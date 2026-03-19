import { createHash, randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { isIP } from 'net';
import { lookup } from 'dns/promises';
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

type CompanyInvoiceMap = Map<string, StoredInvoice[]>;

function monthKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMissingRecipientEnvVars(): string[] {
  const required = new Set<string>();
  for (const cfg of Object.values(COMPANY_TARGETS)) {
    for (const k of cfg.envRecipients) required.add(k);
  }
  return Array.from(required).filter((k) => !(process.env[k] || '').trim());
}

function getJuniorAlertEmail(): string {
  return (process.env.JUNIOR_ALERT_EMAIL || process.env.AUTOMATION_ALERT_EMAIL || '').trim();
}

function tryAutoReloadAccountingEnv(): void {
  const candidates = [process.env.OPENCLAW_ENV_PATH, '.env.local', '.env']
    .filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const content = readFileSync(p, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [rawKey, ...rest] = trimmed.split('=');
        const key = rawKey.trim();
        if (!key.startsWith('ACCOUNTING_') && key !== 'JUNIOR_ALERT_EMAIL' && key !== 'AUTOMATION_ALERT_EMAIL') continue;
        const value = rest.join('=').trim().replace(/^"|"$/g, '');
        if (!process.env[key] && value) process.env[key] = value;
      }
    } catch {
      // no-op
    }
  }
}

export function validateInvoiceAutomationConfig(): { ok: boolean; missing: string[] } {
  const missing = getMissingRecipientEnvVars();
  if (missing.length > 0) {
    logger.error(`🔴 INVOICE_AUTOMATION_ALERT: Missing env vars: ${missing.join(', ')}`);
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
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

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;

  const ipVer = isIP(h);
  if (!ipVer) return false;

  if (ipVer === 4) {
    if (h.startsWith('10.')) return true;
    if (h.startsWith('127.')) return true;
    if (h.startsWith('192.168.')) return true;
    const second = Number(h.split('.')[1] || '0');
    if (h.startsWith('172.') && second >= 16 && second <= 31) return true;
  }

  if (ipVer === 6) {
    if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  }

  return false;
}

function normalizeInvoiceUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const removable = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    for (const key of removable) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

async function isSafePublicHttpsUrl(rawUrl: string): Promise<boolean> {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    if (isPrivateOrLocalHost(u.hostname)) return false;

    const resolved = await lookup(u.hostname, { all: true, verbatim: true });
    if (!resolved || resolved.length === 0) return false;

    for (const r of resolved) {
      if (isPrivateOrLocalHost(r.address)) return false;
    }

    return true;
  } catch {
    return false;
  }
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

async function getRecipientEmails(_accountId: string, company: string): Promise<string[]> {
  const cfg = COMPANY_TARGETS[company];
  if (!cfg) return [];

  const fromEnv = cfg.envRecipients
    .map((k) => (process.env[k] || '').trim())
    .filter(Boolean);

  // Recipient safety: only explicit env allowlist is allowed for monthly accounting distribution.
  return Array.from(new Set(fromEnv));
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
  const normalized = normalizeInvoiceUrl(link);
  const key = `invoice_link_${emailId}_${sha(normalized).slice(0, 20)}`;
  const row = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE account_id = ? AND key = ?', [accountId, key]);
  return Boolean(row);
}

async function markHandledLink(accountId: string, emailId: string, link: string, payload: object): Promise<void> {
  const normalized = normalizeInvoiceUrl(link);
  const key = `invoice_link_${emailId}_${sha(normalized).slice(0, 20)}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, key, JSON.stringify(payload), Date.now()],
  );
}

async function downloadInvoiceFromLink(url: string): Promise<{ buffer: Buffer; fileName: string; contentType: string | null } | null> {
  try {
    let currentUrl = normalizeInvoiceUrl(url);
    if (!(await isSafePublicHttpsUrl(currentUrl))) return null;

    const timeoutMs = 15000;
    const maxBytes = 15 * 1024 * 1024;

    let resp: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(t);

      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get('location');
        if (!location) return null;
        const next = new URL(location, currentUrl).toString();
        if (!(await isSafePublicHttpsUrl(next))) return null;
        currentUrl = normalizeInvoiceUrl(next);
        continue;
      }

      resp = r;
      break;
    }

    if (!resp || !resp.ok) return null;

    const contentType = resp.headers.get('content-type');
    const disp = resp.headers.get('content-disposition') || '';
    const contentLength = Number(resp.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;

    if (!likelyInvoiceContentType(contentType) && !/invoice|szamla|pdf/i.test(currentUrl) && !/invoice|szamla|pdf/i.test(disp)) {
      return null;
    }

    const reader = resp.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) return null;
      chunks.push(value);
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    if (buf.length === 0) return null;

    const byDisp = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disp);
    const fileNameRaw = decodeURIComponent(byDisp?.[1] || byDisp?.[2] || '').trim();
    const fromUrl = new URL(currentUrl).pathname.split('/').pop() || '';
    const fileName = (fileNameRaw || fromUrl || `invoice-${Date.now()}.pdf`).replace(/[^\w.\-() ]/g, '_');

    return { buffer: buf, fileName, contentType };
  } catch {
    return null;
  }
}

async function runDailyInvoiceCollectorForAccount(account: { id: string; email: string }): Promise<void> {
  const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    await drive.about.get({ fields: 'user(emailAddress)' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/insufficient|permission|scope|forbidden/i.test(msg)) {
      throw new Error('Drive scope hiányzik. Kérlek jelentkezz be újra Google OAuth consent-tel (drive.file scope).');
    }
    throw err;
  }

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const rows = await queryAll<InvoiceEmailRow>(
    `SELECT id, subject, from_email, to_email, snippet, body, body_html, date
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND labels NOT LIKE '%TRASH%'
       AND (
         LOWER(subject) LIKE '%számla%' OR LOWER(subject) LIKE '%invoice%' OR LOWER(subject) LIKE '%e-számla%'
         OR LOWER(snippet) LIKE '%számla%' OR LOWER(snippet) LIKE '%invoice%' OR LOWER(snippet) LIKE '%díjbekérő%'
         OR LOWER(body) LIKE '%számla%' OR LOWER(body) LIKE '%invoice%' OR LOWER(body) LIKE '%fizetés%' OR LOWER(body) LIKE '%payment%' OR LOWER(body) LIKE '%receipt%' OR LOWER(body) LIKE '%díjbekérő%'
         OR LOWER(body_html) LIKE '%számla%' OR LOWER(body_html) LIKE '%invoice%' OR LOWER(body_html) LIKE '%fizetés%' OR LOWER(body_html) LIKE '%payment%' OR LOWER(body_html) LIKE '%receipt%' OR LOWER(body_html) LIKE '%díjbekérő%'
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

async function getMonthlyInvoicesByCompany(accountId: string, monthKey: string): Promise<CompanyInvoiceMap> {
  const records = await queryAll<{ key: string; value: string }>(
    `SELECT key, value FROM user_settings WHERE account_id = ? AND key LIKE 'invoice_auto_%'`,
    [accountId],
  );

  const parsed = records
    .map((r) => {
      try { return JSON.parse(r.value) as StoredInvoice; } catch { return null; }
    })
    .filter((x): x is StoredInvoice => x !== null && x.monthKey === monthKey);

  const byCompany: CompanyInvoiceMap = new Map<string, StoredInvoice[]>();
  for (const row of parsed) {
    if (!byCompany.has(row.company)) byCompany.set(row.company, []);
    byCompany.get(row.company)!.push(row);
  }

  return byCompany;
}

async function isMonthlyApproved(accountId: string, monthKey: string): Promise<boolean> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, `invoice_monthly_approved_${monthKey}`],
  );
  return Boolean(row);
}

