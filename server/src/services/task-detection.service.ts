import crypto from 'crypto';
import { queryAll, queryOne, execute, runInTransaction } from '../db/index.js';
import logger from '../utils/logger.js';

// --- Types ---

export interface DetectedTask {
  id: string;
  accountId: string;
  emailId: string;
  threadId: string | null;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  emailDate: number | null;
  detectionType: string;
  reason: string | null;
  priority: string;
  status: string;
  snoozedUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

interface DetectedTaskRow {
  id: string;
  account_id: string;
  email_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  email_date: number | null;
  detection_type: string;
  reason: string | null;
  priority: string;
  status: string;
  snoozed_until: number | null;
  created_at: number;
  updated_at: number;
}

interface IncomingEmailRow {
  id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  date: number;
}

function rowToDetectedTask(row: DetectedTaskRow): DetectedTask {
  return {
    id: row.id,
    accountId: row.account_id,
    emailId: row.email_id,
    threadId: row.thread_id,
    subject: row.subject,
    fromEmail: row.from_email,
    fromName: row.from_name,
    emailDate: row.email_date,
    detectionType: row.detection_type,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Saját email cím meghatározása az accounts táblából.
 */
function getAccountEmail(accountId: string): string | null {
  const row = queryOne<{ email: string }>('SELECT email FROM accounts WHERE id = ?', [accountId]);
  return row?.email ?? null;
}

/**
 * Megválaszolatlan emailek felismerése és detected_tasks létrehozása.
 *
 * Logika:
 * 1. Bejövő emailek az elmúlt N napból (olvasott, nem tőlünk)
 * 2. Thread alapú ellenőrzés: küldtünk-e választ az adott thread-ben
 * 3. Ha nem → detected_task (unanswered)
 * 4. Prioritás: 7+ nap = high, 3-7 = medium, 1-3 = low
 * 5. Duplikátum elkerülés email_id alapján
 */
export function detectUnansweredEmails(accountId: string, daysBack: number = 30): DetectedTask[] {
  const accountEmail = getAccountEmail(accountId);
  if (!accountEmail) {
    logger.warn(`Task detection: no email found for account ${accountId}`);
    return [];
  }

  const now = Date.now();
  const sinceDate = now - daysBack * 24 * 60 * 60 * 1000;
  // Skip emails newer than 1 day — give time to respond
  const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

  // 1. Bejövő emailek: olvasott, nem tőlünk, elmúlt N nap, legalább 1 naposak
  const incomingEmails = queryAll<IncomingEmailRow>(
    `SELECT id, thread_id, subject, from_email, from_name, date
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND date <= ?
       AND from_email != ?
       AND is_read = 1
     ORDER BY date DESC`,
    [accountId, sinceDate, oneDayAgo, accountEmail],
  );

  const newTasks: DetectedTask[] = [];

  for (const email of incomingEmails) {
    // 5. Duplikátum elkerülés — ha már van detected_task erre az email_id-re → skip
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM detected_tasks WHERE email_id = ? AND account_id = ?',
      [email.id, accountId],
    );
    if (existing) continue;

    // 2. Thread alapú válasz detekció
    let hasReply = false;
    if (email.thread_id) {
      const reply = queryOne<{ id: string }>(
        `SELECT id FROM emails
         WHERE thread_id = ?
           AND account_id = ?
           AND from_email = ?
           AND date > ?
         LIMIT 1`,
        [email.thread_id, accountId, accountEmail, email.date],
      );
      hasReply = !!reply;
    }

    // 3. Ha NINCS válasz → detected_task
    if (!hasReply) {
      const daysSinceEmail = Math.floor((now - email.date) / (24 * 60 * 60 * 1000));

      // 4. Prioritás meghatározás
      let priority: string;
      if (daysSinceEmail >= 7) {
        priority = 'high';
      } else if (daysSinceEmail >= 3) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      const reason = `Nem válaszoltál rá ${daysSinceEmail} napja`;
      const id = crypto.randomUUID();
      const taskNow = Date.now();

      execute(
        `INSERT INTO detected_tasks (id, account_id, email_id, thread_id, subject, from_email, from_name, email_date, detection_type, reason, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unanswered', ?, ?, 'open', ?, ?)`,
        [
          id,
          accountId,
          email.id,
          email.thread_id,
          email.subject,
          email.from_email,
          email.from_name,
          email.date,
          reason,
          priority,
          taskNow,
          taskNow,
        ],
      );

      newTasks.push({
        id,
        accountId,
        emailId: email.id,
        threadId: email.thread_id,
        subject: email.subject,
        fromEmail: email.from_email,
        fromName: email.from_name,
        emailDate: email.date,
        detectionType: 'unanswered',
        reason,
        priority,
        status: 'open',
        snoozedUntil: null,
        createdAt: taskNow,
        updatedAt: taskNow,
      });
    }
  }

  if (newTasks.length > 0) {
    logger.info(`Task detection: found ${newTasks.length} unanswered emails for account ${accountId}`);
  }

  // Meglévő open taskok prioritás frissítése
  const openTasks = queryAll<{ id: string; email_date: number | null }>(
    "SELECT id, email_date FROM detected_tasks WHERE account_id = ? AND status = 'open'",
    [accountId],
  );
  for (const task of openTasks) {
    if (task.email_date == null) continue;
    const daysSince = Math.floor((Date.now() - task.email_date) / 86400000);
    const newPriority = daysSince >= 7 ? 'high' : daysSince >= 3 ? 'medium' : 'low';
    execute('UPDATE detected_tasks SET priority = ?, updated_at = ? WHERE id = ?', [
      newPriority,
      Date.now(),
      task.id,
    ]);
  }

  return newTasks;
}

/**
 * Detected taskok listázása. Szűrés status + priority alapján, dátum DESC.
 */
export function getDetectedTasks(
  accountId: string,
  options: { status?: string; priority?: string; page?: number; limit?: number } = {},
): { tasks: DetectedTask[]; total: number } {
  const { status = 'open', priority, page = 1, limit = 50 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (Math.max(1, page) - 1) * safeLimit;

  let whereClauses = 'account_id = ? AND status = ?';
  const params: unknown[] = [accountId, status];

  if (priority) {
    whereClauses += ' AND priority = ?';
    params.push(priority);
  }

  const countResult = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM detected_tasks WHERE ${whereClauses}`,
    params,
  );
  const total = countResult?.total ?? 0;

  const rows = queryAll<DetectedTaskRow>(
    `SELECT * FROM detected_tasks WHERE ${whereClauses} ORDER BY email_date DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset],
  );

  return {
    tasks: rows.map(rowToDetectedTask),
    total,
  };
}

/**
 * Task status frissítés + ownership check.
 */
export function updateDetectedTaskStatus(
  taskId: string,
  accountId: string,
  newStatus: string,
  snoozedUntil?: number,
): boolean {
  const validStatuses = ['open', 'done', 'dismissed', 'snoozed'];
  if (!validStatuses.includes(newStatus)) {
    return false;
  }

  const existing = queryOne<{ id: string }>(
    'SELECT id FROM detected_tasks WHERE id = ? AND account_id = ?',
    [taskId, accountId],
  );
  if (!existing) return false;

  execute(
    'UPDATE detected_tasks SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ? AND account_id = ?',
    [newStatus, snoozedUntil ?? null, Date.now(), taskId, accountId],
  );
  return true;
}

/**
 * Task törlés + ownership check.
 */
export function deleteDetectedTask(taskId: string, accountId: string): boolean {
  const existing = queryOne<{ id: string }>(
    'SELECT id FROM detected_tasks WHERE id = ? AND account_id = ?',
    [taskId, accountId],
  );
  if (!existing) return false;

  execute('DELETE FROM detected_tasks WHERE id = ? AND account_id = ?', [taskId, accountId]);
  return true;
}

/**
 * Statisztika az open taskok számáról prioritás szerint.
 */
export function getTaskStats(accountId: string): {
  open: number;
  high: number;
  medium: number;
  low: number;
} {
  const openResult = queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open'",
    [accountId],
  );
  const highResult = queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open' AND priority = 'high'",
    [accountId],
  );
  const mediumResult = queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open' AND priority = 'medium'",
    [accountId],
  );
  const lowResult = queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open' AND priority = 'low'",
    [accountId],
  );

  return {
    open: openResult?.total ?? 0,
    high: highResult?.total ?? 0,
    medium: mediumResult?.total ?? 0,
    low: lowResult?.total ?? 0,
  };
}

/**
 * Snoozed taskok feloldása — ha snoozed_until lejárt, visszaállítjuk 'open'-re.
 */
export function processExpiredSnoozedTasks(): number {
  const now = Date.now();
  const expired = queryAll<{ id: string }>(
    "SELECT id FROM detected_tasks WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?",
    [now],
  );

  for (const task of expired) {
    execute(
      "UPDATE detected_tasks SET status = 'open', snoozed_until = NULL, updated_at = ? WHERE id = ?",
      [now, task.id],
    );
  }

  if (expired.length > 0) {
    logger.info(`Task detection: unsnoozed ${expired.length} tasks`);
  }

  return expired.length;
}
