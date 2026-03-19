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

function parseSearchQuery(query: string): ParsedTerm[] {
  const rawTokens = tokenizeQuery(query);
  const terms: ParsedTerm[] = [];

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

      if (key === 'from' || key === 'to' || key === 'cc' || key === 'subject' || key === 'body') {
        terms.push({ field: key, value, exclude });
        continue;
      }
    }

    terms.push({ field: 'any', value: token, exclude });
  }

  return terms;
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
    case 'any':
    default:
      return ['subject', 'from_email', 'from_name', 'to_email', 'cc_email', 'body', 'body_html', 'snippet'];
  }
}

function buildWhereClause(accountId: string, query: string): { whereSql: string; params: unknown[] } {
  const terms = parseSearchQuery(query);
  const params: unknown[] = [accountId];
  const whereParts: string[] = [
    'account_id = ?',
    "labels NOT LIKE '%TRASH%'",
  ];

  for (const term of terms) {
    const columns = columnsForField(term.field);
    const pattern = `%${term.value}%`;
    const orParts: string[] = [];

    for (const col of columns) {
      orParts.push(`${col} LIKE ? COLLATE NOCASE`);
      params.push(pattern);
    }

    const groupSql = `(${orParts.join(' OR ')})`;
    whereParts.push(term.exclude ? `NOT ${groupSql}` : groupSql);
  }

  return {
    whereSql: whereParts.join(' AND '),
    params,
  };
}

export async function searchEmails(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const { whereSql, params } = buildWhereClause(accountId, query);

  const results = await queryAll<EmailRecord>(
    `SELECT * FROM emails WHERE ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const countResult = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM emails WHERE ${whereSql}`,
    params,
  );

  return {
    emails: results.map(formatEmail),
    total: countResult?.total || 0,
    page,
    totalPages: Math.ceil((countResult?.total || 0) / limit),
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

  const allResults: Array<ReturnType<typeof formatEmail> & {
    accountId: string;
    accountEmail: string;
    accountColor: string | null;
  }> = [];

  let totalCount = 0;

  for (const accountId of accountIds) {
    const { whereSql, params } = buildWhereClause(accountId, query);

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM emails WHERE ${whereSql}`,
      params,
    );
    totalCount += countResult?.total || 0;

    const results = await queryAll<EmailRecord>(
      `SELECT * FROM emails WHERE ${whereSql} ORDER BY date DESC LIMIT ?`,
      [...params, limit],
    );

    const accountInfo = accountMap.get(accountId);
    for (const row of results) {
      allResults.push({
        ...formatEmail(row),
        accountId,
        accountEmail: accountInfo?.email || accountId,
        accountColor: accountInfo?.color || null,
      });
    }
  }

  allResults.sort((a, b) => b.date - a.date);
  const trimmed = allResults.slice(0, limit);

  return {
    emails: trimmed,
    total: totalCount,
    page: 1,
    totalPages: Math.ceil(totalCount / limit),
  };
}
