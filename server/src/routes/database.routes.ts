import logger from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  getDatabaseStats,
  listEmailsForManager,
  deleteEmails,
  deleteEmailsByDateRange,
  createBackup,
  listBackups,
  deleteBackup,
  vacuumDatabase,
  deleteOldEmails,
  cleanupOrphanedRecords,
} from '../services/database.service.js';
import { fixAllNamesEncoding } from '../services/contacts.service.js';
import { getAllAccounts } from '../services/auth.service.js';

const router = Router();

const MAX_LIMIT = 100;

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: Request): string | null {
  const accountId = req.session.activeAccountId;
  if (!accountId) return null;

  // Ellenőrizzük, hogy a kért accountId a felhasználó session-jében van-e
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

// Adatbázis statisztikák
router.get('/stats', async (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }
  try {
    const stats = await getDatabaseStats(accountId);
    res.json(stats);
  } catch (error) {
    logger.error('Database stats lekérdezés hiba:', error);
    res.status(500).json({ error: 'Adatbázis statisztikák lekérdezése sikertelen' });
  }
});

// Emailek listázása adatbázis kezelőhöz
router.get('/emails', async (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  // Validate sortOrder against whitelist to prevent SQL injection
  const validSortOrders = ['asc', 'desc'] as const;
  const sortOrderParam = req.query.sortOrder as string;
  const sortOrder = validSortOrders.includes(sortOrderParam as 'asc' | 'desc')
    ? (sortOrderParam as 'asc' | 'desc')
    : 'desc';

  const options = {
    page: Math.max(1, parseInt(req.query.page as string, 10) || 1),
    limit: Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT),
    sortBy: (['date', 'from', 'subject', 'size'] as const).includes(
      req.query.sortBy as 'date' | 'from' | 'subject' | 'size',
    )
      ? (req.query.sortBy as 'date' | 'from' | 'subject' | 'size')
      : 'date',
    sortOrder,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom ? parseInt(req.query.dateFrom as string, 10) : undefined,
    dateTo: req.query.dateTo ? parseInt(req.query.dateTo as string, 10) : undefined,
    hasAttachments:
      req.query.hasAttachments === 'true'
        ? true
        : req.query.hasAttachments === 'false'
          ? false
          : undefined,
    isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
  };

  const result = await listEmailsForManager(accountId, options);
  res.json(result);
});

// Emailek törlése (batch)
router.delete('/emails', async (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { emailIds } = req.body;
  if (!Array.isArray(emailIds)) {
    return res.status(400).json({ error: 'emailIds tömb szükséges' });
  }

  const deletedCount = await deleteEmails(accountId, emailIds);
  res.json({ success: true, deletedCount });
});

// Emailek törlése időszak alapján
router.delete('/emails/by-date', async (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { dateFrom, dateTo } = req.body;
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'dateFrom és dateTo szükséges' });
  }

  const deletedCount = await deleteEmailsByDateRange(accountId, dateFrom, dateTo);
  res.json({ success: true, deletedCount });
});

// Régi emailek törlése
router.delete('/emails/old', async (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { olderThanDays } = req.body;
  if (!olderThanDays || typeof olderThanDays !== 'number') {
    return res.status(400).json({ error: 'olderThanDays szám szükséges' });
  }

  const deletedCount = await deleteOldEmails(accountId, olderThanDays);
  res.json({ success: true, deletedCount });
});

// Backup létrehozása
router.post('/backup', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup létrehozáshoz
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    const backup = await createBackup();
    res.json({ success: true, ...backup });
  } catch (error) {
    logger.error('Backup hiba:', error);
    res.status(501).json({ error: 'Backup létrehozása ebben a PostgreSQL környezetben nem támogatott' });
  }
});

// Backup-ok listázása
router.get('/backups', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const backups = listBackups();
  res.json({
    backups,
    supported: false,
    message: 'A fájlos backupokat a platform kezeli ebben a PostgreSQL környezetben.',
  });
});

// Backup letöltése
router.get('/backups/:filename', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup letöltéshez
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  return res.status(501).json({
    error: 'Backup letöltés ebben a PostgreSQL környezetben nem támogatott',
  });
});

// Backup törlése
router.delete('/backups/:filename', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup törléshez
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }
  return res.status(501).json({
    error: 'Backup törlés ebben a PostgreSQL környezetben nem támogatott',
  });
});

// Adatbázis tömörítés
router.post('/vacuum', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    await vacuumDatabase();
    res.json({ success: true });
  } catch (error) {
    logger.error('Vacuum hiba:', error);
    res.status(500).json({ error: 'Adatbázis tömörítés sikertelen' });
  }
});

// Árva rekordok tisztítása
router.post('/cleanup', async (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    const result = await cleanupOrphanedRecords();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Cleanup hiba:', error);
    res.status(500).json({ error: 'Tisztítás sikertelen' });
  }
});

// Admin: karakterkódolás javítása minden fiókra (session nélkül, csak localhost)
router.post('/fix-encoding-all', async (req: Request, res: Response) => {
  // Csak localhost-ról engedélyezett
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocalhost) {
    return res.status(403).json({ error: 'Csak localhost-ról érhető el' });
  }

  try {
    const accounts = await getAllAccounts();
    const results: Record<string, { contacts: number; senderGroups: number; emails: number }> = {};

    for (const account of accounts) {
      const result = await fixAllNamesEncoding(account.id);
      results[account.email] = result;
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error('Fix encoding hiba:', error);
    res.status(500).json({ error: 'Karakterkódolás javítása sikertelen' });
  }
});

export default router;

