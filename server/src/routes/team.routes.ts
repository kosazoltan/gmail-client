import { Router, Request, Response } from 'express';
import { queryAll } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/team/members — csapattagok email aktivitás alapján
router.get('/members', (req: Request, res: Response) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Top 20 kontakt az utolsó 30 napból (küldött + fogadott összesítve)
    const members = queryAll<{
      email: string;
      name: string;
      emailCount: number;
      lastContact: number;
      topCategory: string | null;
    }>(
      `SELECT
        contact_email AS email,
        contact_name AS name,
        COUNT(*) AS emailCount,
        MAX(date) AS lastContact,
        (
          SELECT c.name FROM categories c
          WHERE c.id = (
            SELECT e2.category_id FROM emails e2
            WHERE e2.account_id = ?
              AND e2.date >= ?
              AND (e2.from_email = contact_email OR e2.to_email LIKE '%' || contact_email || '%')
              AND e2.category_id IS NOT NULL
            GROUP BY e2.category_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) AS topCategory
      FROM (
        SELECT from_email AS contact_email, from_name AS contact_name, date, category_id
        FROM emails
        WHERE account_id = ? AND date >= ?
          AND from_email != (SELECT email FROM accounts WHERE id = ?)

        UNION ALL

        SELECT
          TRIM(to_email) AS contact_email,
          '' AS contact_name,
          date,
          category_id
        FROM emails
        WHERE account_id = ? AND date >= ?
          AND from_email = (SELECT email FROM accounts WHERE id = ?)
          AND TRIM(to_email) != ''
          AND TRIM(to_email) != (SELECT email FROM accounts WHERE id = ?)
      )
      GROUP BY contact_email
      ORDER BY emailCount DESC
      LIMIT 20`,
      [accountId, thirtyDaysAgo, accountId, thirtyDaysAgo, accountId, accountId, thirtyDaysAgo, accountId, accountId]
    );

    // to_email multi-recipient szétbontás: ha contact_email vesszőt tartalmaz, külön sorokra bontjuk
    const expandedMembers: typeof members = [];
    for (const row of members) {
      if (row.email.includes(',')) {
        const emails = row.email.split(',').map((e: string) => e.trim()).filter(Boolean);
        for (const email of emails) {
          expandedMembers.push({ ...row, email });
        }
      } else {
        expandedMembers.push(row);
      }
    }

    // Újra-aggregálás JS-ben a szétbontott sorok után
    const contactMap = new Map<string, { email: string; name: string; emailCount: number; lastContact: number; topCategory: string | null }>();
    for (const row of expandedMembers) {
      const existing = contactMap.get(row.email);
      if (existing) {
        existing.emailCount += row.emailCount;
        existing.lastContact = Math.max(existing.lastContact, row.lastContact);
        if (!existing.name && row.name) existing.name = row.name;
        if (!existing.topCategory && row.topCategory) existing.topCategory = row.topCategory;
      } else {
        contactMap.set(row.email, { ...row });
      }
    }

    const aggregatedMembers = Array.from(contactMap.values())
      .sort((a, b) => b.emailCount - a.emailCount)
      .slice(0, 20);

    const result = aggregatedMembers.map((m) => ({
      email: m.email,
      name: m.name || m.email.split('@')[0],
      emailCount: m.emailCount,
      lastContact: new Date(m.lastContact).toISOString(),
      topCategory: m.topCategory || null,
      status: m.lastContact >= sevenDaysAgo ? ('active' as const) : ('inactive' as const),
    }));

    return res.json({ members: result });
  } catch (error) {
    logger.error('Team members query failed:', error);
    return res.status(500).json({ error: 'Nem sikerült lekérdezni a csapattagokat' });
  }
});

