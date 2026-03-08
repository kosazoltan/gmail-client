import { Router } from 'express';
import logger from '../utils/logger.js';
import {
  getSmartFolders,
  getSmartFolderById,
  getSmartFolderEmails,
  createSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  seedDefaultSmartFolders,
} from '../services/smart-folders.service.js';
import type { SmartFolderRule } from '../services/smart-folders.service.js';

const router = Router();

// GET /api/smart-folders — list all smart folders (with email counts)
router.get('/', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    // Seed defaults if first time
    seedDefaultSmartFolders(accountId);

    const folders = getSmartFolders(accountId);
    res.json({ success: true, folders });
  } catch (err) {
    logger.error('Get smart folders error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/smart-folders/:id/emails — get emails in a smart folder
router.get('/:id/emails', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const folder = getSmartFolderById(id);
    if (!folder || folder.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder not found' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { emails, total } = getSmartFolderEmails(id, page, limit);

    // Map to frontend format
    const mappedEmails = emails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.from_email,
      fromName: e.from_name,
      to: e.to_email,
      snippet: e.snippet,
      date: e.date,
      isRead: e.is_read === 1,
      isStarred: e.is_starred === 1,
      labels: e.labels ? JSON.parse(e.labels) : [],
      hasAttachments: e.has_attachments === 1,
      threadId: e.thread_id,
    }));

    res.json({
      success: true,
      emails: mappedEmails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('Get smart folder emails error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/smart-folders — create new smart folder
router.post('/', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { name, rules, icon } = req.body as { name: string; rules: SmartFolderRule[]; icon?: string };

    if (!name || !rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ error: 'Név és legalább egy szabály szükséges' });
    }

    const folder = createSmartFolder(accountId, name, rules, icon);
    res.status(201).json({ success: true, folder });
  } catch (err) {
    logger.error('Create smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// PUT /api/smart-folders/:id — update smart folder
router.put('/:id', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;
    const updates = req.body as { name?: string; icon?: string; rules?: SmartFolderRule[]; sortOrder?: number };

    // Ownership check
    const existing = getSmartFolderById(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    const folder = updateSmartFolder(id, updates);
    if (!folder) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    res.json({ success: true, folder });
  } catch (err) {
    logger.error('Update smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/smart-folders/:id — delete smart folder
router.delete('/:id', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const existing = getSmartFolderById(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    const success = deleteSmartFolder(id);

    if (!success) {
      return res.status(404).json({ error: 'Smart folder nem található' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete smart folder error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
