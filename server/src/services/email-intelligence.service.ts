import Anthropic from '@anthropic-ai/sdk';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// --- Types ---

export interface ActionItem {
  id: string;
  emailId: string;
  accountId: string;
  text: string;
  dueDate: number | null;
  isDone: boolean;
  createdAt: number;
}

export interface SentimentResult {
  sentiment: 'urgent' | 'positive' | 'negative' | 'neutral';
  confidence: number;
  reason: string;
}

export interface ReplySuggestion {
  tone: 'short' | 'medium' | 'detailed';
  subject: string;
  body: string;
}

export interface RelatedEmail {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  date: number;
  relevance: 'topic' | 'sender' | 'thread';
}

export interface WeeklyReportData {
  period: { from: number; to: number };
  totalEmails: number;
  unreadCount: number;
  topSenders: Array<{ email: string; name: string; count: number }>;
  topTopics: Array<{ subject: string; count: number }>;
  unansweredCount: number;
  sentimentBreakdown: { urgent: number; positive: number; negative: number; neutral: number };
  actionItemsPending: number;
  summary: string;
}

// --- Anthropic client ---

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// --- Helper: get email by id ---

interface EmailRow {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  snippet: string | null;
  body: string | null;
  date: number;
  is_read: number;
  labels: string | null;
}

function getEmailById(emailId: string): EmailRow | undefined {
  return queryOne<EmailRow>(
    'SELECT id, account_id, thread_id, subject, from_email, from_name, to_email, snippet, body, date, is_read, labels FROM emails WHERE id = ?',
    [emailId],
  );
}

function truncateBody(body: string | null, maxLength = 3000): string {
  if (!body) return '';
  // Strip HTML tags for AI processing
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// --- 1. Extract Action Items ---

export async function extractActionItems(emailId: string): Promise<ActionItem[]> {
  const email = getEmailById(emailId);
  if (!email) throw new Error('Email nem található');

  // Check if action items already exist for this email
  const existing = queryAll<{ id: string; emailId: string; accountId: string; text: string; dueDate: number | null; isDone: number; createdAt: number }>(
    'SELECT id, email_id as emailId, account_id as accountId, text, due_date as dueDate, is_done as isDone, created_at as createdAt FROM action_items WHERE email_id = ?',
    [emailId],
  );
  if (existing.length > 0) return existing.map(item => ({ ...item, isDone: item.isDone === 1 }));

  const anthropic = getClient();
  if (!anthropic) {
    // Fallback: simple keyword-based extraction
    return extractActionItemsFallback(email);
  }

  const bodyText = truncateBody(email.body);
  const prompt = `Analyze this email and extract ALL action items (tasks, requests, deadlines).

Subject: ${email.subject || '(no subject)'}
From: ${email.from_name || email.from_email || 'unknown'}
Date: ${new Date(email.date).toISOString()}

Body:
${bodyText}

Return ONLY a JSON array. Each item:
{"text": "action item description in Hungarian", "due_date": "YYYY-MM-DD or null"}

If no action items, return [].`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251015', // Haiku: egyszer� JSON kinyer�s
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    const items: Array<{ text: string; due_date: string | null }> = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const now = Date.now();
    const result: ActionItem[] = [];

    for (const item of items) {
      const id = crypto.randomUUID();
      const dueDate = item.due_date ? new Date(item.due_date).getTime() : null;
      execute(
        'INSERT INTO action_items (id, email_id, account_id, text, due_date, is_done, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [id, emailId, email.account_id, item.text, dueDate, now],
      );
      result.push({
        id,
        emailId,
        accountId: email.account_id,
        text: item.text,
        dueDate,
        isDone: false,
        createdAt: now,
      });
    }

    return result;
  } catch (err) {
    logger.error('AI action items extraction failed:', err);
    return extractActionItemsFallback(email);
  }
}

function extractActionItemsFallback(email: EmailRow): ActionItem[] {
  const bodyText = truncateBody(email.body);
  const keywords = ['kérem', 'kérlek', 'határidő', 'deadline', 'válaszolj', 'küldj', 'please', 'szükséges', 'ASAP', 'sürgős', 'urgent'];
  const sentences = bodyText.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
  const items: ActionItem[] = [];
  const now = Date.now();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      const id = crypto.randomUUID();
      const text = sentence.trim();
      execute(
        'INSERT INTO action_items (id, email_id, account_id, text, due_date, is_done, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [id, email.id, email.account_id, text, null, now],
      );
      items.push({ id, emailId: email.id, accountId: email.account_id, text, dueDate: null, isDone: false, createdAt: now });
    }
  }

  return items;
}

// --- 2. Detect Sentiment ---

