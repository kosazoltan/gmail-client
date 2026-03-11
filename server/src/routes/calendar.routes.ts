import { Router } from 'express';
import { google } from 'googleapis';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import {
  CalendarWritePermissionError,
  extractAndStoreEventCandidatesForEmail,
  getEventCandidatesForAccount,
  syncEventCandidateToCalendar,
} from '../services/calendar-automation.service.js';
import { queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

function isWriteScopeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
  return candidate.code === 403
    || candidate.message?.toLowerCase().includes('insufficient')
    || candidate.errors?.some((item) => item.reason === 'insufficientPermissions') === true;
}

router.get('/suggestions', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const events = await getEventCandidatesForAccount(accountId);
    return res.json({ events });
  } catch (error) {
    logger.error('Calendar suggestions error:', error);
    return res.status(500).json({ error: 'Naptárjavaslatok lekérése sikertelen' });
  }
});

router.post('/suggestions/from-email/:emailId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { emailId } = req.params;
    const owned = await queryOne<{ account_id: string }>('SELECT account_id FROM emails WHERE id = ?', [emailId]);
    if (!owned || owned.account_id !== accountId) {
      return res.status(404).json({ error: 'Email nem található' });
    }

    const events = await extractAndStoreEventCandidatesForEmail(emailId);
    return res.json({ events });
  } catch (error) {
    logger.error('Calendar suggestions from email error:', error);
    return res.status(500).json({ error: 'Emailből történő naptárfelismerés sikertelen' });
  }
});

router.post('/suggestions/:id/sync', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const owned = await queryOne<{ account_id: string }>(
      'SELECT account_id FROM email_event_candidates WHERE id = ?',
      [req.params.id],
    );
    if (!owned || owned.account_id !== accountId) {
      return res.status(404).json({ error: 'Naptárjavaslat nem található' });
    }

    const event = await syncEventCandidateToCalendar(req.params.id, accountId);
    return res.json({ event });
  } catch (error) {
    logger.error('Calendar suggestion sync error:', error);
    if (error instanceof CalendarWritePermissionError || isWriteScopeError(error)) {
      return res.status(403).json({ error: 'Google Calendar írási jogosultság hiányzik. Jelentkezz be újra a naptár szinkronhoz.' });
    }
    return res.status(500).json({ error: 'Naptárjavaslat szinkron sikertelen' });
  }
});

// Mai nap eseményei
router.get('/today', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = (response.data.items || []).map(formatEvent);
    return res.json({ events });
  } catch (error) {
    logger.error('Calendar today error:', error);
    return res.status(500).json({ error: 'Naptár események lekérése sikertelen' });
  }
});

// Aktuális hét eseményei
router.get('/week', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const dayOfWeek = now.getDay();
    // Hétfőtől induljon (magyar konvenció)
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: monday.toISOString(),
      timeMax: sunday.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = (response.data.items || []).map(formatEvent);
    return res.json({ events, weekStart: monday.toISOString(), weekEnd: sunday.toISOString() });
  } catch (error) {
    logger.error('Calendar week error:', error);
    return res.status(500).json({ error: 'Heti események lekérése sikertelen' });
  }
});

// Események lekérése (szabadon konfigurálható időtartam)
router.get('/events', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const timeMin = (req.query.timeMin as string) || now.toISOString();

    const defaultMax = new Date(now);
    defaultMax.setDate(defaultMax.getDate() + 30);
    const timeMax = (req.query.timeMax as string) || defaultMax.toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = (response.data.items || []).map(formatEvent);
    return res.json({ events });
  } catch (error) {
    logger.error('Calendar events error:', error);
    return res.status(500).json({ error: 'Naptár események lekérése sikertelen' });
  }
});

