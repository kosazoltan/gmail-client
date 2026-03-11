import { google } from 'googleapis';
import { queryAll, queryOne } from '../db/index.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import logger from '../utils/logger.js';
import {
  buildOperationalGroupKey,
  isLikelyBulkNoise,
  isLikelyOperationalAlert,
} from './email-signal.service.js';

export type ActionCenterPriority = 'critical' | 'high' | 'medium' | 'low';
export type ActionCenterItemKind =
  | 'action_item'
  | 'urgent_reply'
  | 'unread_email'
  | 'unanswered_email'
  | 'repeated_followup'
  | 'calendar_event'
  | 'event_candidate'
  | 'reminder'
  | 'google_task';

export interface ActionCenterLinkSet {
  app: string | null;
  gmail: string | null;
  calendar: string | null;
}

export interface ActionCenterItem {
  id: string;
  kind: ActionCenterItemKind;
  sourceType:
    | 'action_items'
    | 'detected_tasks'
    | 'reminders'
    | 'calendar'
    | 'event_candidates'
    | 'google_tasks';
  title: string;
  summary: string | null;
  quote: string | null;
  priority: ActionCenterPriority;
  dueAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  status: string | null;
  confidence: number | null;
  suggestedAction: string | null;
  emailId: string | null;
  emailIds?: string[] | null;
  accountId: string | null;
  threadId: string | null;
  calendarEventId: string | null;
  groupSize?: number | null;
  links: ActionCenterLinkSet;
}

export interface ActionCenterData {
  generatedAt: number;
  blocks: {
    todayFocus: ActionCenterItem[];
    urgentClientMatters: ActionCenterItem[];
    unanswered: ActionCenterItem[];
    repeatedFollowUps: ActionCenterItem[];
    suggestedEvents: ActionCenterItem[];
    todayCalendar: ActionCenterItem[];
    delegatedWatch: ActionCenterItem[];
  };
}

function buildEmailLinks(emailId: string | null, accountId?: string | null): ActionCenterLinkSet {
  if (!emailId) {
    return { app: null, gmail: null, calendar: null };
  }
  const params = new URLSearchParams({ emailId });
  if (accountId) params.set('accountId', accountId);
  const encoded = encodeURIComponent(emailId);
  return {
    app: `/?${params.toString()}`,
    gmail: `https://mail.google.com/mail/#inbox/${encoded}`,
    calendar: null,
  };
}

function buildCalendarLink(dueAt?: number | null): string | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `https://calendar.google.com/calendar/r/day/${year}/${month}/${day}`;
}

function buildCalendarAppLink(eventId?: string | null, dueAt?: number | null): string {
  const params = new URLSearchParams();
  if (eventId) params.set('eventId', eventId);
  if (dueAt) params.set('date', new Date(dueAt).toISOString().slice(0, 10));
  const query = params.toString();
  return query ? `/calendar?${query}` : '/calendar';
}