export async function detectSentiment(emailId: string): Promise<SentimentResult> {
  const email = getEmailById(emailId);
  if (!email) throw new Error('Email nem található');

  const anthropic = getClient();
  if (!anthropic) {
    return detectSentimentFallback(email);
  }

  const bodyText = truncateBody(email.body, 2000);
  const prompt = `Analyze the sentiment of this email. Classify as: urgent, positive, negative, or neutral.

Subject: ${email.subject || '(no subject)'}
From: ${email.from_name || email.from_email || 'unknown'}
Body: ${bodyText}

Return ONLY JSON: {"sentiment": "urgent|positive|negative|neutral", "confidence": 0.0-1.0, "reason": "brief explanation in Hungarian"}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251015', // Haiku: egyszer� klasszifik�ci�
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as SentimentResult;
      result.confidence = Math.max(0, Math.min(1, result.confidence));
      return result;
    }
    return { sentiment: 'neutral', confidence: 0.5, reason: 'Nem sikerült elemezni' };
  } catch (err) {
    logger.error('AI sentiment detection failed:', err);
    return detectSentimentFallback(email);
  }
}

function detectSentimentFallback(email: EmailRow): SentimentResult {
  const text = `${email.subject || ''} ${truncateBody(email.body, 1000)}`.toLowerCase();
  const urgentWords = ['sürgős', 'urgent', 'asap', 'azonnal', 'haladéktalanul', 'fontos', 'kritikus'];
  const positiveWords = ['köszön', 'gratulál', 'thank', 'great', 'excellent', 'örül', 'siker'];
  const negativeWords = ['probléma', 'hiba', 'panasz', 'reklamáció', 'elégedetlen', 'complaint', 'issue', 'error'];

  const urgentScore = urgentWords.filter(w => text.includes(w)).length;
  const positiveScore = positiveWords.filter(w => text.includes(w)).length;
  const negativeScore = negativeWords.filter(w => text.includes(w)).length;

  if (urgentScore >= 2) return { sentiment: 'urgent', confidence: 0.7, reason: 'Sürgős kulcsszavak találhatók' };
  if (negativeScore > positiveScore) return { sentiment: 'negative', confidence: 0.6, reason: 'Negatív hangvételű kulcsszavak' };
  if (positiveScore > negativeScore) return { sentiment: 'positive', confidence: 0.6, reason: 'Pozitív hangvételű kulcsszavak' };
  return { sentiment: 'neutral', confidence: 0.5, reason: 'Semleges hangvétel' };
}

// --- 3. Suggest Reply ---

export async function suggestReply(emailId: string): Promise<ReplySuggestion[]> {
  const email = getEmailById(emailId);
  if (!email) throw new Error('Email nem található');

  const anthropic = getClient();
  if (!anthropic) {
    return suggestReplyFallback(email);
  }

  const bodyText = truncateBody(email.body, 2000);
  const prompt = `You are helping a Hungarian business executive (CEO of ~90 currency exchange offices) reply to an email.

Subject: ${email.subject || '(no subject)'}
From: ${email.from_name || email.from_email || 'unknown'}
Body: ${bodyText}

Generate 3 reply suggestions in Hungarian:
1. Short (1-2 sentences, quick acknowledgment)
2. Medium (3-5 sentences, informative)
3. Detailed (full response with context)

Return ONLY JSON array:
[
  {"tone": "short", "subject": "Re: ...", "body": "..."},
  {"tone": "medium", "subject": "Re: ...", "body": "..."},
  {"tone": "detailed", "subject": "Re: ...", "body": "..."}
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20260217',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ReplySuggestion[];
    }
    return suggestReplyFallback(email);
  } catch (err) {
    logger.error('AI reply suggestion failed:', err);
    return suggestReplyFallback(email);
  }
}

function suggestReplyFallback(email: EmailRow): ReplySuggestion[] {
  const subject = `Re: ${email.subject || ''}`;
  const name = email.from_name || email.from_email || 'Tisztelt Partnerünk';
  return [
    {
      tone: 'short',
      subject,
      body: `Kedves ${name},\n\nKöszönöm a levelet, hamarosan visszajelzek.\n\nÜdvözlettel`,
    },
    {
      tone: 'medium',
      subject,
      body: `Kedves ${name},\n\nKöszönöm a levelet. Megkaptam és átnézem a tartalmát. A következő munkanapon visszajelzek a részletekkel kapcsolatban.\n\nHa sürgős, kérem jelezze.\n\nÜdvözlettel`,
    },
    {
      tone: 'detailed',
      subject,
      body: `Kedves ${name},\n\nKöszönöm a megkeresést. Levelét megkaptam és részletesen áttanulmányozom.\n\nA felvetett kérdésekre a lehető leghamarabb, de legkésőbb a következő munkanapon válaszolok. Amennyiben időközben további információra lenne szükségem, jelezni fogom.\n\nHa a téma sürgős, kérem hívjon a szokásos elérhetőségemen.\n\nÜdvözlettel`,
    },
  ];
}

