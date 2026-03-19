import { createHash, randomUUID } from 'crypto';
import { google } from 'googleapis';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';
import { callAI, isAIAvailable } from '../ai/provider.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getGmailClient, sendEmail } from './gmail.service.js';

const INVOICE_KEYWORDS = ['számla', 'invoice', 'e-számla', 'fizetés', 'payment', 'díjbekérő', 'receipt'];

const COMPANY_TARGETS: Record<string, { aliases: string[]; envRecipients: string[]; fallbackNames: string[] }> = {
  'EXCLUSIVE BEST CHANGE ZRT': {
    aliases: ['exclusive best change', 'ebc', 'exclusive best change zrt'],
    envRecipients: ['ACCOUNTING_KARDOS_ILDIKO_EMAIL', 'ACCOUNTING_BRAND_ZSUZSA_EMAIL'],
    fallbackNames: ['Kardos Ildikó', 'Brand Zsuzsa'],
  },
  'EC INGATLAN KFT': {
    aliases: ['ec ingatlan', 'ec ingatlan kft'],
    envRecipients: ['ACCOUNTING_NAGY_MARIAN_EMAIL', 'ACCOUNTING_KARDOS_ILDIKO_EMAIL'],
    fallbackNames: ['Nagy Marian', 'Kardos Ildikó'],
  },
};

interface InvoiceEmailRow {
  id: string;
  subject: string | null;
  from_email: string | null;
  to_email: string | null;
  snippet: string | null;
  body: string | null;
  body_html: string | null;
  date: number;
}

interface StoredInvoice {
  emailId: string;
  accountId: string;
  company: string;
  fileName: string;
  driveFileId: string;
  driveLink: string;
  monthKey: string;
  createdAt: number;
}

function monthKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractHttpLinks(raw: string): string[] {
  const links = new Set<string>();
  const regex = /https?:\/\/[^\s"'<>]+/gi;
  for (const m of raw.matchAll(regex)) {
    if (!m[0]) continue;
    links.add(m[0].replace(/[),.;]+$/, ''));
  }
  return Array.from(links);
}

function likelyInvoiceContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const c = contentType.toLowerCase();
  return c.includes('application/pdf') || c.includes('octet-stream') || c.includes('xml');
}

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function resolveCompany(email: InvoiceEmailRow): Promise<string> {
  const text = normalize(`${email.subject || ''} ${email.snippet || ''} ${email.body || ''}`);

  for (const [company, cfg] of Object.entries(COMPANY_TARGETS)) {
    if (cfg.aliases.some((a) => text.includes(a))) return company;
  }

  if (!isAIAvailable()) return 'EXCLUSIVE BEST CHANGE ZRT';

  try {
    const response = await callAI([
      {
        role: 'user',
        content: `Döntsd el, melyik céghez tartozik a számlaemail. Csak egyet adj vissza pontosan:
- EXCLUSIVE BEST CHANGE ZRT
- EC INGATLAN KFT

Tárgy: ${email.subject || ''}
Snippet: ${(email.snippet || '').slice(0, 200)}
Body: ${(email.body || '').slice(0, 600)}`,
      },
    ], { maxTokens: 30 });

    const out = (response.text || '').toUpperCase();
    if (out.includes('EC INGATLAN')) return 'EC INGATLAN KFT';
    return 'EXCLUSIVE BEST CHANGE ZRT';
  } catch {
    return 'EXCLUSIVE BEST CHANGE ZRT';
  }
}

async function getRecipientEmails(accountId: string, company: string): Promise<string[]> {
  const cfg = COMPANY_TARGETS[company];
  if (!cfg) return [];

  const fromEnv = cfg.envRecipients
    .map((k) => (process.env[k] || '').trim())
    .filter(Boolean);

  const found = await queryAll<{ email: string }>(
    `SELECT DISTINCT email FROM contacts WHERE account_id = ? AND (
      LOWER(name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(name) LIKE ?
    )`,
    [
      accountId,
      `%${normalize(cfg.fallbackNames[0] || '')}%`,
      `%${normalize(cfg.fallbackNames[1] || '')}%`,
      `%kardos%`,
    ],
  ).catch(() => []);

  const merged = [...fromEnv, ...found.map((f) => f.email)].filter(Boolean);
  return Array.from(new Set(merged));
}

