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
import { AppError } from '../middleware/error-handler.js';

const router = Router();

router.get('/', (req, res) => {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const sort = (req.query.sort as string) || 'date_desc';
  const offset = (page - 1) * limit;

  const orderBy = sort === 'date_asc' ? 'date ASC' : 'date DESC';

  const results = queryAll(
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
  const emailId = req.params.id;
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;

  let email = queryOne<any>(
    'SELECT * FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );

  if (email && !email.body && !email.body_html) {
    try {
      const { oauth2Client } = getOAuth2ClientForAccount(accountId!);
      const gmail = getGmailClient(oauth2Client);
      const fullMsg = await getMessage(gmail, emailId);

      execute(
        'UPDATE emails SET body = ?, body_html = ? WHERE id = ?',
        [fullMsg.body, fullMsg.bodyHtml, emailId],
      );

      email = { ...email, body: fullMsg.body, body_html: fullMsg.bodyHtml };
    } catch (err) {
      console.error('Email body letöltés hiba:', err);
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
});

router.post('/send', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

  const { to, subject, body, cc } = req.body;
  if (!to || !subject || !body) { res.status(400).json({ error: 'Hiányzó mezők: to, subject, body' }); return; }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, { to, subject, body, cc });
    res.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Email küldés hiba:', error);
    res.status(500).json({ error: 'Email küldés sikertelen' });
  }
});

router.post('/reply', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

  const { to, subject, body, cc, inReplyTo, threadId } = req.body;
  if (!to || !body) { res.status(400).json({ error: 'Hiányzó mezők: to, body' }); return; }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);
    const result = await sendEmail(gmail, { to, subject: subject || '', body, cc, inReplyTo, threadId });
    res.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Válasz küldés hiba:', error);
    res.status(500).json({ error: 'Válasz küldés sikertelen' });
  }
});

router.patch('/:id/read', async (req, res) => {
  const emailId = req.params.id;
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

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
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

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
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
    const gmail = getGmailClient(oauth2Client);

    await trashMessage(gmail, emailId);
    execute('DELETE FROM emails WHERE id = ?', [emailId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Törlés hiba:', error);
    res.status(500).json({ error: 'Törlés sikertelen' });
  }
});

function formatEmail(email: any) {
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
    labels: email.labels ? JSON.parse(email.labels) : [],
    hasAttachments: email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  };
}

export default router;
