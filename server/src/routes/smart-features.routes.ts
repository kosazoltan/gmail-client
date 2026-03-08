import { Router } from 'express';
import {
  autoPrioritize,
  detectPendingFollowups,
  scoreContacts,
  getEmailHealth,
  findSimilarEmails,
  getSmartFolders,
} from '../services/smart-features.service.js';
import { queryAll, queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/smart/priorities — auto-prioritizált emailek
router.get('/priorities', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    // Utolsó 100 olvasatlan email priorizálása
    const limit = parseInt(req.query.limit as string) || 100;
    const emailIds = (await queryAll<{ id: string }>(
      `SELECT id FROM emails
       WHERE account_id = ? AND is_read = 0 AND labels NOT LIKE '%TRASH%'
       ORDER BY date DESC LIMIT ?`,
      [accountId, limit],
    )).map((e) => e.id);

    const rawPriorities = await autoPrioritize(accountId, emailIds);

    // Enrich with email data for frontend PriorityEmail format
    const emailDataMap = new Map<string, { subject: string; from_email: string; from_name: string; date: number }>();
    if (rawPriorities.length > 0) {
      const pholders = rawPriorities.map(() => '?').join(',');
      const emailData = await queryAll<{ id: string; subject: string; from_email: string; from_name: string; date: number }>(
        `SELECT id, subject, from_email, from_name, date FROM emails WHERE id IN (${pholders})`,
        rawPriorities.map(p => p.emailId),
      );
      for (const e of emailData) {
        emailDataMap.set(e.id, e);
      }
    }

    const priorities = rawPriorities.map(p => {
      const email = emailDataMap.get(p.emailId);
      return {
        id: p.emailId,
        subject: email?.subject || '(Nincs tárgy)',
        from: email?.from_email || '',
        fromName: email?.from_name || '',
        receivedAt: email?.date || 0,
        priority: p.priority,
        reason: p.reason,
      };
    });

    res.json({ priorities });
  } catch (error) {
    logger.error('Smart priorities error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a prioritásokat' });
  }
});

// GET /api/smart/followups — pending follow-upok
router.get('/followups', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const followups = await detectPendingFollowups(accountId);
    res.json({ followups });
  } catch (error) {
    logger.error('Smart followups error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a follow-upokat' });
  }
});

// GET /api/smart/contact-scores — contact scoring
router.get('/contact-scores', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const contacts = await scoreContacts(accountId);
    res.json({ contacts });
  } catch (error) {
    logger.error('Smart contact scores error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a contact score-okat' });
  }
});

// GET /api/smart/daily-brief — napi összefoglaló
router.get('/daily-brief', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    // Kombináljuk az email health-et, prioritásokat, follow-upokat és smart folders-t
    const health = await getEmailHealth(accountId);
    const followups = await detectPendingFollowups(accountId);
    const smartFolders = await getSmartFolders(accountId);

    // Top 20 olvasatlan email priorizálása
    const unreadIds = (await queryAll<{ id: string }>(
      `SELECT id FROM emails
       WHERE account_id = ? AND is_read = 0 AND labels NOT LIKE '%TRASH%'
       ORDER BY date DESC LIMIT 20`,
      [accountId],
    )).map((e) => e.id);

    const priorities = await autoPrioritize(accountId, unreadIds);
    const urgentCount = priorities.filter((p) => p.priority === 'urgent').length;
    const highCount = priorities.filter((p) => p.priority === 'high').length;

    // Stats for DailyBriefView frontend
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const totalTodayResult = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM emails WHERE account_id = ? AND date >= ? AND labels NOT LIKE \'%TRASH%\' AND labels NOT LIKE \'%SENT%\'',
      [accountId, todayMs],
    );
    const unreadTodayResult = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM emails WHERE account_id = ? AND date >= ? AND is_read = 0 AND labels NOT LIKE \'%TRASH%\' AND labels NOT LIKE \'%SENT%\'',
      [accountId, todayMs],
    );
    const repliedTodayResult = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM emails WHERE account_id = ? AND date >= ? AND labels LIKE \'%SENT%\'',
      [accountId, todayMs],
    );

    const totalToday = totalTodayResult?.cnt || 0;
    const unreadToday = unreadTodayResult?.cnt || 0;
    const repliedToday = repliedTodayResult?.cnt || 0;
    const pendingToday = totalToday - repliedToday;

    const stats = {
      received: totalToday,
      replied: repliedToday,
      pending: pendingToday > 0 ? pendingToday : 0,
      date: new Date().toISOString().slice(0, 10),
    };

    // Contacts from scoreContacts
    const allContacts = await scoreContacts(accountId);
    const contacts = allContacts.slice(0, 10).map(c => ({
      email: c.email,
      name: c.name,
      count: c.emailCount,
    }));

    res.json({
      stats,
      contacts,
      health,
      followups: followups.slice(0, 10),
      smartFolders,
      prioritySummary: {
        urgent: urgentCount,
        high: highCount,
        total: priorities.length,
      },
      generatedAt: Date.now(),
    });
  } catch (error) {
    logger.error('Smart daily brief error:', error);
    res.status(500).json({ error: 'Nem sikerült generálni a napi összefoglalót' });
  }
});

