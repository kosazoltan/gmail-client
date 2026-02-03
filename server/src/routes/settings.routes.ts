import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';

const router = Router();

interface UserSetting {
  id: string;
  account_id: string;
  key: string;
  value: string;
  updated_at: number;
}

// Összes beállítás lekérése
router.get('/', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const settings = queryAll<UserSetting>(
    'SELECT key, value FROM user_settings WHERE account_id = ?',
    [accountId],
  );

  // Objektummá alakítjuk
  const settingsObj: Record<string, unknown> = {};
  for (const setting of settings) {
    try {
      settingsObj[setting.key] = JSON.parse(setting.value);
    } catch {
      settingsObj[setting.key] = setting.value;
    }
  }

  return res.json({ settings: settingsObj });
});

// Egy beállítás lekérése
router.get('/:key', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const setting = queryOne<UserSetting>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, req.params.key],
  );

  if (!setting) {
    return res.json({ value: null });
  }

  try {
    return res.json({ value: JSON.parse(setting.value) });
  } catch {
    return res.json({ value: setting.value });
  }
});

// Beállítás mentése/frissítése
router.put('/:key', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { value } = req.body;
  const key = req.params.key;

  // Validáció - megengedett beállítások
  const allowedKeys = [
    'swipeLeftAction',
    'swipeRightAction',
    'undoSendDelay',
    'quietHoursStart',
    'quietHoursEnd',
    'quietHoursEnabled',
    'quietHoursWeekendOnly',
    'toolbarActions',
    'theme',
  ];

  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ error: `Érvénytelen beállítás kulcs: ${key}` });
  }

  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  const existing = queryOne<{ id: string }>(
    'SELECT id FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, key],
  );

  if (existing) {
    execute(
      'UPDATE user_settings SET value = ?, updated_at = ? WHERE id = ?',
      [valueStr, Date.now(), existing.id],
    );
  } else {
    execute(
      'INSERT INTO user_settings (id, account_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), accountId, key, valueStr, Date.now()],
    );
  }

  return res.json({ success: true, key, value });
});

// Beállítás törlése
router.delete('/:key', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  execute(
    'DELETE FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, req.params.key],
  );

  return res.json({ success: true });
});

export default router;
