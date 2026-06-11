import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { execute, queryAll, queryOne } from '../db/index.js';
import { getEmailAttachments } from '../services/attachment.service.js';
import {
  getOAuth2ClientForAccount,
  isMissingVaultTokenError,
  isOAuthReloginError,
  OAUTH_RELOGIN_REQUIRED_MESSAGE,
} from '../services/auth.service.js';
import { safeUpsertContact } from '../services/contacts.service.js';
import {
  getGmailClient,
  getMessage,
  modifyMessage,
  sendEmail,
  trashMessage,
} from '../services/gmail.service.js';
import logger from '../utils/logger.js';

// Adatbázis rekord interfész
interface EmailRecord {
  id: string;
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

const router = Router();

const MAX_LIMIT = 100;
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB email body limit
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_RELOGIN_REQUIRED_FOR_TRASH_MESSAGE =
  'A Gmail törléshez új Google-belépés szükséges. Jelentkezz ki, majd jelentkezz be újra, hogy a ZMail megkapja a kukába helyezéshez szükséges Gmail jogosultságot.';

// FIX: Extract JSON parse helper to avoid code duplication
function parseLabelsJson(labels: string | null, context?: { emailId?: string }): string[] {
  if (!labels) return [];
  try {
    return JSON.parse(labels);
  } catch (err) {
    if (context?.emailId) {
      logger.warn('Labels JSON parse failed', { emailId: context.emailId, error: err });
    }
    return [];
  }
}

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: {
  query: { accountId?: string };
  session: { activeAccountId?: string | null; accountIds?: string[] };
}): string | null {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) return null;

  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// Email cím validáció
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// Email címek validálása string-ből (to, cc mezőkhöz)
function validateEmailAddresses(addressString: string): boolean {
  if (!addressString) return true; // Üres CC megengedett

  const addresses = addressString
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a);
  for (const addr of addresses) {
    // "Name <email>" formátum
    const match = addr.match(/<([^>]+)>$/);
    const email = match ? match[1] : addr;
    if (!isValidEmail(email)) return false;
  }
  return true;
}

function getExternalErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  const status = err.status ?? err.statusCode ?? err.response?.status ?? err.code;
  return typeof status === 'number' ? status : null;
}

function getExternalErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function isGmailMessageGoneError(error: unknown): boolean {
  const status = getExternalErrorStatus(error);
  if (status === 404 || status === 410) return true;
  return /not found|requested entity was not found|message not found/i.test(
    getExternalErrorMessage(error),
  );
}

function isGmailAuthActionRequired(error: unknown): boolean {
  if (isOAuthReloginError(error)) return true;
  const status = getExternalErrorStatus(error);
  if (status === 401) return true;
  if (status !== 403) return false;
  return /insufficient authentication scopes|invalid credentials/i.test(
    getExternalErrorMessage(error),
  );
}

async function markEmailAsTrashedInDatabase(emailId: string, accountId: string): Promise<boolean> {
  const email = await queryOne<{ labels: string | null }>(
    'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );

  if (!email) return false;

  const currentLabels = parseLabelsJson(email.labels, { emailId });
  const newLabels = Array.from(
    new Set([...currentLabels.filter((label: string) => label !== 'INBOX'), 'TRASH']),
  );

  await execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [
    JSON.stringify(newLabels),
    emailId,
    accountId,
  ]);

  logger.info('Local DB TRASH label update sikeres', {
    emailId,
    accountId,
    labelsBefore: currentLabels,
    labelsAfter: newLabels,
  });

  return true;
}

/**
 * @openapi
 * /api/emails:
 *   get:
 *     tags: [Emails]
 *     summary: Levelek listázása
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: label
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: string
 *           enum: ['0', '1']
 *     responses:
 *       200:
 *         description: Levelek listája
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 emails:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Email'
 *                 total:
 *                   type: integer
 *       400:
 *         description: Nincs aktív fiók
 */
