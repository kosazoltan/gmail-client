import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { recategorizeAllEmails } from '../services/categorization.service.js';

const router = Router();

router.get('/', (req, res) => {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

  const cats = queryAll('SELECT * FROM categories WHERE account_id = ?', [accountId]);
  res.json({ categories: cats });
});

router.post('/', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

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
  const categoryId = req.params.id;
  const { name, color, icon } = req.body;

  const updates: string[] = [];
  const params: unknown[] = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (color) { updates.push('color = ?'); params.push(color); }
  if (icon) { updates.push('icon = ?'); params.push(icon); }

  if (updates.length > 0) {
    params.push(categoryId);
    execute('UPDATE categories SET ' + updates.join(', ') + ' WHERE id = ?', params);
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const categoryId = req.params.id;
  const cat = queryOne<{ id: string; is_system: number }>('SELECT id, is_system FROM categories WHERE id = ?', [categoryId]);
  if (cat?.is_system) { res.status(400).json({ error: 'Rendszer kategória nem törölhető' }); return; }
  execute('DELETE FROM categories WHERE id = ?', [categoryId]);
  res.json({ success: true });
});

router.get('/rules', (req, res) => {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }
  const rules = queryAll('SELECT * FROM categorization_rules WHERE account_id = ?', [accountId]);
  res.json({ rules });
});

router.post('/rules', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }

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
  execute('DELETE FROM categorization_rules WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.post('/recategorize', (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók' }); return; }
  const updated = recategorizeAllEmails(accountId);
  res.json({ success: true, updatedCount: updated });
});

export default router;
