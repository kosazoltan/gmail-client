import logger from '../utils/logger.js';
import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { suggestVipSenders } from '../services/vip-suggestions.service.js';

const router = Router();

interface VipSenderRow {
  id: string;
  account_id: string;
  email: string;
  name: string | null;
  created_at: number;
}

// Get all VIP senders
router.get('/', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const vipSenders = await queryAll<VipSenderRow>(
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
    logger.error('VIP senders fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a VIP küldőket' });
  }
});

// AI-suggested VIP senders (from email history)
router.get('/suggest', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const suggestions = await suggestVipSenders(accountId);
    res.json({ suggestions });
  } catch (error) {
    logger.error('VIP suggest error:', error);
    res.status(500).json({ error: 'Nem sikerült generálni a VIP javaslatokat' });
  }
});

// Batch-add suggested VIPs
router.post('/apply-suggestions', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { items } = req.body as { items: Array<{ email: string; name?: string | null }> };
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Érvénytelen kérés' });
    }

    const added: Array<{ id: string; email: string; name: string | null }> = [];
    for (const { email, name } of items.slice(0, 20)) {
      const normalizedEmail = (email || '').toString().toLowerCase().trim();
      if (!normalizedEmail || !normalizedEmail.includes('@')) continue;

      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM vip_senders WHERE account_id = ? AND email = ?',
        [accountId, normalizedEmail],
      );
      if (existing) continue;

      const id = uuid();
      const createdAt = Date.now();
      await execute(
        `INSERT INTO vip_senders (id, account_id, email, name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, accountId, normalizedEmail, name || null, createdAt],
      );
      added.push({ id, email: normalizedEmail, name: name || null });
    }

    res.json({ added: added.length, items: added });
  } catch (error) {
    logger.error('VIP apply-suggestions error:', error);
    res.status(500).json({ error: 'Nem sikerült hozzáadni a javasolt VIP küldőket' });
  }
});

// Get VIP emails (sender email addresses only for quick lookup)
router.get('/emails', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const vipEmails = await queryAll<{ email: string }>(
      'SELECT email FROM vip_senders WHERE account_id = ?',
      [accountId],
    );

    res.json({
      emails: vipEmails.filter((v) => v.email).map((v) => v.email.toLowerCase()),
    });
  } catch (error) {
    logger.error('VIP emails fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a VIP email címeket' });
  }
});

// Add VIP sender
router.post('/', async (req, res) => {
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
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE account_id = ? AND email = ?',
      [accountId, normalizedEmail],
    );

    if (existing) {
      return res.status(409).json({ error: 'Ez a küldő már VIP' });
    }

    const id = uuid();
    const createdAt = Date.now();

    await execute(
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
    logger.error('Add VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült hozzáadni a VIP küldőt' });
  }
});

// Update VIP sender name
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { name } = req.body;

    const existing = await queryOne<VipSenderRow>(
      'SELECT * FROM vip_senders WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'VIP küldő nem található' });
    }

    await execute('UPDATE vip_senders SET name = ? WHERE id = ? AND account_id = ?', [
      name || null,
      id,
      accountId,
    ]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Update VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni a VIP küldőt' });
  }
});

// Remove VIP sender
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'VIP küldő nem található' });
    }

    await execute('DELETE FROM vip_senders WHERE id = ? AND account_id = ?', [id, accountId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete VIP sender error:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a VIP küldőt' });
  }
});

// Toggle VIP by email (add if not exists, remove if exists)
router.post('/toggle', async (req, res) => {
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

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM vip_senders WHERE account_id = ? AND email = ?',
      [accountId, normalizedEmail],
    );

    if (existing) {
      // Remove
      await execute('DELETE FROM vip_senders WHERE id = ? AND account_id = ?', [existing.id, accountId]);
      res.json({ isVip: false });
    } else {
      // Add
      const id = uuid();
      const createdAt = Date.now();

      await execute(
        `INSERT INTO vip_senders (id, account_id, email, name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, accountId, normalizedEmail, name || null, createdAt],
      );

      res.json({ isVip: true, id });
    }
  } catch (error) {
    logger.error('Toggle VIP error:', error);
    res.status(500).json({ error: 'Nem sikerült módosítani a VIP státuszt' });
  }
});

export default router;
