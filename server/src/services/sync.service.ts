import { v4 as uuidv4 } from 'uuid';
import { execute, queryAll, queryOne, runInTransaction } from '../db/index.js';
import { broadcastNewEmail } from '../routes/sse.routes.js';
import logger from '../utils/logger.js';
import { getOAuth2ClientForAccount, isMissingVaultTokenError } from './auth.service.js';
import { extractAndStoreEventCandidatesForEmail } from './calendar-automation.service.js';
import { categorizeEmail } from './categorization.service.js';
import { harvestContactsForNewEmails } from './contact-harvester.service.js';
import { autoExtractContactsIfNeeded, extractContactsFromEmail } from './contacts.service.js';
import { extractActionItems } from './email-intelligence.service.js';
import {
  getGmailClient,
  getHistory,
  getMessage,
  getProfile,
  listMessages,
} from './gmail.service.js';
import { sendPushToAccount } from './push.service.js';
import {
  resolveDetectedTasksForThread,
  upsertDetectedTaskForEmail,
} from './task-detection.service.js';
import { hasStoredOAuthTokensForAccount } from './token-vault.service.js';
import { executeWorkflow, getActiveWorkflowsForAccount } from './workflow.service.js';

const OPERATIONAL_REPROCESS_KEY = 'operational_reprocess_last_run';
const syncPromises = new Map<string, Promise<{ success: boolean; messagesProcessed: number }>>();

// Gmail üzenet interfész (getMessage visszatérési típusa)
interface GmailMessage {
  id: string;
  threadId?: string | null;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  cc: string;
  snippet?: string | null;
  body: string;
  bodyHtml: string;
  date: number;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

async function ensureRemindersForActionItems(accountId: string, emailId: string): Promise<void> {
  const items = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM action_items WHERE email_id = ? AND account_id = ?',
    [emailId, accountId],
  );
  if (!Number(items?.count ?? 0)) return;

  const dueItems = await queryOne<{ due_date: number | null }>(
    `SELECT due_date
     FROM action_items
     WHERE email_id = ? AND account_id = ? AND is_done = 0 AND due_date IS NOT NULL
     ORDER BY due_date ASC
     LIMIT 1`,
    [emailId, accountId],
  );
  if (!dueItems?.due_date) return;

