import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db/index.js';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import {
  getGmailClient,
  getMessage,
  sendEmail,
  modifyMessage,
  trashMessage,
} from '../services/gmail.service.js';
import { getEmailAttachments } from '../services/attachment.service.js';
import { upsertContact } from '../services/contacts.service.js';

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

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: { query: { accountId?: string }; session: { activeAccountId?: string | null; accountIds?: string[] } }): string | null {
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

  const addresses = addressString.split(',').map(a => a.trim()).filter(a => a);
  for (const addr of addresses) {
    // "Name <email>" formátum
    const match = addr.match(/<([^>]+)>$/);
    const email = match ? match[1] : addr;
    if (!isValidEmail(email)) return false;
  }
  return true;
}

router.get('/', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
  const sort = (req.query.sort as string) || 'date_desc';
  const offset = (page - 1) * limit;

  const orderBy = sort === 'date_asc' ? 'date ASC' : 'date DESC';

  const results = queryAll<EmailRecord>(
    'SELECT * FROM emails WHERE account_id = ? ORDER BY ' + orderBy + ' LIMIT ? OFFSET ?',
    [accountId, limit, offset],
  );

  const countResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM emails WHERE account_id = ?',
    [accountId],
  );
  const total = countResult?.total || 0;

  res.json({
    emails: results.map(formatEmail),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.get('/:id', async (req, res) => {
  try {
    const emailId = req.params.id;
    const accountId = validateAccountAccess(req);

    if (!accountId) {
      res.status(403).json({ error: 'Nincs jogosultság' });
      return;
    }

    let email = queryOne<EmailRecord>(
      'SELECT * FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId],
    );

    if (email && !email.body && !email.body_html) {
      try {
        const { oauth2Client } = getOAuth2ClientForAccount(accountId);
        const gmail = getGmailClient(oauth2Client);
        const fullMsg = await getMessage(gmail, emailId);

        execute(
          'UPDATE emails SET body = ?, body_html = ? WHERE id = ?',
          [fullMsg.body, fullMsg.bodyHtml, emailId],
        );

        email = { ...email, body: fullMsg.body, body_html: fullMsg.bodyHtml };
      } catch (err) {
        console.error('Email body letöltés hiba:', err);
        throw err; // Re-throw so outer handler catches it
      }
    }

    if (!email) {
      res.status(404).json({ error: 'Email nem található' });
      return;
    }

    const emailAttachments = getEmailAttachments(emailId);

    res.json({
      ...formatEmail(email),
      body: email.body,
      bodyHtml: email.body_html,
      attachments: emailAttachments,
    });
  } catch (err) {
    console.error('Email lekérés hiba:', err);
    res.status(500).json({ error: 'Szerver hiba az email lekérésekor' });
  }
});

router.post('/send', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { to, subject, body, cc, attachments } = req.body;
  if (!to || !subject || !body) { res.status(400).json({ error: 'Hiányzó mezők: to, subject, body' }); return; }

  // Email cím validáció
  if (!validateEmailAddresses(to)) {
    res.status(400).json({ error: 'Érvénytelen címzett email cím' });
    return;
  }
  if (cc && !validateEmailAddresses(cc)) {
    res.status(400).json({ error: 'Érvénytelen CC email cím' });
    return;
  }

  // Body méret ellenőrzés
  if (body.length > MAX_BODY_SIZE) {
    res.status(400).json({ error: 'Az email törzse túl nagy (max 5MB)' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, { to, subject, body, cc, attachments });

    // Címzettek mentése a kontaktokba
    saveRecipientsToContacts(accountId, to, cc);

    res.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Email küldés hiba:', error);
    res.status(500).json({ error: 'Email küldés sikertelen' });
  }
});

router.post('/reply', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { to, subject, body, cc, inReplyTo, threadId, attachments } = req.body;
  if (!to || !body) { res.status(400).json({ error: 'Hiányzó mezők: to, body' }); return; }

  // Email cím validáció
  if (!validateEmailAddresses(to)) {
    res.status(400).json({ error: 'Érvénytelen címzett email cím' });
    return;
  }
  if (cc && !validateEmailAddresses(cc)) {
    res.status(400).json({ error: 'Érvénytelen CC email cím' });
    return;
  }

  // Body méret ellenőrzés
  if (body.length > MAX_BODY_SIZE) {
    res.status(400).json({ error: 'Az email törzse túl nagy (max 5MB)' });
    return;
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, { to, subject: subject || '', body, cc, inReplyTo, threadId, attachments });

    // Címzettek mentése a kontaktokba
    saveRecipientsToContacts(accountId, to, cc);

    res.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Válasz küldés hiba:', error);
    res.status(500).json({ error: 'Válasz küldés sikertelen' });
  }
});

