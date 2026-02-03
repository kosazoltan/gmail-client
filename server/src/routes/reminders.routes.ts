import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, getDb } from '../db/index.js';

const router = Router();

// FONTOS: Specifikus route-ok előre, a `/` route utolsónak!

// Esedékes emlékeztetők lekérése (polling endpoint)
router.get('/due', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const now = Date.now();
  const reminders = queryAll(
    `SELECT r.*, e.subject, e.from_email as "from", e.from_name as "fromName"
     FROM reminders r
     JOIN emails e ON r.email_id = e.id
     WHERE r.account_id = ? AND r.is_completed = 0 AND r.remind_at <= ?
     ORDER BY r.remind_at ASC`,
    [accountId, now],
  );

  return res.json({ reminders });
});

// Lejárt emlékeztetők száma
router.get('/count', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const now = Date.now();
  const result = queryOne(
    `SELECT COUNT(*) as count FROM reminders
     WHERE account_id = ? AND is_completed = 0 AND remind_at <= ?`,
    [accountId, now],
  );

  return res.json({ count: (result as { count: number })?.count || 0 });
});

// Emlékeztetők listázása
router.get('/', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const includeCompleted = req.query.includeCompleted === 'true';

  let query = `
    SELECT r.*, e.subject, e.from_email as "from", e.from_name as "fromName", e.date
    FROM reminders r
    JOIN emails e ON r.email_id = e.id
    WHERE r.account_id = ?
  `;

  if (!includeCompleted) {
    query += ' AND r.is_completed = 0';
  }

  query += ' ORDER BY r.remind_at ASC';

  const reminders = queryAll(query, [accountId]);

  return res.json({ reminders });
});

// Emlékeztető létrehozása
router.post('/', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { emailId, remindAt, note } = req.body;

  if (!emailId || !remindAt) {
    return res.status(400).json({ error: 'emailId és remindAt kötelező' });
  }

  // Validáljuk a remindAt timestamp-et
  const remindTimestamp = parseInt(remindAt, 10);
  if (isNaN(remindTimestamp) || remindTimestamp <= Date.now()) {
    return res.status(400).json({ error: 'Érvénytelen emlékeztető időpont - jövőbeli időpontot adj meg' });
  }

  // Ellenőrizzük, hogy az email létezik és ehhez a fiókhoz tartozik
  const email = queryOne(
    'SELECT id FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );

  if (!email) {
    return res.status(404).json({ error: 'Email nem található' });
  }

  // Ellenőrizzük, hogy nincs-e már aktív emlékeztető ehhez az emailhez (account_id szűréssel)
  const existingReminder = queryOne(
    'SELECT id FROM reminders WHERE email_id = ? AND account_id = ? AND is_completed = 0',
    [emailId, accountId],
  );

  if (existingReminder) {
    return res.status(400).json({ error: 'Ehhez az emailhez már van aktív emlékeztető' });
  }

  const id = uuidv4();
  const now = Date.now();

  execute(
    `INSERT INTO reminders (id, email_id, account_id, remind_at, note, is_completed, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, emailId, accountId, remindTimestamp, note || null, now],
  );

  const reminder = queryOne('SELECT * FROM reminders WHERE id = ?', [id]);

  if (!reminder) {
    return res.status(500).json({ error: 'Emlékeztető létrehozása sikertelen' });
  }

  return res.json({ reminder });
});

// Emlékeztető frissítése
router.patch('/:id', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { id } = req.params;
  const { remindAt, note, isCompleted } = req.body;

  const reminder = queryOne(
    'SELECT * FROM reminders WHERE id = ? AND account_id = ?',
    [id, accountId],
  );

  if (!reminder) {
    return res.status(404).json({ error: 'Emlékeztető nem található' });
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (remindAt !== undefined) {
    updates.push('remind_at = ?');
    values.push(remindAt);
  }

  if (note !== undefined) {
    updates.push('note = ?');
    values.push(note);
  }

  if (isCompleted !== undefined) {
    updates.push('is_completed = ?');
    values.push(isCompleted ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id, accountId);
    execute(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ? AND account_id = ?`, values);
  }

  const updated = queryOne('SELECT * FROM reminders WHERE id = ?', [id]);

  if (!updated) {
    return res.status(500).json({ error: 'Emlékeztető frissítése sikertelen' });
  }

  return res.json({ reminder: updated });
});

// Emlékeztető törlése
router.delete('/:id', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { id } = req.params;

  const reminder = queryOne(
    'SELECT * FROM reminders WHERE id = ? AND account_id = ?',
    [id, accountId],
  );

  if (!reminder) {
    return res.status(404).json({ error: 'Emlékeztető nem található' });
  }

  execute('DELETE FROM reminders WHERE id = ? AND account_id = ?', [id, accountId]);

  return res.json({ success: true });
});

// Emlékeztető teljesítettnek jelölése
router.post('/:id/complete', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { id } = req.params;

  const reminder = queryOne(
    'SELECT * FROM reminders WHERE id = ? AND account_id = ?',
    [id, accountId],
  );

  if (!reminder) {
    return res.status(404).json({ error: 'Emlékeztető nem található' });
  }

  execute('UPDATE reminders SET is_completed = 1 WHERE id = ? AND account_id = ?', [id, accountId]);

  const updated = queryOne('SELECT * FROM reminders WHERE id = ?', [id]);

  if (!updated) {
    return res.status(500).json({ error: 'Emlékeztető frissítése sikertelen' });
  }

  return res.json({ reminder: updated });
});

export default router;