router.get('/', async (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) {
      res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
      return;
    }

    const parsedPage = parseInt(req.query.page as string, 10);
    const parsedLimit = parseInt(req.query.limit as string, 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = Math.min(isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit, MAX_LIMIT);
    const sort = (req.query.sort as string) || 'date_desc';
    const offset = (page - 1) * limit;

    // Whitelist sort values to prevent SQL injection
    const ALLOWED_SORTS: Record<string, string> = {
      date_asc: 'date ASC',
      date_desc: 'date DESC',
    };
    const orderBy = ALLOWED_SORTS[sort] || 'date DESC';

    const results = await queryAll<EmailRecord>(
      `SELECT * FROM emails
       WHERE account_id = ? AND (labels IS NULL OR labels NOT LIKE '%"TRASH"%')
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [accountId, limit, offset],
    );

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM emails
       WHERE account_id = ? AND (labels IS NULL OR labels NOT LIKE '%"TRASH"%')`,
      [accountId],
    );
    const total = countResult?.total || 0;

    res.json({
      emails: results.map(formatEmail),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('Email lista lekérés hiba:', err);
    res.status(500).json({ error: 'Szerver hiba az email lista lekérésekor' });
  }
});

// Thread conversation - összes email egy thread-ből (sent + received), body-val együtt
router.get('/:id/thread', async (req, res) => {
  try {
    const emailId = req.params.id;
    const accountId = validateAccountAccess(req);

    if (!accountId) {
      res.status(403).json({ error: 'Nincs jogosultság' });
      return;
    }

    // Először keressük meg az email thread_id-ját
    const email = await queryOne<EmailRecord>(
      'SELECT * FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (!email) {
      res.status(404).json({ error: 'Email nem található' });
      return;
    }

    // Ha nincs threadId, csak ezt az egy emailt adjuk vissza
    if (!email.thread_id) {
      const emailAttachments = await getEmailAttachments(emailId);
      const accountInfo = await queryOne<{ email: string }>(
        'SELECT email FROM accounts WHERE id = ?',
        [accountId],
      );
      res.json({
        threadId: null,
        accountEmail: accountInfo?.email || null,
        emails: [
          {
            ...formatEmail(email),
            body: email.body,
            bodyHtml: email.body_html,
            attachments: emailAttachments,
          },
        ],
      });
      return;
    }

    // Lekérjük az összes NEM kukázott emailt ebből a thread-ből (időrendben)
    const threadEmails = await queryAll<EmailRecord>(
      `SELECT * FROM emails
       WHERE account_id = ? AND thread_id = ?
         AND (labels IS NULL OR labels NOT LIKE '%"TRASH"%')
       ORDER BY date ASC`,
      [accountId, email.thread_id],
    );

    // Lekérjük az account email-jét, hogy tudjuk melyik a "saját" küldés
    const accountInfo = await queryOne<{ email: string }>(
      'SELECT email FROM accounts WHERE id = ?',
      [accountId],
    );

    // Ha hiányoznak body-k, megpróbáljuk letölteni a Gmail-ből
    let oauth2Client: Awaited<ReturnType<typeof getOAuth2ClientForAccount>>['oauth2Client'] | null =
      null;
    let gmail: ReturnType<typeof getGmailClient> | null = null;

    const formattedEmails = [];
    for (const threadEmail of threadEmails) {
      let emailBody = threadEmail.body;
      let emailBodyHtml = threadEmail.body_html;

      // Body letöltése ha hiányzik
      if (!emailBody && !emailBodyHtml) {
        try {
          if (!oauth2Client) {
            const auth = await getOAuth2ClientForAccount(accountId);
            oauth2Client = auth.oauth2Client;
            gmail = getGmailClient(oauth2Client);
          }
          const fullMsg = await getMessage(gmail!, threadEmail.id, accountId);
          emailBody = fullMsg.body;
          emailBodyHtml = fullMsg.bodyHtml;

          await execute(
            'UPDATE emails SET body = ?, body_html = ? WHERE id = ? AND account_id = ?',
            [fullMsg.body, fullMsg.bodyHtml, threadEmail.id, accountId],
          );
        } catch (err) {
          logger.warn('Thread email body letöltés hiba', { emailId: threadEmail.id, error: err });
          // Ne akadjon el a teljes thread
        }
      }

      const emailAttachments = await getEmailAttachments(threadEmail.id);
      const labels = parseLabelsJson(threadEmail.labels, { emailId: threadEmail.id });

      formattedEmails.push({
        ...formatEmail(threadEmail),
        body: emailBody,
        bodyHtml: emailBodyHtml,
        attachments: emailAttachments,
        isSent: labels.includes('SENT'),
        isDraft: labels.includes('DRAFT'),
      });
    }

    res.json({
      threadId: email.thread_id,
      accountEmail: accountInfo?.email || null,
      emails: formattedEmails,
    });
  } catch (err) {
    logger.error('Thread conversation lekérés hiba:', err);
    res.status(500).json({ error: 'Szerver hiba a thread lekérésekor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const emailId = req.params.id;
    const accountId = validateAccountAccess(req);

    if (!accountId) {
      res.status(403).json({ error: 'Nincs jogosultság' });
      return;
    }

    let email = await queryOne<EmailRecord>(
      'SELECT * FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (email && !email.body && !email.body_html) {
      try {
        const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
        const gmail = getGmailClient(oauth2Client);
        const fullMsg = await getMessage(gmail, emailId, accountId);

        await execute('UPDATE emails SET body = ?, body_html = ? WHERE id = ? AND account_id = ?', [
          fullMsg.body,
          fullMsg.bodyHtml,
          emailId,
          accountId,
        ]);

        email = { ...email, body: fullMsg.body, body_html: fullMsg.bodyHtml };
      } catch (err) {
        logger.error('Email body letöltés hiba:', err);
        throw err; // Re-throw so outer handler catches it
      }
    }

    if (!email) {
      res.status(404).json({ error: 'Email nem található' });
      return;
    }

    const emailAttachments = await getEmailAttachments(emailId);

    res.json({
      ...formatEmail(email),
      body: email.body,
      bodyHtml: email.body_html,
      attachments: emailAttachments,
    });
  } catch (err) {
    logger.error('Email lekérés hiba:', err);
    res.status(500).json({ error: 'Szerver hiba az email lekérésekor' });
  }
});

// Helper: get undo send delay for an account (0 = disabled)
async function getUndoSendDelay(accountId: string): Promise<number> {
  const setting = await queryOne<{ value: string }>(
    "SELECT value FROM user_settings WHERE account_id = ? AND key = 'undoSendDelay'",
    [accountId],
  );
  if (!setting) return 0;
  const delay = parseInt(setting.value, 10);
  return isNaN(delay) || delay < 0 ? 0 : delay;
}

router.post('/send', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { to, subject, body, cc, bcc, attachments } = req.body;
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'Hiányzó mezők: to, subject, body' });
    return;
  }

  // Email cím validáció
  if (!validateEmailAddresses(to)) {
    res.status(400).json({ error: 'Érvénytelen címzett email cím' });
    return;
  }
  if (cc && !validateEmailAddresses(cc)) {
    res.status(400).json({ error: 'Érvénytelen CC email cím' });
    return;
  }
  if (bcc && !validateEmailAddresses(bcc)) {
    res.status(400).json({ error: 'Érvénytelen BCC email cím' });
    return;
  }

  // Body méret ellenőrzés
  if (body.length > MAX_BODY_SIZE) {
    res.status(400).json({ error: 'Az email törzse túl nagy (max 5MB)' });
    return;
  }

  try {
    // Check undo send delay setting
    const undoDelay = await getUndoSendDelay(accountId);

    if (undoDelay > 0) {
      // Schedule instead of sending immediately
      const scheduledId = uuid();
      const sendAt = Date.now() + undoDelay * 1000;
      const attachmentsJson = attachments ? JSON.stringify(attachments) : null;

      await execute(
        `INSERT INTO scheduled_emails (id, account_id, to_addresses, cc_addresses, bcc_addresses, subject, body, scheduled_at, status, created_at, attachments_json, is_undo_send)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 1)`,
        [
          scheduledId,
          accountId,
          to,
          cc || null,
          bcc || null,
          subject,
          body,
          sendAt,
          Date.now(),
          attachmentsJson,
        ],
      );

      void saveRecipientsToContacts(accountId, to, cc, bcc).catch((e) =>
        logger.warn('saveRecipientsToContacts (scheduled send):', e),
      );

      res.json({
        success: true,
        scheduledId,
        undoAvailable: true,
        undoSeconds: undoDelay,
      });
      return;
    }

    // No undo delay — send immediately
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, accountId, { to, subject, body, cc, bcc, attachments });

    void saveRecipientsToContacts(accountId, to, cc, bcc).catch((e) =>
      logger.warn('saveRecipientsToContacts (send):', e),
    );

    res.json({ success: true, messageId: result.id });
  } catch (error) {
    logger.error('Email küldés hiba:', error);
    res.status(500).json({ error: 'Email küldés sikertelen' });
  }
});

