import { Router, Request } from 'express';
import { queryOne, queryAll, execute } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { recategorizeAllEmails } from '../services/categorization.service.js';

const router = Router();

// FIX: Standardized account authorization helper
function validateAccountAccess(req: Request): string | null {
  const accountId = (req.query.accountId as string) || req.session?.activeAccountId;
  if (!accountId) return null;

  const accountIds = req.session?.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

router.get('/', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const cats = queryAll('SELECT * FROM categories WHERE account_id = ?', [accountId]);
  res.json({ categories: cats });
});

router.post('/', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { name, color, icon } = req.body;
  if (!name) { res.status(400).json({ error: 'Név kötelező' }); return; }

  const id = uuidv4();
  execute(
    'INSERT INTO categories (id, name, color, icon, is_system, account_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, color || '#6B7280', icon || 'folder', 0, accountId],
  );
  res.json({ id, name, color, icon, isSystem: false });
});

router.put('/:id', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const categoryId = req.params.id;
  const { name, color, icon } = req.body;

  // Ellenőrizzük, hogy a kategória a felhasználóé
  const existing = queryOne<{ account_id: string }>(
    'SELECT account_id FROM categories WHERE id = ?',
    [categoryId],
  );
  if (!existing || existing.account_id !== accountId) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }

  // Csak engedélyezett oszlopok frissítése (SQL injection védelem)
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (color) { updates.push('color = ?'); params.push(color); }
  if (icon) { updates.push('icon = ?'); params.push(icon); }

  if (updates.length > 0) {
    params.push(categoryId, accountId);
    execute('UPDATE categories SET ' + updates.join(', ') + ' WHERE id = ? AND account_id = ?', params);
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const categoryId = req.params.id;
  const cat = queryOne<{ id: string; is_system: number; account_id: string }>(
    'SELECT id, is_system, account_id FROM categories WHERE id = ?',
    [categoryId],
  );

  if (!cat || cat.account_id !== accountId) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }
  if (cat.is_system) {
    res.status(400).json({ error: 'Rendszer kategória nem törölhető' });
    return;
  }

  execute('DELETE FROM categories WHERE id = ? AND account_id = ?', [categoryId, accountId]);
  res.json({ success: true });
});

router.get('/rules', (req, res) => {
  // FIX: Use standardized validateAccountAccess helper
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const rules = queryAll('SELECT * FROM categorization_rules WHERE account_id = ?', [accountId]);
  res.json({ rules });
});

router.post('/rules', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const { categoryId, type, value, priority } = req.body;
  if (!categoryId || !type || !value) { res.status(400).json({ error: 'Hiányzó mezők: categoryId, type, value' }); return; }

  const id = uuidv4();
  execute(
    'INSERT INTO categorization_rules (id, category_id, type, value, priority, account_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, categoryId, type, value, priority || 0, accountId],
  );
  res.json({ id, categoryId, type, value, priority: priority || 0 });
});

router.delete('/rules/:id', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  // Ellenőrizzük, hogy a szabály a felhasználóé
  const rule = queryOne<{ account_id: string }>(
    'SELECT account_id FROM categorization_rules WHERE id = ?',
    [req.params.id],
  );
  if (!rule || rule.account_id !== accountId) {
    res.status(404).json({ error: 'Szabály nem található' });
    return;
  }

  execute('DELETE FROM categorization_rules WHERE id = ? AND account_id = ?', [req.params.id, accountId]);
  res.json({ success: true });
});

router.post('/recategorize', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }
  const updated = recategorizeAllEmails(accountId);
  res.json({ success: true, updatedCount: updated });
});

export default router;
