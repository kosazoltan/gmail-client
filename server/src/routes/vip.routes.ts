import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

interface VipSenderRow {
  id: string;
  account_id: string;
  email: string;
  name: string | null;
  created_at: number;
}

// Get all VIP senders
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const vipSenders = queryAll<VipSenderRow>(
      'SELECT * FROM vip_senders WHERE account_id = ? ORDER BY name ASC, email ASC',
      [accountId],
    );

    res.json({
      vipSenders: vipSenders.map((v) => ({
        id: v.id,
        email: v.email,
        name: v.name,
        createdAt: v.created_at,
      })),
    });
  } catch (error) {
    console.error('VIP senders fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a VIP küldőket' });
  }
});

// Get VIP emails (sender email addresses only for quick lookup)
router.get('/emails', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const vipEmails = queryAll<{ email: string }>(
      'SELECT email FROM vip_senders WHERE account_id = ?',
      [accountId],
    );

    res.json({
      emails: vipEmails.map((v) => v.email.toLowerCase()),
    });
  } catch (error) {
    console.error('VIP emails fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a VIP email címeket' });
  }
});

// Add VIP sender
router.post('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Az email cím megadása kötelező' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already exists
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE account_id = ? AND email = ?',
      [accountId, normalizedEmail],
    );

    if (existing) {
      return res.status(409).json({ error: 'Ez a küldő már VIP' });
    }

    const id = uuid();
    const createdAt = Date.now();

    execute(
      `INSERT INTO vip_senders (id, account_id, email, name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, accountId, normalizedEmail, name || null, createdAt],
    );

    res.json({
      id,
      email: normalizedEmail,
      name: name || null,
      createdAt,
    });
  } catch (error) {
    console.error('Add VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült hozzáadni a VIP küldőt' });
  }
});

// Update VIP sender name
router.put('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { name } = req.body;

    const existing = queryOne<VipSenderRow>(
      'SELECT * FROM vip_senders WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'VIP küldő nem található' });
    }

    execute(
      'UPDATE vip_senders SET name = ? WHERE id = ?',
      [name || null, id],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni a VIP küldőt' });
  }
});

// Remove VIP sender
router.delete('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'VIP küldő nem található' });
    }

    execute('DELETE FROM vip_senders WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a VIP küldőt' });
  }
});

// Toggle VIP by email (add if not exists, remove if exists)
router.post('/toggle', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Az email cím megadása kötelező' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE account_id = ? AND email = ?',
      [accountId, normalizedEmail],
    );

    if (existing) {
      // Remove
      execute('DELETE FROM vip_senders WHERE id = ?', [existing.id]);
      res.json({ isVip: false });
    } else {
      // Add
      const id = uuid();
      const createdAt = Date.now();

      execute(
        `INSERT INTO vip_senders (id, account_id, email, name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, accountId, normalizedEmail, name || null, createdAt],
      );

      res.json({ isVip: true, id });
    }
  } catch (error) {
    console.error('Toggle VIP error:', error);
    res.status(500).json({ error: 'Nem sikerült módosítani a VIP státuszt' });
  }
});

export default router;