router.patch('/:id/read', async (req, res) => {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { isRead } = req.body;

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    if (isRead) {
      await modifyMessage(gmail, emailId, { removeLabels: ['UNREAD'] });
    } else {
      await modifyMessage(gmail, emailId, { addLabels: ['UNREAD'] });
    }

    execute('UPDATE emails SET is_read = ? WHERE id = ?', [isRead ? 1 : 0, emailId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Olvasott jelölés hiba:', error);
    res.status(500).json({ error: 'Módosítás sikertelen' });
  }
});

router.patch('/:id/star', async (req, res) => {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { isStarred } = req.body;

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    if (isStarred) {
      await modifyMessage(gmail, emailId, { addLabels: ['STARRED'] });
    } else {
      await modifyMessage(gmail, emailId, { removeLabels: ['STARRED'] });
    }

    execute('UPDATE emails SET is_starred = ? WHERE id = ?', [isStarred ? 1 : 0, emailId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Csillagozás hiba:', error);
    res.status(500).json({ error: 'Módosítás sikertelen' });
  }
});

// Email törlése (kukába helyezés)
router.delete('/:id', async (req, res) => {
  const emailId = req.params.id;
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await trashMessage(gmail, emailId);

    // Frissítsük az adatbázisban is - hozzáadjuk a TRASH labelt
    const email = queryOne<{ labels: string | null }>(
      'SELECT labels FROM emails WHERE id = ? AND account_id = ?',
      [emailId, accountId]
    );

    if (email) {
      const currentLabels = (() => {
        try {
          return email.labels ? JSON.parse(email.labels) : [];
        } catch {
          return [];
        }
      })();

      // Hozzáadjuk a TRASH labelt és eltávolítjuk az INBOX-ot
      const newLabels = [...currentLabels.filter((l: string) => l !== 'INBOX'), 'TRASH'];
      execute('UPDATE emails SET labels = ? WHERE id = ? AND account_id = ?', [
        JSON.stringify(newLabels),
        emailId,
        accountId
      ]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Törlés hiba:', error);
    res.status(500).json({ error: 'Törlés sikertelen' });
  }
});

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
    labels: (() => {
      try {
        return email.labels ? JSON.parse(email.labels) : [];
      } catch {
        return [];
      }
    })(),
    hasAttachments: email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  };
}

// Címzettek mentése a kontaktokba küldéskor/válaszkor
function saveRecipientsToContacts(accountId: string, to: string, cc?: string) {
  // To címek feldolgozása
  if (to) {
    const toAddresses = parseEmailAddresses(to);
    for (const addr of toAddresses) {
      upsertContact(accountId, addr.email, addr.name);
    }
  }

  // CC címek feldolgozása
  if (cc) {
    const ccAddresses = parseEmailAddresses(cc);
    for (const addr of ccAddresses) {
      upsertContact(accountId, addr.email, addr.name);
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
        email: match[2].trim()
      });
    } else if (trimmed.includes('@')) {
      results.push({
        name: null,
        email: trimmed
      });
    }
  }

  return results;
}

export default router;
