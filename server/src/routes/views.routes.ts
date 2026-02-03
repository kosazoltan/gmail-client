import { Router } from 'express';
import { queryOne, queryAll } from '../db/index.js';
import logger from '../utils/logger.js';

// Adatbázis rekord interfészek
interface EmailRecord {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  cc_email: string | null;
  snippet: string | null;
  date: number;
  is_read: number;
  is_starred: number;
  labels: string | null;
  has_attachments: number;
  category_id: string | null;
  topic_id: string | null;
}

interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_system: number;
  account_id: string;
}

const router = Router();

// Max limit konstans a DoS védelem érdekében
const MAX_LIMIT = 100;

// Default account color constant - actual hex color value
const DEFAULT_ACCOUNT_COLOR = '#3B82F6';

// Jogosultság ellenőrzés helper
function validateAccountAccess(req: { query: { accountId?: string }; session: { activeAccountId?: string | null; accountIds?: string[] } }): string | null {
  const accountId = (req.query.accountId as string) || req.session.activeAccountId;
  if (!accountId) return null;

  // Ellenőrizzük, hogy a kért accountId a felhasználó session-jében van-e
  const accountIds = req.session.accountIds || [];
  if (!accountIds.includes(accountId)) return null;

  return accountId;
}

router.get('/by-sender', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 30), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const senders = queryAll('SELECT * FROM sender_groups WHERE account_id = ? ORDER BY message_count DESC LIMIT ? OFFSET ?', [accountId, limit, offset]);
    res.json({ senders });
  } catch (error) {
    console.error('By-sender view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-sender/:email', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const senderEmail = decodeURIComponent(req.params.email);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND from_email = ? ORDER BY date DESC LIMIT ? OFFSET ?', [accountId, senderEmail, limit, offset]);
    res.json({ emails: results.map(formatEmail), senderEmail });
  } catch (error) {
    console.error('By-sender email view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-topic', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 30), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const topicList = queryAll('SELECT * FROM topics WHERE account_id = ? ORDER BY message_count DESC LIMIT ? OFFSET ?', [accountId, limit, offset]);
    res.json({ topics: topicList });
  } catch (error) {
    console.error('By-topic view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-topic/:id', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const topicId = req.params.id;
    const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND topic_id = ? ORDER BY date DESC', [accountId, topicId]);
    // FIX: Add account_id filter to prevent unauthorized access to other accounts' topics
    const topic = queryOne('SELECT * FROM topics WHERE id = ? AND account_id = ?', [topicId, accountId]);
    res.json({ emails: results.map(formatEmail), topic });
  } catch (error) {
    console.error('By-topic ID view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-time', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const countByPeriod = (from: number, to: number) => {
      const r = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND date >= ? AND date < ?', [accountId, from, to]);
      return r?.count || 0;
    };

    const olderCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND date < ?', [accountId, monthStart])?.count || 0;

    const timePeriods = [
      { id: 'today', name: 'Ma', from: todayStart, to: Date.now(), count: countByPeriod(todayStart, Date.now()) },
      { id: 'yesterday', name: 'Tegnap', from: yesterdayStart, to: todayStart, count: countByPeriod(yesterdayStart, todayStart) },
      { id: 'this_week', name: 'Ezen a héten', from: weekStart, to: yesterdayStart, count: countByPeriod(weekStart, yesterdayStart) },
      { id: 'this_month', name: 'Ebben a hónapban', from: monthStart, to: weekStart, count: countByPeriod(monthStart, weekStart) },
      { id: 'older', name: 'Régebbi', from: 0, to: monthStart, count: olderCount },
    ];
    res.json({ periods: timePeriods });
  } catch (error) {
    console.error('By-time view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-time/:periodId', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const periodId = req.params.periodId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let from = 0;
    let to = Date.now();

    switch (periodId) {
      case 'today': from = todayStart; to = Date.now(); break;
      case 'yesterday': from = yesterdayStart; to = todayStart; break;
      case 'this_week': from = weekStart; to = yesterdayStart; break;
      case 'this_month': from = monthStart; to = weekStart; break;
      case 'older': from = 0; to = monthStart; break;
    }

    const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND date >= ? AND date < ? ORDER BY date DESC LIMIT ? OFFSET ?', [accountId, from, to, limit, offset]);
    res.json({ emails: results.map(formatEmail), periodId });
  } catch (error) {
    console.error('By-time period view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-category', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const cats = queryAll<CategoryRecord>('SELECT * FROM categories WHERE account_id = ?', [accountId]);

    // N+1 query probléma javítása: egyetlen query az összes kategória email számához
    const counts = queryAll<{ category_id: string; count: number }>(
      'SELECT category_id, COUNT(*) as count FROM emails WHERE account_id = ? AND category_id IS NOT NULL GROUP BY category_id',
      [accountId]
    );
    const countMap = new Map(counts.map(c => [c.category_id, c.count]));

    const categoriesWithCount = cats.map((cat) => ({
      ...cat,
      emailCount: countMap.get(cat.id) || 0
    }));

    res.json({ categories: categoriesWithCount });
  } catch (error) {
    console.error('By-category view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

router.get('/by-category/:id', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const categoryId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND category_id = ? ORDER BY date DESC LIMIT ? OFFSET ?', [accountId, categoryId, limit, offset]);
    // FIX: Add account_id filter to prevent cross-account category access
    const cat = queryOne('SELECT * FROM categories WHERE id = ? AND account_id = ?', [categoryId, accountId]);
    res.json({ emails: results.map(formatEmail), category: cat });
  } catch (error) {
    console.error('By-category ID view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

function formatEmail(email: EmailRecord) {
  return {
    id: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    from: email.from_email,
    fromName: email.from_name,
    to: email.to_email,
    cc: email.cc_email,
    snippet: email.snippet,
    date: email.date,
    isRead: email.is_read,
    isStarred: email.is_starred,
    labels: (() => {
      try {
        return email.labels ? JSON.parse(email.labels) : [];
      } catch (err) {
        logger.warn('Labels JSON parse failed in formatEmail', { emailId: email.id, labels: email.labels, error: err });
        return [];
      }
    })(),
    hasAttachments: email.has_attachments,
    categoryId: email.category_id,
    topicId: email.topic_id,
  };
}

// Beérkezett levelek (INBOX label, de nem TRASH)
router.get('/inbox', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;

    // FIX: N+1 query optimization - filter in SQL instead of loading all emails
    // Using LIKE to filter JSON labels array for INBOX but not TRASH
    const inboxEmails = queryAll<EmailRecord>(
      `SELECT * FROM emails
       WHERE account_id = ?
         AND labels LIKE '%"INBOX"%'
         AND labels NOT LIKE '%"TRASH"%'
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [accountId, limit, offset]
    );

    // Get total count for pagination
    const countResult = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM emails
       WHERE account_id = ?
         AND labels LIKE '%"INBOX"%'
         AND labels NOT LIKE '%"TRASH"%'`,
      [accountId]
    );
    const total = countResult?.count || 0;

    res.json({
      emails: inboxEmails.map(formatEmail),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Inbox view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

// Unified Inbox - minden fiók emailjei egy helyen
router.get('/unified', (req, res) => {
  try {
    const accountIds = req.session.accountIds || [];
    if (accountIds.length === 0) {
      res.status(400).json({ error: 'Nincs bejelentkezett fiók' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const filterAccountId = req.query.filterAccountId as string | undefined;

    // Fiók információk lekérése (email és szín)
    const accountPlaceholders = accountIds.map(() => '?').join(',');
    const accounts = queryAll<{ id: string; email: string; color: string | null }>(
      `SELECT id, email, color FROM accounts WHERE id IN (${accountPlaceholders})`,
      accountIds
    );
    const accountMap = new Map(accounts.map(a => [a.id, { email: a.email, color: a.color }]));

    // Szűrt accountIds lista
    const targetAccountIds = filterAccountId && accountIds.includes(filterAccountId)
      ? [filterAccountId]
      : accountIds;

    // FIX: N+1 query optimization - filter in SQL instead of loading all emails
    const targetPlaceholders = targetAccountIds.map(() => '?').join(',');
    const inboxEmails = queryAll<EmailRecord & { account_id: string }>(
      `SELECT * FROM emails
       WHERE account_id IN (${targetPlaceholders})
         AND labels LIKE '%"INBOX"%'
         AND labels NOT LIKE '%"TRASH"%'
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [...targetAccountIds, limit, offset]
    );

    // Get total count for pagination
    const countResult = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM emails
       WHERE account_id IN (${targetPlaceholders})
         AND labels LIKE '%"INBOX"%'
         AND labels NOT LIKE '%"TRASH"%'`,
      targetAccountIds
    );
    const total = countResult?.count || 0;

    // Formázás account adatokkal
    const formattedEmails = inboxEmails.map(email => {
      const accountInfo = accountMap.get(email.account_id);
      return {
        ...formatEmail(email),
        accountId: email.account_id,
        accountEmail: accountInfo?.email || null,
        accountColor: accountInfo?.color || DEFAULT_ACCOUNT_COLOR,
      };
    });

    // Fiók statisztikák - optimized with GROUP BY
    const statsResults = queryAll<{ account_id: string; count: number }>(
      `SELECT account_id, COUNT(*) as count FROM emails
       WHERE account_id IN (${targetPlaceholders})
         AND labels LIKE '%"INBOX"%'
         AND labels NOT LIKE '%"TRASH"%'
       GROUP BY account_id`,
      targetAccountIds
    );
    const statsMap = new Map(statsResults.map(s => [s.account_id, s.count]));

    const accountStats = targetAccountIds.map(accId => {
      const accountInfo = accountMap.get(accId);
      return {
        accountId: accId,
        email: accountInfo?.email || '',
        color: accountInfo?.color || DEFAULT_ACCOUNT_COLOR,
        count: statsMap.get(accId) || 0,
      };
    });

    res.json({
      emails: formattedEmails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      accounts: accountStats,
    });
  } catch (error) {
    console.error('Unified inbox view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

// Kuka - törölt levelek (TRASH label)
router.get('/trash', (req, res) => {
  try {
    const accountId = validateAccountAccess(req);
    if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), MAX_LIMIT);
    const offset = (page - 1) * limit;

    // FIX: N+1 query optimization - filter in SQL instead of loading all emails
    const trashedEmails = queryAll<EmailRecord>(
      `SELECT * FROM emails
       WHERE account_id = ?
         AND labels LIKE '%"TRASH"%'
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [accountId, limit, offset]
    );

    // Get total count for pagination
    const countResult = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM emails
       WHERE account_id = ?
         AND labels LIKE '%"TRASH"%'`,
      [accountId]
    );
    const total = countResult?.count || 0;

    res.json({
      emails: trashedEmails.map(formatEmail),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Trash view error:', error);
    res.status(500).json({ error: 'Adatbázis hiba történt' });
  }
});

export default router;
