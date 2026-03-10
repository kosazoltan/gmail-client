import { queryOne, queryAll, execute, getPool } from '../db/index.js';
import logger from '../utils/logger.js';

// Statisztikák interfész
export interface DatabaseStats {
  totalEmails: number;
  totalContacts: number;
  totalAttachments: number;
  totalCategories: number;
  totalSenderGroups: number;
  totalTopics: number;
  databaseSizeBytes: number;
  oldestEmail: number | null;
  newestEmail: number | null;
  emailsByAccount: Array<{ accountId: string; email: string; count: number }>;
}

// Email lista interfész
export interface EmailListItem {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  date: number;
  is_read: number;
  has_attachments: number;
  body_size: number;
}

// Safe count helper — returns 0 ONLY if table doesn't exist (schema not ready yet)
// Rethrows on connection errors so /stats correctly returns 500 when DB is down
async function safeCount(sql: string, params: unknown[]): Promise<number> {
  try {
    const result = await queryOne<{ count: number }>(sql, params);
    return Number(result?.count ?? 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such table|relation .* does not exist|undefined table/i.test(msg)) {
      logger.warn('safeCount: table missing (schema not ready):', { sql, error: msg });
      return 0;
    }
    // DB connection error, timeout, permission error → rethrow → /stats returns 500
    throw err;
  }
}

// Adatbázis statisztikák lekérése
export async function getDatabaseStats(accountId?: string): Promise<DatabaseStats> {
  const accountFilter = accountId ? 'WHERE account_id = ?' : '';
  const params = accountId ? [accountId] : [];

  const [totalEmails, totalContacts, totalAttachments, totalCategories, totalSenderGroups, totalTopics] =
    await Promise.all([
      safeCount(`SELECT COUNT(*) as count FROM emails ${accountFilter}`, params),
      safeCount(`SELECT COUNT(*) as count FROM contacts ${accountFilter}`, params),
      safeCount(
        `SELECT COUNT(*) as count FROM attachments a ${accountId ? 'JOIN emails e ON a.email_id = e.id WHERE e.account_id = ?' : ''}`,
        params,
      ),
      safeCount(`SELECT COUNT(*) as count FROM categories ${accountFilter}`, params),
      safeCount(`SELECT COUNT(*) as count FROM sender_groups ${accountFilter}`, params),
      safeCount(`SELECT COUNT(*) as count FROM topics ${accountFilter}`, params),
    ]);

  let oldestEmailDate: number | null = null;
  let newestEmailDate: number | null = null;
  try {
    const oldest = await queryOne<{ date: number | null }>(
      `SELECT MIN(date) as date FROM emails ${accountFilter}`,
      params,
    );
    oldestEmailDate = oldest?.date || null;
    const newest = await queryOne<{ date: number | null }>(
      `SELECT MAX(date) as date FROM emails ${accountFilter}`,
      params,
    );
    newestEmailDate = newest?.date || null;
  } catch (err) {
    logger.warn('Database stats: failed to get email date range', { accountId, error: err });
  }

  // Emailek fiókonként - csak a kért accountId-t mutatjuk, ha meg van adva
  let emailsByAccountRaw: Array<{ account_id: string; email: string; count: number }> = [];
  try {
    if (accountId) {
      emailsByAccountRaw = await queryAll<{ account_id: string; email: string; count: number }>(
        `SELECT e.account_id, a.email, COUNT(*) as count
         FROM emails e
         JOIN accounts a ON e.account_id = a.id
         WHERE e.account_id = ?
         GROUP BY e.account_id`,
        [accountId],
      );
    }
  } catch (err) {
    logger.warn('Database stats: failed to get emails by account', { accountId, error: err });
  }

  // Adatbázis méret (PostgreSQL)
  let databaseSizeBytes = 0;
  try {
    const pool = getPool();
    const sizeResult = await pool.query("SELECT pg_database_size(current_database()) as size");
    databaseSizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
  } catch (err) {
    logger.warn('Database stats: failed to get database size', { error: err });
  }

  return {
    totalEmails,
    totalContacts,
    totalAttachments,
    totalCategories,
    totalSenderGroups,
    totalTopics,
    databaseSizeBytes,
    oldestEmail: oldestEmailDate,
    newestEmail: newestEmailDate,
    emailsByAccount: emailsByAccountRaw.map((row) => ({
      accountId: row.account_id,
      email: row.email,
      count: row.count,
    })),
  };
}

