import { Router } from 'express';
import { google } from 'googleapis';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import logger from '../utils/logger.js';

const router = Router();

// Mai nap eseményei
router.get('/today', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
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
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
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
    const { oauth2Client } = getOAuth2ClientForAccount(accountId);
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
  const endTime = event.end?.dateTime || event.end?.date || '';

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

export default router;