// GET /api/smart/analytics — email analytics dashboard
router.get('/analytics', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const period = (req.query.period as string) || 'week';
    const now = Date.now();
    let periodMs: number;
    let previousPeriodMs: number;

    if (period === 'month') {
      periodMs = 30 * 24 * 60 * 60 * 1000;
    } else if (period === 'quarter') {
      periodMs = 90 * 24 * 60 * 60 * 1000;
    } else {
      // week
      periodMs = 7 * 24 * 60 * 60 * 1000;
    }
    previousPeriodMs = periodMs;

    const periodStart = now - periodMs;
    const prevStart = periodStart - previousPeriodMs;

    // Response time trend (daily avg in minutes)
    const responseTimes = (await queryAll<{ day: string; avgMs: number }>(
      `SELECT
         DATE(sent.date / 1000, 'unixepoch') AS day,
         AVG(sent.date - incoming.date) AS avgMs
       FROM emails sent
       JOIN emails incoming ON sent.thread_id = incoming.thread_id
         AND incoming.account_id = sent.account_id
         AND incoming.labels NOT LIKE '%SENT%'
         AND incoming.date < sent.date
       WHERE sent.account_id = ?
         AND sent.labels LIKE '%SENT%'
         AND sent.date >= ?
       GROUP BY day
       ORDER BY day`,
      [accountId, periodStart],
    )).map(r => ({
      date: r.day,
      avgMinutes: Math.round((r.avgMs || 0) / (1000 * 60)),
    }));

    // Category distribution
    const totalResult = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM emails WHERE account_id = ? AND date >= ? AND labels NOT LIKE \'%TRASH%\'',
      [accountId, periodStart],
    );
    const totalEmails = totalResult?.total || 1;

    const categories = (await queryAll<{ name: string; count: number }>(
      `SELECT
         COALESCE(c.name, 'Kategorizálatlan') AS name,
         COUNT(*) AS count
       FROM emails e
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.account_id = ? AND e.date >= ? AND e.labels NOT LIKE '%TRASH%'
       GROUP BY e.category_id
       ORDER BY count DESC`,
      [accountId, periodStart],
    )).map(c => ({
      name: c.name,
      count: c.count,
      color: '#6B7280',
    }));

    // Period comparison
    const currentCount = (await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM emails WHERE account_id = ? AND date >= ? AND labels NOT LIKE \'%TRASH%\'',
      [accountId, periodStart],
    ))?.cnt || 0;

    const previousCount = (await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM emails WHERE account_id = ? AND date >= ? AND date < ? AND labels NOT LIKE \'%TRASH%\'',
      [accountId, prevStart, periodStart],
    ))?.cnt || 0;

    const comparison = [
      { label: 'Jelenlegi', current: currentCount, previous: previousCount },
    ];

    // Top senders
    const topSenders = (await queryAll<{ email: string; name: string; count: number }>(
      `SELECT
         from_email AS email,
         COALESCE(from_name, from_email) AS name,
         COUNT(*) AS count
       FROM emails
       WHERE account_id = ?
         AND from_email IS NOT NULL
         AND date >= ?
         AND labels NOT LIKE '%TRASH%'
       GROUP BY LOWER(from_email)
       ORDER BY count DESC
       LIMIT 10`,
      [accountId, periodStart],
    )).map(s => ({
      email: s.email,
      name: s.name || s.email,
      count: s.count,
    }));

    res.json({
      responseTimes,
      categories,
      comparison,
      topSenders,
    });
  } catch (error) {
    logger.error('Smart analytics error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni az analytics adatokat' });
  }
});

// POST /api/smart/analyze-email/:id — egyedi email elemzés
router.post('/analyze-email/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    // Prioritás
    const priorities = await autoPrioritize(accountId, [id]);
    const priority = priorities.length > 0 ? priorities[0] : null;

    // Hasonló emailek
    const similar = await findSimilarEmails(accountId, id);

    res.json({
      emailId: id,
      priority,
      similarEmails: similar,
      analyzedAt: Date.now(),
    });
  } catch (error) {
    logger.error('Smart analyze email error:', error);
    res.status(500).json({ error: 'Nem sikerült elemezni az emailt' });
  }
});

export default router;

