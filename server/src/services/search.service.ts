import { queryOne, queryAll } from '../db/index.js';
import { getDb } from '../db/index.js';

interface SearchOptions {
  accountId: string;
  query: string;
  page?: number;
  limit?: number;
}

export function searchEmails(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  try {
    const ftsResults = queryAll(
      `SELECT e.*
       FROM emails_fts fts
       JOIN emails e ON e.rowid = fts.rowid
       WHERE emails_fts MATCH ?
       AND e.account_id = ?
       ORDER BY e.date DESC
       LIMIT ? OFFSET ?`,
      [query, accountId, limit, offset],
    );

    const countResult = queryOne<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM emails_fts fts
       JOIN emails e ON e.rowid = fts.rowid
       WHERE emails_fts MATCH ?
       AND e.account_id = ?`,
      [query, accountId],
    );

    return {
      emails: ftsResults,
      total: countResult?.total || 0,
      page,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    };
  } catch {
    return searchEmailsLike(options);
  }
}

function searchEmailsLike(options: SearchOptions) {
  const { accountId, query, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;
  const pattern = `%${query}%`;

  const results = queryAll(
    `SELECT * FROM emails
     WHERE account_id = ?
     AND (subject LIKE ? OR from_email LIKE ? OR from_name LIKE ? OR body LIKE ? OR snippet LIKE ?)
     ORDER BY date DESC
     LIMIT ? OFFSET ?`,
    [accountId, pattern, pattern, pattern, pattern, pattern, limit, offset],
  );

  return {
    emails: results,
    total: results.length,
    page,
    totalPages: 1,
  };
}

export function indexEmailForSearch(emailId: string) {
  try {
    const email = queryOne('SELECT * FROM emails WHERE id = ?', [emailId]);

    if (email) {
      const db = getDb();
      db.run(
        `INSERT INTO emails_fts(rowid, subject, from_email, from_name, body, snippet)
         SELECT rowid, subject, from_email, from_name, body, snippet
         FROM emails WHERE id = ?`,
        [emailId],
      );
    }
  } catch {
    // FTS index hiba - nem kritikus
  }
}
