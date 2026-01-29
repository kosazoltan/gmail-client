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

// Adatbázis statisztikák
router.get('/stats', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId || undefined;
  const stats = getDatabaseStats(accountId);
  res.json(stats);
});

// Emailek listázása adatbázis kezelőhöz
router.get('/emails', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const options = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 50,
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
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
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
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
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
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { olderThanDays } = req.body;
  if (!olderThanDays || typeof olderThanDays !== 'number') {
    return res.status(400).json({ error: 'olderThanDays szám szükséges' });
  }

  const deletedCount = deleteOldEmails(accountId, olderThanDays);
  res.json({ success: true, deletedCount });
});

// Backup létrehozása
router.post('/backup', (_req: Request, res: Response) => {
  try {
    const backup = createBackup();
    res.json({ success: true, ...backup });
  } catch (error) {
    console.error('Backup hiba:', error);
    res.status(500).json({ error: 'Backup létrehozása sikertelen' });
  }
});

// Backup-ok listázása
router.get('/backups', (_req: Request, res: Response) => {
  const backups = listBackups();
  res.json({ backups });
});

// Backup letöltése
router.get('/backups/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;

  // Biztonsági ellenőrzés
  if (!filename.endsWith('.db') || filename.includes('..')) {
    return res.status(400).json({ error: 'Érvénytelen fájlnév' });
  }

  const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  const backupPath = path.join(backupDir, filename);

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup nem található' });
  }

  res.download(backupPath, filename);
});

// Backup törlése
router.delete('/backups/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;

  const success = deleteBackup(filename);
  if (!success) {
    return res.status(404).json({ error: 'Backup nem található vagy nem törölhető' });
  }

  res.json({ success: true });
});

// Adatbázis tömörítés
router.post('/vacuum', (_req: Request, res: Response) => {
  try {
    vacuumDatabase();
    res.json({ success: true });
  } catch (error) {
    console.error('Vacuum hiba:', error);
    res.status(500).json({ error: 'Adatbázis tömörítés sikertelen' });
  }
});

// Árva rekordok tisztítása
router.post('/cleanup', (_req: Request, res: Response) => {
  try {
    const result = cleanupOrphanedRecords();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Cleanup hiba:', error);
    res.status(500).json({ error: 'Tisztítás sikertelen' });
  }
});

export default router;
