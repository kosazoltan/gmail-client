import { queryOne, queryAll, execute } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getOAuth2ClientForAccount } from './auth.service.js';
import {
  getGmailClient,
  listMessages,
  getMessage,
  getMessageMetadata,
  getProfile,
  getHistory,
} from './gmail.service.js';
import { categorizeEmail } from './categorization.service.js';

// Email szinkronizálás egy fiókhoz
export async function syncAccount(accountId: string, fullSync = false) {
  const logId = uuidv4();
  execute(
    'INSERT INTO sync_log (id, account_id, started_at, status) VALUES (?, ?, ?, ?)',
    [logId, accountId, Date.now(), 'running'],
  );

  try {
    const { oauth2Client, account } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    let processedCount = 0;

    if (!fullSync && account.history_id) {
      processedCount = await incrementalSync(gmail, accountId, account.history_id);
    } else {
      const daysBack = parseInt(process.env.SYNC_DAYS_BACK || '30');
      processedCount = await fullSyncMessages(gmail, accountId, daysBack);
    }

    const profile = await getProfile(gmail);
    execute(
      'UPDATE accounts SET history_id = ?, last_sync_at = ? WHERE id = ?',
      [profile.historyId?.toString(), Date.now(), accountId],
    );

    execute(
      'UPDATE sync_log SET completed_at = ?, messages_processed = ?, status = ? WHERE id = ?',
      [Date.now(), processedCount, 'completed', logId],
    );

    return { success: true, messagesProcessed: processedCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba';
    execute(
      'UPDATE sync_log SET completed_at = ?, status = ?, error = ? WHERE id = ?',
      [Date.now(), 'failed', errorMsg, logId],
    );
    throw error;
  }
}

async function fullSyncMessages(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  daysBack: number,
) {
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - daysBack);
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
  const query = `after:${afterStr}`;

  let pageToken: string | undefined;
  let totalProcessed = 0;

  do {
    const result = await listMessages(gmail, {
      query,
      maxResults: 100,
      pageToken,
    });

    const batch: string[] = [];
    for (const msg of result.messages) {
      if (!msg.id) continue;

      const existing = queryOne<{ id: string }>(
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
        getMessage(gmail, id).catch((err) => {
          console.error(`Hiba üzenet letöltésekor (${id}):`, err.message);
          return null;
        }),
      );

      const messages = await Promise.all(messagePromises);

      for (const msg of messages) {
        if (!msg) continue;
        saveEmail(accountId, msg);
        totalProcessed++;
      }

      if (i + 10 < batch.length) {
        await sleep(200);
      }
    }

    pageToken = result.nextPageToken || undefined;
  } while (pageToken);

  return totalProcessed;
}

async function incrementalSync(
  gmail: ReturnType<typeof getGmailClient>,
  accountId: string,
  historyId: string,
) {
  let processedCount = 0;

  try {
    const { history } = await getHistory(gmail, historyId);

    const newMessageIds = new Set<string>();
    for (const entry of history) {
      if (entry.messagesAdded) {
        for (const added of entry.messagesAdded) {
          if (added.message?.id) {
            newMessageIds.add(added.message.id);
          }
        }
      }
    }

    for (const msgId of newMessageIds) {
      try {
        const msg = await getMessage(gmail, msgId);
        saveEmail(accountId, msg);
        processedCount++;
      } catch (err) {
        console.error(`Hiba inkrementális szinkronizálásnál (${msgId}):`, err);
      }
    }
  } catch (err: any) {
    if (err?.code === 404) {
      console.log('HistoryId érvénytelen, teljes szinkronizálás...');
      const daysBack = parseInt(process.env.SYNC_DAYS_BACK || '30');
      processedCount = await fullSyncMessages(gmail, accountId, daysBack);
    } else {
      throw err;
    }
  }

  return processedCount;
}

function saveEmail(accountId: string, msg: any) {
  const categoryId = categorizeEmail(accountId, {
    from: msg.from,
    subject: msg.subject || '',
    labels: msg.labels,
  });

  const topicId = findOrCreateTopic(accountId, msg.subject || '', msg.threadId);

  execute(
    `INSERT OR IGNORE INTO emails (id, account_id, thread_id, subject, from_email, from_name, to_email, cc_email, snippet, body, body_html, date, is_read, is_starred, labels, has_attachments, category_id, topic_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id, accountId, msg.threadId, msg.subject, msg.from, msg.fromName,
      msg.to, msg.cc, msg.snippet, msg.body, msg.bodyHtml, msg.date,
      msg.isRead ? 1 : 0, msg.isStarred ? 1 : 0, JSON.stringify(msg.labels),
      msg.hasAttachments ? 1 : 0, categoryId, topicId,
    ],
  );

  if (msg.attachments && msg.attachments.length > 0) {
    for (const att of msg.attachments) {
      execute(
        'INSERT OR IGNORE INTO attachments (id, email_id, filename, mime_type, size, gmail_attachment_id) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), msg.id, att.filename, att.mimeType, att.size, att.attachmentId],
      );
    }
  }

  updateSenderGroup(accountId, msg.from, msg.fromName, msg.date);
}

function findOrCreateTopic(
  accountId: string,
  subject: string,
  threadId?: string | null,
): string | null {
  const normalized = normalizeSubject(subject);
  if (!normalized) return null;

  const existing = queryOne<{ id: string; message_count: number }>(
    'SELECT id, message_count FROM topics WHERE account_id = ? AND normalized_subject = ?',
    [accountId, normalized],
  );

  if (existing) {
    execute(
      'UPDATE topics SET message_count = ? WHERE id = ?',
      [existing.message_count + 1, existing.id],
    );
    return existing.id;
  }

  const topicId = uuidv4();
  execute(
    'INSERT INTO topics (id, name, normalized_subject, message_count, account_id) VALUES (?, ?, ?, ?, ?)',
    [topicId, normalized, normalized, 1, accountId],
  );

  return topicId;
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|FW|Válasz|Továbbítás):\s*/gi, '')
    .replace(/^(Re|Fwd|FW|Válasz|Továbbítás):\s*/gi, '')
    .trim();
}

function updateSenderGroup(
  accountId: string,
  email: string,
  name: string | null | undefined,
  date: number,
) {
  if (!email) return;

  const domain = email.split('@')[1] || '';
  const existing = queryOne<{ id: string; message_count: number; last_message_at: number | null; name: string | null }>(
    'SELECT id, message_count, last_message_at, name FROM sender_groups WHERE account_id = ? AND email = ?',
    [accountId, email],
  );

  if (existing) {
    execute(
      'UPDATE sender_groups SET message_count = ?, last_message_at = ?, name = ? WHERE id = ?',
      [existing.message_count + 1, Math.max(existing.last_message_at || 0, date), name || existing.name, existing.id],
    );
  } else {
    execute(
      'INSERT INTO sender_groups (id, email, name, domain, message_count, last_message_at, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), email, name || null, domain, 1, date, accountId],
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const syncIntervals = new Map<string, NodeJS.Timeout>();

export function startBackgroundSync(accountId: string) {
  if (syncIntervals.has(accountId)) return;

  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS || '120000');
  const interval = setInterval(async () => {
    try {
      await syncAccount(accountId);
    } catch (err) {
      console.error(`Háttér szinkronizálás hiba (${accountId}):`, err);
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
