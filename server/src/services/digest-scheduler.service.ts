import { randomUUID } from 'crypto';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';
import { callAI, isAIAvailable } from '../ai/provider.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getGmailClient, sendEmail } from './gmail.service.js';

interface DigestCandidate {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  snippet: string | null;
  body: string | null;
  date: number;
  is_read: number;
  has_attachments: number;
}

interface DigestItem {
  emailId: string;
  priority: 'kritikus' | 'magas' | 'kozepes';
  category: 'teendo' | 'arajanlat' | 'naptar' | 'penzugy' | 'egyeb';
  title: string;
  reason: string;
  from: string;
  appLink: string;
  gmailLink: string;
  date: number;
}

const DIGEST_HOURS = [7, 12, 17] as const;

function toBudapestDateParts(now: Date): { dateKey: string; hour: number; minute: number } {
  const bud = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
  const yyyy = bud.getFullYear();
  const mm = String(bud.getMonth() + 1).padStart(2, '0');
  const dd = String(bud.getDate()).padStart(2, '0');
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    hour: bud.getHours(),
    minute: bud.getMinutes(),
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function heuristicClassify(email: DigestCandidate): Omit<DigestItem, 'appLink' | 'gmailLink'> {
  const subject = email.subject || '(nincs tárgy)';
  const from = email.from_name || email.from_email || 'ismeretlen';
  const text = normalize(`${email.subject || ''} ${email.snippet || ''} ${email.body || ''}`);

  let priority: DigestItem['priority'] = 'kozepes';
  let category: DigestItem['category'] = 'egyeb';
  let reason = 'Fontosnak tűnő levél az elmúlt 7 napból.';

  if (/(hatarido|deadline|surgos|urgent|asap|azonnal|teendo|todo|feladat|fizetesi felszolitas)/.test(text)) {
    priority = 'kritikus';
    category = 'teendo';
    reason = 'Határidős/teendő jellegű tartalom.';
  } else if (/(ajanlat|arajanlat|quote|proposal|offer|rfq)/.test(text)) {
    priority = 'magas';
    category = 'arajanlat';
    reason = 'Árajánlat/proposal tartalom.';
  } else if (/(meeting|talalkozo|naptar|calendar|idopont|egyeztetes|megbeszeles)/.test(text)) {
    priority = 'magas';
    category = 'naptar';
    reason = 'Naptár/egyeztetés tartalom.';
  } else if (/(invoice|szamla|atutalas|payment|fizetes|penzugy|utalas)/.test(text)) {
    priority = 'magas';
    category = 'penzugy';
    reason = 'Pénzügyi/számla tartalom.';
  } else if (email.has_attachments) {
    priority = 'magas';
    category = 'egyeb';
    reason = 'Mellékletes levél, ellenőrzendő.';
  }

  if (!email.is_read && priority !== 'kritikus') {
    priority = 'magas';
  }

  return {
    emailId: email.id,
    priority,
    category,
    title: subject,
    reason,
    from,
    date: email.date,
  };
}

function buildLinks(emailId: string, accountId: string, frontendBase: string): { appLink: string; gmailLink: string } {
  const safeBase = frontendBase.replace(/\/$/, '');
  return {
    appLink: `${safeBase}/?emailId=${encodeURIComponent(emailId)}&accountId=${encodeURIComponent(accountId)}`,
    gmailLink: `https://mail.google.com/mail/#inbox/${encodeURIComponent(emailId)}`,
  };
}

async function aiPrioritize(
  emails: DigestCandidate[],
  accountId: string,
  frontendBase: string,
): Promise<DigestItem[]> {
  const compact = emails.slice(0, 80).map((e) => ({
    id: e.id,
    from: e.from_name || e.from_email || 'ismeretlen',
    subject: e.subject || '(nincs tárgy)',
    snippet: (e.snippet || '').slice(0, 180),
    date: e.date,
    unread: !e.is_read,
    hasAttachments: Boolean(e.has_attachments),
  }));

  if (!isAIAvailable()) {
    return compact.map((e) => {
      const row = heuristicClassify({
        id: e.id,
        subject: e.subject,
        from_email: e.from,
        from_name: e.from,
        snippet: e.snippet,
        body: '',
        date: e.date,
        is_read: e.unread ? 0 : 1,
        has_attachments: e.hasAttachments ? 1 : 0,
      });
      return { ...row, ...buildLinks(e.id, accountId, frontendBase) };
    }).slice(0, 15);
  }

  try {
    const response = await callAI([
      {
        role: 'user',
        content: `Vezetői email triage feladat magyarul. Az elmúlt 7 nap emailjeiből válogasd ki a valóban fontosakat.

Prioritás: kritikus/magas/kozepes
Kategória: teendo/arajanlat/naptar/penzugy/egyeb

Adj vissza MAX 15 elemet, fontosság szerint rendezve.
JSON tömböt adj vissza, mezők:
[{"emailId":"...","priority":"kritikus|magas|kozepes","category":"...","title":"...","reason":"rövid indok"}]

EMAIL ADATOK:
${JSON.stringify(compact)}`,
      },
    ], { maxTokens: 1800 });

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI returned no JSON array');
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      emailId: string;
      priority: 'kritikus' | 'magas' | 'kozepes';
      category: 'teendo' | 'arajanlat' | 'naptar' | 'penzugy' | 'egyeb';
      title: string;
      reason: string;
    }>;

    const byId = new Map(emails.map((e) => [e.id, e]));
    const items: DigestItem[] = [];

    for (const row of parsed) {
      const email = byId.get(row.emailId);
      if (!email) continue;
      const from = email.from_name || email.from_email || 'ismeretlen';
      items.push({
        emailId: email.id,
        priority: row.priority,
        category: row.category,
        title: row.title || email.subject || '(nincs tárgy)',
        reason: row.reason || 'AI kiemelés',
        from,
        ...buildLinks(email.id, accountId, frontendBase),
        date: email.date,
      });
    }

    if (items.length > 0) return items.slice(0, 15);
    throw new Error('AI returned empty list');
  } catch (err) {
    logger.warn('AI digest prioritization failed, using heuristic fallback', err);
    return emails
      .map((e) => {
        const base = heuristicClassify(e);
        return { ...base, ...buildLinks(e.id, accountId, frontendBase) };
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, 15);
  }
}

async function buildDigestEmailBody(accountId: string, accountEmail: string, frontendBase: string): Promise<{ subject: string; html: string; text: string; totalEmails: number; importantCount: number }> {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const emails = await queryAll<DigestCandidate>(
    `SELECT id, subject, from_email, from_name, snippet, body, date, is_read, has_attachments
     FROM emails
     WHERE account_id = ? AND date >= ? AND labels NOT LIKE '%TRASH%'
     ORDER BY date DESC
     LIMIT 200`,
    [accountId, weekAgo],
  );

  const prioritized = await aiPrioritize(emails, accountId, frontendBase);

  const groups: Record<string, DigestItem[]> = {
    kritikus: prioritized.filter((i) => i.priority === 'kritikus'),
    magas: prioritized.filter((i) => i.priority === 'magas'),
    kozepes: prioritized.filter((i) => i.priority === 'kozepes'),
  };

  const section = (title: string, items: DigestItem[]) => {
    if (items.length === 0) return '';
    return `
<h3>${title}</h3>
<ul>
${items.map((i) => `<li><strong>${i.title}</strong> — ${i.from}<br>${i.reason}<br><a href="${i.appLink}">Megnyitás a kliensben</a> · <a href="${i.gmailLink}">Megnyitás Gmailben</a></li>`).join('\n')}
</ul>`;
  };

  const summaryLine = `Elmúlt 7 nap: ${emails.length} email átnézve, ${prioritized.length} fontos elem kiemelve.`;
  const subject = `📬 AI Email összefoglaló (${new Date().toLocaleDateString('hu-HU')})`;

  const html = `
<p>Szia,</p>
<p>${summaryLine}</p>
${section('🔴 Kritikus', groups.kritikus)}
${section('🟠 Magas', groups.magas)}
${section('🟡 Közepes', groups.kozepes)}
<p>Automatikus összefoglaló Junior AI alapján (teendők, árajánlatok, naptár, pénzügy).</p>
`;

  const textItems = prioritized
    .map((i) => `- [${i.priority.toUpperCase()}|${i.category}] ${i.title} (${i.from})\n  ${i.reason}\n  App: ${i.appLink}\n  Gmail: ${i.gmailLink}`)
    .join('\n\n');

  const text = `${summaryLine}\n\n${textItems || 'Nincs kiemelt tétel.'}`;

  return { subject, html, text, totalEmails: emails.length, importantCount: prioritized.length };
}

async function alreadySentForSlot(accountId: string, dateKey: string, hour: number): Promise<boolean> {
  const key = `ai_digest_sent_${dateKey}_${hour}`;
  const row = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE account_id = ? AND key = ?', [accountId, key]);
  return Boolean(row);
}

async function markSentForSlot(accountId: string, dateKey: string, hour: number, payload: Record<string, unknown>): Promise<void> {
  const key = `ai_digest_sent_${dateKey}_${hour}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, key, JSON.stringify(payload), Date.now()],
  );
}

export async function runAiDigestScheduler(accounts: Array<{ id: string; email: string }>, frontendUrl?: string): Promise<void> {
  const now = new Date();
  const { dateKey, hour, minute } = toBudapestDateParts(now);

  if (!DIGEST_HOURS.includes(hour as 7 | 12 | 17)) return;
  if (minute > 10) return;

  const frontendBase = (frontendUrl || process.env.FRONTEND_URL || 'https://mindenes.org').replace(/\/$/, '');

  for (const account of accounts) {
    try {
      if (await alreadySentForSlot(account.id, dateKey, hour)) continue;

      const digest = await buildDigestEmailBody(account.id, account.email, frontendBase);
      const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
      const gmail = getGmailClient(oauth2Client);

      await sendEmail(gmail, {
        to: account.email,
        subject: digest.subject,
        body: `${digest.text}\n\n<!-- HTML version below -->\n${digest.html}`,
      });

      await markSentForSlot(account.id, dateKey, hour, {
        sentAt: Date.now(),
        totalEmails: digest.totalEmails,
        importantCount: digest.importantCount,
      });

      logger.info(`AI digest email sent for ${account.email} at slot ${hour}:00`);
    } catch (err) {
      logger.error(`AI digest scheduler failed for ${account.email}`, err);
    }
  }
}