router.post('/reply', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { to, subject, body, cc, bcc, inReplyTo, threadId, attachments } = req.body;
  if (!to || !body) {
    res.status(400).json({ error: 'Hiányzó mezők: to, body' });
    return;
  }

  // Email cím validáció
  if (!validateEmailAddresses(to)) {
    res.status(400).json({ error: 'Érvénytelen címzett email cím' });
    return;
  }
  if (cc && !validateEmailAddresses(cc)) {
    res.status(400).json({ error: 'Érvénytelen CC email cím' });
    return;
  }
  if (bcc && !validateEmailAddresses(bcc)) {
    res.status(400).json({ error: 'Érvénytelen BCC email cím' });
    return;
  }

  // Body méret ellenőrzés
  if (body.length > MAX_BODY_SIZE) {
    res.status(400).json({ error: 'Az email törzse túl nagy (max 5MB)' });
    return;
  }

  try {
    // Check undo send delay setting
    const undoDelay = await getUndoSendDelay(accountId);

    if (undoDelay > 0) {
      // Schedule reply instead of sending immediately
      const scheduledId = uuid();
      const sendAt = Date.now() + undoDelay * 1000;
      const attachmentsJson = attachments ? JSON.stringify(attachments) : null;

      await execute(
        `INSERT INTO scheduled_emails (id, account_id, to_addresses, cc_addresses, bcc_addresses, subject, body, scheduled_at, status, created_at, in_reply_to, thread_id, attachments_json, is_undo_send)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 1)`,
        [
          scheduledId,
          accountId,
          to,
          cc || null,
          bcc || null,
          subject || '',
          body,
          sendAt,
          Date.now(),
          inReplyTo || null,
          threadId || null,
          attachmentsJson,
        ],
      );

      void saveRecipientsToContacts(accountId, to, cc, bcc).catch((e) =>
        logger.warn('saveRecipientsToContacts (scheduled reply):', e),
      );

      res.json({
        success: true,
        scheduledId,
        undoAvailable: true,
        undoSeconds: undoDelay,
      });
      return;
    }

    // No undo delay — send immediately
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, accountId, {
      to,
      subject: subject || '',
      body,
      cc,
      bcc,
      inReplyTo,
      threadId,
      attachments,
    });

    void saveRecipientsToContacts(accountId, to, cc, bcc).catch((e) =>
      logger.warn('saveRecipientsToContacts (reply):', e),
    );

    res.json({ success: true, messageId: result.id });
  } catch (error) {
    logger.error('Válasz küldés hiba:', error);
    res.status(500).json({ error: 'Válasz küldés sikertelen' });
  }
});

