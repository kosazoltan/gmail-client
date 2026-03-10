import { Router, Request } from 'express';
import { queryOne, queryAll, execute, runInTransaction } from '../db/index.js';
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

router.get('/', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const cats = await queryAll('SELECT * FROM categories WHERE account_id = ?', [accountId]);
  res.json({ categories: cats });
});

// Get categories for a specific email (must be before /:id routes)
router.get('/for-email/:emailId', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { emailId } = req.params;
  const categories = await queryAll<{ id: string; name: string; color: string; icon: string }>(
    `SELECT c.id, c.name, c.color, c.icon FROM categories c
     INNER JOIN email_categories ec ON ec.category_id = c.id
     WHERE ec.email_id = ? AND ec.account_id = ?`,
    [emailId, accountId],
  );
  res.json({ categories });
});

router.post('/', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { name, color, icon, description, sort_order } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Név kötelező' });
    return;
  }

  const id = uuidv4();
  await execute(
    'INSERT INTO categories (id, name, color, icon, is_system, account_id, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, color || '#6B7280', icon || 'folder', 0, accountId, description || null, sort_order || 0, Date.now()],
  );
  res.json({ id, name, color: color || '#6B7280', icon: icon || 'folder', is_system: 0, isSystem: false, description: description || null, sort_order: sort_order || 0 });
});

router.put('/:id', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const categoryId = req.params.id;
  const { name, color, icon, description, sort_order } = req.body;

  // Ellenőrizzük, hogy a kategória a felhasználóé
  const existing = await queryOne<{ account_id: string; is_system: number }>(
    'SELECT account_id, is_system FROM categories WHERE id = ? AND account_id = ?',
    [categoryId, accountId],
  );
  if (!existing) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }
  if (existing.is_system) {
    res.status(400).json({ error: 'Rendszer kategória nem módosítható' });
    return;
  }

  // Csak engedélyezett oszlopok frissítése (SQL injection védelem)
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    params.push(color);
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push(icon);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(sort_order);
  }

  if (updates.length > 0) {
    params.push(categoryId, accountId);
    await execute(
      'UPDATE categories SET ' + updates.join(', ') + ' WHERE id = ? AND account_id = ?',
      params,
    );
  }
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const categoryId = req.params.id;
  const cat = await queryOne<{ id: string; is_system: number; account_id: string }>(
    'SELECT id, is_system, account_id FROM categories WHERE id = ? AND account_id = ?',
    [categoryId, accountId],
  );

  if (!cat) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }
  if (cat.is_system) {
    res.status(400).json({ error: 'Rendszer kategória nem törölhető' });
    return;
  }

  await runInTransaction(async () => {
    await execute('DELETE FROM email_categories WHERE category_id = ? AND account_id = ?', [categoryId, accountId]);
    await execute('DELETE FROM categories WHERE id = ? AND account_id = ?', [categoryId, accountId]);
  });
  res.json({ success: true });
});

// === Email-Category relationship endpoints ===

// Add email to user category
router.post('/:id/add-email', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const categoryId = req.params.id;
  const { emailId } = req.body;
  if (!emailId) {
    res.status(400).json({ error: 'emailId kötelező' });
    return;
  }

  // Check category exists and belongs to user
  const cat = await queryOne<{ id: string; account_id: string }>(
    'SELECT id, account_id FROM categories WHERE id = ? AND account_id = ?',
    [categoryId, accountId],
  );
  if (!cat) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }

  // Check email exists and belongs to user
  const email = await queryOne<{ id: string }>(
    'SELECT id FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );
  if (!email) {
    res.status(404).json({ error: 'Email nem található' });
    return;
  }

  // Check if already assigned
  const existing = await queryOne(
    'SELECT email_id FROM email_categories WHERE email_id = ? AND category_id = ?',
    [emailId, categoryId],
  );
  if (existing) {
    res.json({ success: true, message: 'Már hozzá van rendelve' });
    return;
  }

  await execute(
    'INSERT INTO email_categories (email_id, category_id, account_id, created_at) VALUES (?, ?, ?, ?)',
    [emailId, categoryId, accountId, Date.now()],
  );
  res.json({ success: true });
});

