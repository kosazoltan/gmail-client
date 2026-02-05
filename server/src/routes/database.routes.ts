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

  // Validate sortOrder against whitelist to prevent SQL injection
  const validSortOrders = ['asc', 'desc'] as const;
  const sortOrderParam = req.query.sortOrder as string;
  const sortOrder = validSortOrders.includes(sortOrderParam as 'asc' | 'desc') ? sortOrderParam as 'asc' | 'desc' : 'desc';

  const options = {
    page: Math.max(1, parseInt(req.query.page as string, 10) || 1),
    limit: Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT),
    sortBy: (req.query.sortBy as 'date' | 'from' | 'subject' | 'size') || 'date',
    sortOrder,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom ? parseInt(req.query.dateFrom as string, 10) : undefined,
    dateTo: req.query.dateTo ? parseInt(req.query.dateTo as string, 10) : undefined,
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

  // FIX: Decode and normalize filename to prevent encoded path traversal
  // Also handle Express typing where params can be string | string[]
  const rawFilename = req.params.filename;
  if (Array.isArray(rawFilename)) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév formátum' });
  }

  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename).normalize('NFC');
  } catch {
    return res.status(400).json({ error: 'Érvénytelen fájlnév kódolás' });
  }

  // Biztonsági ellenőrzés - path traversal védelem
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév' });
  }

  // Csak alfanumerikus karakterek, kötőjelek, pontok, aláhúzás engedélyezve
  if (!/^[\w\-\.]+\.db$/.test(filename)) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév formátum' });
  }

  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.resolve(path.dirname(dbPath), 'backups');
  const backupPath = path.resolve(backupDir, filename);

  // FIX: Include path separator in check for proper containment
  if (!backupPath.startsWith(backupDir + path.sep)) {
    return res.status(400).json({ error: 'Path traversal detected' });
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

  // FIX: Decode and normalize filename to prevent encoded path traversal
  // Also handle Express typing where params can be string | string[]
  const rawFilename = req.params.filename;
  if (Array.isArray(rawFilename)) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév formátum' });
  }

  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename).normalize('NFC');
  } catch {
    return res.status(400).json({ error: 'Érvénytelen fájlnév kódolás' });
  }

  // Biztonsági ellenőrzés - path traversal védelem
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév' });
  }

  // Csak alfanumerikus karakterek, kötőjelek, pontok, aláhúzás engedélyezve
  if (!/^[\w\-\.]+\.db$/.test(filename)) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév formátum' });
  }

  // FIX: Verify resolved path is within backup directory
  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.resolve(path.dirname(dbPath), 'backups');
  const resolvedPath = path.resolve(backupDir, filename);

  if (!resolvedPath.startsWith(backupDir + path.sep)) {
    return res.status(400).json({ error: 'Path traversal detected' });
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

// Admin: karakterkódolás javítása minden fiókra (session nélkül, csak localhost)
router.post('/fix-encoding-all', (req: Request, res: Response) => {
  // Csak localhost-ról engedélyezett
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocalhost) {
    return res.status(403).json({ error: 'Csak localhost-ról érhető el' });
  }

  try {
    const accounts = getAllAccounts();
    const results: Record<string, { contacts: number; senderGroups: number; emails: number }> = {};

    for (const account of accounts) {
      const result = fixAllNamesEncoding(account.id);
      results[account.email] = result;
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Fix encoding hiba:', error);
    res.status(500).json({ error: 'Karakterkódolás javítása sikertelen' });
  }
});

export default router;
