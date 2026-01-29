import { queryOne, queryAll, execute, getDb, saveDatabase } from '../db/index.js';
import fs from 'fs';
import path from 'path';

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

// Adatbázis statisztikák lekérése
export function getDatabaseStats(accountId?: string): DatabaseStats {
  const accountFilter = accountId ? 'WHERE account_id = ?' : '';
  const params = accountId ? [accountId] : [];

  const emailCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails ${accountFilter}`,
    params
  );

  const contactCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM contacts ${accountFilter}`,
    params
  );

  const attachmentCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM attachments a
     ${accountId ? 'JOIN emails e ON a.email_id = e.id WHERE e.account_id = ?' : ''}`,
    params
  );

  const categoryCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM categories ${accountFilter}`,
    params
  );

  const senderGroupCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sender_groups ${accountFilter}`,
    params
  );

  const topicCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM topics ${accountFilter}`,
    params
  );

  const oldestEmail = queryOne<{ date: number | null }>(
    `SELECT MIN(date) as date FROM emails ${accountFilter}`,
    params
  );

  const newestEmail = queryOne<{ date: number | null }>(
    `SELECT MAX(date) as date FROM emails ${accountFilter}`,
    params
  );

  // Emailek fiókonként
  const emailsByAccountRaw = queryAll<{ account_id: string; email: string; count: number }>(
    `SELECT e.account_id, a.email, COUNT(*) as count
     FROM emails e
     JOIN accounts a ON e.account_id = a.id
     GROUP BY e.account_id`
  );

  // Adatbázis méret
  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  let databaseSizeBytes = 0;
  try {
    if (fs.existsSync(dbPath)) {
      databaseSizeBytes = fs.statSync(dbPath).size;
    }
  } catch {
    // Ignore
  }

  return {
    totalEmails: emailCount?.count || 0,
    totalContacts: contactCount?.count || 0,
    totalAttachments: attachmentCount?.count || 0,
    totalCategories: categoryCount?.count || 0,
    totalSenderGroups: senderGroupCount?.count || 0,
    totalTopics: topicCount?.count || 0,
    databaseSizeBytes,
    oldestEmail: oldestEmail?.date || null,
    newestEmail: newestEmail?.date || null,
    emailsByAccount: emailsByAccountRaw.map(row => ({
      accountId: row.account_id,
      email: row.email,
      count: row.count,
    })),
  };
}

// Emailek listázása (adatbázis kezelőhöz)
export function listEmailsForManager(
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
  } = {}
): { emails: EmailListItem[]; total: number; page: number; totalPages: number } {
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
  const sortColumn = {
    date: 'date',
    from: 'from_email',
    subject: 'subject',
    size: 'LENGTH(COALESCE(body, \'\')) + LENGTH(COALESCE(body_html, \'\'))',
  }[sortBy];

  const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Összes szám
  const countResult = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails WHERE ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Emailek lekérése
  const emails = queryAll<EmailListItem>(
    `SELECT
      id, subject, from_email, from_name, to_email, date, is_read, has_attachments,
      (LENGTH(COALESCE(body, '')) + LENGTH(COALESCE(body_html, ''))) as body_size
     FROM emails
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { emails, total, page, totalPages };
}

// Emailek törlése (batch)
export function deleteEmails(accountId: string, emailIds: string[]): number {
  if (emailIds.length === 0) return 0;

  let deletedCount = 0;
  for (const emailId of emailIds) {
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId]
    );

    if (existing) {
      // Csatolmányok törlése
      execute('DELETE FROM attachments WHERE email_id = ?', [emailId]);
      // Email törlése
      execute('DELETE FROM emails WHERE id = ?', [emailId]);
      deletedCount++;
    }
  }

  return deletedCount;
}

// Emailek törlése időszak alapján
export function deleteEmailsByDateRange(
  accountId: string,
  dateFrom: number,
  dateTo: number
): number {
  // Először az email id-ket gyűjtjük össze
  const emails = queryAll<{ id: string }>(
    'SELECT id FROM emails WHERE account_id = ? AND date >= ? AND date <= ?',
    [accountId, dateFrom, dateTo]
  );

  if (emails.length === 0) return 0;

  const emailIds = emails.map((e) => e.id);

  // Csatolmányok törlése
  const placeholders = emailIds.map(() => '?').join(',');
  execute(`DELETE FROM attachments WHERE email_id IN (${placeholders})`, emailIds);

  // Emailek törlése
  execute(
    `DELETE FROM emails WHERE account_id = ? AND date >= ? AND date <= ?`,
    [accountId, dateFrom, dateTo]
  );

  return emails.length;
}

// Adatbázis backup létrehozása
export function createBackup(): { filename: string; path: string; size: number } {
  saveDatabase(); // Először mentés

  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.join(path.dirname(dbPath), 'backups');

  // Backup könyvtár létrehozása
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `gmail-client-backup-${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFilename);

  // Adatbázis másolása
  fs.copyFileSync(dbPath, backupPath);

  const size = fs.statSync(backupPath).size;

  return { filename: backupFilename, path: backupPath, size };
}

// Backup-ok listázása
export function listBackups(): Array<{ filename: string; path: string; size: number; createdAt: number }> {
  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.join(path.dirname(dbPath), 'backups');

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir);
  return files
    .filter((f) => f.endsWith('.db'))
    .map((filename) => {
      const filePath = path.join(backupDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.mtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Backup törlése
export function deleteBackup(filename: string): boolean {
  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  const backupPath = path.join(backupDir, filename);

  // Biztonsági ellenőrzés - csak .db fájlok a backup könyvtárból
  if (!filename.endsWith('.db') || !backupPath.startsWith(backupDir)) {
    return false;
  }

  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
    return true;
  }

  return false;
}

// Adatbázis tömörítés (VACUUM)
export function vacuumDatabase(): void {
  const db = getDb();
  db.run('VACUUM');
  saveDatabase();
}

// Régi emailek törlése (pl. 1 évnél régebbiek)
export function deleteOldEmails(accountId: string, olderThanDays: number): number {
  const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const emails = queryAll<{ id: string }>(
    'SELECT id FROM emails WHERE account_id = ? AND date < ?',
    [accountId, cutoffDate]
  );

  if (emails.length === 0) return 0;

  const emailIds = emails.map((e) => e.id);
  const placeholders = emailIds.map(() => '?').join(',');

  execute(`DELETE FROM attachments WHERE email_id IN (${placeholders})`, emailIds);
  execute('DELETE FROM emails WHERE account_id = ? AND date < ?', [accountId, cutoffDate]);

  return emails.length;
}

// Árva rekordok törlése (kontaktok, témák, stb. amikhez nincs email)
export function cleanupOrphanedRecords(): { topics: number; senderGroups: number } {
  // Üres témák törlése
  execute(
    `DELETE FROM topics WHERE id NOT IN (SELECT DISTINCT topic_id FROM emails WHERE topic_id IS NOT NULL)`
  );

  // Üres küldő csoportok törlése
  execute(
    `DELETE FROM sender_groups WHERE email NOT IN (SELECT DISTINCT from_email FROM emails WHERE from_email IS NOT NULL)`
  );

  return {
    topics: 0, // sql.js nem ad vissza affected rows-t
    senderGroups: 0,
  };
}