// --- 4. Find Related Emails ---

export function findRelatedEmails(emailId: string): RelatedEmail[] {
  const email = getEmailById(emailId);
  if (!email) throw new Error('Email nem található');

  const results: RelatedEmail[] = [];
  const addedIds = new Set<string>();
  addedIds.add(emailId);

  // 1. Same thread
  if (email.thread_id) {
    const threadEmails = queryAll<EmailRow>(
      'SELECT id, subject, from_email, from_name, date FROM emails WHERE thread_id = ? AND id != ? ORDER BY date DESC LIMIT 5',
      [email.thread_id, emailId],
    );
    for (const e of threadEmails) {
      if (!addedIds.has(e.id)) {
        addedIds.add(e.id);
        results.push({
          id: e.id,
          subject: e.subject || '',
          fromEmail: e.from_email || '',
          fromName: e.from_name || '',
          date: e.date,
          relevance: 'thread',
        });
      }
    }
  }

  // 2. Same sender
  if (email.from_email) {
    const senderEmails = queryAll<EmailRow>(
      'SELECT id, subject, from_email, from_name, date FROM emails WHERE from_email = ? AND id != ? AND account_id = ? ORDER BY date DESC LIMIT 5',
      [email.from_email, emailId, email.account_id],
    );
    for (const e of senderEmails) {
      if (!addedIds.has(e.id)) {
        addedIds.add(e.id);
        results.push({
          id: e.id,
          subject: e.subject || '',
          fromEmail: e.from_email || '',
          fromName: e.from_name || '',
          date: e.date,
          relevance: 'sender',
        });
      }
    }
  }

  // 3. Similar subject (keyword matching)
  if (email.subject) {
    const words = email.subject
      .replace(/^(Re:|Fwd:|Fw:)\s*/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 3);

    if (words.length > 0) {
      const conditions = words.map(() => 'subject LIKE ? COLLATE NOCASE').join(' OR ');
      const params = words.map(w => `%${w}%`);
      const topicEmails = queryAll<EmailRow>(
        `SELECT id, subject, from_email, from_name, date FROM emails WHERE (${conditions}) AND id != ? AND account_id = ? ORDER BY date DESC LIMIT 5`,
        [...params, emailId, email.account_id],
      );
      for (const e of topicEmails) {
        if (!addedIds.has(e.id)) {
          addedIds.add(e.id);
          results.push({
            id: e.id,
            subject: e.subject || '',
            fromEmail: e.from_email || '',
            fromName: e.from_name || '',
            date: e.date,
            relevance: 'topic',
          });
        }
      }
    }
  }

  return results.slice(0, 15);
}

// --- Sentiment Heuristic ---

function estimateSentimentBreakdown(
  accountId: string,
  since: number,
  totalEmails: number,
): { urgent: number; positive: number; negative: number; neutral: number } {
  const urgentKeywords = ['sürgős', 'urgent', 'asap', 'azonnal', 'kritikus', 'fontos', 'deadline', 'határidő'];
  const positiveKeywords = ['köszön', 'gratulál', 'thank', 'great', 'excellent', 'siker', 'örül'];
  const negativeKeywords = ['probléma', 'hiba', 'panasz', 'reklamáció', 'complaint', 'issue', 'error', 'fail'];

  const emails = queryAll<{ subject: string | null; snippet: string | null }>(
    'SELECT subject, snippet FROM emails WHERE account_id = ? AND date >= ? LIMIT 500',
    [accountId, since],
  );

  let urgent = 0;
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const e of emails) {
    const text = `${e.subject ?? ''} ${e.snippet ?? ''}`.toLowerCase();
    const uScore = urgentKeywords.filter(kw => text.includes(kw)).length;
    const pScore = positiveKeywords.filter(kw => text.includes(kw)).length;
    const nScore = negativeKeywords.filter(kw => text.includes(kw)).length;

    if (uScore >= 2) urgent++;
    else if (nScore > pScore) negative++;
    else if (pScore > nScore) positive++;
    else neutral++;
  }

  // Scale to totalEmails if we sampled fewer
  if (emails.length < totalEmails && emails.length > 0) {
    const scale = totalEmails / emails.length;
    return {
      urgent: Math.round(urgent * scale),
      positive: Math.round(positive * scale),
      negative: Math.round(negative * scale),
      neutral: Math.max(0, totalEmails - Math.round(urgent * scale) - Math.round(positive * scale) - Math.round(negative * scale)),
    };
  }

  return { urgent, positive, negative, neutral };
}

