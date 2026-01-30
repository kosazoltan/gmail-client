import { Router } from 'express';
import {
  getAuthUrl,
  handleAuthCallback,
  getAllAccounts,
} from '../services/auth.service.js';
import { startBackgroundSync } from '../services/sync.service.js';

const router = Router();
const frontendUrl = process.env.FRONTEND_URL || 'https://mail.mindenes.org';

// OAuth2 login redirect URL generálás
router.get('/login', (_req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

// OAuth2 callback - Google ide irányít vissza
router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: 'Hiányzó authorization code' });
      return;
    }

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
    req.session.save((err) => {
      if (err) {
        console.error('Session mentési hiba:', err);
        res.redirect(`${frontendUrl}/?error=session_failed`);
        return;
      }

      // Háttér szinkronizálás indítása
      startBackgroundSync(accountId);

      // Redirect a frontendre
      res.redirect(`${frontendUrl}/?account=${accountId}&newLogin=true`);
    });
  } catch (error) {
    console.error('OAuth callback hiba:', error);
    res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
});

// Kijelentkezés
router.post('/logout', (req, res) => {
  const { accountId } = req.body;
  if (accountId && req.session.accountIds) {
    req.session.accountIds = req.session.accountIds.filter(
      (id) => id !== accountId,
    );
    if (req.session.activeAccountId === accountId) {
      req.session.activeAccountId = req.session.accountIds[0] || null;
    }
  }

  // Session explicit mentése
  req.session.save((err) => {
    if (err) {
      console.error('Session mentési hiba logout után:', err);
    }
    res.json({ success: true });
  });
});

// Session info
router.get('/session', (req, res) => {
  const accountIds = req.session.accountIds || [];
  const activeAccountId = req.session.activeAccountId || null;

  if (accountIds.length === 0) {
    res.json({ authenticated: false, accounts: [], activeAccountId: null });
    return;
  }

  const accountsList = getAllAccounts().filter((a) => accountIds.includes(a.id));

  res.json({
    authenticated: true,
    accounts: accountsList,
    activeAccountId,
  });
});

// Aktív fiók váltás
router.post('/switch-account', (req, res) => {
  const { accountId } = req.body;
  if (
    accountId &&
    req.session.accountIds &&
    req.session.accountIds.includes(accountId)
  ) {
    req.session.activeAccountId = accountId;

    // Session explicit mentése
    req.session.save((err) => {
      if (err) {
        console.error('Session mentési hiba switch után:', err);
      }
      res.json({ success: true, activeAccountId: accountId });
    });
  } else {
    res.status(400).json({ error: 'Érvénytelen fiók' });
  }
});

export default router;
