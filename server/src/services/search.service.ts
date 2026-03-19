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

const SEARCH_QUERY = `SELECT * FROM emails
     WHERE account_id = ?
     AND labels NOT LIKE '%TRASH%'
     AND (
       subject LIKE ? COLLATE NOCASE OR
       from_email LIKE ? COLLATE NOCASE OR
       from_name LIKE ? COLLATE NOCASE OR
       to_email LIKE ? COLLATE NOCASE OR
       cc_email LIKE ? COLLATE NOCASE OR
       body LIKE ? COLLATE NOCASE OR
       body_html LIKE ? COLLATE NOCASE OR
       snippet LIKE ? COLLATE NOCASE
     )`;

const COUNT_QUERY = `SELECT COUNT(*) as total FROM emails
     WHERE account_id = ?
     AND labels NOT LIKE '%TRASH%'
     AND (
       subject LIKE ? COLLATE NOCASE OR
       from_email LIKE ? COLLATE NOCASE OR
       from_name LIKE ? COLLATE NOCASE OR
       to_email LIKE ? COLLATE NOCASE OR
       cc_email LIKE ? COLLATE NOCASE OR
       body LIKE ? COLLATE NOCASE OR
       body_html LIKE ? COLLATE NOCASE OR
       snippet LIKE ? COLLATE NOCASE
     )`;

export async function searchEmails(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;
  const pattern = `%${query}%`;

  const results = await queryAll<EmailRecord>(
    SEARCH_QUERY + ' ORDER BY date DESC LIMIT ? OFFSET ?',
    [accountId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, limit, offset],
  );

  const countResult = await queryOne<{ total: number }>(
    COUNT_QUERY,
    [accountId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern],
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
  const pattern = `%${query}%`;

  // Collect results from all accounts
  const allResults: Array<ReturnType<typeof formatEmail> & {
    accountId: string;
    accountEmail: string;
    accountColor: string | null;
  }> = [];

  let totalCount = 0;

  for (const accountId of accountIds) {
    // Count per account
    const countResult = await queryOne<{ total: number }>(
      COUNT_QUERY,
      [accountId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern],
    );
    totalCount += countResult?.total || 0;

    // Fetch up to limit per account (we'll sort and trim later)
    const results = await queryAll<EmailRecord>(
      SEARCH_QUERY + ' ORDER BY date DESC LIMIT ?',
      [accountId, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, limit],
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

  // Sort all results by date DESC and take only `limit`
  allResults.sort((a, b) => b.date - a.date);
  const trimmed = allResults.slice(0, limit);

  return {
    emails: trimmed,
    total: totalCount,
    page: 1,
    totalPages: Math.ceil(totalCount / limit),
  };
}
