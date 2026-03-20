import { queryAll, queryOne } from '../db/index.js';

export async function getAnalytics(accountId: string) {
  const now = Date.now();
  const start30 = now - 30 * 24 * 60 * 60 * 1000;
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const prevWeekStart = now - 14 * 24 * 60 * 60 * 1000;

  const dailyVolume = await queryAll<{ day: string; count: number }>(
    `SELECT DATE(date / 1000, 'unixepoch') as day, COUNT(*) as count
     FROM emails WHERE account_id = ? AND date >= ? AND labels NOT LIKE '%TRASH%'
     GROUP BY day ORDER BY day`,
    [accountId, start30],
  );

  const avgResponse = await queryOne<{ avgHours: number }>(
    `SELECT AVG((sent.date - incoming.date) / 3600000.0) as avgHours
     FROM emails sent
     JOIN emails incoming ON sent.thread_id = incoming.thread_id AND sent.account_id = incoming.account_id
     WHERE sent.account_id = ? AND sent.labels LIKE '%SENT%' AND incoming.labels NOT LIKE '%SENT%' AND incoming.date < sent.date`,
    [accountId],
  );

  const topSenders = await queryAll<{ email: string; name: string; count: number }>(
    `SELECT from_email as email, COALESCE(from_name, from_email) as name, COUNT(*) as count
     FROM emails WHERE account_id = ? AND from_email IS NOT NULL AND date >= ?
     GROUP BY LOWER(from_email) ORDER BY count DESC LIMIT 10`,
    [accountId, start30],
  );

  const categories = await queryAll<{ name: string; count: number }>(
    `SELECT COALESCE(c.name, 'Kategorizálatlan') as name, COUNT(*) as count
     FROM emails e LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.account_id = ? AND e.date >= ?
     GROUP BY e.category_id ORDER BY count DESC`,
    [accountId, start30],
  );

  const thisWeek =
    (
      await queryOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM emails WHERE account_id=? AND date>=?',
        [accountId, weekStart],
      )
    )?.cnt || 0;
  const prevWeek =
    (
      await queryOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM emails WHERE account_id=? AND date>=? AND date<?',
        [accountId, prevWeekStart, weekStart],
      )
    )?.cnt || 0;

  return {
    dailyVolume,
    avgResponseHours: Number((avgResponse?.avgHours || 0).toFixed(1)),
    topSenders,
    categories,
    weeklyComparison: { current: thisWeek, previous: prevWeek },
  };
}
