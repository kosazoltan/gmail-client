import logger from '../utils/logger.js';
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
  clearAccountData,
} from '../services/sync.service.js';

const router = Router();

// Összes hozzáadott fiók
router.get('/', async (req, res) => {
  const accountIds = req.session.accountIds || [];
  const accountsList = (await getAllAccounts()).filter((a: { id: string }) => accountIds.includes(a.id));
  res.json({ accounts: accountsList });
});

// Fiók eltávolítása
router.delete('/:id', async (req, res) => {
  const accountId = req.params.id;

  // Ellenőrizzük, hogy a felhasználó jogosult-e törölni ezt a fiókot
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    return res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
  }

  stopBackgroundSync(accountId);
  await deleteAccount(accountId);

  if (req.session.accountIds) {
    req.session.accountIds = req.session.accountIds.filter((id) => id !== accountId);
    if (req.session.activeAccountId === accountId) {
      req.session.activeAccountId = req.session.accountIds[0] || null;
    }
  }

  // Session explicit mentése
  req.session.save((err) => {
    if (err) {
      logger.error('Session mentési hiba fiók törlés után:', err);
      return res.status(500).json({ error: 'Session mentési hiba' });
    }
    res.json({ success: true });
  });
});

// Fiók színének frissítése
router.put('/:id/color', async (req, res) => {
  const accountId = req.params.id;
  const { color } = req.body;

  // Ellenőrizzük, hogy a felhasználó jogosult-e módosítani ezt a fiókot
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    return res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
  }

  // Szín validálás (hex formátum)
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res
      .status(400)
      .json({ error: 'Érvénytelen szín formátum (használj #RRGGBB formátumot)' });
  }

  try {
    updateAccountColor(accountId, color);
    res.json({ success: true, color });
  } catch (error) {
    logger.error('Szín frissítési hiba:', error);
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
    logger.error('Szinkronizálás hiba:', error);
    res.status(500).json({ error: 'Szinkronizálás sikertelen' });
  }
});

// Teljes újraszinkronizálás (emailek és kontaktok törlése, majd újraszinkronizálás)
// Használd ezt, ha a karakterkódolás javítása után frissíteni szeretnéd az adatokat
router.post('/:id/resync', async (req, res) => {
  const accountId = req.params.id;

  // Ellenőrizzük, hogy a felhasználó jogosult-e
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) {
    res.status(403).json({ error: 'Nincs jogosultságod ehhez a fiókhoz' });
    return;
  }

  try {
    // Töröljük az összes emailt, kontaktot és kapcsolódó adatot
    clearAccountData(accountId);

    // Teljes újraszinkronizálás
    const result = await syncAccount(accountId, true);
    res.json({
      success: true,
      messagesProcessed: result.messagesProcessed,
      message: 'Adatok újraszinkronizálva',
    });
  } catch (error) {
    logger.error('Újraszinkronizálás hiba:', error);
    res.status(500).json({ error: 'Újraszinkronizálás sikertelen' });
  }
});

export default router;
