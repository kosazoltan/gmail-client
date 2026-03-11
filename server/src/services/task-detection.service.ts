import crypto from 'crypto';
import { queryAll, queryOne, execute, runInTransaction } from '../db/index.js';
import logger from '../utils/logger.js';
import { assessEmailTaskRelevance } from './task-relevance.service.js';

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
  is_read: number;
  snippet?: string | null;
  labels?: string | null;
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
async function getAccountEmail(accountId: string): Promise<string | null> {
  const row = await queryOne<{ email: string }>('SELECT email FROM accounts WHERE id = ?', [accountId]);
  return row?.email ?? null;
}

function inferImmediatePriority(email: { subject: string | null; snippet?: string | null; date: number }): string {
  const combined = `${email.subject || ''} ${email.snippet || ''}`.toLowerCase();
  if (/(sürgős|urgent|azonnal|asap|határidő|deadline|kritikus)/i.test(combined)) return 'high';
  const ageHours = (Date.now() - email.date) / (60 * 60 * 1000);
  if (ageHours >= 72) return 'medium';
  return 'low';
}

async function dismissIrrelevantDetectedTasks(accountId: string): Promise<number> {
  const rows = await queryAll<Array<DetectedTaskRow & IncomingEmailRow>[number]>(
    `SELECT
       dt.id,
       dt.account_id,
       dt.email_id,
       dt.thread_id,
       dt.subject,
       dt.from_email,
       dt.from_name,
       dt.email_date,
       dt.detection_type,
       dt.reason,
       dt.priority,
       dt.status,
       dt.snoozed_until,
       dt.created_at,
       dt.updated_at,
       e.snippet,
       e.labels,
       e.date,
       e.is_read
     FROM detected_tasks dt
     JOIN emails e ON e.id = dt.email_id AND e.account_id = dt.account_id
     WHERE dt.account_id = ? AND dt.status = 'open'`,
    [accountId],
  );

  let dismissed = 0;
  for (const row of rows) {
    const relevance = assessEmailTaskRelevance({
      fromEmail: row.from_email,
      fromName: row.from_name,
      subject: row.subject,
      snippet: row.snippet,
      labels: row.labels,
    });
    if (!relevance.isRelevant) {
      await execute(
        "UPDATE detected_tasks SET status = 'dismissed', reason = ?, updated_at = ? WHERE id = ? AND account_id = ?",
        ['Automatikusan kizárva: nem feladatjellegű promóciós vagy rendszerértesítő email.', Date.now(), row.id, accountId],
      );
      dismissed++;
    }
  }

  return dismissed;
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
export async function detectUnansweredEmails(accountId: string, daysBack: number = 30): Promise<DetectedTask[]> {
  const accountEmail = await getAccountEmail(accountId);
  if (!accountEmail) {
    logger.warn(`Task detection: no email found for account ${accountId}`);
    return [];
  }

  const now = Date.now();
  const sinceDate = now - daysBack * 24 * 60 * 60 * 1000;
  // Skip emails newer than 1 day — give time to respond
  const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

  // 1. Bejövő emailek: nem tőlünk, elmúlt N nap, legalább 1 naposak (olvasott + olvasatlan)
  const incomingEmails = await queryAll<IncomingEmailRow>(
    `SELECT id, thread_id, subject, from_email, from_name, date, is_read, snippet, labels
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND date <= ?
       AND from_email != ?
     ORDER BY date DESC`,
    [accountId, sinceDate, oneDayAgo, accountEmail],
  );

  const newTasks: DetectedTask[] = [];
  let irrelevantSkipped = 0;

  for (const email of incomingEmails) {
    const relevance = assessEmailTaskRelevance({
      fromEmail: email.from_email,
      fromName: email.from_name,
      subject: email.subject,
      snippet: email.snippet,
      labels: email.labels,
    });
    if (!relevance.isRelevant) {
      irrelevantSkipped++;
      continue;
    }

    // 5. Duplikátum elkerülés — ha már van detected_task erre az email_id-re → skip
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM detected_tasks WHERE email_id = ? AND account_id = ?',
      [email.id, accountId],
    );
    if (existing) continue;

    // 2. Thread alapú válasz detekció
    let hasReply = false;
    if (email.thread_id) {
      const reply = await queryOne<{ id: string }>(
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

    // 3. Ha olvasatlan VAGY nincs válasz → detected_task
    const isUnread = email.is_read === 0;
    if (isUnread || !hasReply) {
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

      // DetectionType: olvasatlan vs megválaszolatlan
      const detectionType = isUnread ? 'unread' : 'unanswered';
      const reason = isUnread
        ? `Olvasatlan email ${daysSinceEmail} napja`
        : `Nem válaszoltál rá ${daysSinceEmail} napja`;

      const id = crypto.randomUUID();
      const taskNow = Date.now();

      await execute(
        `INSERT INTO detected_tasks (id, account_id, email_id, thread_id, subject, from_email, from_name, email_date, detection_type, reason, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          id,
          accountId,
          email.id,
          email.thread_id,
          email.subject,
          email.from_email,
          email.from_name,
          email.date,
          detectionType,
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
        detectionType,
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

  const dismissedCount = await dismissIrrelevantDetectedTasks(accountId);
  if (irrelevantSkipped > 0 || dismissedCount > 0) {
    logger.info(`Task detection: skipped ${irrelevantSkipped} irrelevant emails and auto-dismissed ${dismissedCount} noisy tasks for account ${accountId}`);
  }

  // Meglévő open taskok prioritás frissítése
  const openTasks = await queryAll<{ id: string; email_date: number | null }>(
    "SELECT id, email_date FROM detected_tasks WHERE account_id = ? AND status = 'open'",
    [accountId],
  );
  for (const task of openTasks) {
    if (task.email_date == null) continue;
    const daysSince = Math.floor((Date.now() - task.email_date) / 86400000);
    const newPriority = daysSince >= 7 ? 'high' : daysSince >= 3 ? 'medium' : 'low';
    await execute('UPDATE detected_tasks SET priority = ?, updated_at = ? WHERE id = ?', [
      newPriority,
      Date.now(),
      task.id,
    ]);
  }

  return newTasks;
}

export async function upsertDetectedTaskForEmail(accountId: string, emailId: string): Promise<DetectedTask | null> {
  const accountEmail = await getAccountEmail(accountId);
  if (!accountEmail) return null;

  const email = await queryOne<IncomingEmailRow>(
    `SELECT id, thread_id, subject, from_email, from_name, date, is_read, snippet, labels
     FROM emails
     WHERE id = ? AND account_id = ?`,
    [emailId, accountId],
  );
  if (!email || !email.from_email || email.from_email === accountEmail) {
    return null;
  }

  let hasReply = false;
  if (email.thread_id) {
    const reply = await queryOne<{ id: string }>(
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

  const detectionType = email.is_read === 0 ? 'unread' : !hasReply ? 'unanswered' : null;
  if (!detectionType) return null;

  const relevance = assessEmailTaskRelevance({
    fromEmail: email.from_email,
    fromName: email.from_name,
    subject: email.subject,
    snippet: email.snippet,
    labels: email.labels,
  });

  const priority = inferImmediatePriority(email);
  const reason =
    detectionType === 'unread'
      ? 'Új, feldolgozandó email'
      : 'Az ügy továbbra is válaszra vár';

  const existing = await queryOne<DetectedTaskRow>(
    'SELECT * FROM detected_tasks WHERE email_id = ? AND account_id = ?',
    [emailId, accountId],
  );

  const now = Date.now();
  if (!relevance.isRelevant) {
    if (existing) {
      await execute(
        `UPDATE detected_tasks
         SET status = 'dismissed', reason = ?, updated_at = ?
         WHERE id = ?`,
        ['Automatikusan kizárva: nem feladatjellegű promóciós vagy rendszerértesítő email.', now, existing.id],
      );
    }
    return null;
  }

  if (existing) {
    await execute(
      `UPDATE detected_tasks
       SET detection_type = ?, reason = ?, priority = ?, status = 'open', updated_at = ?
       WHERE id = ?`,
      [detectionType, reason, priority, now, existing.id],
    );
    return rowToDetectedTask({
      ...existing,
      detection_type: detectionType,
      reason,
      priority,
      status: 'open',
      updated_at: now,
    });
  }

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO detected_tasks (
      id, account_id, email_id, thread_id, subject, from_email, from_name, email_date,
      detection_type, reason, priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [
      id,
      accountId,
      email.id,
      email.thread_id,
      email.subject,
      email.from_email,
      email.from_name,
      email.date,
      detectionType,
      reason,
      priority,
      now,
      now,
    ],
  );

  return {
    id,
    accountId,
    emailId: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    fromEmail: email.from_email,
    fromName: email.from_name,
    emailDate: email.date,
    detectionType,
    reason,
    priority,
    status: 'open',
    snoozedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function resolveDetectedTasksForThread(accountId: string, threadId: string | null): Promise<void> {
  if (!threadId) return;
  await execute(
    `UPDATE detected_tasks
     SET status = 'done', updated_at = ?
     WHERE account_id = ? AND thread_id = ? AND status = 'open'`,
    [Date.now(), accountId, threadId],
  );
}

/**
 * SSE progress-szel ellátott változat: detectUnansweredEmails + onProgress callback.
 * Fázisok: 'loading' → 'scanning' → 'updating' → 'done'
 */
export async function detectUnansweredEmailsWithProgress(
  accountId: string,
  daysBack: number,
  onProgress: (data: { phase: string; processed: number; total: number; found: number; skipped?: number }) => void,
): Promise<{ newTasksCount: number; totalProcessed: number; existingSkipped: number }> {
  const accountEmail = await getAccountEmail(accountId);
  if (!accountEmail) {
    logger.warn(`Task detection: no email found for account ${accountId}`);
    return { newTasksCount: 0, totalProcessed: 0, existingSkipped: 0 };
  }

  const now = Date.now();
  const sinceDate = now - daysBack * 24 * 60 * 60 * 1000;
  const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;

  onProgress({ phase: 'loading', processed: 0, total: 0, found: 0 });

  const incomingEmails = await queryAll<IncomingEmailRow>(
    `SELECT id, thread_id, subject, from_email, from_name, date, is_read, snippet, labels
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND date <= ?
       AND from_email != ?
     ORDER BY date DESC`,
    [accountId, sinceDate, oneDayAgo, accountEmail],
  );

  onProgress({ phase: 'scanning', processed: 0, total: incomingEmails.length, found: 0, skipped: 0 });

  const newTasks: DetectedTask[] = [];
  let existingSkipped = 0;
  let irrelevantSkipped = 0;

  for (let i = 0; i < incomingEmails.length; i++) {
    const email = incomingEmails[i];

    const relevance = assessEmailTaskRelevance({
      fromEmail: email.from_email,
      fromName: email.from_name,
      subject: email.subject,
      snippet: email.snippet,
      labels: email.labels,
    });
    if (!relevance.isRelevant) {
      irrelevantSkipped++;
      if (i % 10 === 0) {
        onProgress({ phase: 'scanning', processed: i, total: incomingEmails.length, found: newTasks.length, skipped: existingSkipped + irrelevantSkipped });
      }
      continue;
    }

    // Duplikátum elkerülés
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM detected_tasks WHERE email_id = ? AND account_id = ?',
      [email.id, accountId],
    );
    if (existing) {
      existingSkipped++;
      if (i % 10 === 0) {
        onProgress({ phase: 'scanning', processed: i, total: incomingEmails.length, found: newTasks.length, skipped: existingSkipped + irrelevantSkipped });
      }
      continue;
    }

    // Thread alapú válasz detekció
    let hasReply = false;
    if (email.thread_id) {
      const reply = await queryOne<{ id: string }>(
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

    const isUnread = email.is_read === 0;
    if (isUnread || !hasReply) {
      const daysSinceEmail = Math.floor((now - email.date) / (24 * 60 * 60 * 1000));

      let priority: string;
      if (daysSinceEmail >= 7) {
        priority = 'high';
      } else if (daysSinceEmail >= 3) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      const detectionType = isUnread ? 'unread' : 'unanswered';
      const reason = isUnread
        ? `Olvasatlan email ${daysSinceEmail} napja`
        : `Nem válaszoltál rá ${daysSinceEmail} napja`;

      const id = crypto.randomUUID();
      const taskNow = Date.now();

      await execute(
        `INSERT INTO detected_tasks (id, account_id, email_id, thread_id, subject, from_email, from_name, email_date, detection_type, reason, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          id,
          accountId,
          email.id,
          email.thread_id,
          email.subject,
          email.from_email,
          email.from_name,
          email.date,
          detectionType,
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
        detectionType,
        reason,
        priority,
        status: 'open',
        snoozedUntil: null,
        createdAt: taskNow,
        updatedAt: taskNow,
      });
    }

    if (i % 10 === 0) {
      onProgress({ phase: 'scanning', processed: i, total: incomingEmails.length, found: newTasks.length, skipped: existingSkipped + irrelevantSkipped });
    }
  }

  // Meglévő open taskok prioritás frissítése
  const dismissedCount = await dismissIrrelevantDetectedTasks(accountId);
  onProgress({ phase: 'updating', processed: incomingEmails.length, total: incomingEmails.length, found: newTasks.length, skipped: existingSkipped + irrelevantSkipped + dismissedCount });

  const openTasks = await queryAll<{ id: string; email_date: number | null }>(
    "SELECT id, email_date FROM detected_tasks WHERE account_id = ? AND status = 'open'",
    [accountId],
  );
  for (const task of openTasks) {
    if (task.email_date == null) continue;
    const daysSince = Math.floor((Date.now() - task.email_date) / 86400000);
    const newPriority = daysSince >= 7 ? 'high' : daysSince >= 3 ? 'medium' : 'low';
    await execute('UPDATE detected_tasks SET priority = ?, updated_at = ? WHERE id = ?', [
      newPriority,
      Date.now(),
      task.id,
    ]);
  }

  if (newTasks.length > 0) {
    logger.info(`Task detection (progress): found ${newTasks.length} new tasks for account ${accountId}`);
  }
  if (irrelevantSkipped > 0 || dismissedCount > 0) {
    logger.info(`Task detection (progress): skipped ${irrelevantSkipped} irrelevant emails and auto-dismissed ${dismissedCount} noisy tasks for account ${accountId}`);
  }

  return { newTasksCount: newTasks.length, totalProcessed: incomingEmails.length, existingSkipped };
}

/**
 * Detected taskok listázása. Szűrés status + priority alapján, dátum DESC.
 */
export async function getDetectedTasks(
  accountId: string,
  options: { status?: string; priority?: string; page?: number; limit?: number } = {},
): Promise<{ tasks: DetectedTask[]; total: number }> {
  const { status = 'open', priority, page = 1, limit = 50 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (Math.max(1, page) - 1) * safeLimit;

  let whereClauses = 'account_id = ? AND status = ?';
  const params: unknown[] = [accountId, status];

  if (priority) {
    whereClauses += ' AND priority = ?';
    params.push(priority);
  }

  const countResult = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM detected_tasks WHERE ${whereClauses}`,
    params,
  );
  const total = countResult?.total ?? 0;

  const rows = await queryAll<DetectedTaskRow>(
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
export async function updateDetectedTaskStatus(
  taskId: string,
  accountId: string,
  newStatus: string,
  snoozedUntil?: number,
): Promise<boolean> {
  const validStatuses = ['open', 'done', 'dismissed', 'snoozed'];
  if (!validStatuses.includes(newStatus)) {
    return false;
  }

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM detected_tasks WHERE id = ? AND account_id = ?',
    [taskId, accountId],
  );
  if (!existing) return false;

  await execute(
    'UPDATE detected_tasks SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ? AND account_id = ?',
    [newStatus, snoozedUntil ?? null, Date.now(), taskId, accountId],
  );
  return true;
}

/**
 * Task törlés + ownership check.
 */
export async function deleteDetectedTask(taskId: string, accountId: string): Promise<boolean> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM detected_tasks WHERE id = ? AND account_id = ?',
    [taskId, accountId],
  );
  if (!existing) return false;

  await execute('DELETE FROM detected_tasks WHERE id = ? AND account_id = ?', [taskId, accountId]);
  return true;
}

/**
 * Statisztika az open taskok számáról prioritás szerint.
 */
export async function getTaskStats(accountId: string): Promise<{
  open: number;
  high: number;
  medium: number;
  low: number;
}> {
  const openResult = await queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open'",
    [accountId],
  );
  const highResult = await queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open' AND priority = 'high'",
    [accountId],
  );
  const mediumResult = await queryOne<{ total: number }>(
    "SELECT COUNT(*) as total FROM detected_tasks WHERE account_id = ? AND status = 'open' AND priority = 'medium'",
    [accountId],
  );
  const lowResult = await queryOne<{ total: number }>(
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
export async function processExpiredSnoozedTasks(): Promise<number> {
  const now = Date.now();
  const expired = await queryAll<{ id: string }>(
    "SELECT id FROM detected_tasks WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?",
    [now],
  );

  for (const task of expired) {
    await execute(
      "UPDATE detected_tasks SET status = 'open', snoozed_until = NULL, updated_at = ? WHERE id = ?",
      [now, task.id],
    );
  }

  if (expired.length > 0) {
    logger.info(`Task detection: unsnoozed ${expired.length} tasks`);
  }

  return expired.length;
}