function normalizePriority(priority?: string | null): ActionCenterPriority {
  switch ((priority || '').toLowerCase()) {
    case 'critical':
    case 'urgent':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

function withCalendarLink(links: ActionCenterLinkSet, dueAt?: number | null): ActionCenterLinkSet {
  if (links.calendar) return links;
  const calendar = buildCalendarLink(dueAt);
  return calendar ? { ...links, calendar } : links;
}

function sanitizeQuote(text?: string | null, maxLength = 220): string | null {
  if (!text) return null;
  const normalized = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function getItemSignalParts(item: ActionCenterItem): {
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
} {
  return {
    fromEmail: item.summary,
    subject: item.title,
    snippet: item.quote,
  };
}

function highestPriority(items: ActionCenterItem[]): ActionCenterPriority {
  const order: ActionCenterPriority[] = ['critical', 'high', 'medium', 'low'];
  return (
    items
      .map((item) => item.priority)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? 'medium'
  );
}

function summarizeOperationalGroup(items: ActionCenterItem[]): ActionCenterItem {
  const sorted = [...items].sort(
    (a, b) =>
      (b.updatedAt ?? b.createdAt ?? b.dueAt ?? 0) - (a.updatedAt ?? a.createdAt ?? a.dueAt ?? 0),
  );
  const newest = sorted[0];
  const count = sorted.length;
  const domainLike = newest.summary?.split('@')[1] || newest.summary || 'rendszer';
  const baseTitle = newest.title || 'Rendszerértesítés';

  return {
    ...newest,
    id: `group-${buildOperationalGroupKey({
      fromEmail: newest.summary,
      subject: newest.title,
      title: newest.title,
    })}`,
    title: `${count} hasonló rendszerjelzés`,
    summary: `${domainLike} · legfrissebb: ${baseTitle}`,
    quote: newest.quote || `${count} hasonló deploy / monitoring / hibajelzés lett összevonva.`,
    priority: highestPriority(sorted),
    suggestedAction: 'Nyisd meg a legfrissebb levelet, a hasonló rendszerjelzések összevonva jelennek meg.',
    emailId: newest.emailId,
    emailIds: sorted.flatMap((item) =>
      item.emailIds?.length ? item.emailIds : item.emailId ? [item.emailId] : [],
    ),
    groupSize: count,
  };
}

function filterAndGroupItems(items: ActionCenterItem[]): ActionCenterItem[] {
  const visible = items.filter((item) => {
    const signal = getItemSignalParts(item);
    return !isLikelyBulkNoise(signal);
  });

  const grouped = new Map<string, ActionCenterItem[]>();
  const passthrough: ActionCenterItem[] = [];

  for (const item of visible) {
    const signal = getItemSignalParts(item);
    if (!isLikelyOperationalAlert(signal)) {
      passthrough.push(item);
      continue;
    }

    const key = buildOperationalGroupKey({
      fromEmail: item.summary,
      subject: item.title,
      title: item.title,
    });
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  const summaryItems = Array.from(grouped.values()).map((bucket) =>
    bucket.length > 1 ? summarizeOperationalGroup(bucket) : bucket[0],
  );

  return [...passthrough, ...summaryItems];
}

async function getAccountEmail(accountId: string): Promise<string | null> {
  const row = await queryOne<{ email: string }>('SELECT email FROM accounts WHERE id = ?', [accountId]);
  return row?.email ?? null;
}

async function getGoogleCalendarBlocks(accountId: string): Promise<{
  todayCalendar: ActionCenterItem[];
  googleTasks: ActionCenterItem[];
}> {
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
        maxResults: 25,
      }),
      tasksApi.tasklists.list({ maxResults: 20 }),
    ]);

    const todayCalendar: ActionCenterItem[] =
      calendarResponse.status === 'fulfilled'
        ? (calendarResponse.value.data.items || []).map((event) => ({
            id: event.id || '',
            kind: 'calendar_event' as const,
            sourceType: 'calendar' as const,
            title: event.summary || '(Nincs cím)',
            summary: event.location || null,
            quote: sanitizeQuote(event.description),
            priority: 'medium' as const,
            dueAt: event.start?.dateTime
              ? new Date(event.start.dateTime).getTime()
              : event.start?.date
                ? new Date(event.start.date).getTime()
                : null,
            createdAt: null,
            updatedAt: null,
            status: event.status || null,
            confidence: 1,
            suggestedAction: 'Nyisd meg és kezeld a naptárbejegyzést.',
            emailId: null,
            accountId,
            threadId: null,
            calendarEventId: event.id || null,
            links: {
              app: buildCalendarAppLink(event.id || null, event.start?.dateTime
                ? new Date(event.start.dateTime).getTime()
                : event.start?.date
                  ? new Date(event.start.date).getTime()
                  : null),
              gmail: null,
              calendar: event.htmlLink || null,
            },
          }))
        : [];

    if (calendarResponse.status === 'rejected') {
      logger.error('Action center calendar fetch error:', calendarResponse.reason);
    }

    let googleTasks: ActionCenterItem[] = [];
    if (taskListsResponse.status === 'fulfilled') {
      const lists = taskListsResponse.value.data.items || [];
      const taskGroups = await Promise.all(
        lists
          .filter((list) => list.id)
          .map(async (list) => {
            try {
              const response = await tasksApi.tasks.list({
                tasklist: list.id!,
                showCompleted: false,
                maxResults: 50,
              });
              return (response.data.items || []).map((task) => ({
                id: task.id || '',
                kind: 'google_task' as const,
                sourceType: 'google_tasks' as const,
                title: task.title || '(Névtelen feladat)',
                summary: list.title || 'Google Tasks',
                quote: sanitizeQuote(task.notes),
                priority: (task.due ? 'high' : 'medium') as ActionCenterPriority,
                dueAt: task.due ? new Date(task.due).getTime() : null,
                createdAt: null,
                updatedAt: task.updated ? new Date(task.updated).getTime() : null,
                status: task.status || 'needsAction',
                confidence: 1,
                suggestedAction: 'Nyisd meg és jelöld készre vagy pontosítsd.',
                emailId: null,
                accountId,
                threadId: null,
                calendarEventId: null,
                links: {
                  app: '/tasks',
                  gmail: null,
                  calendar: null,
                },
              }));
            } catch (error) {
              logger.error(`Action center task fetch error for list ${list.id}:`, error);
              return [];
            }
          }),
      );
      googleTasks = taskGroups.flat().slice(0, 10);
    } else {
      logger.error('Action center tasks list fetch error:', taskListsResponse.reason);
    }

    return { todayCalendar, googleTasks };
  } catch (error) {
    logger.error('Action center Google integration error:', error);
    return { todayCalendar: [], googleTasks: [] };
  }
}

