import { Router } from 'express';
import { google } from 'googleapis';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import { queryOne } from '../db/index.js';
import { getTaskStats, getDetectedTasks } from '../services/task-detection.service.js';
import { getActionCenter, type ActionCenterItem } from '../services/action-center.service.js';
import logger from '../utils/logger.js';

const router = Router();

interface FeedItem {
  id: string;
  type: 'today_task' | 'urgent_reply' | 'unanswered_email' | 'deadline';
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  dueAt?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
  emailId?: string | null;
  threadId?: string | null;
  links: {
    app: string | null;
    gmail: string | null;
    calendar: string | null;
  };
  source: ActionCenterItem['sourceType'];
}

function buildCalendarLink(dueAt?: number | null): string {
  if (!dueAt) return '/calendar';
  const date = new Date(dueAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `https://calendar.google.com/calendar/r/day/${year}/${month}/${day}`;
}

function normalizePriority(input?: string | null): 'high' | 'medium' | 'low' | null {
  if (input === 'high' || input === 'medium' || input === 'low') return input;
  return null;
}

function mapActionCenterItem(item: ActionCenterItem, type: FeedItem['type']): FeedItem {
  const calendarLink = item.links.calendar ?? (item.dueAt ? buildCalendarLink(item.dueAt) : null);

  return {
    id: item.id,
    type,
    title: item.title,
    subtitle: item.summary,
    excerpt: item.quote || item.suggestedAction,
    dueAt: item.dueAt,
    priority: item.priority === 'critical' ? 'high' : normalizePriority(item.priority),
    emailId: item.emailId,
    threadId: item.threadId,
    links: {
      ...item.links,
      calendar: calendarLink,
    },
    source: item.sourceType,
  };
}

// Összesített dashboard adat
router.get('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    // Először akcióközpont + DB — OAuth nélkül is működik (getActionCenter belül elkapja a Google hibát).
    // A régi sorrend (OAuth előbb) miatt hiányzó / hibás token esetén az egész dashboard 500 volt.
    const actionCenter = await getActionCenter(accountId);

    // Olvasatlan levelek száma (helyi DB-ből — gyorsabb)
    const unreadResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0',
      [accountId],
    );
    const unreadCount = Number(unreadResult?.count ?? 0);

    const accountRow = await queryOne<{ email: string }>(
      'SELECT email FROM accounts WHERE id = ?',
      [accountId],
    );
    const accountEmail = accountRow?.email?.toLowerCase() ?? null;

    let calendarEvents: Array<{
      id: string;
      summary: string;
      start: string;
      end: string;
      isAllDay: boolean;
      location: string | null;
      htmlLink: string | null;
      organizerEmail: string | null;
      isOrganizer: boolean;
    }> = [];

    let openTasks: Array<{
      id: string;
      title: string;
      status: string;
      due: string | null;
      listId: string;
      listTitle: string;
    }> = [];

    try {
      const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

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

      calendarEvents =
        calendarResponse.status === 'fulfilled'
          ? (calendarResponse.value.data.items || []).map((event) => {
              const isAllDay = !event.start?.dateTime;
              const organizerEmail = event.organizer?.email || event.creator?.email || null;
              return {
                id: event.id || '',
                summary: event.summary || '(Nincs cím)',
                start: event.start?.dateTime || event.start?.date || '',
                end: event.end?.dateTime || event.end?.date || '',
                isAllDay,
                location: event.location || null,
                htmlLink: event.htmlLink || null,
                organizerEmail,
                isOrganizer: Boolean(
                  accountEmail && organizerEmail && organizerEmail.toLowerCase() === accountEmail,
                ),
              };
            })
          : [];

      if (calendarResponse.status === 'rejected') {
        logger.error('Dashboard calendar error:', calendarResponse.reason);
      }

      let taskItems: typeof openTasks = [];

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

      openTasks = taskItems.filter((t) => t.status === 'needsAction');
    } catch (oauthErr) {
      logger.debug('Dashboard: calendar / Google Tasks skipped (no OAuth or API error)', oauthErr);
    }

    // Detected tasks (email-alapú feladatok) integrálása
    const detectedStats = await getTaskStats(accountId);
    const { tasks: detectedTasks } = await getDetectedTasks(accountId, { status: 'open' });

    // Detected tasks átalakítása dashboard formátumra
    const detectedTaskItems = detectedTasks.slice(0, 5).map((dt) => ({
      id: dt.id,
      title: `📧 ${dt.subject || '(nincs tárgy)'} — ${dt.fromName || dt.fromEmail || 'Ismeretlen'}`,
      notes: dt.reason || null,
      status: 'needsAction' as const,
      due: null,
      listId: 'detected',
      listTitle: 'Email feladatok',
      emailId: dt.emailId,
      accountId: dt.accountId,
      appLink: `/?emailId=${encodeURIComponent(dt.emailId)}&accountId=${encodeURIComponent(dt.accountId)}`,
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
        emailId: null as string | null,
        accountId: null as string | null,
        appLink: '/tasks',
      })),
    ].slice(0, 5);

    return res.json({
      unreadCount,
      todayEvents: calendarEvents,
      todayEventsCount: calendarEvents.length,
      openTasks: combinedOpenTasks,
      openTasksCount: openTasks.length + detectedStats.open,
      actionCenter,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Dashboard adatok lekérése sikertelen' });
  }
});

// Akcióközpont feed - actionable feladatok blokkosítva
router.get('/feed', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const actionCenter = await getActionCenter(accountId);
    const todayTasks = actionCenter.blocks.todayFocus
      .filter((item) => item.sourceType === 'action_items')
      .map((item) => mapActionCenterItem(item, 'today_task'));
    const urgentReplies = actionCenter.blocks.urgentClientMatters
      .filter(
        (item) =>
          item.kind === 'urgent_reply' ||
          item.kind === 'unanswered_email' ||
          item.kind === 'unread_email',
      )
      .map((item) => mapActionCenterItem(item, 'urgent_reply'));
    const unanswered = [
      ...actionCenter.blocks.unanswered,
      ...actionCenter.blocks.repeatedFollowUps,
    ].map((item) => mapActionCenterItem(item, 'unanswered_email'));
    const deadlines = [
      ...actionCenter.blocks.suggestedEvents,
      ...actionCenter.blocks.todayCalendar,
    ].map((item) => mapActionCenterItem(item, 'deadline'));

    return res.json({
      generatedAt: actionCenter.generatedAt,
      blocks: {
        todayTasks,
        urgentReplies,
        unanswered,
        deadlines,
      },
    });
  } catch (error) {
    logger.error('Dashboard feed error:', error);
    return res.status(500).json({ error: 'Dashboard feed lekérése sikertelen' });
  }
});

export default router;