async function ensureDriveFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string,
): Promise<string> {
  const qParts = [`name='${name.replace(/'/g, "\\'")}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false'];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const q = qParts.join(' and ');

  const existing = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 1 });
  const id = existing.data.files?.[0]?.id;
  if (id) return id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  if (!created.data.id) throw new Error(`Cannot create drive folder: ${name}`);
  return created.data.id;
}

async function saveInvoiceRecord(record: StoredInvoice): Promise<void> {
  const key = `invoice_auto_${record.accountId}_${record.emailId}_${sha(record.driveFileId).slice(0, 16)}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), record.accountId, key, JSON.stringify(record), Date.now()],
  );
}

async function alreadyHandledLink(accountId: string, emailId: string, link: string): Promise<boolean> {
  const key = `invoice_link_${emailId}_${sha(link).slice(0, 20)}`;
  const row = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE account_id = ? AND key = ?', [accountId, key]);
  return Boolean(row);
}

async function markHandledLink(accountId: string, emailId: string, link: string, payload: object): Promise<void> {
  const key = `invoice_link_${emailId}_${sha(link).slice(0, 20)}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, key, JSON.stringify(payload), Date.now()],
  );
}

async function downloadInvoiceFromLink(url: string): Promise<{ buffer: Buffer; fileName: string; contentType: string | null } | null> {
  try {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) return null;

    const contentType = resp.headers.get('content-type');
    const disp = resp.headers.get('content-disposition') || '';

    if (!likelyInvoiceContentType(contentType) && !/invoice|szamla|pdf/i.test(url) && !/invoice|szamla|pdf/i.test(disp)) {
      return null;
    }

    const ab = await resp.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length === 0) return null;

    const byDisp = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disp);
    const fileNameRaw = decodeURIComponent(byDisp?.[1] || byDisp?.[2] || '').trim();
    const fromUrl = url.split('/').pop() || '';
    const fileName = (fileNameRaw || fromUrl || `invoice-${Date.now()}.pdf`).replace(/[^\w.\-() ]/g, '_');

    return { buffer: buf, fileName, contentType };
  } catch {
    return null;
  }
}

async function runDailyInvoiceCollectorForAccount(account: { id: string; email: string }): Promise<void> {
  const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const rows = await queryAll<InvoiceEmailRow>(
    `SELECT id, subject, from_email, to_email, snippet, body, body_html, date
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND labels NOT LIKE '%TRASH%'
       AND (
         LOWER(subject) LIKE '%számla%' OR LOWER(subject) LIKE '%invoice%' OR LOWER(snippet) LIKE '%számla%' OR LOWER(snippet) LIKE '%invoice%'
       )
     ORDER BY date DESC
     LIMIT 200`,
    [account.id, weekAgo],
  );

  const rootFolder = await ensureDriveFolder(drive, 'Junior-Invoice-Automation');

  for (const email of rows) {
    const ownScoped = normalize(`${email.from_email || ''} ${email.to_email || ''}`).includes(normalize(account.email));
    if (!ownScoped) continue;

    const combined = `${email.body_html || ''} ${email.body || ''} ${email.snippet || ''}`;
    if (!INVOICE_KEYWORDS.some((k) => normalize(combined).includes(normalize(k)))) continue;

    const links = extractHttpLinks(combined);
    if (links.length === 0) continue;

    const company = await resolveCompany(email);
    const monthKey = monthKeyFromTs(email.date || now);

    const monthFolder = await ensureDriveFolder(drive, monthKey, rootFolder);
    const companyFolder = await ensureDriveFolder(drive, company, monthFolder);

    for (const link of links) {
      if (await alreadyHandledLink(account.id, email.id, link)) continue;

      const downloaded = await downloadInvoiceFromLink(link);
      if (!downloaded) continue;

      const uploaded = await drive.files.create({
        requestBody: {
          name: downloaded.fileName,
          parents: [companyFolder],
        },
        media: {
          mimeType: downloaded.contentType || 'application/pdf',
          body: Buffer.from(downloaded.buffer),
        },
        fields: 'id,webViewLink,name',
      });

      const fileId = uploaded.data.id;
      if (!fileId) continue;

      await saveInvoiceRecord({
        emailId: email.id,
        accountId: account.id,
        company,
        fileName: uploaded.data.name || downloaded.fileName,
        driveFileId: fileId,
        driveLink: uploaded.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        monthKey,
        createdAt: Date.now(),
      });

      await markHandledLink(account.id, email.id, link, {
        status: 'uploaded',
        fileId,
        monthKey,
        company,
      });
    }
  }
}

async function runMonthlyDistributionForAccount(account: { id: string; email: string }, monthKey: string): Promise<void> {
  const records = await queryAll<{ key: string; value: string }>(
    `SELECT key, value FROM user_settings WHERE account_id = ? AND key LIKE 'invoice_auto_%'`,
    [account.id],
  );

  const parsed = records
    .map((r) => {
      try { return JSON.parse(r.value) as StoredInvoice; } catch { return null; }
    })
    .filter((x): x is StoredInvoice => x !== null && x.monthKey === monthKey);

  if (parsed.length === 0) return;

  const byCompany = new Map<string, StoredInvoice[]>();
  for (const row of parsed) {
    if (!byCompany.has(row.company)) byCompany.set(row.company, []);
    byCompany.get(row.company)!.push(row);
  }

  const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
  const gmail = getGmailClient(oauth2Client);

  for (const [company, items] of byCompany.entries()) {
    const recipients = await getRecipientEmails(account.id, company);
    if (recipients.length === 0) {
      logger.warn(`Invoice monthly distribution skipped: no recipients for ${company}`);
      continue;
    }

    const markerKey = `invoice_monthly_sent_${monthKey}_${sha(company).slice(0, 8)}`;
    const already = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE account_id = ? AND key = ?', [account.id, markerKey]);
    if (already) continue;

    const lines = items
      .map((it) => `- ${it.fileName}: ${it.driveLink}`)
      .join('\n');

    const body = `Sziasztok,\n\n${monthKey} havi ${company} számlagyűjtés:\n\n${lines}\n\nAutomatikus küldés: Junior Invoice Automation.`;

    await sendEmail(gmail, {
      to: recipients.join(','),
      subject: `[Junior] ${monthKey} havi számlagyűjtés - ${company}`,
      body,
    });

    await execute(
      `INSERT INTO user_settings (id, account_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [randomUUID(), account.id, markerKey, JSON.stringify({ sentAt: Date.now(), count: items.length, recipients }), Date.now()],
    );
  }
}

function budapestNow(now = new Date()): { hour: number; minute: number; day: number; monthKeyPrev: string } {
  const b = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
  const prevMonth = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1));
  const monthKeyPrev = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  return { hour: b.getHours(), minute: b.getMinutes(), day: b.getDate(), monthKeyPrev };
}

export async function runInvoiceAutomation(accounts: Array<{ id: string; email: string }>): Promise<void> {
  const { hour, day, monthKeyPrev } = budapestNow();
  const dueDaily = hour >= 7;
  const dueMonthly = day === 1 && hour >= 7;

  for (const account of accounts) {
    try {
      if (dueDaily) {
        await runDailyInvoiceCollectorForAccount(account);
      }

      if (dueMonthly) {
        await runMonthlyDistributionForAccount(account, monthKeyPrev);
      }
    } catch (err) {
      logger.error(`Invoice automation failed for ${account.email}`, err);
    }
  }
}
