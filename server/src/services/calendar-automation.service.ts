import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { queryAll, queryOne, execute } from '../db/index.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { extractEventsFromEmails } from './smart-features.service.js';
import logger from '../utils/logger.js';

export interface EventCandidate {
  id: string;
  emailId: string;
  accountId: string;
  threadId: string | null;
  title: string;
  eventType: 'meeting' | 'deadline' | 'reminder';
  startAt: number;
  endAt: number | null;
  isAllDay: boolean;
  timezone: string;
  location: string | null;
  participants: string[];
  sourceQuote: string | null;
  confidence: number;
  status: string;
  googleEventId: string | null;
  googleEventLink: string | null;
  createdAt: number;
  updatedAt: number;
}

export class CalendarWritePermissionError extends Error {
  constructor(message = 'Google Calendar írási jogosultság hiányzik vagy újrabejelentkezés szükséges.') {
    super(message);
    this.name = 'CalendarWritePermissionError';
  }
}

interface EmailRow {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string | null;
  body: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  date: number;
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function stripHtml(text: string | null | undefined): string {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toIsoDateOnly(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function sanitizeQuote(text: string | null | undefined, maxLength = 260): string | null {
  const normalized = stripHtml(text);
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function getDefaultEnd(startAt: number, isAllDay: boolean): number {
  return isAllDay ? startAt + 24 * 60 * 60 * 1000 : startAt + 60 * 60 * 1000;
}

function isWriteScopeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
  return candidate.code === 403
    || candidate.message?.toLowerCase().includes('insufficient')
    || candidate.errors?.some((item) => item.reason === 'insufficientPermissions') === true;
}

async function getEmailById(emailId: string): Promise<EmailRow | undefined> {
  return queryOne<EmailRow>(
    `SELECT id, account_id, thread_id, subject, body, snippet, from_email, from_name, date
     FROM emails
     WHERE id = ?`,
    [emailId],
  );
}

function extractParticipants(email: EmailRow): string[] {
  const source = `${email.body || ''}\n${email.snippet || ''}`;
  const matches = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((item) => item.toLowerCase()))].slice(0, 10);
}

async function extractEventsWithAI(email: EmailRow): Promise<Array<Omit<EventCandidate, 'id' | 'accountId' | 'emailId' | 'threadId' | 'status' | 'googleEventId' | 'googleEventLink' | 'createdAt' | 'updatedAt'>>> {
  const anthropic = getClient();
  if (!anthropic) return [];

  const body = stripHtml(email.body).slice(0, 6000);
  const prompt = `Elemezd az alábbi emailt és nyerd ki belőle az összes konkrét találkozót, határidőt vagy emlékeztető-jellegű eseményt.

Válasz kizárólag JSON tömbként:
[
  {
    "title": "rövid magyar cím",
    "eventType": "meeting|deadline|reminder",
    "startAt": "ISO datetime vagy YYYY-MM-DD",
    "endAt": "ISO datetime vagy null",
    "isAllDay": true,
    "timezone": "Europe/Budapest",
    "location": "helyszín vagy null",
    "participants": ["email@example.com"],
    "sourceQuote": "rövid releváns idézet",
    "confidence": 0.0
  }
]

Ha nincs ilyen esemény, adj vissza [].

Subject: ${email.subject || '(nincs tárgy)'}
From: ${email.from_name || email.from_email || 'ismeretlen'}
Date: ${new Date(email.date).toISOString()}
Snippet: ${stripHtml(email.snippet)}
Body:
${body}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251015',
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as Array<{
      title?: string;
      eventType?: 'meeting' | 'deadline' | 'reminder';
      startAt?: string;
      endAt?: string | null;
      isAllDay?: boolean;
      timezone?: string;
      location?: string | null;
      participants?: string[];
      sourceQuote?: string | null;
      confidence?: number;
    }> : [];

    return parsed
      .filter((item) => item.title && item.startAt && item.eventType)
      .map((item) => {
        const startAt = new Date(item.startAt!).getTime();
        const isAllDay = item.isAllDay ?? !item.startAt?.includes('T');
        return {
          title: item.title!.trim(),
          eventType: item.eventType!,
          startAt,
          endAt: item.endAt ? new Date(item.endAt).getTime() : getDefaultEnd(startAt, isAllDay),
          isAllDay,
          timezone: item.timezone || 'Europe/Budapest',
          location: item.location || null,
          participants: (item.participants || []).slice(0, 10),
          sourceQuote: sanitizeQuote(item.sourceQuote) || sanitizeQuote(email.snippet),
          confidence: Math.max(0, Math.min(1, item.confidence ?? 0.75)),
        };
      })
      .filter((item) => Number.isFinite(item.startAt));
  } catch (error) {
    logger.error('AI event extraction failed:', error);
    return [];
  }
}

async function extractEventsFallback(email: EmailRow): Promise<Array<Omit<EventCandidate, 'id' | 'accountId' | 'emailId' | 'threadId' | 'status' | 'googleEventId' | 'googleEventLink' | 'createdAt' | 'updatedAt'>>> {
  const fallback = await extractEventsFromEmails(email.account_id, [email.id]);
  const matches = fallback[0]?.events || [];
  return matches.map((item) => {
    const startAt = new Date(item.date).getTime();
    const isAllDay = true;
    return {
      title: item.title,
      eventType: item.type,
      startAt,
      endAt: getDefaultEnd(startAt, isAllDay),
      isAllDay,
      timezone: 'Europe/Budapest',
      location: null,
      participants: extractParticipants(email),
      sourceQuote: sanitizeQuote(email.snippet || email.body),
      confidence: 0.45,
    };
  });
}

async function upsertEventCandidate(
  email: EmailRow,
  candidate: Array<Omit<EventCandidate, 'id' | 'accountId' | 'emailId' | 'threadId' | 'status' | 'googleEventId' | 'googleEventLink' | 'createdAt' | 'updatedAt'>>,
): Promise<EventCandidate[]> {
  const now = Date.now();
  const stored: EventCandidate[] = [];

  for (const item of candidate) {
    const existing = await queryOne<{
      id: string;
      google_event_id: string | null;
      google_event_link: string | null;
      status: string | null;
      created_at: number;
    }>(
      'SELECT id, google_event_id, google_event_link, status, created_at FROM email_event_candidates WHERE email_id = ? AND title = ? AND start_at = ?',
      [email.id, item.title, item.startAt],
    );

    const participantsJson = JSON.stringify(item.participants);
    const id = existing?.id || crypto.randomUUID();
    if (existing) {
      await execute(
        `UPDATE email_event_candidates
         SET end_at = ?, is_all_day = ?, timezone = ?, location = ?, participants_json = ?,
             source_quote = ?, confidence = ?, updated_at = ?
         WHERE id = ?`,
        [
          item.endAt,
          item.isAllDay ? 1 : 0,
          item.timezone,
          item.location,
          participantsJson,
          item.sourceQuote,
          item.confidence,
          now,
          existing.id,
        ],
      );
    } else {
      await execute(
        `INSERT INTO email_event_candidates (
          id, email_id, account_id, thread_id, title, event_type, start_at, end_at, is_all_day,
          timezone, location, participants_json, source_quote, confidence, status, google_event_id, google_event_link, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', NULL, NULL, ?, ?)`,
        [
          id,
          email.id,
          email.account_id,
          email.thread_id,
          item.title,
          item.eventType,
          item.startAt,
          item.endAt,
          item.isAllDay ? 1 : 0,
          item.timezone,
          item.location,
          participantsJson,
          item.sourceQuote,
          item.confidence,
          now,
          now,
        ],
      );
    }