  const existingReminder = await queryOne<{ id: string; remind_at: number; note: string | null }>(
    'SELECT id, remind_at, note FROM reminders WHERE email_id = ? AND account_id = ? AND is_completed = 0',
    [emailId, accountId],
  );
  const remindAt = Math.max(Date.now() + 10 * 60 * 1000, dueItems.due_date - 4 * 60 * 60 * 1000);
  const note = 'Automatikusan létrehozott AI emlékeztető';
  if (existingReminder) {
    if (existingReminder.remind_at !== remindAt || existingReminder.note !== note) {
      await execute('UPDATE reminders SET remind_at = ?, note = ? WHERE id = ?', [
        remindAt,
        note,
        existingReminder.id,
      ]);
    }
    return;
  }
  await execute(
    `INSERT INTO reminders (id, email_id, account_id, remind_at, note, is_completed, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [uuidv4(), emailId, accountId, remindAt, note, Date.now()],
  );
}

async function processOperationalSignals(
  accountId: string,
  emailId: string,
  isSent: boolean,
  threadId: string | null,
): Promise<void> {
  try {
    if (isSent) {
      await resolveDetectedTasksForThread(accountId, threadId);
      return;
    }

    await upsertDetectedTaskForEmail(accountId, emailId);
    await extractActionItems(emailId, { workflowOrigin: 'sync_new_email' });
    await ensureRemindersForActionItems(accountId, emailId);
    await extractAndStoreEventCandidatesForEmail(emailId);
  } catch (error) {
    logger.error(`Operational AI processing failed for email ${emailId}:`, error);
  }
}

async function runWorkflowTriggersForEmail(accountId: string, emailId: string): Promise<void> {
  try {
    const workflows = await getActiveWorkflowsForAccount(accountId);
    for (const wf of workflows) {
      if (wf.triggerType === 'on_receive' || wf.triggerType === 'new_email') {
        await executeWorkflow(wf.id, emailId).catch((wfErr) =>
          logger.error(`Workflow ${wf.id} failed for email ${emailId}:`, wfErr),
        );
      }
    }
  } catch (wfErr) {
    logger.error('Workflow trigger error:', wfErr);
  }
}

async function handleInsertedEmailEffects(
  accountId: string,
  msg: GmailMessage,
  options: { notifyRealtime: boolean; runUserWorkflows: boolean },
): Promise<void> {
  if (options.notifyRealtime) {
    broadcastNewEmail(accountId, {
      emailId: msg.id,
      subject: msg.subject,
      from: msg.from,
      fromName: msg.fromName,
      date: msg.date,
      snippet: msg.snippet || null,
    });

    if (!msg.isRead) {
      sendPushToAccount(accountId, {
        title: msg.fromName || msg.from,
        body: msg.subject || 'Új üzenet',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        url: `/?emailId=${msg.id}`,
        tag: `email-${msg.id}`,
      }).catch((err) => {
        logger.error('Push notification hiba:', err);
      });
    }
  }

  await processOperationalSignals(
    accountId,
    msg.id,
    msg.labels.includes('SENT'),
    msg.threadId ?? null,
  );

  if (options.runUserWorkflows) {
    await runWorkflowTriggersForEmail(accountId, msg.id);
  }
}

export async function reprocessRecentOperationalSignals(
  accountId: string,
  options?: { force?: boolean; daysBack?: number; maxEmails?: number; minIntervalMs?: number },
): Promise<{ processed: number; skipped: boolean }> {
  const daysBack = options?.daysBack ?? 30;
  const maxEmails = options?.maxEmails ?? 120;
  const minIntervalMs = options?.minIntervalMs ?? 6 * 60 * 60 * 1000;

  if (!options?.force) {
    const existing = await queryOne<{ value: string | null }>(
      'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
      [accountId, OPERATIONAL_REPROCESS_KEY],
    );
    const lastRun = Number(existing?.value ?? 0);
    if (Number.isFinite(lastRun) && lastRun > 0 && Date.now() - lastRun < minIntervalMs) {
      return { processed: 0, skipped: true };
    }
  }

  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const emails = await queryAll<{ id: string; thread_id: string | null; labels: string | null }>(
    `SELECT id, thread_id, labels
     FROM emails
     WHERE account_id = ? AND date >= ?
     ORDER BY date DESC
     LIMIT ?`,
    [accountId, since, maxEmails],
  );

  let processed = 0;
  for (const email of emails) {
    try {
      const labels = email.labels ? (JSON.parse(email.labels) as string[]) : [];
      const isSent = labels.includes('SENT');
      if (isSent) {
        await resolveDetectedTasksForThread(accountId, email.thread_id);
        continue;
      }

      await upsertDetectedTaskForEmail(accountId, email.id);
      await extractActionItems(email.id, { force: true, workflowOrigin: 'scheduled_reprocess' });
      await ensureRemindersForActionItems(accountId, email.id);
      await extractAndStoreEventCandidatesForEmail(email.id);
      processed++;
    } catch (error) {
      logger.error(`Operational reprocess failed for email ${email.id}:`, error);
    }
  }
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [uuidv4(), accountId, OPERATIONAL_REPROCESS_KEY, String(Date.now()), Date.now()],
  );

  return { processed, skipped: false };
}

// Email szinkronizálás egy fiókhoz
export async function syncAccount(accountId: string, fullSync = false) {
  const activeSync = syncPromises.get(accountId);
  if (activeSync) {
    logger.info(`Sync already in progress for ${accountId}, joining existing run`);
    return activeSync;
  }

  const syncPromise = (async () => {
    const logId = uuidv4();

    // Wrap initial sync_log insert in try-catch to handle DB failures
    try {
      await execute(
        'INSERT INTO sync_log (id, account_id, started_at, status) VALUES (?, ?, ?, ?)',
        [logId, accountId, Date.now(), 'running'],
      );
    } catch (error) {
      logger.error('Failed to create sync log:', error);
      throw new Error('Cannot start sync: database error');
    }

    try {
      const { oauth2Client, account } = await getOAuth2ClientForAccount(accountId);
      const gmail = getGmailClient(oauth2Client);

      let processedCount = 0;
      let newEmailIds: string[] = [];

      let latestHistoryId: string | null | undefined;

      if (!fullSync && account.history_id) {
        const incrementalResult = await incrementalSync(gmail, accountId, account.history_id);
        processedCount = incrementalResult.processedCount;
        newEmailIds = incrementalResult.newEmailIds;
        latestHistoryId = incrementalResult.historyId;

        const daysBack = Math.max(1, parseInt(process.env.SYNC_DAYS_BACK || '30', 10));
        processedCount += await reconcileRecentMailboxWindow(gmail, accountId, daysBack);
      } else {
        const daysBack = Math.max(1, parseInt(process.env.SYNC_DAYS_BACK || '30', 10));
        const fullSyncResult = await fullSyncMessages(gmail, accountId, daysBack);
        processedCount = fullSyncResult.processedCount;
        newEmailIds = fullSyncResult.newEmailIds;
      }

      const profile = await getProfile(gmail);
      await execute('UPDATE accounts SET history_id = ?, last_sync_at = ? WHERE id = ?', [
        latestHistoryId
          ? latestHistoryId.toString()
          : profile.historyId
            ? profile.historyId.toString()
            : null,
        Date.now(),
        accountId,
      ]);

      await execute(
        'UPDATE sync_log SET completed_at = ?, messages_processed = ?, status = ? WHERE id = ?',
        [Date.now(), processedCount, 'completed', logId],
      );

      try {
        if (newEmailIds.length > 0) {
          await harvestContactsForNewEmails(accountId, newEmailIds);
        }
        await autoExtractContactsIfNeeded(accountId);
      } catch (err) {
        logger.error(`Failed to extract contacts for account ${accountId}:`, err);
      }

      return { success: true, messagesProcessed: processedCount };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba';
      try {
        await execute('UPDATE sync_log SET completed_at = ?, status = ?, error = ? WHERE id = ?', [
          Date.now(),
          'failed',
          errorMsg,
          logId,
        ]);
      } catch (updateError) {
        logger.error('Failed to update sync log on error:', updateError);
      }
      throw error;
    }
  })().finally(() => {
    syncPromises.delete(accountId);
  });

  syncPromises.set(accountId, syncPromise);
  return syncPromise;
}

async function fullSyncMessages(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  daysBack: number,
): Promise<{ processedCount: number; newEmailIds: string[] }> {
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - daysBack);
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
  const query = `after:${afterStr} -in:trash -in:spam`;

  let pageToken: string | undefined;
  let totalProcessed = 0;
  const newEmailIds: string[] = [];
  const gmailVisibleIds = new Set<string>();

  do {
    const result = await listMessages(gmail, accountId, {
      query,
      maxResults: 100,
      pageToken,
    });

    const batch: string[] = [];
    for (const msg of result.messages) {
      if (!msg.id) continue;
      gmailVisibleIds.add(msg.id);

      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM emails WHERE id = ? AND account_id = ?',
        [msg.id, accountId],
      );

      if (!existing) {
        batch.push(msg.id);
      }
    }

    for (let i = 0; i < batch.length; i += 10) {
      const chunk = batch.slice(i, i + 10);
      const messagePromises = chunk.map((id) =>
        getMessage(gmail, id, accountId).catch((err) => {
          logger.error(`Hiba üzenet letöltésekor (${id}):`, err.message);
          return null;
        }),
      );

      const messages = await Promise.all(messagePromises);

      for (const msg of messages) {
        if (!msg) continue;
        const isNew = await saveEmail(accountId, msg);
        if (isNew) {
          await handleInsertedEmailEffects(accountId, msg, {
            notifyRealtime: false,
            runUserWorkflows: false,
          });
          totalProcessed++;
          newEmailIds.push(msg.id);
        }
      }

      if (i + 10 < batch.length) {
        await sleep(200);
      }
    }

    pageToken = result.nextPageToken || undefined;
  } while (pageToken);

  totalProcessed += await reconcileRecentLocalState(
    gmail,
    accountId,
    afterDate.getTime(),
    gmailVisibleIds,
  );

  return { processedCount: totalProcessed, newEmailIds };
}

async function reconcileRecentMailboxWindow(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  daysBack: number,
): Promise<number> {
  const maxChecks = getSyncReconcileMax();
  if (maxChecks === 0) return 0;

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - daysBack);
  const gmailVisibleIds = await listRecentVisibleMessageIds(gmail, accountId, afterDate, maxChecks);
  return reconcileRecentLocalState(gmail, accountId, afterDate.getTime(), gmailVisibleIds);
}

async function listRecentVisibleMessageIds(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  afterDate: Date,
  maxMessages: number,
): Promise<Set<string>> {
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
  const query = `after:${afterStr} -in:trash -in:spam`;
  const ids = new Set<string>();
  let pageToken: string | undefined;

  do {
    const result = await listMessages(gmail, accountId, {
      query,
      maxResults: Math.min(100, maxMessages - ids.size),
      pageToken,
    });

    for (const message of result.messages) {
      if (message.id) ids.add(message.id);
      if (ids.size >= maxMessages) break;
    }

    pageToken = ids.size < maxMessages ? result.nextPageToken || undefined : undefined;
  } while (pageToken);

  return ids;
}

async function incrementalSync(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  historyId: string,
): Promise<{ processedCount: number; newEmailIds: string[]; historyId?: string | null }> {
  let processedCount = 0;
  const newEmailIds: string[] = [];
  let latestHistoryId: string | null | undefined;

  try {
    const historyResult = await getHistory(gmail, historyId, accountId);
    const { history } = historyResult;
    latestHistoryId = historyResult.historyId;

    const newMessageIds = new Set<string>();
    const deletedMessageIds = new Set<string>();
    const labelAdds = new Map<string, Set<string>>();
    const labelRemoves = new Map<string, Set<string>>();
    for (const entry of history) {
      if (entry.messagesAdded) {
        for (const added of entry.messagesAdded) {
          if (added.message?.id) {
            newMessageIds.add(added.message.id);
          }
        }
      }

      if (entry.messagesDeleted) {
        for (const deleted of entry.messagesDeleted) {
          if (deleted.message?.id) {
            deletedMessageIds.add(deleted.message.id);
          }
        }
      }

      if (entry.labelsAdded) {
        for (const labelAdded of entry.labelsAdded) {
          collectLabelChange(labelAdds, labelAdded.message?.id, labelAdded.labelIds || []);
        }
      }

      if (entry.labelsRemoved) {
        for (const labelRemoved of entry.labelsRemoved) {
          collectLabelChange(labelRemoves, labelRemoved.message?.id, labelRemoved.labelIds || []);
        }
      }
    }

    for (const msgId of deletedMessageIds) {
      const deleted = await deleteLocalEmail(accountId, msgId);
      if (deleted) processedCount++;
      newMessageIds.delete(msgId);
      labelAdds.delete(msgId);
      labelRemoves.delete(msgId);
    }

    for (const msgId of newMessageIds) {
      try {
        const msg = await getMessage(gmail, msgId, accountId);
        const isNew = await saveEmail(accountId, msg);
        if (!isNew) {
          await updateEmailState(accountId, msg);
        }
        if (isNew) {
          processedCount++;
          newEmailIds.push(msg.id);
          await handleInsertedEmailEffects(accountId, msg, {
            notifyRealtime: true,
            runUserWorkflows: true,
          });
        }
        labelAdds.delete(msgId);
        labelRemoves.delete(msgId);
      } catch (err) {
        logger.error(`Hiba inkrementális szinkronizálásnál (${msgId}):`, err);
      }
    }

    for (const [msgId, addedLabels] of labelAdds) {
      const removedLabels = labelRemoves.get(msgId) || new Set<string>();
      const updated = await applyLocalLabelDelta(accountId, msgId, addedLabels, removedLabels);
      if (updated) processedCount++;
      labelRemoves.delete(msgId);
    }

    for (const [msgId, removedLabels] of labelRemoves) {
      const updated = await applyLocalLabelDelta(
        accountId,
        msgId,
        new Set<string>(),
        removedLabels,
      );
      if (updated) processedCount++;
    }
  } catch (err) {
    const errorCode =
      err && typeof err === 'object' && 'code' in err ? (err as { code: number }).code : undefined;
    if (errorCode === 404) {
      logger.info('HistoryId érvénytelen, teljes szinkronizálás...');
      const daysBack = Math.max(1, parseInt(process.env.SYNC_DAYS_BACK || '30', 10));
      const fullSyncResult = await fullSyncMessages(gmail, accountId, daysBack);
      processedCount = fullSyncResult.processedCount;
      newEmailIds.push(...fullSyncResult.newEmailIds);
    } else {
      throw err;
    }
  }

  return { processedCount, newEmailIds, historyId: latestHistoryId };
}

function parseLabelsJson(labels: string | null, emailId: string): string[] {
  if (!labels) return [];
  try {
    const parsed = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed.filter((label) => typeof label === 'string') : [];
  } catch (error) {
    logger.warn('Labels JSON parse failed during sync', { emailId, error });
    return [];
  }
}

function collectLabelChange(
  target: Map<string, Set<string>>,
  messageId: string | null | undefined,
  labelIds: string[],
): void {
  if (!messageId || labelIds.length === 0) return;
  const labels = target.get(messageId) || new Set<string>();
  for (const labelId of labelIds) {
    labels.add(labelId);
  }
  target.set(messageId, labels);
}

async function deleteLocalEmail(accountId: string, emailId: string): Promise<boolean> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );
  if (!existing) return false;

  await execute('DELETE FROM emails WHERE id = ? AND account_id = ?', [emailId, accountId]);
  logger.info('Local email removed after Gmail permanent deletion', { accountId, emailId });
  return true;
}

async function applyLocalLabelDelta(
  accountId: string,
  emailId: string,
  addedLabels: Set<string>,
  removedLabels: Set<string>,
): Promise<boolean> {
  const email = await queryOne<{ labels: string | null }>(
    'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );
  if (!email) return false;

  const labels = new Set(parseLabelsJson(email.labels, emailId));
  for (const label of removedLabels) labels.delete(label);
  for (const label of addedLabels) labels.add(label);
  if (addedLabels.has('TRASH')) labels.delete('INBOX');

  await execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [
    JSON.stringify(Array.from(labels)),
    emailId,
    accountId,
  ]);
  return true;
}

async function updateEmailState(accountId: string, msg: GmailMessage): Promise<void> {
  await execute(
    `UPDATE emails
     SET thread_id = ?, is_read = ?, is_starred = ?, labels = ?, has_attachments = ?
     WHERE id = ? AND account_id = ?`,
    [
      msg.threadId,
      msg.isRead ? 1 : 0,
      msg.isStarred ? 1 : 0,
      JSON.stringify(msg.labels),
      msg.hasAttachments ? 1 : 0,
      msg.id,
      accountId,
    ],
  );
}

async function reconcileRecentLocalState(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  sinceDate: number,
  gmailVisibleIds: Set<string>,
): Promise<number> {
  const maxChecks = getSyncReconcileMax();
  if (maxChecks === 0) return 0;

  const localEmails = await queryAll<{ id: string }>(
    `SELECT id FROM emails
     WHERE account_id = ? AND date >= ? AND (labels IS NULL OR labels NOT LIKE '%"TRASH"%')
     ORDER BY date DESC
     LIMIT ?`,
    [accountId, sinceDate, maxChecks],
  );

  let reconciledCount = 0;
  for (const localEmail of localEmails) {
    if (gmailVisibleIds.has(localEmail.id)) continue;
    try {
      const msg = await getMessage(gmail, localEmail.id, accountId);
      await updateEmailState(accountId, msg);
      reconciledCount++;
    } catch (error) {
      const status = getGmailErrorStatus(error);
      if (status === 404 || status === 410) {
        const deleted = await deleteLocalEmail(accountId, localEmail.id);
        if (deleted) reconciledCount++;
        continue;
      }
      logger.warn('Recent Gmail reconciliation failed for email', {
        accountId,
        emailId: localEmail.id,
        error,
      });
    }
  }

  return reconciledCount;
}

function getSyncReconcileMax(): number {
  return Math.max(0, parseInt(process.env.SYNC_RECONCILE_MAX || '500', 10));
}

function getGmailErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = err.code ?? err.status ?? err.statusCode ?? err.response?.status;
  return typeof status === 'number' ? status : undefined;
}

async function saveEmail(accountId: string, msg: GmailMessage): Promise<boolean> {
  return runInTransaction(async () => {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO emails (id, account_id, thread_id, subject, from_email, from_name, to_email, cc_email, snippet, body, body_html, date, is_read, is_starred, labels, has_attachments, category_id, topic_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
       ON CONFLICT(id) DO NOTHING
       RETURNING id`,
      [
        msg.id,
        accountId,
        msg.threadId,
        msg.subject,
        msg.from,
        msg.fromName,
        msg.to,
        msg.cc,
        msg.snippet,
        msg.body,
        msg.bodyHtml,
        msg.date,
        msg.isRead ? 1 : 0,
        msg.isStarred ? 1 : 0,
        JSON.stringify(msg.labels),
        msg.hasAttachments ? 1 : 0,
      ],
    );

