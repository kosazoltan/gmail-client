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
router.get('/stats', (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }
  const stats = getDatabaseStats(accountId);
  res.json(stats);
});

// Emailek listázása adatbázis kezelőhöz
router.get('/emails', (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const options = {
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT),
    sortBy: (req.query.sortBy as 'date' | 'from' | 'subject' | 'size') || 'date',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined,
    hasAttachments: req.query.hasAttachments === 'true' ? true : req.query.hasAttachments === 'false' ? false : undefined,
    isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
  };

  const result = listEmailsForManager(accountId, options);
  res.json(result);
});

// Emailek törlése (batch)
router.delete('/emails', (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { emailIds } = req.body;
  if (!Array.isArray(emailIds)) {
    return res.status(400).json({ error: 'emailIds tömb szükséges' });
  }

  const deletedCount = deleteEmails(accountId, emailIds);
  res.json({ success: true, deletedCount });
});

// Emailek törlése időszak alapján
router.delete('/emails/by-date', (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { dateFrom, dateTo } = req.body;
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'dateFrom és dateTo szükséges' });
  }

  const deletedCount = deleteEmailsByDateRange(accountId, dateFrom, dateTo);
  res.json({ success: true, deletedCount });
});

// Régi emailek törlése
router.delete('/emails/old', (req: Request, res: Response) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const { olderThanDays } = req.body;
  if (!olderThanDays || typeof olderThanDays !== 'number') {
    return res.status(400).json({ error: 'olderThanDays szám szükséges' });
  }

  const deletedCount = deleteOldEmails(accountId, olderThanDays);
  res.json({ success: true, deletedCount });
});

// Backup létrehozása
router.post('/backup', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup létrehozáshoz
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    const backup = createBackup();
    res.json({ success: true, ...backup });
  } catch (error) {
    console.error('Backup hiba:', error);
    res.status(500).json({ error: 'Backup létrehozása sikertelen' });
  }
});

// Backup-ok listázása
router.get('/backups', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const backups = listBackups();
  res.json({ backups });
});

// Backup letöltése
router.get('/backups/:filename', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup letöltéshez
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const filename = req.params.filename as string;

  // Biztonsági ellenőrzés - path traversal védelem
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév' });
  }

  // Csak alfanumerikus karakterek, kötőjelek, pontok engedélyezve
  if (!/^[\w\-\.]+\.db$/.test(filename)) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév formátum' });
  }

  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.resolve(path.dirname(dbPath), 'backups');
  const backupPath = path.resolve(backupDir, filename);

  // Ellenőrizzük, hogy a feloldott útvonal a backup könyvtáron belül van
  if (!backupPath.startsWith(backupDir)) {
    return res.status(400).json({ error: 'Érvénytelen útvonal' });
  }

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup nem található' });
  }

  res.download(backupPath, filename);
});

// Backup törlése
router.delete('/backups/:filename', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés backup törléshez
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  const filename = req.params.filename as string;

  // Biztonsági ellenőrzés
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév' });
  }

  const success = deleteBackup(filename);
  if (!success) {
    return res.status(404).json({ error: 'Backup nem található vagy nem törölhető' });
  }

  res.json({ success: true });
});

// Adatbázis tömörítés
router.post('/vacuum', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    vacuumDatabase();
    res.json({ success: true });
  } catch (error) {
    console.error('Vacuum hiba:', error);
    res.status(500).json({ error: 'Adatbázis tömörítés sikertelen' });
  }
});

// Árva rekordok tisztítása
router.post('/cleanup', (req: Request, res: Response) => {
  // Jogosultság ellenőrzés
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
  }

  try {
    const result = cleanupOrphanedRecords();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Cleanup hiba:', error);
    res.status(500).json({ error: 'Tisztítás sikertelen' });
  }
});

export default router;
