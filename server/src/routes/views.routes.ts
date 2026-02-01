import { Router } from 'express';
import { queryOne, queryAll } from '../db/index.js';

// Adatbázis rekord interfészek
interface EmailRecord {
  id: string;
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
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const senders = queryAll('SELECT * FROM sender_groups WHERE account_id = ? ORDER BY message_count DESC LIMIT ? OFFSET ?', [accountId, limit, offset]);
  res.json({ senders });
});

router.get('/by-sender/:email', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const senderEmail = decodeURIComponent(req.params.email);
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND from_email = ? ORDER BY date DESC LIMIT ? OFFSET ?', [accountId, senderEmail, limit, offset]);
  res.json({ emails: results.map(formatEmail), senderEmail });
});

router.get('/by-topic', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const topicList = queryAll('SELECT * FROM topics WHERE account_id = ? ORDER BY message_count DESC LIMIT ? OFFSET ?', [accountId, limit, offset]);
  res.json({ topics: topicList });
});

router.get('/by-topic/:id', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const topicId = req.params.id;
  const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND topic_id = ? ORDER BY date DESC', [accountId, topicId]);
  const topic = queryOne('SELECT * FROM topics WHERE id = ?', [topicId]);
  res.json({ emails: results.map(formatEmail), topic });
});

router.get('/by-time', (req, res) => {
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
});

router.get('/by-time/:periodId', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const periodId = req.params.periodId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
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
});

router.get('/by-category', (req, res) => {
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
});

router.get('/by-category/:id', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const categoryId = req.params.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const results = queryAll<EmailRecord>('SELECT * FROM emails WHERE account_id = ? AND category_id = ? ORDER BY date DESC LIMIT ? OFFSET ?', [accountId, categoryId, limit, offset]);
  const cat = queryOne('SELECT * FROM categories WHERE id = ?', [categoryId]);
  res.json({ emails: results.map(formatEmail), category: cat });
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
      } catch {
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
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
  const offset = (page - 1) * limit;

  // Szűrjük azokat az emaileket, amelyek labels JSON-jében benne van az "INBOX" DE NINCS benne a "TRASH"
  const allEmails = queryAll<EmailRecord>(
    'SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC',
    [accountId]
  );

  const inboxEmails = allEmails.filter(email => {
    try {
      const labels: string[] = email.labels ? JSON.parse(email.labels) : [];
      return labels.includes('INBOX') && !labels.includes('TRASH');
    } catch {
      return false;
    }
  });

  const paginatedEmails = inboxEmails.slice(offset, offset + limit);

  res.json({
    emails: paginatedEmails.map(formatEmail),
    total: inboxEmails.length,
    page,
    totalPages: Math.ceil(inboxEmails.length / limit),
  });
});

// Kuka - törölt levelek (TRASH label)
router.get('/trash', (req, res) => {
  const accountId = validateAccountAccess(req);
  if (!accountId) { res.status(400).json({ error: 'Nincs aktív fiók vagy nincs jogosultság' }); return; }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
  const offset = (page - 1) * limit;

  // Szűrjük azokat az emaileket, amelyek labels JSON-jében benne van a "TRASH"
  const allEmails = queryAll<EmailRecord>(
    'SELECT * FROM emails WHERE account_id = ? ORDER BY date DESC',
    [accountId]
  );

  const trashedEmails = allEmails.filter(email => {
    try {
      const labels: string[] = email.labels ? JSON.parse(email.labels) : [];
      return labels.includes('TRASH');
    } catch {
      return false;
    }
  });

  const paginatedEmails = trashedEmails.slice(offset, offset + limit);

  res.json({
    emails: paginatedEmails.map(formatEmail),
    total: trashedEmails.length,
    page,
    totalPages: Math.ceil(trashedEmails.length / limit),
  });
});

export default router;
