import { Router } from 'express';
import {
  detectUnansweredEmails,
  getDetectedTasks,
  updateDetectedTaskStatus,
  deleteDetectedTask,
  getTaskStats,
  processExpiredSnoozedTasks,
} from '../services/task-detection.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Auth + ownership check helper.
 * Returns accountId or null (and sends 401 response).
 */
function getAccountId(req: { session?: { activeAccountId?: string | null; accountIds?: string[] }; query?: { accountId?: string } }): string | null {
  const accountId = (req.query?.accountId as string) || req.session?.activeAccountId;
  if (!accountId) return null;
  const accountIds = req.session?.accountIds || [];
  if (!accountIds.includes(accountId)) return null;
  return accountId;
}

// GET /api/detected-tasks — taskok listája
router.get('/', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const status = (req.query.status as string) || 'open';
    const priority = req.query.priority as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = getDetectedTasks(accountId, { status, priority, page, limit });

    return res.json({
      tasks: result.tasks,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / Math.min(Math.max(1, limit), 100)),
    });
  } catch (err) {
    logger.error('Detected tasks list error:', err);
    return res.status(500).json({ error: 'Detected taskok lekérése sikertelen' });
  }
});

// GET /api/detected-tasks/stats — statisztika
router.get('/stats', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const stats = getTaskStats(accountId);
    return res.json(stats);
  } catch (err) {
    logger.error('Detected tasks stats error:', err);
    return res.status(500).json({ error: 'Statisztika lekérése sikertelen' });
  }
});

// POST /api/detected-tasks/scan — kézi scan indítás
router.post('/scan', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const daysBack = typeof req.body?.daysBack === 'number' && req.body.daysBack > 0
      ? Math.min(req.body.daysBack, 365)
      : 30;

    const newTasks = detectUnansweredEmails(accountId, daysBack);

    // Snoozed taskok feloldása is
    const unsnoozed = processExpiredSnoozedTasks();

    return res.json({
      newTasksCount: newTasks.length,
      unsnoozedCount: unsnoozed,
      tasks: newTasks,
    });
  } catch (err) {
    logger.error('Detected tasks scan error:', err);
    return res.status(500).json({ error: 'Scan sikertelen' });
  }
});

// PATCH /api/detected-tasks/:id — status update
router.patch('/:id', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'status mező kötelező (open/done/dismissed/snoozed)' });
    }

    const updated = updateDetectedTaskStatus(id, accountId, status);
    if (!updated) {
      return res.status(404).json({ error: 'Task nem található vagy érvénytelen status' });
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error('Detected task update error:', err);
    return res.status(500).json({ error: 'Task frissítése sikertelen' });
  }
});

// DELETE /api/detected-tasks/:id — task törlés
router.delete('/:id', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const { id } = req.params;
    const deleted = deleteDetectedTask(id, accountId);
    if (!deleted) {
      return res.status(404).json({ error: 'Task nem található' });
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error('Detected task delete error:', err);
    return res.status(500).json({ error: 'Task törlése sikertelen' });
  }
});

// POST /api/detected-tasks/:id/snooze — szundi
router.post('/:id/snooze', (req, res) => {
  try {
    const accountId = getAccountId(req);
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' });
    }

    const { id } = req.params;
    const days = typeof req.body?.days === 'number' && req.body.days > 0
      ? Math.min(req.body.days, 90)
      : 1;

    const snoozedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    const updated = updateDetectedTaskStatus(id, accountId, 'snoozed', snoozedUntil);
    if (!updated) {
      return res.status(404).json({ error: 'Task nem található' });
    }

    return res.json({ success: true, snoozedUntil });
  } catch (err) {
    logger.error('Detected task snooze error:', err);
    return res.status(500).json({ error: 'Snooze sikertelen' });
  }
});

export default router;
