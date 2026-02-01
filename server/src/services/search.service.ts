import { queryOne, queryAll } from '../db/index.js';

interface SearchOptions {
  accountId: string;
  query: string;
  page?: number;
  limit?: number;
}

export function searchEmails(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  // LIKE alapú keresés - sql.js nem támogatja az FTS5-öt
  // COLLATE NOCASE használata a case-insensitive kereséshez
  const pattern = `%${query}%`;

  const results = queryAll(
    `SELECT * FROM emails
     WHERE account_id = ?
     AND (
       subject LIKE ? COLLATE NOCASE OR
       from_email LIKE ? COLLATE NOCASE OR
       from_name LIKE ? COLLATE NOCASE OR
       body LIKE ? COLLATE NOCASE OR
       snippet LIKE ? COLLATE NOCASE
     )
     ORDER BY date DESC
     LIMIT ? OFFSET ?`,
    [accountId, pattern, pattern, pattern, pattern, pattern, limit, offset],
  );

  const countResult = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM emails
     WHERE account_id = ?
     AND (
       subject LIKE ? COLLATE NOCASE OR
       from_email LIKE ? COLLATE NOCASE OR
       from_name LIKE ? COLLATE NOCASE OR
       body LIKE ? COLLATE NOCASE OR
       snippet LIKE ? COLLATE NOCASE
     )`,
    [accountId, pattern, pattern, pattern, pattern, pattern],
  );

  return {
    emails: results,
    total: countResult?.total || 0,
    page,
    totalPages: Math.ceil((countResult?.total || 0) / limit),
  };
}