// Remove email from user category
router.post('/:id/remove-email', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const categoryId = req.params.id;
  const { emailId } = req.body;
  if (!emailId) {
    res.status(400).json({ error: 'emailId kötelező' });
    return;
  }

  await execute(
    'DELETE FROM email_categories WHERE email_id = ? AND category_id = ? AND account_id = ?',
    [emailId, categoryId, accountId],
  );
  res.json({ success: true });
});

// Get emails in a user category (paginated)
router.get('/:id/emails', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const categoryId = req.params.id;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), 100);
  const offset = (page - 1) * limit;

  // Check category exists
  const cat = await queryOne<{ id: string; is_system: number }>(
    'SELECT id, name, color, icon, is_system, description, sort_order, created_at FROM categories WHERE id = ? AND account_id = ?',
    [categoryId, accountId],
  );
  if (!cat) {
    res.status(404).json({ error: 'Kategória nem található' });
    return;
  }

  // For system categories: use emails.category_id
  // For user categories: use email_categories join table
  let emails;
  let total: number;

  if (cat.is_system) {
    emails = await queryAll<Record<string, unknown>>(
      'SELECT * FROM emails WHERE account_id = ? AND category_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
      [accountId, categoryId, limit, offset],
    );
    const countResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND category_id = ?',
      [accountId, categoryId],
    );
    total = Number(countResult?.count ?? 0);
  } else {
    emails = await queryAll<Record<string, unknown>>(
      `SELECT e.* FROM emails e
       INNER JOIN email_categories ec ON ec.email_id = e.id
       WHERE ec.category_id = ? AND ec.account_id = ?
       ORDER BY e.date DESC LIMIT ? OFFSET ?`,
      [categoryId, accountId, limit, offset],
    );
    const countResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM email_categories WHERE category_id = ? AND account_id = ?',
      [categoryId, accountId],
    );
    total = Number(countResult?.count ?? 0);
  }

  const formatEmail = (email: Record<string, unknown>) => ({
    id: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    from: email.from_email,
    fromName: email.from_name,
    to: email.to_email,
    cc: email.cc_email,
    snippet: email.snippet,
    date: email.date,
    isRead: !!email.is_read,
    isStarred: !!email.is_starred,
    labels: (() => { try { return email.labels ? JSON.parse(email.labels as string) : []; } catch { return []; } })(),
    hasAttachments: !!email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  });

  res.json({
    emails: emails.map(formatEmail),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    category: cat,
  });
});

router.get('/rules', async (req, res) => {
  // FIX: Use standardized validateAccountAccess helper
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const rules = await queryAll('SELECT * FROM categorization_rules WHERE account_id = ?', [accountId]);
  res.json({ rules });
});

router.post('/rules', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  const { categoryId, type, value, priority } = req.body;
  if (!categoryId || !type || !value) {
    res.status(400).json({ error: 'Hiányzó mezők: categoryId, type, value' });
    return;
  }

  const id = uuidv4();
  await execute(
    'INSERT INTO categorization_rules (id, category_id, type, value, priority, account_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, categoryId, type, value, priority || 0, accountId],
  );
  res.json({ id, categoryId, type, value, priority: priority || 0 });
});

router.delete('/rules/:id', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }

  // Ellenőrizzük, hogy a szabály a felhasználóé
  const rule = await queryOne<{ account_id: string }>(
    'SELECT account_id FROM categorization_rules WHERE id = ?',
    [req.params.id],
  );
  if (!rule || rule.account_id !== accountId) {
    res.status(404).json({ error: 'Szabály nem található' });
    return;
  }

  await execute('DELETE FROM categorization_rules WHERE id = ? AND account_id = ?', [
    req.params.id,
    accountId,
  ]);
  res.json({ success: true });
});

router.post('/recategorize', async (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) {
    res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    return;
  }
  const updated = await recategorizeAllEmails(accountId);
  res.json({ success: true, updatedCount: updated });
});

export default router;