    if (!inserted) {
      return false;
    }

    const categoryId = await categorizeEmail(accountId, {
      from: msg.from,
      subject: msg.subject || '',
      labels: msg.labels,
    });

    const topicSubject = msg.subject || extractSubjectFromBody(msg.body);
    const topicId = await findOrCreateTopic(accountId, topicSubject, msg.threadId, msg.body);

    await execute(
      'UPDATE emails SET category_id = ?, topic_id = ? WHERE id = ? AND account_id = ?',
      [categoryId, topicId, msg.id, accountId],
    );

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        await execute(
          'INSERT INTO attachments (id, email_id, filename, mime_type, size, gmail_attachment_id) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), msg.id, att.filename, att.mimeType, att.size, att.attachmentId],
        );
      }
    }

    const isSent = msg.labels.includes('SENT');
    if (isSent) {
      await updateSenderGroup(accountId, msg.from, msg.fromName, msg.date);

      if (msg.to) {
        const recipients = parseEmailList(msg.to);
        for (const recipient of recipients) {
          await updateSenderGroup(accountId, recipient.email, recipient.name, msg.date);
        }
      }

      if (msg.cc) {
        const ccRecipients = parseEmailList(msg.cc);
        for (const ccRecipient of ccRecipients) {
          await updateSenderGroup(accountId, ccRecipient.email, ccRecipient.name, msg.date);
        }
      }
    } else {
      await updateSenderGroup(accountId, msg.from, msg.fromName, msg.date);
    }

    await extractContactsFromEmail(accountId, msg.from, msg.fromName, msg.to, msg.cc);
    return true;
  });
}