// --- 5. Weekly Report ---

export async function generateWeeklyReport(accountId: string): Promise<WeeklyReportData> {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Total emails this week
  const totalResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM emails WHERE account_id = ? AND date >= ?',
    [accountId, weekAgo],
  );
  const totalEmails = totalResult?.total || 0;

  // Unread count
  const unreadResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM emails WHERE account_id = ? AND date >= ? AND is_read = 0',
    [accountId, weekAgo],
  );
  const unreadCount = unreadResult?.total || 0;

  // Top senders
  const topSenders = queryAll<{ from_email: string; from_name: string; cnt: number }>(
    `SELECT from_email, from_name, COUNT(*) as cnt FROM emails
     WHERE account_id = ? AND date >= ? AND from_email IS NOT NULL
     GROUP BY from_email ORDER BY cnt DESC LIMIT 10`,
    [accountId, weekAgo],
  );

  // Top topics (normalized subjects)
  const topTopics = queryAll<{ subject: string; cnt: number }>(
    `SELECT REPLACE(REPLACE(REPLACE(subject, 'Re: ', ''), 'Fwd: ', ''), 'Fw: ', '') as subject, COUNT(*) as cnt
     FROM emails WHERE account_id = ? AND date >= ? AND subject IS NOT NULL
     GROUP BY 1 ORDER BY cnt DESC LIMIT 10`,
    [accountId, weekAgo],
  );

  // Unanswered: received but not replied (simplified: unread older than 24h)
  const unansweredResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM emails WHERE account_id = ? AND date >= ? AND date < ? AND is_read = 0',
    [accountId, weekAgo, now - 24 * 60 * 60 * 1000],
  );
  const unansweredCount = unansweredResult?.total || 0;

  // Pending action items
  const pendingResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM action_items WHERE account_id = ? AND is_done = 0',
    [accountId],
  );
  const actionItemsPending = pendingResult?.total || 0;

  // Generate AI summary if available
  let summary = `Heti összesítő: ${totalEmails} email érkezett, ebből ${unreadCount} olvasatlan. ${unansweredCount} levél vár válaszra. ${actionItemsPending} nyitott teendő.`;

  const anthropic = getClient();
  if (anthropic && totalEmails > 0) {
    const topSendersText = topSenders
      .slice(0, 5)
      .map(s => `${s.from_name || s.from_email} (${s.cnt} levél)`)
      .join(', ');
    const topTopicsText = topTopics
      .slice(0, 5)
      .map(t => `"${t.subject}" (${t.cnt}x)`)
      .join(', ');

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6-20260217',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Készíts rövid heti email összefoglalót magyarul egy cégvezető számára (90 valutaváltó iroda igazgatója).

Adatok:
- Összes email: ${totalEmails}
- Olvasatlan: ${unreadCount}
- Válaszra vár: ${unansweredCount}
- Nyitott teendők: ${actionItemsPending}
- Top küldők: ${topSendersText}
- Top témák: ${topTopicsText}

Írj 3-4 mondatos, lényegre törő összefoglalót. Emeld ki ami fontos/sürgős.`,
        }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      if (text.length > 20) summary = text;
    } catch (err) {
      logger.warn('AI weekly summary failed, using fallback:', err);
    }
  }

  return {
    period: { from: weekAgo, to: now },
    totalEmails,
    unreadCount,
    topSenders: topSenders.map(s => ({ email: s.from_email, name: s.from_name || s.from_email, count: s.cnt })),
    topTopics: topTopics.map(t => ({ subject: t.subject, count: t.cnt })),
    unansweredCount,
    sentimentBreakdown: estimateSentimentBreakdown(accountId, weekAgo, totalEmails),
    actionItemsPending,
    summary,
  };
}

// --- Action item toggle ---

export function toggleActionItem(actionItemId: string, isDone: boolean): void {
  execute('UPDATE action_items SET is_done = ? WHERE id = ?', [isDone ? 1 : 0, actionItemId]);
}

export function getActionItemsByEmail(emailId: string): ActionItem[] {
  return queryAll<{ id: string; email_id: string; account_id: string; text: string; due_date: number | null; is_done: number; created_at: number }>(
    'SELECT id, email_id, account_id, text, due_date, is_done, created_at FROM action_items WHERE email_id = ?',
    [emailId],
  ).map(row => ({
    id: row.id,
    emailId: row.email_id,
    accountId: row.account_id,
    text: row.text,
    dueDate: row.due_date,
    isDone: row.is_done === 1,
    createdAt: row.created_at,
  }));
}
