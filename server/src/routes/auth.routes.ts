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
import { runInvoiceAutomation } from '../services/invoice-automation.service.js';

const router = Router();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

function triggerInvoiceAutomationOnNewLogin(accountId: string): void {
  const runForAccount = async () => {
    const accounts = await getAllAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    await runInvoiceAutomation([{ id: account.id, email: account.email }]);
  };

  const delays = [0, 60_000, 180_000];
  for (const delayMs of delays) {
    setTimeout(() => {
      runForAccount().catch((err) =>
        logger.error(
          `Invoice automation login-trigger failed for ${accountId} (+${delayMs}ms)`,
          err,
        ),
      );
    }, delayMs);
  }
}

/**
 * @openapi
 * /api/auth/login:
 *   get:
 *     tags: [Auth]
 *     summary: Google OAuth2 bejelentkezés indítása
 *     description: Generál egy Google OAuth2 authorization URL-t és átirányít.
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: string
 *         description: Meglévő fiók ID újra-hitelesítéshez
 *     responses:
 *       302:
 *         description: Átirányítás a Google OAuth consent oldalra
 *       500:
 *         description: Hiba az OAuth URL generálásakor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
    const forceConsent = req.query.forceConsent === '1' || req.query.forceConsent === 'true';
    const url = getAuthUrl(state, { forceConsent });
    res.json({ url });
  });
});

// OAuth2 callback - Google ide irányít vissza
/**
 * @openapi
 * /api/auth/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Google OAuth2 callback
 *     description: Google átirányít ide a consent után. Session-t hoz létre és szinkronizálást indít.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Sikeres bejelentkezés → frontend redirect
 *       400:
 *         description: Hiányzó authorization code
 */
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

      // Első belépéskor dedikált invoice automation trigger (azonnal + ismétlődő re-check)
      triggerInvoiceAutomationOnNewLogin(accountId);

      // Redirect a frontendre
      res.redirect(`${frontendUrl}/?account=${accountId}&newLogin=true`);
    });
  } catch (error) {
    logger.error('OAuth callback hiba:', error);
    res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Kijelentkezés
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Opcionális — adott fiók kijelentkezése
 *     responses:
 *       200:
 *         description: Sikeres kijelentkezés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
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
    deleteSubscriptionsByAccount(accountId).catch((err) =>
      logger.warn('Push subscription cleanup error:', err),
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

/**
 * @openapi
 * /api/auth/session:
 *   get:
 *     tags: [Auth]
 *     summary: Aktuális session információ
 *     responses:
 *       200:
 *         description: Session állapot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Account'
 *                 activeAccountId:
 *                   type: string
 *                   nullable: true
 */
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

/**
 * @openapi
 * /api/auth/switch-account:
 *   post:
 *     tags: [Auth]
 *     summary: Aktív fiók váltás
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId]
 *             properties:
 *               accountId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sikeres váltás
 *       400:
 *         description: Érvénytelen fiók
 */
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