router.patch('/:id/read', async (req, res) => {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { isRead } = req.body;
  if (typeof isRead !== 'boolean' && isRead !== 0 && isRead !== 1) {
    res.status(400).json({ error: 'isRead mező kötelező (boolean)' });
    return;
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    if (isRead) {
      await modifyMessage(gmail, emailId, accountId, { removeLabels: ['UNREAD'] });
    } else {
      await modifyMessage(gmail, emailId, accountId, { addLabels: ['UNREAD'] });
    }

    await execute('UPDATE emails SET is_read = ? WHERE id = ? AND account_id = ?', [
      isRead ? 1 : 0,
      emailId,
      accountId,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Olvasott jelölés hiba:', error);
    res.status(500).json({ error: 'Módosítás sikertelen' });
  }
});

router.patch('/:id/star', async (req, res) => {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { isStarred } = req.body;
  if (typeof isStarred !== 'boolean' && isStarred !== 0 && isStarred !== 1) {
    res.status(400).json({ error: 'isStarred mező kötelező (boolean)' });
    return;
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    if (isStarred) {
      await modifyMessage(gmail, emailId, accountId, { addLabels: ['STARRED'] });
    } else {
      await modifyMessage(gmail, emailId, accountId, { removeLabels: ['STARRED'] });
    }

    await execute('UPDATE emails SET is_starred = ? WHERE id = ? AND account_id = ?', [
      isStarred ? 1 : 0,
      emailId,
      accountId,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Csillagozás hiba:', error);
    res.status(500).json({ error: 'Módosítás sikertelen' });
  }
});

// Batch mark read/unread
router.patch('/batch-read', async (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) {
      res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
      return;
    }

    const { emailIds, isRead } = req.body;
    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      res.status(400).json({ error: 'emailIds tömb szükséges' });
      return;
    }
    if (typeof isRead !== 'boolean') {
      res.status(400).json({ error: 'isRead boolean szükséges' });
      return;
    }

    // Validate all elements are strings
    if (!emailIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      res.status(400).json({ error: 'Minden emailId-nek szövegnek kell lennie' });
      return;
    }

    // Védőkorlát nagyon nagy payload ellen (Gmail API hívások száma korlátos)
    if (emailIds.length > 500) {
      res.status(400).json({ error: 'Maximum 500 email módosítható egyszerre' });
      return;
    }

    const placeholders = emailIds.map(() => '?').join(',');
    const ownedEmails = await queryAll<{ id: string }>(
      `SELECT id FROM emails WHERE id IN (${placeholders}) AND account_id = ?`,
      [...emailIds, accountId],
    );

    if (ownedEmails.length === 0) {
      res.json({ updatedCount: 0, failedCount: emailIds.length });
      return;
    }

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const updatedIds: string[] = [];

    for (const { id } of ownedEmails) {
      try {
        if (isRead) {
          await modifyMessage(gmail, id, accountId, { removeLabels: ['UNREAD'] });
        } else {
          await modifyMessage(gmail, id, accountId, { addLabels: ['UNREAD'] });
        }
        updatedIds.push(id);
      } catch (err) {
        logger.error('Batch mark read Gmail sync error:', { emailId: id, error: err });
      }
    }

    if (updatedIds.length > 0) {
      const updatedPlaceholders = updatedIds.map(() => '?').join(',');
      await execute(
        `UPDATE emails SET is_read = ? WHERE id IN (${updatedPlaceholders}) AND account_id = ?`,
        [isRead ? 1 : 0, ...updatedIds, accountId],
      );
    }

    res.json({
      updatedCount: updatedIds.length,
      failedCount: ownedEmails.length - updatedIds.length,
    });
  } catch (error) {
    logger.error('Batch mark read error:', error);
    res.status(500).json({ error: 'Hiba a batch olvasottság módosítás során' });
  }
});

// Batch email törlés (kukába helyezés) — POST is elfogadott (DELETE body nem mindig megy át proxy-n)
router.post('/batch-delete', async (req, res) => {
  // Forward to the same handler
  req.method = 'DELETE';
  return batchDeleteHandler(req, res);
});
router.delete('/batch', async (req, res) => {
  return batchDeleteHandler(req, res);
});

async function batchDeleteHandler(req: any, res: any) {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { emailIds } = req.body;
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    res.status(400).json({ error: 'Hiányzó vagy érvénytelen emailIds tömb' });
    return;
  }

  // Validate all elements are non-empty strings
  if (!emailIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
    res.status(400).json({ error: 'emailIds must contain only non-empty strings' });
    return;
  }

  // Védőkorlát nagyon nagy payload ellen
  if (emailIds.length > 500) {
    res.status(400).json({ error: 'Maximum 500 email törölhető egyszerre' });
    return;
  }

  try {
    // Csak a fiókhoz tartozó emaileket dolgozzuk fel (idegen/elavult ID = hiba, nem siker)
    const placeholders = emailIds.map(() => '?').join(',');
    const ownedRows = await queryAll<{ id: string }>(
      `SELECT id FROM emails WHERE id IN (${placeholders}) AND account_id = ?`,
      [...emailIds, accountId],
    );
    const ownedIds = ownedRows.map((row) => row.id);

    let successCount = 0;
    let failCount = emailIds.length - ownedIds.length;
    if (failCount > 0) {
      logger.warn('Batch delete: nem a fiókhoz tartozó email ID-k kihagyva', {
        accountId,
        skippedCount: failCount,
      });
    }

    if (ownedIds.length === 0) {
      res.json({ success: true, deletedCount: 0, failedCount: failCount });
      return;
    }

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    const BATCH_SIZE = 20;

    // Korlátozott párhuzamosítás: gyorsabb nagyobb kijelölésnél, de nem terheli túl a Gmail API-t.
    for (let i = 0; i < ownedIds.length; i += BATCH_SIZE) {
      const chunk = ownedIds.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (emailId: string) => {
          try {
            await trashMessage(gmail, emailId, accountId);
          } catch (error) {
            if (!isGmailMessageGoneError(error)) throw error;
            logger.warn('Batch delete: Gmail message már nem található, lokálisan kukázzuk', {
              emailId,
              accountId,
              error: getExternalErrorMessage(error),
            });
          }

          const localUpdated = await markEmailAsTrashedInDatabase(emailId, accountId);
          if (!localUpdated) {
            throw new Error('Lokális email rekord nem frissült törléskor');
          }
        }),
      );

      for (const [idx, result] of chunkResults.entries()) {
        if (result.status === 'fulfilled') {
          successCount++;
          continue;
        }
        const emailId = chunk[idx];
        logger.error('Batch delete - egyedi email törlés hiba', { emailId, error: result.reason });
        failCount++;
      }
    }

    res.json({ success: true, deletedCount: successCount, failedCount: failCount });
  } catch (error) {
    if (isMissingVaultTokenError(error) || isGmailAuthActionRequired(error)) {
      res.status(401).json({
        error: isMissingVaultTokenError(error)
          ? OAUTH_RELOGIN_REQUIRED_MESSAGE
          : GMAIL_RELOGIN_REQUIRED_FOR_TRASH_MESSAGE,
        code: 'OAUTH_RELOGIN_REQUIRED',
      });
      return;
    }
    logger.error('Batch törlés hiba:', error);
    res.status(500).json({ error: 'Batch törlés sikertelen' });
  }
}

