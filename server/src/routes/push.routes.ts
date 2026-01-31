import { Router } from 'express';
import {
  saveSubscription,
  deleteSubscription,
  getVapidPublicKey,
  sendPushToAccount,
  generateVapidKeys,
} from '../services/push.service.js';

const router = Router();

// VAPID public key lekérése (subscription-höz kell)
router.get('/vapid-public-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: 'Push notifications not configured' });
    return;
  }
  res.json({ publicKey });
});

// Push subscription regisztráció
router.post('/subscribe', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    res.status(401).json({ error: 'Nincs bejelentkezve' });
    return;
  }

  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    res.status(400).json({ error: 'Érvénytelen subscription' });
    return;
  }

  try {
    saveSubscription(accountId, subscription);
    res.json({ success: true, message: 'Push értesítések bekapcsolva' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: 'Subscription mentése sikertelen' });
  }
});

// Push subscription törlése
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint kötelező' });
    return;
  }

  try {
    deleteSubscription(endpoint);
    res.json({ success: true, message: 'Push értesítések kikapcsolva' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Subscription törlése sikertelen' });
  }
});

// Teszt notification küldése (fejlesztéshez)
router.post('/test', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    res.status(401).json({ error: 'Nincs bejelentkezve' });
    return;
  }

  try {
    const result = await sendPushToAccount(accountId, {
      title: 'ZMail teszt',
      body: 'Push értesítések működnek!',
      icon: '/icons/icon-192x192.png',
      url: '/',
    });
    res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Push test error:', error);
    res.status(500).json({ error: 'Teszt küldése sikertelen' });
  }
});

// VAPID kulcsok generálása (egyszeri admin művelet)
router.get('/generate-vapid-keys', (_req, res) => {
  // Ez csak fejlesztéshez - production-ben ne legyen elérhető!
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not available in production' });
    return;
  }

  const keys = generateVapidKeys();
  res.json({
    message: 'Add these to your .env file:',
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  });
});

export default router;
