import { queryOne, queryAll } from '../db/index.js';

interface SearchOptions {
  accountId: string;
  query: string;
  page?: number;
  limit?: number;
}

interface EmailRecord {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  cc_email: string | null;
  snippet: string | null;
  body: string | null;
  body_html: string | null;
  date: number;
  is_read: number;
  is_starred: number;
  labels: string | null;
  has_attachments: number;
  category_id: string | null;
  topic_id: string | null;
}

type SearchField = 'from' | 'to' | 'cc' | 'subject' | 'body' | 'any';

interface ParsedTerm {
  field: SearchField;
  value: string;
  exclude: boolean;
}

interface ParsedSearch {
  terms: ParsedTerm[];
  afterTs?: number;
  beforeTs?: number;
  hasAttachment?: boolean;
  isRead?: boolean;
}

function parseLabelsJson(labels: string | null): string[] {
  if (!labels) return [];
  try {
    return JSON.parse(labels);
  } catch {
    return [];
  }
}

function formatEmail(email: EmailRecord) {
  return {
    id: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    from: email.from_email,
    fromName: email.from_name,
    to: email.to_email,
    cc: email.cc_email,
    snippet: email.snippet,
    date: email.date,
    isRead: email.is_read,
    isStarred: email.is_starred,
    labels: parseLabelsJson(email.labels),
    hasAttachments: email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  };
}

function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    const token = (m[1] ?? m[2] ?? '').trim();
    if (token) tokens.push(token);
  }
  return tokens;
}

// Naptári dátum (éjfél) Europe/Budapest időzónában, epoch ms-ben.
// A felhasználó "after:2026-06-01" alatt budapesti június 1-jét érti, nem UTC-t.
function budapestMidnightTs(y: number, m: number, d: number): number {
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(utcGuess)) return NaN;
  const asBudapest = new Date(
    new Date(utcGuess).toLocaleString('en-US', { timeZone: 'Europe/Budapest' }),
  );
  const offsetMs = asBudapest.getTime() - utcGuess;
  return utcGuess - offsetMs;
}

function parseDateToTs(raw: string): number | undefined {
  const v = raw.trim();
  if (!v) return undefined;

  const calendarMatch = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(v);
  if (calendarMatch) {
    const [, y, m, d] = calendarMatch;
    const ts = budapestMidnightTs(Number(y), Number(m), Number(d));
    return Number.isNaN(ts) ? undefined : ts;
  }

  const numeric = Number(v);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 2_000_000_000 ? numeric : numeric * 1000;
  }

  return undefined;
}

function parseSearchQuery(query: string): ParsedSearch {
  const rawTokens = tokenizeQuery(query);
  const terms: ParsedTerm[] = [];
  let afterTs: number | undefined;
  let beforeTs: number | undefined;
  let hasAttachment: boolean | undefined;
  let isRead: boolean | undefined;

  for (let token of rawTokens) {
    let exclude = false;
    if (token.startsWith('-') && token.length > 1) {
      exclude = true;
      token = token.slice(1);
    }

    const idx = token.indexOf(':');
    if (idx > 0 && idx < token.length - 1) {
      const key = token.slice(0, idx).toLowerCase();
      const value = token.slice(idx + 1).trim();
      if (!value) continue;

      if (key === 'after') {
        const ts = parseDateToTs(value);
        if (ts) afterTs = ts;
        continue;
      }
      if (key === 'before') {
        const ts = parseDateToTs(value);
        if (ts) beforeTs = ts;
        continue;
      }
      if (key === 'has' && value.toLowerCase() === 'attachment') {
        hasAttachment = !exclude;
        continue;
      }
      if (key === 'is') {
        const v = value.toLowerCase();
        if (v === 'unread') {
          isRead = false;
          continue;
        }
        if (v === 'read') {
          isRead = true;
          continue;
        }
      }

      if (key === 'from' || key === 'to' || key === 'cc' || key === 'subject' || key === 'body') {
        terms.push({ field: key, value, exclude });
        continue;
      }
    }

    terms.push({ field: 'any', value: token, exclude });
  }

  return { terms, afterTs, beforeTs, hasAttachment, isRead };
}

function columnsForField(field: SearchField): string[] {
  switch (field) {
    case 'from':
      return ['from_email', 'from_name'];
    case 'to':
      return ['to_email'];
    case 'cc':
      return ['cc_email'];
    case 'subject':
      return ['subject'];
    case 'body':
      return ['body', 'body_html', 'snippet'];
    default:
      return [
        'subject',
        'from_email',
        'from_name',
        'to_email',
        'cc_email',
        'body',
        'body_html',
        'snippet',
      ];
  }
}