// Emailek listázása (adatbázis kezelőhöz)
export async function listEmailsForManager(
  accountId: string,
  options: {
    page?: number;
    limit?: number;
    sortBy?: 'date' | 'from' | 'subject' | 'size';
    sortOrder?: 'asc' | 'desc';
    search?: string;
    dateFrom?: number;
    dateTo?: number;
    hasAttachments?: boolean;
    isRead?: boolean;
  } = {},
): Promise<{ emails: EmailListItem[]; total: number; page: number; totalPages: number }> {
  const {
    page = 1,
    limit = 50,
    sortBy = 'date',
    sortOrder = 'desc',
    search,
    dateFrom,
    dateTo,
    hasAttachments,
    isRead,
  } = options;

  const conditions: string[] = ['account_id = ?'];
  const params: unknown[] = [accountId];

  if (search) {
    conditions.push('(subject LIKE ? OR from_email LIKE ? OR from_name LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (dateFrom) {
    conditions.push('date >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('date <= ?');
    params.push(dateTo);
  }

  if (hasAttachments !== undefined) {
    conditions.push('has_attachments = ?');
    params.push(hasAttachments ? 1 : 0);
  }

  if (isRead !== undefined) {
    conditions.push('is_read = ?');
    params.push(isRead ? 1 : 0);
  }

  const whereClause = conditions.join(' AND ');

  // Sortolás
  const sortColumnMap: Record<string, string> = {
    date: 'date',
    from: 'from_email',
    subject: 'subject',
    size: "LENGTH(COALESCE(body, '')) + LENGTH(COALESCE(body_html, ''))",
  };
  const sortColumn = sortColumnMap[sortBy] || 'date';

  const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Összes szám
  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails WHERE ${whereClause}`,
    params,
  );
  const total = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Emailek lekérése
  const emails = await queryAll<EmailListItem>(
    `SELECT
      id, subject, from_email, from_name, to_email, date, is_read, has_attachments,
      (LENGTH(COALESCE(body, '')) + LENGTH(COALESCE(body_html, ''))) as body_size
     FROM emails
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { emails, total, page, totalPages };
}

// Emailek törlése (batch)
export async function deleteEmails(accountId: string, emailIds: string[]): Promise<number> {
  if (emailIds.length === 0) return 0;

  let deletedCount = 0;
  for (const emailId of emailIds) {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (existing) {
      // Email törlése — ON DELETE CASCADE automatikusan törli:
      // attachments, action_items, snoozed_emails, reminders,
      // pinned_emails, detected_tasks, email_categories
      // workflow_runs.trigger_email_id → SET NULL
      await execute('DELETE FROM emails WHERE id = ?', [emailId]);
      deletedCount++;
    }
  }

  return deletedCount;
}

// Emailek törlése időszak alapján
export async function deleteEmailsByDateRange(
  accountId: string,
  dateFrom: number,
  dateTo: number,
): Promise<number> {
  // Először az email id-ket gyűjtjük össze
  const emails = await queryAll<{ id: string }>(
    'SELECT id FROM emails WHERE account_id = ? AND date >= ? AND date <= ?',
    [accountId, dateFrom, dateTo],
  );

  if (emails.length === 0) return 0;

  // Emailek törlése — ON DELETE CASCADE automatikusan törli az összes függő rekordot
  await execute(`DELETE FROM emails WHERE account_id = ? AND date >= ? AND date <= ?`, [
    accountId,
    dateFrom,
    dateTo,
  ]);

  return emails.length;
}

// Backup nem elérhető Neon PostgreSQL-nél — a platform kezeli
export async function createBackup(): Promise<{ filename: string; path: string; size: number }> {
  throw new Error('Backup not available for Neon PostgreSQL — managed by the platform.');
}

// Backup-ok listázása — Neon PostgreSQL platform kezeli
export function listBackups(): Array<{
  filename: string;
  path: string;
  size: number;
  createdAt: number;
}> {
  // Neon PostgreSQL: backups managed by the platform
  return [];
}

// Backup törlése — Neon PostgreSQL platform kezeli
export function deleteBackup(_filename: string): boolean {
  return false;
}

// Adatbázis tömörítés (VACUUM)
export async function vacuumDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query('VACUUM');
}

// Régi emailek törlése (pl. 1 évnél régebbiek)
export async function deleteOldEmails(accountId: string, olderThanDays: number): Promise<number> {
  const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const emails = await queryAll<{ id: string }>(
    'SELECT id FROM emails WHERE account_id = ? AND date < ?',
    [accountId, cutoffDate],
  );

  if (emails.length === 0) return 0;

  const emailIds = emails.map((e) => e.id);
  const placeholders = emailIds.map(() => '?').join(',');

  await execute(`DELETE FROM attachments WHERE email_id IN (${placeholders})`, emailIds);
  await execute('DELETE FROM emails WHERE account_id = ? AND date < ?', [accountId, cutoffDate]);

  return emails.length;
}

// Árva rekordok törlése (kontaktok, témák, stb. amikhez nincs email)
export async function cleanupOrphanedRecords(): Promise<{ topics: number; senderGroups: number }> {
  // Üres témák törlése
  await execute(
    `DELETE FROM topics WHERE id NOT IN (SELECT DISTINCT topic_id FROM emails WHERE topic_id IS NOT NULL)`,
  );

  // Üres küldő csoportok törlése
  await execute(
    `DELETE FROM sender_groups WHERE email NOT IN (SELECT DISTINCT from_email FROM emails WHERE from_email IS NOT NULL)`,
  );

  return {
    topics: 0, // TODO: use changes() for affected rows count
    senderGroups: 0,
  };
}
