import { Router } from 'express';
import { google } from 'googleapis';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import { queryOne } from '../db/index.js';
import { getTaskStats, getDetectedTasks } from '../services/task-detection.service.js';
import logger from '../utils/logger.js';

const router = Router();

// Összesített dashboard adat
router.get('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);

    // Olvasatlan levelek száma (helyi DB-ből — gyorsabb)
    const unreadResult = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0',
      [accountId],
    );
    const unreadCount = unreadResult?.count || 0;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Calendar + Tasks párhuzamosan
    const [calendarResponse, taskListsResponse] = await Promise.allSettled([
      calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      }),
      tasksApi.tasklists.list({ maxResults: 20 }),
    ]);

    // Calendar events feldolgozása
    const calendarEvents =
      calendarResponse.status === 'fulfilled'
        ? (calendarResponse.value.data.items || []).map((event) => {
            const isAllDay = !event.start?.dateTime;
            return {
              id: event.id || '',
              summary: event.summary || '(Nincs cím)',
              start: event.start?.dateTime || event.start?.date || '',
              end: event.end?.dateTime || event.end?.date || '',
              isAllDay,
              location: event.location || null,
            };
          })
        : [];

    if (calendarResponse.status === 'rejected') {
      logger.error('Dashboard calendar error:', calendarResponse.reason);
    }

    // Tasks: összes nyitott feladat az összes listából
    let taskItems: Array<{
      id: string;
      title: string;
      status: string;
      due: string | null;
      listId: string;
      listTitle: string;
    }> = [];

    if (taskListsResponse.status === 'fulfilled') {
      const lists = taskListsResponse.value.data.items || [];

      const taskPromises = lists
        .filter((list) => list.id)
        .map(async (list) => {
          try {
            const resp = await tasksApi.tasks.list({
              tasklist: list.id!,
              showCompleted: false,
              maxResults: 100,
            });

            return (resp.data.items || []).map((task) => ({
              id: task.id || '',
              title: task.title || '',
              status: task.status || 'needsAction',
              due: task.due || null,
              listId: list.id!,
              listTitle: list.title || 'Névtelen lista',
            }));
          } catch (err) {
            logger.error(`Dashboard tasks error for list ${list.id}:`, err);
            return [];
          }
        });

      const results = await Promise.all(taskPromises);
      taskItems = results.flat();
    } else {
      logger.error('Dashboard tasks lists error:', taskListsResponse.reason);
    }

    const openTasks = taskItems.filter((t) => t.status === 'needsAction');

    // Detected tasks (email-alapú feladatok) integrálása
    const detectedStats = getTaskStats(accountId);
    const { tasks: detectedTasks } = getDetectedTasks(accountId, { status: 'open' });

    // Detected tasks átalakítása dashboard formátumra
    const detectedTaskItems = detectedTasks.slice(0, 5).map((dt) => ({
      id: dt.id,
      title: `📧 ${dt.subject || '(nincs tárgy)'} — ${dt.fromName || dt.fromEmail || 'Ismeretlen'}`,
      notes: dt.reason || null,
      status: 'needsAction' as const,
      due: null,
      listId: 'detected',
      listTitle: 'Email feladatok',
    }));

    // Kombinált lista: detected tasks először, aztán Google Tasks, max 5
    const combinedOpenTasks = [
      ...detectedTaskItems,
      ...openTasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title || '',
        notes: null as string | null,
        status: t.status || 'needsAction',
        due: t.due || null,
        listId: t.listId,
        listTitle: t.listTitle,
      })),
    ].slice(0, 5);

    return res.json({
      unreadCount,
      todayEvents: calendarEvents,
      todayEventsCount: calendarEvents.length,
      openTasks: combinedOpenTasks,
      openTasksCount: openTasks.length + detectedStats.open,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Dashboard adatok lekérése sikertelen' });
  }
});

export default router;