    stored.push({
      id,
      emailId: email.id,
      accountId: email.account_id,
      threadId: email.thread_id,
      title: item.title,
      eventType: item.eventType,
      startAt: item.startAt,
      endAt: item.endAt,
      isAllDay: item.isAllDay,
      timezone: item.timezone,
      location: item.location,
      participants: item.participants,
      sourceQuote: item.sourceQuote,
      confidence: item.confidence,
      status: existing?.status || 'suggested',
      googleEventId: existing?.google_event_id || null,
      googleEventLink: existing?.google_event_link || null,
      createdAt: existing?.created_at || now,
      updatedAt: now,
    });
  }

  return stored;
}

function buildCalendarRequest(candidate: EventCandidate, email: EmailRow): Record<string, unknown> {
  const descriptionLines = [
    `AI által felismert ${candidate.eventType === 'meeting' ? 'találkozó' : candidate.eventType === 'deadline' ? 'határidő' : 'emlékeztető'}.`,
    email.subject ? `Forrás email: ${email.subject}` : null,
    candidate.sourceQuote ? `Idézet: ${candidate.sourceQuote}` : null,
    email.from_email ? `Feladó: ${email.from_name || email.from_email} <${email.from_email}>` : null,
  ].filter(Boolean);

  return {
    summary: candidate.title,
    description: descriptionLines.join('\n'),
    location: candidate.location || undefined,
    attendees: candidate.participants.map((emailAddress) => ({ email: emailAddress })),
    start: candidate.isAllDay
      ? { date: toIsoDateOnly(candidate.startAt) }
      : { dateTime: new Date(candidate.startAt).toISOString(), timeZone: candidate.timezone || 'Europe/Budapest' },
    end: candidate.isAllDay
      ? { date: toIsoDateOnly(candidate.endAt || getDefaultEnd(candidate.startAt, true)) }
      : { dateTime: new Date(candidate.endAt || getDefaultEnd(candidate.startAt, false)).toISOString(), timeZone: candidate.timezone || 'Europe/Budapest' },
  };
}

