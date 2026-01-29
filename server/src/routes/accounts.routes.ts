import { Router } from 'express';
import {
  getAllAccounts,
  getAccountById,
  deleteAccount,
} from '../services/auth.service.js';
import {
  syncAccount,
  startBackgroundSync,
  stopBackgroundSync,
} from '../services/sync.service.js';

const router = Router();

// Összes hozzáadott fiók
router.get('/', (req, res) => {
  const accountIds = req.session.accountIds || [];
  const accountsList = getAllAccounts().filter((a) => accountIds.includes(a.id));
  res.json({ accounts: accountsList });
});

// Fiók eltávolítása
router.delete('/:id', (req, res) => {
  const accountId = req.params.id;

  stopBackgroundSync(accountId);
  deleteAccount(accountId);

  if (req.session.accountIds) {
    req.session.accountIds = req.session.accountIds.filter(
      (id) => id !== accountId,
    );
    if (req.session.activeAccountId === accountId) {
      req.session.activeAccountId = req.session.accountIds[0] || null;
    }
  }

  res.json({ success: true });
});

// Szinkronizálás indítása
router.post('/:id/sync', async (req, res) => {
  const accountId = req.params.id;
  const fullSync = req.query.full === 'true';

  try {
    const result = await syncAccount(accountId, fullSync);
    res.json(result);
  } catch (error) {
    console.error('Szinkronizálás hiba:', error);
    res.status(500).json({ error: 'Szinkronizálás sikertelen' });
  }
});

export default router;
