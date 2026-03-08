import { Router } from 'express';
import logger from '../utils/logger.js';
import {
  extractActionItems,
  detectSentiment,
  suggestReply,
  findRelatedEmails,
  generateWeeklyReport,
  toggleActionItem,
  getActionItemsByEmail,
} from '../services/email-intelligence.service.js';
import { queryOne } from '../db/index.js';

const router = Router();

// POST /api/intelligence/action-items/:emailId
router.post('/action-items/:emailId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailId } = req.params;

    // Ownership check
    const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!email || email.account_id !== accountId) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const items = await extractActionItems(emailId);
    res.json({ success: true, actionItems: items });
  } catch (err) {
    logger.error('Action items extraction error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/intelligence/action-items/:emailId — get existing action items
router.get('/action-items/:emailId', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailId } = req.params;

    // Ownership check
    const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!email || email.account_id !== accountId) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const items = getActionItemsByEmail(emailId);
    res.json({ success: true, actionItems: items });
  } catch (err) {
    logger.error('Get action items error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// PATCH /api/intelligence/action-items/:id/toggle — toggle done status
router.patch('/action-items/:id/toggle', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;
    const { isDone } = req.body as { isDone: boolean };

    // Ownership check (m8)
    const item = queryOne<{ account_id: string }>('SELECT account_id FROM action_items WHERE id = ?', [id]);
    if (!item || item.account_id !== accountId) {
      return res.status(404).json({ success: false, error: 'Action item nem található' });
    }

    toggleActionItem(id, isDone);
    res.json({ success: true });
  } catch (err) {
    logger.error('Toggle action item error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/intelligence/sentiment/:emailId
router.post('/sentiment/:emailId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailId } = req.params;

    // Ownership check
    const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!email || email.account_id !== accountId) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const result = await detectSentiment(emailId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Sentiment detection error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/intelligence/suggest-reply/:emailId
router.post('/suggest-reply/:emailId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailId } = req.params;

    // Ownership check
    const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!email || email.account_id !== accountId) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const suggestions = await suggestReply(emailId);
    res.json({ success: true, suggestions });
  } catch (err) {
    logger.error('Reply suggestion error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/intelligence/related/:emailId
router.get('/related/:emailId', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailId } = req.params;

    // Ownership check
    const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!email || email.account_id !== accountId) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const related = findRelatedEmails(emailId);
    res.json({ success: true, relatedEmails: related });
  } catch (err) {
    logger.error('Related emails error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/intelligence/bulk-analyze
router.post('/bulk-analyze', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { emailIds } = req.body as { emailIds: string[] };

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'emailIds array is required' });
    }

    if (emailIds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 emails allowed' });
    }

    // Ownership check sync
    const ownedEmails = emailIds.filter((id: string) => {
      const email = queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [id]);
      return email && email.account_id === accountId;
    });

    // Parallel AI calls
    const settled = await Promise.allSettled(
      ownedEmails.map(async (emailId: string) => {
        const [actionItems, sentiment] = await Promise.all([
          extractActionItems(emailId),
          detectSentiment(emailId),
        ]);
        return { emailId, actionItems, sentiment };
      }),
    );

    const results = settled
      .filter(
        (r): r is PromiseFulfilledResult<{
          emailId: string;
          actionItems: Awaited<ReturnType<typeof extractActionItems>>;
          sentiment: Awaited<ReturnType<typeof detectSentiment>>;
        }> => r.status === 'fulfilled',
      )
      .map(r => r.value);

    res.json({ success: true, results });
  } catch (err) {
    logger.error('Bulk analyze error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/intelligence/weekly-report
router.get('/weekly-report', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const report = await generateWeeklyReport(accountId);
    res.json({ success: true, report });
  } catch (err) {
    logger.error('Weekly report error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
