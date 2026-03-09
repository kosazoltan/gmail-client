import logger from '../utils/logger.js';
import { Router } from 'express';
import {
  syncNewsletterSenders,
  getNewsletterSenders,
  toggleMuteSender,
  removeSenderFromNewsletters,
  getNewsletterEmails,
} from '../services/newsletter.service.js';

const router = Router();

// Hírlevél küldők listázása
router.get('/senders', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const senders = await getNewsletterSenders(accountId);

    return res.json({
      senders: senders.map((s) => ({
        id: s.id,
        email: s.sender_email,
        name: s.sender_name,
        isMuted: s.is_muted === 1,
        emailCount: s.email_count,
        lastEmailAt: s.last_email_at,
      })),
    });
  } catch (error) {
    logger.error('Hírlevél küldők lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Hírlevél detektálás futtatása
router.post('/sync', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const detectedCount = await syncNewsletterSenders(accountId);

    return res.json({
      success: true,
      detectedCount,
      message: `${detectedCount} új hírlevél küldő detektálva`,
    });
  } catch (error) {
    logger.error('Hírlevél szinkronizálás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Küldő némítása/feloldása
router.patch('/senders/:id/mute', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { muted } = req.body;

    if (typeof muted !== 'boolean') {
      return res.status(400).json({ error: 'muted mező kötelező (boolean)' });
    }

    const success = await toggleMuteSender(accountId, id, muted);

    if (!success) {
      return res.status(404).json({ error: 'Küldő nem található' });
    }

    return res.json({ success: true, muted });
  } catch (error) {
    logger.error('Küldő némítás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Küldő eltávolítása a hírlevél listából
router.delete('/senders/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const success = await removeSenderFromNewsletters(accountId, id);

    if (!success) {
      return res.status(404).json({ error: 'Küldő nem található' });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('Küldő eltávolítás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// snake_case DB record → camelCase frontend format (consistent with views.routes.ts formatEmail)
function formatNewsletterEmail(email: Record<string, unknown>) {
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
    isRead: email.is_read === 1,
    isStarred: email.is_starred === 1,
    labels: (() => {
      try {
        if (Array.isArray(email.labels)) return email.labels;
        return email.labels ? JSON.parse(email.labels as string) : [];
      } catch (err) {
        logger.warn('Labels JSON parse failed in formatNewsletterEmail', { emailId: email.id, error: err });
        return [];
      }
    })(),
    hasAttachments: email.has_attachments === 1,
    categoryId: email.category_id,
    topicId: email.topic_id,
    newsletterName: email.newsletter_name,  // camelCase
    isMuted: email.is_muted === 1,           // boolean
  };
}

// Hírlevél emailek listázása
router.get('/emails', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), 100);
    const senderId = req.query.senderId as string | undefined;
    const includeMuted = req.query.includeMuted === 'true';

    const result = await getNewsletterEmails(accountId, {
      page,
      limit,
      senderId,
      includeMuted,
    });

    return res.json({
      ...result,
      emails: result.emails.map(formatNewsletterEmail),
    });
  } catch (error) {
    logger.error('Hírlevél emailek lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Hírlevél statisztikák
router.get('/stats', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const senders = await getNewsletterSenders(accountId);
    const totalSenders = senders.length;
    const mutedSenders = senders.filter((s) => s.is_muted === 1).length;
    const totalEmails = senders.reduce((sum, s) => sum + s.email_count, 0);

    return res.json({
      totalSenders,
      mutedSenders,
      activeSenders: totalSenders - mutedSenders,
      totalEmails,
    });
  } catch (error) {
    logger.error('Hírlevél statisztikák hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

export default router;
