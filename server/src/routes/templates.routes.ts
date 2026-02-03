import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

interface Template {
  id: string;
  account_id: string;
  name: string;
  subject: string | null;
  body: string;
  shortcut: string | null;
  use_count: number;
  created_at: number;
}

// Összes sablon listázása
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const templates = queryAll<Template>(
      `SELECT * FROM templates
       WHERE account_id = ?
       ORDER BY use_count DESC, created_at DESC`,
      [accountId],
    );

    res.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        shortcut: t.shortcut,
        useCount: t.use_count,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Sablonok lekérése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a sablonokat' });
  }
});

// Új sablon létrehozása
router.post('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { name, subject, body, shortcut } = req.body;

    if (!name || !body) {
      return res.status(400).json({ error: 'A név és a szöveg megadása kötelező' });
    }

    // Ellenőrizzük, hogy létezik-e már ilyen nevű
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM templates WHERE account_id = ? AND name = ?',
      [accountId, name],
    );

    if (existing) {
      return res.status(409).json({ error: 'Már létezik ilyen nevű sablon' });
    }

    const id = uuid();
    const now = Date.now();

    execute(
      `INSERT INTO templates (id, account_id, name, subject, body, shortcut, use_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, accountId, name, subject || null, body, shortcut || null, now],
    );

    res.json({
      id,
      name,
      subject: subject || null,
      body,
      shortcut: shortcut || null,
      useCount: 0,
      createdAt: now,
    });
  } catch (error) {
    console.error('Sablon létrehozása hiba:', error);
    res.status(500).json({ error: 'Nem sikerült létrehozni a sablont' });
  }
});

// Sablon frissítése
router.put('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { name, subject, body, shortcut } = req.body;

    const existing = queryOne<Template>(
      'SELECT * FROM templates WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Sablon nem található' });
    }

    // Ha nevet változtatunk, ellenőrizzük az egyediséget
    if (name && name !== existing.name) {
      const duplicate = queryOne<{ id: string }>(
        'SELECT id FROM templates WHERE account_id = ? AND name = ? AND id != ?',
        [accountId, name, id],
      );
      if (duplicate) {
        return res.status(409).json({ error: 'Már létezik ilyen nevű sablon' });
      }
    }

    execute(
      `UPDATE templates
       SET name = ?, subject = ?, body = ?, shortcut = ?
       WHERE id = ? AND account_id = ?`,
      [
        name || existing.name,
        subject !== undefined ? subject : existing.subject,
        body || existing.body,
        shortcut !== undefined ? shortcut : existing.shortcut,
        id,
        accountId,
      ],
    );

    res.json({
      id,
      name: name || existing.name,
      subject: subject !== undefined ? subject : existing.subject,
      body: body || existing.body,
      shortcut: shortcut !== undefined ? shortcut : existing.shortcut,
      useCount: existing.use_count,
      createdAt: existing.created_at,
    });
  } catch (error) {
    console.error('Sablon frissítése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni a sablont' });
  }
});

// Sablon törlése
router.delete('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM templates WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Sablon nem található' });
    }

    execute('DELETE FROM templates WHERE id = ? AND account_id = ?', [id, accountId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Sablon törlése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a sablont' });
  }
});

// Használat számláló növelése
router.post('/:id/use', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    execute(
      `UPDATE templates
       SET use_count = use_count + 1
       WHERE id = ? AND account_id = ?`,
      [id, accountId],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Használat számláló hiba:', error);
    res.status(500).json({ error: 'Hiba történt' });
  }
});

export default router;