// GET /api/team/stats — csapat statisztikák
router.get('/stats', (req: Request, res: Response) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Küldött emailek (30 nap)
    const sentRow = queryAll<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM emails
       WHERE account_id = ? AND date >= ?
         AND from_email = (SELECT email FROM accounts WHERE id = ?)`,
      [accountId, thirtyDaysAgo, accountId]
    );
    const sentCount = sentRow[0]?.cnt ?? 0;

    // Fogadott emailek (30 nap)
    const receivedRow = queryAll<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM emails
       WHERE account_id = ? AND date >= ?
         AND from_email != (SELECT email FROM accounts WHERE id = ?)`,
      [accountId, thirtyDaysAgo, accountId]
    );
    const receivedCount = receivedRow[0]?.cnt ?? 0;

    // Átlagos válaszidő becslés: thread-ekben a saját válaszok és az előző email közötti idő
    const avgResponseRow = queryAll<{ avgHours: number | null }>(
      `SELECT AVG(response_time_hours) AS avgHours FROM (
        SELECT
          (e_reply.date - e_orig.date) / 3600000.0 AS response_time_hours
        FROM emails e_reply
        INNER JOIN emails e_orig ON e_reply.thread_id = e_orig.thread_id
          AND e_orig.date < e_reply.date
          AND e_orig.account_id = e_reply.account_id
        WHERE e_reply.account_id = ?
          AND e_reply.date >= ?
          AND e_reply.from_email = (SELECT email FROM accounts WHERE id = ?)
          AND e_orig.from_email != (SELECT email FROM accounts WHERE id = ?)
          AND e_reply.thread_id IS NOT NULL
        GROUP BY e_reply.id
        HAVING response_time_hours > 0 AND response_time_hours < 168
      )`,
      [accountId, thirtyDaysAgo, accountId, accountId]
    );
    const avgResponseTimeHours = avgResponseRow[0]?.avgHours
      ? Math.round(avgResponseRow[0].avgHours * 10) / 10
      : null;

    // Top 5 kategória
    const topCategories = queryAll<{ name: string; count: number }>(
      `SELECT c.name, COUNT(*) AS count
       FROM emails e
       JOIN categories c ON c.id = e.category_id
       WHERE e.account_id = ? AND e.date >= ?
       GROUP BY c.name
       ORDER BY count DESC
       LIMIT 5`,
      [accountId, thirtyDaysAgo]
    );

    return res.json({
      sentCount,
      receivedCount,
      avgResponseTimeHours,
      topCategories,
    });
  } catch (error) {
    logger.error('Team stats query failed:', error);
    return res.status(500).json({ error: 'Nem sikerült lekérdezni a statisztikákat' });
  }
});