// Email cím lista feldolgozása ("Name1 <email1@domain.com>, Name2 <email2@domain.com>" formátumból)
function parseEmailList(emailList: string): Array<{ email: string; name: string }> {
  if (!emailList) return [];

  const emails: Array<{ email: string; name: string }> = [];
  // Split by comma, de figyelünk a <> zárójelekre
  const parts = emailList.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      emails.push({ name: match[1].replace(/"/g, '').trim(), email: match[2].trim() });
    } else {
      // Csak email cím van, név nélkül
      emails.push({ email: trimmed, name: '' });
    }
  }

  return emails;
}

// Subject kinyerése a body-ból, ha nincs subject
function extractSubjectFromBody(body: string): string {
  if (!body) return '';

  // Első sor vagy első 100 karakter
  const firstLine = body.split('\n')[0].trim();
  const maxLength = 100;

  if (firstLine.length > maxLength) {
    return firstLine.substring(0, maxLength) + '...';
  }

  return firstLine || '';
}

async function findOrCreateTopic(
  accountId: string,
  subject: string,
  threadId?: string | null,
  body?: string,
): Promise<string | null> {
  let normalized = normalizeSubject(subject);

  // Ha nincs subject, próbáljuk a body-ból kinyerni
  if (!normalized && body) {
    const bodySubject = extractSubjectFromBody(body);
    normalized = normalizeSubject(bodySubject);
  }

  if (!normalized) return null;

  const existing = await queryOne<{ id: string; message_count: number }>(
    'SELECT id, message_count FROM topics WHERE account_id = ? AND normalized_subject = ?',
    [accountId, normalized],
  );

  if (existing) {
    await execute('UPDATE topics SET message_count = message_count + 1 WHERE id = ?', [
      existing.id,
    ]);
    return existing.id;
  }

  const topicId = uuidv4();
  await execute(
    'INSERT INTO topics (id, name, normalized_subject, message_count, account_id) VALUES (?, ?, ?, ?, ?)',
    [topicId, normalized, normalized, 1, accountId],
  );

  return topicId;
}

function normalizeSubject(subject: string): string {
  // Ismételt alkalmazás a beágyazott prefixek kezelésére (pl. "Re: Fwd: Re: ...")
  let normalized = subject;
  let prev = '';
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(/^(Re|Fwd|FW|Válasz|Továbbítás):\s*/gi, '');
  }
  return normalized.trim();
}