async function hasMonthlyPreviewSent(accountId: string, monthKey: string): Promise<boolean> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, `invoice_monthly_preview_sent_${monthKey}`],
  );
  return Boolean(row);
}

async function markMonthlyPreviewSent(accountId: string, monthKey: string, payload: object): Promise<void> {
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, `invoice_monthly_preview_sent_${monthKey}`, JSON.stringify(payload), Date.now()],
  );
}

export async function approveMonthlyInvoiceDistribution(accountId: string, monthKey: string): Promise<void> {
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, `invoice_monthly_approved_${monthKey}`, JSON.stringify({ approvedAt: Date.now() }), Date.now()],
  );
}

async function sendMonthlyPreviewForApproval(
  account: { id: string; email: string },
  monthKey: string,
  byCompany: CompanyInvoiceMap,
): Promise<void> {
  const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
  const gmail = getGmailClient(oauth2Client);

  const blocks: string[] = [];
  for (const [company, items] of byCompany.entries()) {
    const recipients = await getRecipientEmails(account.id, company);
    const lines = items.slice(0, 50).map((it) => `- ${it.fileName}: ${it.driveLink}`).join('\n');
    blocks.push(`\n${company} (${items.length} db) -> ${recipients.join(', ')}\n${lines}`);
  }

  const approvalHint = `Jóváhagyáshoz hívd: POST /api/invoice-automation/approve { \"monthKey\": \"${monthKey}\" }`;
  const body = `Előnézeti havi számla-kiküldés (${monthKey}) - JÓVÁHAGYÁS SZÜKSÉGES\n${blocks.join('\n')}\n\n${approvalHint}`;

  await sendEmail(gmail, {
    to: account.email,
    subject: `[APPROVAL REQUIRED] ${monthKey} havi számla-kiküldési előnézet`,
    body,
  });

  await markMonthlyPreviewSent(account.id, monthKey, { sentAt: Date.now(), companies: Array.from(byCompany.keys()) });
}