// GET /api/team/dashboard — combined endpoint (backwards compat + frontend convenience)
router.get('/dashboard', async (req: Request, res: Response) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Members
    const membersRaw = queryAll<{
      email: string;
      name: string;
      emailCount: number;
      lastContact: number;
      topCategory: string | null;
    }>(
      `SELECT
        contact_email AS email,
        contact_name AS name,
        COUNT(*) AS emailCount,
        MAX(date) AS lastContact,
        (
          SELECT c.name FROM categories c
          WHERE c.id = (
            SELECT e2.category_id FROM emails e2
            WHERE e2.account_id = ?
              AND e2.date >= ?
              AND (e2.from_email = contact_email OR e2.to_email LIKE '%' || contact_email || '%')
              AND e2.category_id IS NOT NULL
            GROUP BY e2.category_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) AS topCategory
      FROM (
        SELECT from_email AS contact_email, from_name AS contact_name, date, category_id
        FROM emails
        WHERE account_id = ? AND date >= ?
          AND from_email != (SELECT email FROM accounts WHERE id = ?)

        UNION ALL

        SELECT
          TRIM(to_email) AS contact_email,
          '' AS contact_name,
          date,
          category_id
        FROM emails
        WHERE account_id = ? AND date >= ?
          AND from_email = (SELECT email FROM accounts WHERE id = ?)
          AND TRIM(to_email) != ''
          AND TRIM(to_email) != (SELECT email FROM accounts WHERE id = ?)
      )
      GROUP BY contact_email
      ORDER BY emailCount DESC
      LIMIT 20`,
      [accountId, thirtyDaysAgo, accountId, thirtyDaysAgo, accountId, accountId, thirtyDaysAgo, accountId, accountId]
    );

    // to_email multi-recipient szétbontás
    const expandedMembersRaw: typeof membersRaw = [];
    for (const row of membersRaw) {
      if (row.email.includes(',')) {
        const emails = row.email.split(',').map((e: string) => e.trim()).filter(Boolean);
        for (const email of emails) {
          expandedMembersRaw.push({ ...row, email });
        }
      } else {
        expandedMembersRaw.push(row);
      }
    }

    // Újra-aggregálás JS-ben
    const contactMap = new Map<string, { email: string; name: string; emailCount: number; lastContact: number; topCategory: string | null }>();
    for (const row of expandedMembersRaw) {
      const existing = contactMap.get(row.email);
      if (existing) {
        existing.emailCount += row.emailCount;
        existing.lastContact = Math.max(existing.lastContact, row.lastContact);
        if (!existing.name && row.name) existing.name = row.name;
        if (!existing.topCategory && row.topCategory) existing.topCategory = row.topCategory;
      } else {
        contactMap.set(row.email, { ...row });
      }
    }

    const aggregatedMembersRaw = Array.from(contactMap.values())
      .sort((a, b) => b.emailCount - a.emailCount)
      .slice(0, 20);

    const members = aggregatedMembersRaw.map((m) => ({
      email: m.email,
      name: m.name || m.email.split('@')[0],
      emailCount: m.emailCount,
      lastContact: new Date(m.lastContact).toISOString(),
      topCategory: m.topCategory || null,
      status: m.lastContact >= sevenDaysAgo ? ('active' as const) : ('inactive' as const),
    }));

    // Stats
    const sentRow = queryAll<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM emails
       WHERE account_id = ? AND date >= ?
         AND from_email = (SELECT email FROM accounts WHERE id = ?)`,
      [accountId, thirtyDaysAgo, accountId]
    );
    const sentCount = sentRow[0]?.cnt ?? 0;

    const receivedRow = queryAll<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM emails
       WHERE account_id = ? AND date >= ?
         AND from_email != (SELECT email FROM accounts WHERE id = ?)`,
      [accountId, thirtyDaysAgo, accountId]
    );
    const receivedCount = receivedRow[0]?.cnt ?? 0;

    const avgResponseRow = queryAll<{ avgHours: number | null }>(
      `SELECT AVG(response_time_hours) AS avgHours FROM (
        SELECT
          (e_reply.date - e_orig.date) / 3600000.0 AS response_time_hours
        FROM emails e_reply
        INNER JOIN emails e_orig ON e_reply.thread_id = e_orig.thread_id
          AND e_orig.date < e_reply.date
          AND e_orig.account_id = e_reply.account_id
        WHERE e_reply.account_id = ?
          AND e_reply.date >= ?
          AND e_reply.from_email = (SELECT email FROM accounts WHERE id = ?)
          AND e_orig.from_email != (SELECT email FROM accounts WHERE id = ?)
          AND e_reply.thread_id IS NOT NULL
        GROUP BY e_reply.id
        HAVING response_time_hours > 0 AND response_time_hours < 168
      )`,
      [accountId, thirtyDaysAgo, accountId, accountId]
    );
    const avgResponseTimeHours = avgResponseRow[0]?.avgHours
      ? Math.round(avgResponseRow[0].avgHours * 10) / 10
      : null;

    const topCategories = queryAll<{ name: string; count: number }>(
      `SELECT c.name, COUNT(*) AS count
       FROM emails e
       JOIN categories c ON c.id = e.category_id
       WHERE e.account_id = ? AND e.date >= ?
       GROUP BY c.name
       ORDER BY count DESC
       LIMIT 5`,
      [accountId, thirtyDaysAgo]
    );

    return res.json({
      members,
      stats: {
        sentCount,
        receivedCount,
        avgResponseTimeHours,
        topCategories,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Team dashboard query failed:', error);
    return res.status(500).json({ error: 'Nem sikerült betölteni a csapat dashboard-ot' });
  }
});

export default router;