async function trashSingleEmailHandler(req: any, res: any) {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  try {
    logger.info('Email törlés kérés érkezett', {
      route: `${req.method} /api/emails/:id${req.path.endsWith('/trash') ? '/trash' : ''}`,
      emailId,
      accountId,
      requestId: req.headers['x-request-id'] || null,
    });

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    let gmailSynced = true;
    try {
      await trashMessage(gmail, emailId, accountId);
      logger.info('Gmail trash sikeres', { emailId, accountId });
    } catch (error) {
      if (!isGmailMessageGoneError(error)) throw error;
      gmailSynced = false;
      logger.warn('Gmail message már nem található, lokálisan kukázzuk', {
        emailId,
        accountId,
        error: getExternalErrorMessage(error),
      });
    }

    const localUpdated = await markEmailAsTrashedInDatabase(emailId, accountId);
    if (!localUpdated) {
      logger.warn('Local DB email record nem található törlés után', { emailId, accountId });
    }

    res.json({ success: true, gmailSynced, localUpdated });
  } catch (error) {
    if (isMissingVaultTokenError(error) || isGmailAuthActionRequired(error)) {
      res.status(401).json({
        error: isMissingVaultTokenError(error)
          ? OAUTH_RELOGIN_REQUIRED_MESSAGE
          : GMAIL_RELOGIN_REQUIRED_FOR_TRASH_MESSAGE,
        code: 'OAUTH_RELOGIN_REQUIRED',
      });
      return;
    }
    logger.error('Törlés hiba:', {
      emailId,
      accountId,
      requestId: req.headers['x-request-id'] || null,
      error,
    });
    res.status(502).json({
      error: 'A Gmail nem tudta kukába helyezni a levelet. Próbáld újra később.',
    });
  }
}