async function updateSenderGroup(
  accountId: string,
  email: string,
  name: string | null | undefined,
  date: number,
) {
  if (!email) return;

  const domain = email.split('@')[1] || '';
  const existing = await queryOne<{
    id: string;
    message_count: number;
    last_message_at: number | null;
    name: string | null;
  }>(
    'SELECT id, message_count, last_message_at, name FROM sender_groups WHERE account_id = ? AND email = ?',
    [accountId, email],
  );

  if (existing) {
    await execute(
      'UPDATE sender_groups SET message_count = message_count + 1, last_message_at = GREATEST(COALESCE(last_message_at, 0), ?), name = COALESCE(?, name) WHERE id = ?',
      [date, name || null, existing.id],
    );
  } else {
    await execute(
      'INSERT INTO sender_groups (id, email, name, domain, message_count, last_message_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), email, name || null, domain, 1, date, accountId],
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const syncIntervals = new Map<string, NodeJS.Timeout>();

export async function startBackgroundSync(accountId: string) {
  if (syncIntervals.has(accountId)) return;

  const intervalMs = Math.max(60000, parseInt(process.env.SYNC_INTERVAL_MS || '300000', 10));
  const interval = setInterval(async () => {
    if (syncPromises.has(accountId)) {
      logger.info(`Sync already in progress for ${accountId}, skipping`);
      return;
    }
    try {
      if (!(await hasStoredOAuthTokensForAccount(accountId))) {
        return;
      }
      await syncAccount(accountId);
    } catch (err) {
      if (isMissingVaultTokenError(err)) {
        logger.debug(`Background sync: token eltűnt a tick előtt (${accountId})`);
        return;
      }
      logger.error(`Háttér szinkronizálás hiba (${accountId}):`, err);
    }
  }, intervalMs);

  syncIntervals.set(accountId, interval);
}

export function stopBackgroundSync(accountId: string) {
  const interval = syncIntervals.get(accountId);
  if (interval) {
    clearInterval(interval);
    syncIntervals.delete(accountId);
  }
}

export function stopAllBackgroundSyncs() {
  for (const [accountId, interval] of syncIntervals) {
    clearInterval(interval);
  }
  syncIntervals.clear();
}

// Fiók adatainak törlése (emailek, kontaktok, stb.) - újraszinkronizálás előtt
export async function clearAccountData(accountId: string) {
  logger.info(`Adatok törlése a(z) ${accountId} fiókhoz...`);

  await runInTransaction(async () => {
    // Emailek törlése — ON DELETE CASCADE automatikusan törli:
    // attachments, action_items, snoozed_emails, reminders,
    // pinned_emails, detected_tasks, email_categories
    // workflow_runs.trigger_email_id → SET NULL
    await execute('DELETE FROM emails WHERE account_id = ?', [accountId]);

    // Account-szintű táblák (nem email-függők)
    await execute('DELETE FROM contacts WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM sender_groups WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM topics WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM categories WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM categorization_rules WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM saved_searches WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM templates WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM newsletter_senders WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM push_subscriptions WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM user_settings WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM scheduled_emails WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM vip_senders WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM workflows WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM ai_conversations WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM smart_folders WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM daily_briefs WHERE account_id = ?', [accountId]);
    await execute('DELETE FROM sync_log WHERE account_id = ?', [accountId]);

    // History ID törlése, hogy teljes szinkronizálás történjen
    await execute('UPDATE accounts SET history_id = NULL WHERE id = ?', [accountId]);
  });

  logger.info(`Adatok törölve a(z) ${accountId} fiókhoz.`);
}