async function runMonthlyDistributionForAccount(account: { id: string; email: string }, monthKey: string): Promise<void> {
  const byCompany = await getMonthlyInvoicesByCompany(account.id, monthKey);
  if (byCompany.size === 0) return;

  const approved = await isMonthlyApproved(account.id, monthKey);
  if (!approved) {
    const previewSent = await hasMonthlyPreviewSent(account.id, monthKey);
    if (!previewSent) {
      await sendMonthlyPreviewForApproval(account, monthKey, byCompany);
      logger.warn(`Monthly invoice distribution waiting approval for ${account.email} (${monthKey})`);
    }
    return;
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

    for (const recipient of recipients) {
      await sendEmail(gmail, {
        to: recipient,
        subject: `[Junior] ${monthKey} havi számlagyűjtés - ${company}`,
        body,
      });
    }

    await execute(
      `INSERT INTO user_settings (id, account_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [randomUUID(), account.id, markerKey, JSON.stringify({ sentAt: Date.now(), count: items.length, recipients }), Date.now()],
    );
  }
}

function budapestNow(now = new Date()): { hour: number; minute: number; day: number; monthKeyPrev: string; dateKey: string } {
  const b = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
  const prevMonth = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1));
  const monthKeyPrev = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  const dateKey = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`;
  return { hour: b.getHours(), minute: b.getMinutes(), day: b.getDate(), monthKeyPrev, dateKey };
}

async function claimDailyCollectionSlot(accountId: string, dateKey: string): Promise<boolean> {
  const key = `invoice_daily_collected_${dateKey}`;
  const row = await queryOne<{ key: string }>(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO NOTHING
     RETURNING key`,
    [randomUUID(), accountId, key, JSON.stringify({ status: 'started', at: Date.now() }), Date.now()],
  );
  return Boolean(row?.key);
}

async function markDailyCollected(accountId: string, dateKey: string): Promise<void> {
  await execute('UPDATE user_settings SET value = ?, updated_at = ? WHERE account_id = ? AND key = ?', [
    JSON.stringify({ status: 'done', at: Date.now() }),
    Date.now(),
    accountId,
    `invoice_daily_collected_${dateKey}`,
  ]);
}

async function notifyConfigIssue(account: { id: string; email: string }, missing: string[]): Promise<void> {
  const markerKey = `invoice_config_alert_${new Date().toISOString().slice(0, 10)}`;
  const already = await queryOne<{ value: string }>('SELECT value FROM user_settings WHERE account_id = ? AND key = ?', [account.id, markerKey]);
  if (already) return;

  const juniorAlertEmail = getJuniorAlertEmail();

  try {
    if (juniorAlertEmail) {
      const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
      const gmail = getGmailClient(oauth2Client);
      await sendEmail(gmail, {
        to: juniorAlertEmail,
        subject: '🔴 Junior riasztás: invoice automation env hiány',
        body: `Hiányzó recipient env változók: ${missing.join(', ')}\nJunior automatikus önjavítás + újraellenőrzés indítva. Érintett fiók: ${account.email}`,
      });
    } else {
      logger.error('JUNIOR_ALERT_EMAIL/AUTOMATION_ALERT_EMAIL nincs beállítva; email riasztás kihagyva.');
    }
  } catch (err) {
    logger.error(`Invoice config alert email failed for Junior recipient`, err);
  }

  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), account.id, markerKey, JSON.stringify({ missing, at: Date.now() }), Date.now()],
  );
}

export async function runInvoiceAutomation(accounts: Array<{ id: string; email: string }>): Promise<void> {
  let config = validateInvoiceAutomationConfig();
  if (!config.ok) {
    // Junior self-heal attempt: reload ACCOUNTING_* env values from env files and re-check immediately
    tryAutoReloadAccountingEnv();
    config = validateInvoiceAutomationConfig();
  }

  if (!config.ok) {
    for (const account of accounts) {
      await notifyConfigIssue(account, config.missing).catch(() => {});
    }
    return;
  }

  const { hour, day, monthKeyPrev, dateKey } = budapestNow();
  const dueDaily = hour >= 7;
  const dueMonthly = day === 1 && hour >= 7;

  for (const account of accounts) {
    try {
      if (dueDaily) {
        const claimed = await claimDailyCollectionSlot(account.id, dateKey);
        if (claimed) {
          await runDailyInvoiceCollectorForAccount(account);
          await markDailyCollected(account.id, dateKey);
        }
      }

      if (dueMonthly) {
        await runMonthlyDistributionForAccount(account, monthKeyPrev);
      }
    } catch (err) {
      logger.error(`Invoice automation failed for ${account.email}`, err);
    }
  }
}