export async function getActionCenter(accountId: string): Promise<ActionCenterData> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const accountEmail = await getAccountEmail(accountId);

  const [actionItems, detectedTasks, reminders, suggestedEvents, repeatedFollowUps, googleData] =
    await Promise.all([
      queryAll<{
        id: string;
        email_id: string;
        account_id: string;
        text: string;
        due_date: number | null;
        source_quote: string | null;
        priority: string | null;
        confidence: number | null;
        suggested_action: string | null;
        workflow_origin: string | null;
        calendar_event_id: string | null;
        is_done: number;
        created_at: number;
        updated_at: number | null;
        thread_id: string | null;
        subject: string | null;
        from_email: string | null;
        from_name: string | null;
        snippet: string | null;
        email_date: number | null;
      }>(
        `SELECT ai.id, ai.email_id, ai.account_id, ai.text, ai.due_date, ai.source_quote, ai.priority,
                ai.confidence, ai.suggested_action, ai.workflow_origin, ai.calendar_event_id, ai.is_done,
                ai.created_at, ai.updated_at, e.thread_id, e.subject, e.from_email, e.from_name, e.snippet,
                e.date AS email_date
         FROM action_items ai
         JOIN emails e ON e.id = ai.email_id
         WHERE ai.account_id = ? AND ai.is_done = 0
         ORDER BY COALESCE(ai.due_date, e.date) ASC
         LIMIT 50`,
        [accountId],
      ),
      queryAll<{
        id: string;
        email_id: string;
        account_id: string;
        thread_id: string | null;
        subject: string | null;
        from_email: string | null;
        from_name: string | null;
        email_date: number | null;
        detection_type: string;
        reason: string | null;
        priority: string;
        status: string;
        snoozed_until: number | null;
        created_at: number;
        updated_at: number;
      }>(
        `SELECT id, email_id, account_id, thread_id, subject, from_email, from_name, email_date,
                detection_type, reason, priority, status, snoozed_until, created_at, updated_at
         FROM detected_tasks
         WHERE account_id = ? AND status = 'open'
         ORDER BY
           CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
           COALESCE(email_date, created_at) DESC
         LIMIT 50`,
        [accountId],
      ),
      queryAll<{
        id: string;
        email_id: string;
        account_id: string;
        remind_at: number;
        note: string | null;
        is_completed: number;
        created_at: number;
        subject: string | null;
        from_email: string | null;
        from_name: string | null;
        thread_id: string | null;
        snippet: string | null;
      }>(
        `SELECT r.id, r.email_id, r.account_id, r.remind_at, r.note, r.is_completed, r.created_at,
                e.subject, e.from_email, e.from_name, e.thread_id, e.snippet
         FROM reminders r
         JOIN emails e ON e.id = r.email_id
         WHERE r.account_id = ? AND r.is_completed = 0
         ORDER BY r.remind_at ASC
         LIMIT 30`,
        [accountId],
      ),
      queryAll<{
        id: string;
        email_id: string;
        account_id: string;
        thread_id: string | null;
        title: string;
        event_type: string;
        start_at: number;
        end_at: number | null;
        is_all_day: number;
        location: string | null;
        source_quote: string | null;
        confidence: number | null;
        status: string | null;
        google_event_id: string | null;
        google_event_link: string | null;
        created_at: number;
        updated_at: number;
        subject: string | null;
        from_email: string | null;
        from_name: string | null;
        snippet: string | null;
      }>(
        `SELECT ec.id, ec.email_id, ec.account_id, ec.thread_id, ec.title, ec.event_type, ec.start_at,
                ec.end_at, ec.is_all_day, ec.location, ec.source_quote, ec.confidence, ec.status,
                ec.google_event_id, ec.google_event_link, ec.created_at, ec.updated_at,
                e.subject, e.from_email, e.from_name, e.snippet
         FROM email_event_candidates ec
         JOIN emails e ON e.id = ec.email_id
         WHERE ec.account_id = ? AND ec.status != 'dismissed'
         ORDER BY start_at ASC
         LIMIT 30`,
        [accountId],
      ),
      accountEmail
        ? queryAll<{
            id: string;
            thread_id: string;
            subject: string | null;
            from_email: string | null;
            from_name: string | null;
            date: number;
            snippet: string | null;
            inbound_count: number;
          }>(
            `SELECT DISTINCT ON (e.thread_id, LOWER(COALESCE(e.from_email, '')))
                e.id, e.thread_id, e.subject, e.from_email, e.from_name, e.date, e.snippet,
                COUNT(*) OVER (PARTITION BY e.thread_id, LOWER(COALESCE(e.from_email, ''))) AS inbound_count
             FROM emails e
             WHERE e.account_id = ?
               AND e.thread_id IS NOT NULL
               AND e.date >= ?
               AND e.from_email IS NOT NULL
               AND e.from_email != ?
               AND NOT EXISTS (
                 SELECT 1
                 FROM emails s
                 WHERE s.account_id = e.account_id
                   AND s.thread_id = e.thread_id
                   AND s.from_email = ?
                   AND s.date > e.date
               )
             ORDER BY e.thread_id, LOWER(COALESCE(e.from_email, '')), e.date DESC`,
            [accountId, thirtyDaysAgo, accountEmail, accountEmail],
          )
        : Promise.resolve([]),
      getGoogleCalendarBlocks(accountId),
    ]);

  const actionCenterItems = actionItems.map<ActionCenterItem>((item) => ({
    id: item.id,
    kind: 'action_item',
    sourceType: 'action_items',
    title: item.text,
    summary: item.subject,
    quote: sanitizeQuote(item.source_quote || item.snippet),
    priority: normalizePriority(item.priority || (item.due_date && item.due_date <= tomorrowStart.getTime() ? 'high' : 'medium')),
    dueAt: item.due_date,
    createdAt: item.created_at,
    updatedAt: item.updated_at ?? item.created_at,
    status: item.is_done ? 'done' : 'open',
    confidence: item.confidence ?? null,
    suggestedAction: item.suggested_action || 'Nyisd meg az emailt és intézd a kért teendőt.',
    emailId: item.email_id,
    emailIds: [item.email_id],
    accountId: item.account_id,
    threadId: item.thread_id,
    calendarEventId: item.calendar_event_id,
    groupSize: null,
    links: withCalendarLink(buildEmailLinks(item.email_id, item.account_id), item.due_date),
  }));

  const detectedItems = detectedTasks.map<ActionCenterItem>((task) => ({
    id: task.id,
    kind: task.detection_type === 'unanswered' ? 'unanswered_email' : 'unread_email',
    sourceType: 'detected_tasks',
    title: task.subject || '(nincs tárgy)',
    summary: task.from_name || task.from_email || null,
    quote: sanitizeQuote(task.reason),
    priority: normalizePriority(task.priority),
    dueAt: task.email_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    status: task.status,
    confidence: null,
    suggestedAction:
      task.detection_type === 'unanswered'
        ? 'Nyisd meg a levelet és küldj választ vagy dönts a következő lépésről.'
        : 'Olvasd el a levelet, majd döntsd el, kell-e válasz vagy további teendő.',
    emailId: task.email_id,
    emailIds: [task.email_id],
    accountId: task.account_id,
    threadId: task.thread_id,
    calendarEventId: null,
    groupSize: null,
    links: buildEmailLinks(task.email_id, task.account_id),
  }));

  const reminderItems = reminders.map<ActionCenterItem>((reminder) => ({
    id: reminder.id,
    kind: 'reminder',
    sourceType: 'reminders',
    title: reminder.subject || 'Emlékeztető',
    summary: reminder.from_name || reminder.from_email || null,
    quote: sanitizeQuote(reminder.note || reminder.snippet),
    priority: reminder.remind_at <= tomorrowStart.getTime() ? 'high' : 'medium',
    dueAt: reminder.remind_at,
    createdAt: reminder.created_at,
    updatedAt: reminder.created_at,
    status: reminder.is_completed ? 'done' : 'open',
    confidence: 1,
    suggestedAction: 'Nyisd meg az emailt és intézd az emlékeztetett teendőt.',
    emailId: reminder.email_id,
    emailIds: [reminder.email_id],
    accountId: reminder.account_id,
    threadId: reminder.thread_id,
    calendarEventId: null,
    groupSize: null,
    links: withCalendarLink(buildEmailLinks(reminder.email_id, reminder.account_id), reminder.remind_at),
  }));

  const eventItems = suggestedEvents.map<ActionCenterItem>((event) => ({
    id: event.id,
    kind: 'event_candidate',
    sourceType: 'event_candidates',
    title: event.title,
    summary: event.from_name || event.from_email || event.location || `${event.event_type} emailből`,
    quote: sanitizeQuote(event.source_quote || event.snippet || event.subject),
    priority: event.start_at <= tomorrowStart.getTime() ? 'high' : 'medium',
    dueAt: event.start_at,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    status: event.status,
    confidence: event.confidence ?? null,
    suggestedAction: event.google_event_id
      ? 'Nyisd meg a naptárbejegyzést és szükség esetén szerkeszd.'
      : 'Ellenőrizd a felismert eseményt, majd hozd létre vagy frissítsd a naptárban.',
    emailId: event.email_id,
    emailIds: [event.email_id],
    accountId: event.account_id,
    threadId: event.thread_id,
    calendarEventId: event.google_event_id,
    groupSize: null,
    links: {
      ...withCalendarLink(
        {
          ...buildEmailLinks(event.email_id, event.account_id),
          app: buildEmailLinks(event.email_id, event.account_id).app,
          calendar: event.google_event_link || null,
        },
        event.start_at,
      ),
    },
  }));

  const repeatedFollowUpItems = repeatedFollowUps
    .filter((item) => Number(item.inbound_count) >= 2)
    .slice(0, 10)
    .map<ActionCenterItem>((item) => ({
      id: `repeat-${item.id}`,
      kind: 'repeated_followup',
      sourceType: 'detected_tasks',
      title: item.subject || '(nincs tárgy)',
      summary: `${item.from_name || item.from_email || 'Ismeretlen'} · ${item.inbound_count} megkeresés`,
      quote: sanitizeQuote(item.snippet) || `${item.inbound_count} külön bejövő levél ugyanabban az ügyben.`,
      priority: Number(item.inbound_count) >= 3 ? 'critical' : 'high',
      dueAt: item.date,
      createdAt: item.date,
      updatedAt: item.date,
      status: 'open',
      confidence: 0.9,
      suggestedAction: 'Ezt az ügyet többször utánkövették. Nyisd meg a threadet és dönts a válaszról.',
      emailId: item.id,
      emailIds: [item.id],
      accountId,
      threadId: item.thread_id,
      calendarEventId: null,
      groupSize: null,
      links: buildEmailLinks(item.id, accountId),
    }));

  const todayFocus = filterAndGroupItems([...actionCenterItems, ...reminderItems, ...googleData.googleTasks]
    .filter((item) => item.dueAt == null || item.dueAt < tomorrowStart.getTime())
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      return (prio[a.priority] - prio[b.priority]) || ((a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER));
    })
    .slice(0, 12));

  const urgentClientMatters = filterAndGroupItems([...detectedItems, ...actionCenterItems]
    .filter((item) =>
      (item.priority === 'critical' || item.priority === 'high')
      && item.kind !== 'unread_email',
    )
    .slice(0, 12));

  const unanswered = filterAndGroupItems(detectedItems
    .filter((item) => item.kind === 'unanswered_email' || item.kind === 'unread_email')
    .slice(0, 12));
  const delegatedWatch = filterAndGroupItems([...reminderItems, ...googleData.googleTasks]
    .filter((item) => item.dueAt != null && item.dueAt > now)
    .sort((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10));

  return {
    generatedAt: now,
    blocks: {
      todayFocus,
      urgentClientMatters,
      unanswered,
      repeatedFollowUps: filterAndGroupItems(repeatedFollowUpItems),
      suggestedEvents: filterAndGroupItems(eventItems.slice(0, 12)),
      todayCalendar: googleData.todayCalendar.slice(0, 12),
      delegatedWatch,
    },
  };
}