export async function extractAndStoreEventCandidatesForEmail(emailId: string): Promise<EventCandidate[]> {
  const email = await getEmailById(emailId);
  if (!email) {
    throw new Error('Email nem található az eseményfelismeréshez.');
  }

  const aiCandidates = await extractEventsWithAI(email);
  const candidates = aiCandidates.length > 0 ? aiCandidates : await extractEventsFallback(email);
  if (candidates.length === 0) {
    return [];
  }

  return upsertEventCandidate(email, candidates);
}

export async function getEventCandidatesForAccount(accountId: string): Promise<EventCandidate[]> {
  const rows = await queryAll<{
    id: string;
    email_id: string;
    account_id: string;
    thread_id: string | null;
    title: string;
    event_type: 'meeting' | 'deadline' | 'reminder';
    start_at: number;
    end_at: number | null;
    is_all_day: number;
    timezone: string | null;
    location: string | null;
    participants_json: string | null;
    source_quote: string | null;
    confidence: number | null;
    status: string;
    google_event_id: string | null;
    google_event_link: string | null;
    created_at: number;
    updated_at: number;
  }>(
    `SELECT id, email_id, account_id, thread_id, title, event_type, start_at, end_at, is_all_day,
            timezone, location, participants_json, source_quote, confidence, status, google_event_id, google_event_link,
            created_at, updated_at
     FROM email_event_candidates
     WHERE account_id = ?
     ORDER BY start_at ASC`,
    [accountId],
  );

  return rows.map((row) => ({
    id: row.id,
    emailId: row.email_id,
    accountId: row.account_id,
    threadId: row.thread_id,
    title: row.title,
    eventType: row.event_type,
    startAt: row.start_at,
    endAt: row.end_at,
    isAllDay: row.is_all_day === 1,
    timezone: row.timezone || 'Europe/Budapest',
    location: row.location,
    participants: row.participants_json ? JSON.parse(row.participants_json) : [],
    sourceQuote: row.source_quote,
    confidence: row.confidence ?? 0.5,
    status: row.status,
    googleEventId: row.google_event_id,
    googleEventLink: row.google_event_link,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function syncEventCandidateToCalendar(
  candidateId: string,
  expectedAccountId?: string,
): Promise<EventCandidate | null> {
  const candidate = await queryOne<{
    id: string;
    email_id: string;
    account_id: string;
    thread_id: string | null;
    title: string;
    event_type: 'meeting' | 'deadline' | 'reminder';
    start_at: number;
    end_at: number | null;
    is_all_day: number;
    timezone: string | null;
    location: string | null;
    participants_json: string | null;
    source_quote: string | null;
    confidence: number | null;
    status: string;
    google_event_id: string | null;
    google_event_link: string | null;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM email_event_candidates WHERE id = ?', [candidateId]);

  if (!candidate) return null;
  if (expectedAccountId && candidate.account_id !== expectedAccountId) {
    return null;
  }
  const email = await getEmailById(candidate.email_id);
  if (!email) return null;

  const eventCandidate: EventCandidate = {
    id: candidate.id,
    emailId: candidate.email_id,
    accountId: candidate.account_id,
    threadId: candidate.thread_id,
    title: candidate.title,
    eventType: candidate.event_type,
    startAt: candidate.start_at,
    endAt: candidate.end_at,
    isAllDay: candidate.is_all_day === 1,
    timezone: candidate.timezone || 'Europe/Budapest',
    location: candidate.location,
    participants: candidate.participants_json ? JSON.parse(candidate.participants_json) : [],
    sourceQuote: candidate.source_quote,
    confidence: candidate.confidence ?? 0.5,
    status: candidate.status,
    googleEventId: candidate.google_event_id,
    googleEventLink: candidate.google_event_link,
    createdAt: candidate.created_at,
    updatedAt: candidate.updated_at,
  };

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(candidate.account_id);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const requestBody = buildCalendarRequest(eventCandidate, email);

    let googleEventId = eventCandidate.googleEventId;
    let googleEventLink = eventCandidate.googleEventLink;
    if (googleEventId) {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody,
      });
      googleEventLink = response.data.htmlLink || googleEventLink;
    } else {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
      });
      googleEventId = response.data.id || null;
      googleEventLink = response.data.htmlLink || null;
    }

    await execute(
      `UPDATE email_event_candidates
       SET google_event_id = ?, google_event_link = ?, status = 'synced', updated_at = ?
       WHERE id = ?`,
      [googleEventId, googleEventLink, Date.now(), candidate.id],
    );

    const updated = await getEventCandidatesForAccount(candidate.account_id);
    return updated.find((item) => item.id === candidate.id) || null;
  } catch (error) {
    if (isWriteScopeError(error)) {
      throw new CalendarWritePermissionError();
    }
    logger.error('Calendar candidate sync failed:', error);
    await execute(
      `UPDATE email_event_candidates
       SET status = 'error', updated_at = ?
       WHERE id = ?`,
      [Date.now(), candidate.id],
    );
    throw error;
  }
}

export async function syncPendingEventCandidates(accountId: string): Promise<EventCandidate[]> {
  const candidates = await getEventCandidatesForAccount(accountId);
  const pending = candidates.filter(
    (item) => (item.status === 'suggested' || item.status === 'error')
      && item.confidence >= 0.55,
  );

  const synced: EventCandidate[] = [];
  for (const candidate of pending) {
    try {
      const result = await syncEventCandidateToCalendar(candidate.id);
      if (result) synced.push(result);
    } catch (error) {
      if (error instanceof CalendarWritePermissionError) {
        logger.warn(`Calendar write scope missing for account ${accountId}; keeping event candidate suggested.`);
        break;
      }
      logger.error(`Failed to sync event candidate ${candidate.id}:`, error);
    }
  }
  return synced;
}