// SQL LIKE speciális karakterek escape-elése, hogy a %, _ literálként keressen.
function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function buildWhereClause(
  accountId: string,
  parsed: ParsedSearch,
): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [accountId];
  // Kanonikus TRASH-szűrő: NULL labels nem kukázott; a JSON-idézőjeles forma
  // nem találja meg tévesen az egyéni "TRASHX" jellegű címkéket.
  const whereParts: string[] = [
    'account_id = ?',
    `(labels IS NULL OR labels NOT LIKE '%"TRASH"%')`,
  ];

  if (typeof parsed.afterTs === 'number') {
    // Gmail-like semantics: strictly newer than date
    whereParts.push('date > ?');
    params.push(parsed.afterTs);
  }
  if (typeof parsed.beforeTs === 'number') {
    // Gmail-like semantics: strictly older than date
    whereParts.push('date < ?');
    params.push(parsed.beforeTs);
  }
  if (typeof parsed.hasAttachment === 'boolean') {
    whereParts.push(parsed.hasAttachment ? 'has_attachments = 1' : 'has_attachments = 0');
  }
  if (typeof parsed.isRead === 'boolean') {
    whereParts.push(parsed.isRead ? 'is_read = 1' : 'is_read = 0');
  }

  for (const term of parsed.terms) {
    const columns = columnsForField(term.field);
    const pattern = `%${escapeLikePattern(term.value)}%`;
    const orParts: string[] = [];

    for (const col of columns) {
      orParts.push(`${col} LIKE ? ESCAPE '\\' COLLATE NOCASE`);
      params.push(pattern);
    }

    const groupSql = `(${orParts.join(' OR ')})`;
    whereParts.push(term.exclude ? `NOT ${groupSql}` : groupSql);
  }

  return { whereSql: whereParts.join(' AND '), params };
}

function relevanceScore(email: EmailRecord, parsed: ParsedSearch): number {
  let score = 0;
  const subject = (email.subject || '').toLowerCase();
  const from = `${email.from_name || ''} ${email.from_email || ''}`.toLowerCase();
  const to = `${email.to_email || ''} ${email.cc_email || ''}`.toLowerCase();
  const body = `${email.snippet || ''} ${email.body || ''} ${email.body_html || ''}`.toLowerCase();

  for (const term of parsed.terms) {
    if (term.exclude) continue;
    const q = term.value.toLowerCase();
    if (!q) continue;

    const exactPhrase = term.value.includes(' ');
    const phraseBoost = exactPhrase ? 2 : 1;

    const matchAndWeight = (text: string, weight: number): number => {
      if (!text.includes(q)) return 0;
      let local = weight * phraseBoost;
      if (text === q) local += 6;
      return local;
    };

    switch (term.field) {
      case 'subject':
        score += matchAndWeight(subject, 8);
        break;
      case 'from':
        score += matchAndWeight(from, 6);
        break;
      case 'to':
      case 'cc':
        score += matchAndWeight(to, 5);
        break;
      case 'body':
        score += matchAndWeight(body, 4);
        break;
      default:
        score += matchAndWeight(subject, 8);
        score += matchAndWeight(from, 6);
        score += matchAndWeight(to, 5);
        score += matchAndWeight(body, 4);
        break;
    }
  }

  if (!email.is_read) score += 1;
  if (email.is_starred) score += 2;

  const ageHours = Math.max(0, (Date.now() - Number(email.date || 0)) / (1000 * 60 * 60));
  if (ageHours <= 24) score += 1;
  if (ageHours <= 6) score += 1;

  return score;
}

function rankAndPaginate(
  results: EmailRecord[],
  parsed: ParsedSearch,
  page: number,
  limit: number,
) {
  const ranked = results
    .map((email) => ({ email, score: relevanceScore(email, parsed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.email.date - a.email.date;
    });

  const total = ranked.length;
  const offset = (page - 1) * limit;
  const pageRows = ranked.slice(offset, offset + limit).map((entry) => entry.email);

  return {
    emails: pageRows,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

// Memória-védelem: a relevancia-rangsorolás JS-ben fut, ezért SQL-szinten
// korlátozzuk a jelöltek számát (legfrissebbek előnyben).
const MAX_SEARCH_CANDIDATES = 2000;

export async function searchEmails(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const parsed = parseSearchQuery(query);
  const { whereSql, params } = buildWhereClause(accountId, parsed);

  const rows = await queryAll<EmailRecord>(
    `SELECT * FROM emails WHERE ${whereSql} ORDER BY date DESC LIMIT ?`,
    [...params, MAX_SEARCH_CANDIDATES],
  );

  const ranked = rankAndPaginate(rows, parsed, page, limit);

  return {
    emails: ranked.emails.map(formatEmail),
    total: ranked.total,
    page,
    totalPages: ranked.totalPages,
  };
}

interface CrossAccountSearchOptions {
  accountIds: string[];
  accountMap: Map<string, { email: string; color: string | null }>;
  query: string;
  limit?: number;
}

export async function searchEmailsAllAccounts(options: CrossAccountSearchOptions) {
  const { accountIds, accountMap, query, limit = 50 } = options;
  const parsed = parseSearchQuery(query);

  const allRows: Array<
    EmailRecord & { accountId: string; accountEmail: string; accountColor: string | null }
  > = [];

  for (const accountId of accountIds) {
    const { whereSql, params } = buildWhereClause(accountId, parsed);
    const rows = await queryAll<EmailRecord>(
      `SELECT * FROM emails WHERE ${whereSql} ORDER BY date DESC LIMIT ?`,
      [...params, MAX_SEARCH_CANDIDATES],
    );

    const accountInfo = accountMap.get(accountId);
    for (const row of rows) {
      allRows.push({
        ...row,
        accountId,
        accountEmail: accountInfo?.email || accountId,
        accountColor: accountInfo?.color || null,
      });
    }
  }

  const rankedAll = allRows
    .map((email) => ({ email, score: relevanceScore(email, parsed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.email.date - a.email.date;
    });

  const total = rankedAll.length;
  const ranked = rankedAll.slice(0, limit).map(({ email }) => ({
    ...formatEmail(email),
    accountId: email.accountId,
    accountEmail: email.accountEmail,
    accountColor: email.accountColor,
  }));

  return {
    emails: ranked,
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
}
