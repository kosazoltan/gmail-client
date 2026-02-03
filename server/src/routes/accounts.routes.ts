import { Router } from 'express';
import {
  getAllAccounts,
  getAccountById,
  deleteAccount,
  updateAccountColor,
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

  // Ellenőrizzük, hogy a felhasználó jogosult-e törölni ezt a fiókot
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    return res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
  }

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

  // Session explicit mentése
  req.session.save((err) => {
    if (err) {
      console.error('Session mentési hiba fiók törlés után:', err);
      return res.status(500).json({ error: 'Session mentési hiba' });
    }
    res.json({ success: true });
  });
});

// Fiók színének frissítése
router.put('/:id/color', (req, res) => {
  const accountId = req.params.id;
  const { color } = req.body;

  // Ellenőrizzük, hogy a felhasználó jogosult-e módosítani ezt a fiókot
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    return res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
  }

  // Szín validálás (hex formátum)
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Érvénytelen szín formátum (használj #RRGGBB formátumot)' });
  }

  try {
    updateAccountColor(accountId, color);
    res.json({ success: true, color });
  } catch (error) {
    console.error('Szín frissítési hiba:', error);
    res.status(500).json({ error: 'Szín frissítése sikertelen' });
  }
});

// Szinkronizálás indítása
router.post('/:id/sync', async (req, res) => {
  const accountId = req.params.id;

  // Ellenőrizzük, hogy a felhasználó jogosult-e szinkronizálni ezt a fiókot
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
    return;
  }

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