// Email törlése (kukába helyezés) — POST is elfogadott proxy/webview kompatibilitás miatt.
router.post('/:id/trash', trashSingleEmailHandler);
router.delete('/:id', trashSingleEmailHandler);

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
    labels: parseLabelsJson(email.labels, { emailId: email.id }),
    hasAttachments: email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  };
}

// Címzettek mentése a kontaktokba küldéskor/válaszkor (háttérben, hibatűrő)
async function saveRecipientsToContacts(accountId: string, to: string, cc?: string, bcc?: string) {
  if (to) {
    const toAddresses = parseEmailAddresses(to);
    for (const addr of toAddresses) {
      await safeUpsertContact(accountId, addr.email, addr.name);
    }
  }

  if (cc) {
    const ccAddresses = parseEmailAddresses(cc);
    for (const addr of ccAddresses) {
      await safeUpsertContact(accountId, addr.email, addr.name);
    }
  }

  if (bcc) {
    const bccAddresses = parseEmailAddresses(bcc);
    for (const addr of bccAddresses) {
      await safeUpsertContact(accountId, addr.email, addr.name);
    }
  }
}

// Email cím lista feldolgozása
function parseEmailAddresses(addressString: string): Array<{ email: string; name: string | null }> {
  const results: Array<{ email: string; name: string | null }> = [];
  const parts = addressString.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // "Name <email>" formátum
    const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      results.push({
        name: match[1].trim().replace(/^["']|["']$/g, ''),
        email: match[2].trim(),
      });
    } else if (trimmed.includes('@')) {
      results.push({
        name: null,
        email: trimmed,
      });
    }
  }

  return results;
}

// Voice-to-text transcription endpoint
// POST /api/emails/transcribe
// Body: { audioBase64: string, language: string }
// Supports both local STT server and OpenAI Whisper API fallback
router.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, language = 'hu' } = req.body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio base64 required' });
    }

    // Decode base64 to binary
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Try local STT server first (Faster Whisper)
    try {
      const formData = new FormData();
      formData.append('audio', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
      formData.append('language', language);

      const localResponse = await fetch('http://127.0.0.1:18790/transcribe', {
        method: 'POST',
        body: formData as any,
        signal: AbortSignal.timeout(30000),
      });

      if (localResponse.ok) {
        const data = (await localResponse.json()) as { text: string };
        return res.json({ text: data.text });
      }
    } catch (err) {
      logger.warn('Local STT server unavailable, fallback to Whisper', { error: err });
    }

    // Fallback to OpenAI Whisper API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Transcription service unavailable (no API key configured)',
      });
    }

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData as any,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Whisper API error', { status: response.status, error });
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = (await response.json()) as { text: string };
    res.json({ text: data.text });
  } catch (err) {
    logger.error('Transcription endpoint error', { error: err });
    res.status(500).json({ error: 'Transcription service error' });
  }
});

export default router;
