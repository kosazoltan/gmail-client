import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

interface SavedSearch {
  id: string;
  account_id: string;
  name: string;
  query: string;
  icon: string;
  color: string;
  use_count: number;
  created_at: number;
}

// Összes mentett keresés listázása
router.get('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const searches = queryAll<SavedSearch>(
      `SELECT * FROM saved_searches
       WHERE account_id = ?
       ORDER BY use_count DESC, created_at DESC`,
      [accountId],
    );

    res.json({
      searches: searches.map((s) => ({
        id: s.id,
        name: s.name,
        query: s.query,
        icon: s.icon,
        color: s.color,
        useCount: s.use_count,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error('Mentett keresések lekérése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a mentett kereséseket' });
  }
});

// Új mentett keresés létrehozása
router.post('/', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { name, query, icon, color } = req.body;

    if (!name || !query) {
      return res.status(400).json({ error: 'A név és a keresés megadása kötelező' });
    }

    // Ellenőrizzük, hogy létezik-e már ilyen nevű
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM saved_searches WHERE account_id = ? AND name = ?',
      [accountId, name],
    );

    if (existing) {
      return res.status(409).json({ error: 'Már létezik ilyen nevű mentett keresés' });
    }

    const id = uuid();
    const now = Date.now();

    execute(
      `INSERT INTO saved_searches (id, account_id, name, query, icon, color, use_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, accountId, name, query, icon || 'search', color || '#6B7280', now],
    );

    res.json({
      id,
      name,
      query,
      icon: icon || 'search',
      color: color || '#6B7280',
      useCount: 0,
      createdAt: now,
    });
  } catch (error) {
    console.error('Mentett keresés létrehozása hiba:', error);
    res.status(500).json({ error: 'Nem sikerült létrehozni a mentett keresést' });
  }
});

// Mentett keresés frissítése
router.put('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;
    const { name, query, icon, color } = req.body;

    const existing = queryOne<SavedSearch>(
      'SELECT * FROM saved_searches WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Mentett keresés nem található' });
    }

    // Ha nevet változtatunk, ellenőrizzük az egyediséget
    if (name && name !== existing.name) {
      const duplicate = queryOne<{ id: string }>(
        'SELECT id FROM saved_searches WHERE account_id = ? AND name = ? AND id != ?',
        [accountId, name, id],
      );
      if (duplicate) {
        return res.status(409).json({ error: 'Már létezik ilyen nevű mentett keresés' });
      }
    }

    execute(
      `UPDATE saved_searches
       SET name = ?, query = ?, icon = ?, color = ?
       WHERE id = ? AND account_id = ?`,
      [
        name || existing.name,
        query || existing.query,
        icon || existing.icon,
        color || existing.color,
        id,
        accountId,
      ],
    );

    res.json({
      id,
      name: name || existing.name,
      query: query || existing.query,
      icon: icon || existing.icon,
      color: color || existing.color,
      useCount: existing.use_count,
      createdAt: existing.created_at,
    });
  } catch (error) {
    console.error('Mentett keresés frissítése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni a mentett keresést' });
  }
});

// Mentett keresés törlése
router.delete('/:id', (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM saved_searches WHERE id = ? AND account_id = ?',
      [id, accountId],
    );

    if (!existing) {
      return res.status(404).json({ error: 'Mentett keresés nem található' });
    }

    execute('DELETE FROM saved_searches WHERE id = ? AND account_id = ?', [id, accountId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Mentett keresés törlése hiba:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a mentett keresést' });
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
      `UPDATE saved_searches
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
