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
router.get('/senders', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const senders = getNewsletterSenders(accountId);

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
    console.error('Hírlevél küldők lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Hírlevél detektálás futtatása
router.post('/sync', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const detectedCount = syncNewsletterSenders(accountId);

    return res.json({
      success: true,
      detectedCount,
      message: `${detectedCount} új hírlevél küldő detektálva`,
    });
  } catch (error) {
    console.error('Hírlevél szinkronizálás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Küldő némítása/feloldása
router.patch('/senders/:id/mute', (req, res) => {
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

    const success = toggleMuteSender(accountId, id, muted);

    if (!success) {
      return res.status(404).json({ error: 'Küldő nem található' });
    }

    return res.json({ success: true, muted });
  } catch (error) {
    console.error('Küldő némítás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Küldő eltávolítása a hírlevél listából
router.delete('/senders/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const success = removeSenderFromNewsletters(accountId, id);

    if (!success) {
      return res.status(404).json({ error: 'Küldő nem található' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Küldő eltávolítás hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Hírlevél emailek listázása
router.get('/emails', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const senderId = req.query.senderId as string | undefined;
    const includeMuted = req.query.includeMuted === 'true';

    const result = getNewsletterEmails(accountId, {
      page,
      limit,
      senderId,
      includeMuted,
    });

    return res.json(result);
  } catch (error) {
    console.error('Hírlevél emailek lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Hírlevél statisztikák
router.get('/stats', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const senders = getNewsletterSenders(accountId);
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
    console.error('Hírlevél statisztikák hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

export default router;
