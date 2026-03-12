import logger from '../utils/logger.js';
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

const logoutSchema = z.object({
  accountId: z.string().min(1).max(255).optional(),
});

const switchAccountSchema = z.object({
  accountId: z.string().min(1).max(255),
});
import { getAuthUrl, handleAuthCallback, getAllAccounts } from '../services/auth.service.js';
import { startBackgroundSync } from '../services/sync.service.js';
import { deleteSubscriptionsByAccount } from '../services/push.service.js';

const router = Router();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

// OAuth2 login redirect URL generálás
router.get('/login', async (req, res) => {
  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  // Save session before generating URL to ensure state is persisted
  req.session.save(async (err) => {
    if (err) {
      logger.error('Session mentési hiba login előtt:', err);
      res.status(500).json({ error: 'Session hiba' });
      return;
    }
    const url = getAuthUrl(state);
    res.json({ url });
  });
});

// OAuth2 callback - Google ide irányít vissza
router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      res.status(400).json({ error: 'Hiányzó authorization code' });
      return;
    }

    // CSRF protection - validate state parameter
    const expectedState = req.session.oauthState;
    if (!state || !expectedState || state !== expectedState) {
      logger.error('OAuth CSRF validation failed - state mismatch');
      res.redirect(`${frontendUrl}/?error=csrf_validation_failed`);
      return;
    }

    // Clear the state after validation (one-time use)
    delete req.session.oauthState;

    const { accountId } = await handleAuthCallback(code);

    // Session frissítés
    if (!req.session.accountIds) {
      req.session.accountIds = [];
    }
    if (!req.session.accountIds.includes(accountId)) {
      req.session.accountIds.push(accountId);
    }
    req.session.activeAccountId = accountId;

    // Session explicit mentése mielőtt redirect
    req.session.save(async (err) => {
      if (err) {
        logger.error('Session mentési hiba:', err);
        res.redirect(`${frontendUrl}/?error=session_failed`);
        return;
      }

      // Háttér szinkronizálás indítása
      await startBackgroundSync(accountId);

      // Redirect a frontendre
      res.redirect(`${frontendUrl}/?account=${accountId}&newLogin=true`);
    });
  } catch (error) {
    logger.error('OAuth callback hiba:', error);
    res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
});

// Kijelentkezés
router.post('/logout', async (req, res) => {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Érvénytelen kérés', details: parsed.error.issues });
    return;
  }
  const { accountId } = parsed.data;
  if (accountId && req.session.accountIds) {
    req.session.accountIds = req.session.accountIds.filter((id) => id !== accountId);
    if (req.session.activeAccountId === accountId) {
      req.session.activeAccountId = req.session.accountIds[0] || null;
    }
    // Push subscription-ök törlése a kijelentkezett fiókhoz
    deleteSubscriptionsByAccount(accountId).catch(err =>
      logger.warn('Push subscription cleanup error:', err)
    );
  }

  // Session explicit mentése
  req.session.save(async (err) => {
    if (err) {
      logger.error('Session mentési hiba logout után:', err);
      res.status(500).json({ error: 'Session mentési hiba' });
      return;
    }
    res.json({ success: true });
  });
});

// Session info
router.get('/session', async (req, res) => {
  const accountIds = req.session.accountIds || [];
  const activeAccountId = req.session.activeAccountId || null;

  if (accountIds.length === 0) {
    res.json({ authenticated: false, accounts: [], activeAccountId: null });
    return;
  }

  const accountsList = (await getAllAccounts()).filter((a) => accountIds.includes(a.id));

  res.json({
    authenticated: true,
    accounts: accountsList,
    activeAccountId,
  });
});

// Aktív fiók váltás
router.post('/switch-account', async (req, res) => {
  const parsed = switchAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Érvénytelen kérés', details: parsed.error.issues });
    return;
  }
  const { accountId } = parsed.data;
  if (accountId && req.session.accountIds && req.session.accountIds.includes(accountId)) {
    req.session.activeAccountId = accountId;

    // Session explicit mentése
    req.session.save(async (err) => {
      if (err) {
        logger.error('Session mentési hiba switch után:', err);
        res.status(500).json({ error: 'Session mentési hiba' });
        return;
      }
      res.json({ success: true, activeAccountId: accountId });
    });
  } else {
    res.status(400).json({ error: 'Érvénytelen fiók' });
  }
});

export default router;