// Segédfüggvény: Google Calendar event → frontend-barát formátum
function formatEvent(event: {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  htmlLink?: string | null;
  colorId?: string | null;
  status?: string | null;
  hangoutLink?: string | null;
}) {
  const isAllDay = !event.start?.dateTime;
  const startTime = event.start?.dateTime || event.start?.date || '';
  let endTime = event.end?.dateTime || event.end?.date || '';

  if (isAllDay && event.end?.date) {
    const inclusiveEnd = new Date(`${event.end.date}T00:00:00`);
    if (!Number.isNaN(inclusiveEnd.getTime())) {
      inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
      endTime = inclusiveEnd.toISOString().slice(0, 10);
    }
  }

  return {
    id: event.id || '',
    summary: event.summary || '(Nincs cím)',
    description: event.description || null,
    location: event.location || null,
    start: startTime,
    end: endTime,
    isAllDay,
    htmlLink: event.htmlLink || null,
    colorId: event.colorId || null,
    status: event.status || null,
    hangoutLink: event.hangoutLink || null,
  };
}

// Segédfüggvény: eventBody összeállítás POST/PUT-hoz
function buildEventBody(body: {
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  isAllDay?: boolean;
}) {
  const { summary, description, location, start, end, isAllDay } = body;

  const eventBody: Record<string, unknown> = {
    summary: summary?.trim(),
    description: description || undefined,
    location: location || undefined,
  };

  if (isAllDay) {
    const exclusiveEnd = end
      ? new Date(`${end}T00:00:00`)
      : start
        ? new Date(`${start}T00:00:00`)
        : null;
    if (exclusiveEnd) {
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    }
    eventBody.start = { date: start };
    eventBody.end = { date: exclusiveEnd ? exclusiveEnd.toISOString().slice(0, 10) : start };
  } else {
    eventBody.start = { dateTime: start, timeZone: 'Europe/Budapest' };
    eventBody.end = {
      dateTime: end || new Date(new Date(start!).getTime() + 3600000).toISOString(),
      timeZone: 'Europe/Budapest',
    };
  }

  return eventBody;
}

// POST / — Esemény létrehozás
router.post('/', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { summary, start } = req.body;
    if (!summary?.trim()) {
      return res.status(400).json({ error: 'A cím kötelező' });
    }
    if (!start) {
      return res.status(400).json({ error: 'A kezdés időpont kötelező' });
    }

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const eventBody = buildEventBody(req.body);

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });

    return res.json({ event: formatEvent(response.data) });
  } catch (error) {
    logger.error('Calendar create error:', error);
    if (isWriteScopeError(error)) {
      return res.status(403).json({ error: 'Google Calendar írási jogosultság hiányzik. Jelentkezz be újra a naptár szinkronhoz.' });
    }
    return res.status(500).json({ error: 'Esemény létrehozása sikertelen' });
  }
});

// PUT /:id — Esemény szerkesztés
router.put('/:id', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { id } = req.params;
    const { summary } = req.body;
    if (!summary?.trim()) {
      return res.status(400).json({ error: 'A cím kötelező' });
    }

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: id,
    });
    const existingIsAllDay = !existingEvent.data.start?.dateTime;
    if (req.body.isAllDay === false && existingIsAllDay && !req.body.start) {
      return res.status(400).json({ error: 'Egész napos esemény időpontosra váltásához új kezdési idő szükséges.' });
    }
    const mergedBody = {
      ...req.body,
      isAllDay: req.body.isAllDay ?? existingIsAllDay,
      start: req.body.start || existingEvent.data.start?.dateTime || existingEvent.data.start?.date,
      end: req.body.end || existingEvent.data.end?.dateTime || existingEvent.data.end?.date,
    };

    const eventBody = buildEventBody(mergedBody);

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: id,
      requestBody: eventBody,
    });

    return res.json({ event: formatEvent(response.data) });
  } catch (error) {
    logger.error('Calendar update error:', error);
    if (isWriteScopeError(error)) {
      return res.status(403).json({ error: 'Google Calendar írási jogosultság hiányzik. Jelentkezz be újra a naptár szinkronhoz.' });
    }
    return res.status(500).json({ error: 'Esemény szerkesztése sikertelen' });
  }
});

// DELETE /:id — Esemény törlés
router.delete('/:id', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { id } = req.params;

    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: id,
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Calendar delete error:', error);
    if (isWriteScopeError(error)) {
      return res.status(403).json({ error: 'Google Calendar írási jogosultság hiányzik. Jelentkezz be újra a naptár szinkronhoz.' });
    }
    return res.status(500).json({ error: 'Esemény törlése sikertelen' });
  }
});

export default router;
