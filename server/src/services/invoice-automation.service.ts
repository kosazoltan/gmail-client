import { createHash, randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { google } from 'googleapis';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';
import { callAI, getAIProviderStatus, isAIAvailable } from '../ai/provider.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getAttachment, getGmailClient, sendEmail } from './gmail.service.js';
import { parseDocument, isAnalyzable } from './document-parser.service.js';
import {
  COMPANY_TARGETS,
  EBC_COMPANY,
  UNKNOWN_COMPANY,
  type InvoiceCompany,
  classifyCompanyFromText,
  hasInvoiceIntent,
  reviewInvoiceEvidence,
  shouldSkipInvoiceAttachment,
} from './invoice-rules.service.js';
import {
  downloadInvoiceFromLink as downloadInvoiceFromPublicLink,
  extractInvoiceLinkCandidates,
  normalizeInvoiceUrl,
} from './invoice-link.service.js';

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
  sourceKind?: 'attachment' | 'link';
  sha256?: string;
  textSha256?: string;
  reviewStatus?: string;
  sourceUrl?: string;
}

interface AttachmentRow {
  id: string;
  email_id: string;
  filename: string;
  mime_type: string;
  size: number;
  gmail_attachment_id: string;
}

interface PreparedInvoiceDocument {
  sourceKind: 'attachment' | 'link';
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  text: string;
  sha256: string;
  textSha256: string;
  sourceUrl?: string;
  reviewStatus: string;
  company: InvoiceCompany;
}

type CompanyInvoiceMap = Map<string, StoredInvoice[]>;

interface InvoiceCollectionOptions {
  fromMs?: number;
  toMs?: number;
  limit?: number;
  runKind?: 'daily' | 'monthly' | 'manual';
}

export type InvoiceManualRunMode = 'daily' | 'previous_month' | 'month';

function monthKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRangeFromKey(monthKey: string): { fromMs: number; toMs: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error('Érvénytelen monthKey (YYYY-MM)');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    fromMs: Date.UTC(year, monthIndex, 1, 0, 0, 0, 0),
    toMs: Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0),
  };
}

function previousMonthKey(now = new Date()): string {
  const budapest = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Budapest' }));
  const prevMonth = new Date(Date.UTC(budapest.getFullYear(), budapest.getMonth() - 1, 1));
  return `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMissingRecipientEnvVars(): string[] {
  const missing: string[] = [];
  for (const cfg of Object.values(COMPANY_TARGETS)) {
    const hasConfiguredRecipient = [...cfg.envRecipients, ...cfg.defaultRecipients].some(
      (keyOrEmail) => {
        if (keyOrEmail.includes('@')) return Boolean(keyOrEmail.trim());
        return Boolean((process.env[keyOrEmail] || '').trim());
      },
    );
    if (!hasConfiguredRecipient) missing.push(...cfg.envRecipients);
  }
  return Array.from(new Set(missing));
}

function tryAutoReloadAccountingEnv(): void {
  const candidates = [process.env.OPENCLAW_ENV_PATH, '.env.local', '.env'].filter(
    (p): p is string => Boolean(p),
  );

  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const content = readFileSync(p, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [rawKey, ...rest] = trimmed.split('=');
        const key = rawKey.trim();
        if (
          !key.startsWith('ACCOUNTING_') &&
          key !== 'JUNIOR_ALERT_EMAIL' &&
          key !== 'AUTOMATION_ALERT_EMAIL'
        )
          continue;
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
    // Opcionális funkció: nincs startup ERROR/WARN — csak akkor naplózunk, ha ténylegesen futtatjuk (notifyConfigIssue).
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
}

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function resolveCompany(email: InvoiceEmailRow): Promise<string> {
  const text = `${email.subject || ''} ${email.snippet || ''} ${email.body || ''}`;
  const ruleCompany = classifyCompanyFromText(text);
  if (ruleCompany !== UNKNOWN_COMPANY) return ruleCompany;

  if (!isAIAvailable()) return UNKNOWN_COMPANY;

  try {
    const response = await callAI(
      [
        {
          role: 'user',
          content: `Döntsd el, melyik céghez tartozik a számlaemail. Csak egyet adj vissza pontosan:
- EXCLUSIVE BEST CHANGE ZRT
- EC INGATLAN KFT

Tárgy: ${email.subject || ''}
Snippet: ${(email.snippet || '').slice(0, 200)}
Body: ${(email.body || '').slice(0, 600)}`,
        },
      ],
      { maxTokens: 30 },
    );

    const out = (response.text || '').toUpperCase();
    if (out.includes('EC INGATLAN')) return 'EC INGATLAN KFT';
    if (out.includes('EXCLUSIVE BEST CHANGE')) return EBC_COMPANY;
    return UNKNOWN_COMPANY;
  } catch {
    return UNKNOWN_COMPANY;
  }
}

async function getRecipientEmails(_accountId: string, company: string): Promise<string[]> {
  if (company === UNKNOWN_COMPANY) return [];
  const knownCompany = company as keyof typeof COMPANY_TARGETS;
  if (!(knownCompany in COMPANY_TARGETS)) return [];
  const cfg = COMPANY_TARGETS[knownCompany];

  const fromEnv = cfg.envRecipients
    .map((key: string) => (process.env[key] || '').trim())
    .filter(Boolean);

  return Array.from(new Set([...fromEnv, ...cfg.defaultRecipients]));
}

async function ensureDriveFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string,
): Promise<string> {
  const qParts = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
  ];
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
  const identity = record.sha256 || record.driveFileId;
  const key = `invoice_auto_${record.accountId}_${record.emailId}_${sha(identity).slice(0, 16)}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), record.accountId, key, JSON.stringify(record), Date.now()],
  );
}

function shaBuffer(input: Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function textSha(input: string): string {
  return sha(input.replace(/\s+/g, ' ').trim().toLowerCase());
}

async function alreadyHandledDocumentHash(accountId: string, digest: string): Promise<boolean> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, `invoice_doc_sha_${digest}`],
  );
  return Boolean(row);
}

async function markHandledDocumentHash(
  accountId: string,
  digest: string,
  payload: object,
): Promise<void> {
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, `invoice_doc_sha_${digest}`, JSON.stringify(payload), Date.now()],
  );
}

function emailEvidenceText(email: InvoiceEmailRow): string {
  return `${email.subject || ''}\n${email.snippet || ''}\n${email.body || ''}\n${email.body_html || ''}`;
}

async function prepareInvoiceDocument(input: {
  sourceKind: 'attachment' | 'link';
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  email: InvoiceEmailRow;
  sourceUrl?: string;
}): Promise<PreparedInvoiceDocument | null> {
  let text = '';
  if (isAnalyzable(input.mimeType, input.fileName)) {
    try {
      const parsed = await parseDocument(input.buffer, input.mimeType, input.fileName);
      text = parsed.text;
    } catch (err) {
      logger.warn('Invoice document parse failed', {
        emailId: input.email.id,
        fileName: input.fileName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const digest = shaBuffer(input.buffer);
  const textDigest = text ? textSha(text) : '';
  const review = reviewInvoiceEvidence({
    documentText: text,
    emailText: emailEvidenceText(input.email),
    emailDate: input.email.date,
    alreadySent: false,
  });

  if (!review.isInvoiceCandidate && !hasInvoiceIntent(emailEvidenceText(input.email))) return null;
  if (review.company === UNKNOWN_COMPANY) {
    logger.warn('Invoice candidate requires manual company review before dispatch', {
      emailId: input.email.id,
      fileName: input.fileName,
      reason: review.humanReviewReason,
    });
    return null;
  }
  if (review.routeStatus !== 'ready') {
    logger.warn('Invoice candidate blocked by review gate', {
      emailId: input.email.id,
      fileName: input.fileName,
      status: review.routeStatus,
      reason: review.humanReviewReason,
    });
    return null;
  }

  return {
    sourceKind: input.sourceKind,
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
    text,
    sha256: digest,
    textSha256: textDigest,
    sourceUrl: input.sourceUrl,
    reviewStatus: review.routeStatus,
    company: review.company,
  };
}

async function alreadyHandledLink(
  accountId: string,
  emailId: string,
  link: string,
): Promise<boolean> {
  const normalized = normalizeInvoiceUrl(link);
  const key = `invoice_link_${emailId}_${sha(normalized).slice(0, 20)}`;
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [accountId, key],
  );
  return Boolean(row);
}

async function markHandledLink(
  accountId: string,
  emailId: string,
  link: string,
  payload: object,
): Promise<void> {
  const normalized = normalizeInvoiceUrl(link);
  const key = `invoice_link_${emailId}_${sha(normalized).slice(0, 20)}`;
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), accountId, key, JSON.stringify(payload), Date.now()],
  );
}

async function runDailyInvoiceCollectorForAccount(
  account: {
    id: string;
    email: string;
  },
  options: InvoiceCollectionOptions = {},
): Promise<void> {
  const { oauth2Client } = await getOAuth2ClientForAccount(account.id);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const gmail = getGmailClient(oauth2Client);

  try {
    await drive.about.get({ fields: 'user(emailAddress)' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/insufficient|permission|scope|forbidden/i.test(msg)) {
      throw new Error(
        'Drive scope hiányzik. Kérlek jelentkezz be újra Google OAuth consent-tel (drive.file scope).',
      );
    }
    throw err;
  }

  const now = Date.now();
  const fromMs = options.fromMs ?? now - 7 * 24 * 60 * 60 * 1000;
  const toMs = options.toMs ?? now + 1;
  const limit = options.limit ?? 500;

  const rows = await queryAll<InvoiceEmailRow>(
    `SELECT id, subject, from_email, to_email, snippet, body, body_html, date
     FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND date < ?
       AND labels NOT LIKE '%TRASH%'
       AND (
         LOWER(subject) LIKE '%számla%' OR LOWER(subject) LIKE '%invoice%' OR LOWER(subject) LIKE '%e-számla%'
         OR LOWER(snippet) LIKE '%számla%' OR LOWER(snippet) LIKE '%invoice%' OR LOWER(snippet) LIKE '%díjbekérő%'
         OR LOWER(body) LIKE '%számla%' OR LOWER(body) LIKE '%invoice%' OR LOWER(body) LIKE '%fizetés%' OR LOWER(body) LIKE '%payment%' OR LOWER(body) LIKE '%receipt%' OR LOWER(body) LIKE '%díjbekérő%'
         OR LOWER(body_html) LIKE '%számla%' OR LOWER(body_html) LIKE '%invoice%' OR LOWER(body_html) LIKE '%fizetés%' OR LOWER(body_html) LIKE '%payment%' OR LOWER(body_html) LIKE '%receipt%' OR LOWER(body_html) LIKE '%díjbekérő%'
       )
     ORDER BY date DESC
     LIMIT ?`,
    [account.id, fromMs, toMs, limit],
  );

  logger.info('Invoice collector run started', {
    account: account.email,
    runKind: options.runKind || 'daily',
    fromMs,
    toMs,
    candidateEmails: rows.length,
  });

  const rootFolder = await ensureDriveFolder(drive, 'Junior-Invoice-Automation');

  async function uploadPrepared(email: InvoiceEmailRow, prepared: PreparedInvoiceDocument) {
    if (await alreadyHandledDocumentHash(account.id, prepared.sha256)) return;

    const monthKey = monthKeyFromTs(email.date || now);
    const monthFolder = await ensureDriveFolder(drive, monthKey, rootFolder);
    const companyFolder = await ensureDriveFolder(drive, prepared.company, monthFolder);

    const uploaded = await drive.files.create({
      requestBody: {
        name: prepared.fileName,
        parents: [companyFolder],
      },
      media: {
        mimeType: prepared.mimeType || 'application/pdf',
        body: Buffer.from(prepared.buffer),
      },
      fields: 'id,webViewLink,name',
    });

    const fileId = uploaded.data.id;
    if (!fileId) return;

    const record: StoredInvoice = {
      emailId: email.id,
      accountId: account.id,
      company: prepared.company,
      fileName: uploaded.data.name || prepared.fileName,
      driveFileId: fileId,
      driveLink: uploaded.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      monthKey,
      createdAt: Date.now(),
      sourceKind: prepared.sourceKind,
      sha256: prepared.sha256,
      textSha256: prepared.textSha256,
      reviewStatus: prepared.reviewStatus,
      sourceUrl: prepared.sourceUrl,
    };

    await saveInvoiceRecord(record);
    await markHandledDocumentHash(account.id, prepared.sha256, {
      status: 'uploaded',
      fileId,
      monthKey,
      company: prepared.company,
      sourceKind: prepared.sourceKind,
      emailId: email.id,
    });
  }

  for (const email of rows) {
    const ownScoped = `${email.from_email || ''} ${email.to_email || ''}`
      .toLowerCase()
      .includes(account.email.toLowerCase());
    if (!ownScoped) continue;

    const combined = emailEvidenceText(email);
    if (!hasInvoiceIntent(combined)) continue;

    const attachments = await queryAll<AttachmentRow>(
      'SELECT id, email_id, filename, mime_type, size, gmail_attachment_id FROM attachments WHERE email_id = ?',
      [email.id],
    );

    for (const attachment of attachments) {
      if (shouldSkipInvoiceAttachment(attachment.filename)) continue;
      if (
        await alreadyHandledLink(
          account.id,
          email.id,
          `attachment:${attachment.gmail_attachment_id}`,
        )
      )
        continue;
      const data = await getAttachment(gmail, email.id, attachment.gmail_attachment_id, account.id);
      const prepared = await prepareInvoiceDocument({
        sourceKind: 'attachment',
        fileName: attachment.filename,
        mimeType: attachment.mime_type,
        buffer: data.data,
        email,
      });
      if (!prepared) continue;
      await uploadPrepared(email, prepared);
      await markHandledLink(account.id, email.id, `attachment:${attachment.gmail_attachment_id}`, {
        status: 'uploaded',
        sha256: prepared.sha256,
        company: prepared.company,
      });
    }

    const links = extractInvoiceLinkCandidates(
      email.body_html || '',
      `${email.body || ''}\n${email.snippet || ''}`,
    );
    for (const candidate of links) {
      const link = candidate.url;
      if (await alreadyHandledLink(account.id, email.id, link)) continue;

      const downloaded = await downloadInvoiceFromPublicLink(link);
      if (!downloaded.ok || !downloaded.buffer || !downloaded.fileName) {
        await markHandledLink(account.id, email.id, link, {
          status: downloaded.status,
          detail: downloaded.detail,
          finalUrl: downloaded.finalUrl,
          score: candidate.score,
          scoreReasons: candidate.reasons,
        });
        continue;
      }

      const prepared = await prepareInvoiceDocument({
        sourceKind: 'link',
        fileName: downloaded.fileName,
        mimeType: downloaded.contentType || 'application/pdf',
        buffer: downloaded.buffer,
        email,
        sourceUrl: downloaded.finalUrl || link,
      });
      if (!prepared) continue;

      await uploadPrepared(email, prepared);
      await markHandledLink(account.id, email.id, link, {
        status: 'uploaded',
        sha256: prepared.sha256,
        company: prepared.company,
        finalUrl: downloaded.finalUrl,
        score: candidate.score,
        scoreReasons: candidate.reasons,
      });
    }
  }
}

async function getMonthlyInvoicesByCompany(
  accountId: string,
  monthKey: string,
): Promise<CompanyInvoiceMap> {
  const records = await queryAll<{ key: string; value: string }>(
    `SELECT key, value FROM user_settings WHERE account_id = ? AND key LIKE 'invoice_auto_%'`,
    [accountId],
  );

  const parsed = records
    .map((r) => {
      try {
        return JSON.parse(r.value) as StoredInvoice;
      } catch {
        return null;
      }
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

async function markMonthlyPreviewSent(
  accountId: string,
  monthKey: string,
  payload: object,
): Promise<void> {
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [
      randomUUID(),
      accountId,
      `invoice_monthly_preview_sent_${monthKey}`,
      JSON.stringify(payload),
      Date.now(),
    ],
  );
}

export async function approveMonthlyInvoiceDistribution(
  accountId: string,
  monthKey: string,
): Promise<void> {
  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [
      randomUUID(),
      accountId,
      `invoice_monthly_approved_${monthKey}`,
      JSON.stringify({ approvedAt: Date.now() }),
      Date.now(),
    ],
  );
}

export function getInvoiceAutomationAIStatus(): ReturnType<typeof getAIProviderStatus> & {
  invoiceAiAvailable: boolean;
  accuracyGate: string;
} {
  return {
    ...getAIProviderStatus(),
    invoiceAiAvailable: isAIAvailable(),
    accuracyGate:
      'AI is advisory only: deterministic document text rules decide routing; unknown/ambiguous/VAT-risk invoices are blocked for human review.',
  };
}

export async function verifyInvoiceAutomationAIModelLive(): Promise<{
  ok: boolean;
  provider: string;
  model: string;
  text: string;
}> {
  const response = await callAI(
    [
      {
        role: 'system',
        content:
          'You are a strict invoice-processing health-check model. Return only compact JSON.',
      },
      {
        role: 'user',
        content:
          '{"task":"invoice_automation_health_check","expected":"return ok true and no routing decision"}',
      },
    ],
    { maxTokens: 80, timeoutMs: 20_000, responseFormat: 'json_object' },
  );
  return { ok: true, provider: response.provider, model: response.model, text: response.text };
}

export async function runInvoiceAutomationForAccountNow(
  account: { id: string; email: string },
  options: { mode?: InvoiceManualRunMode; monthKey?: string } = {},
): Promise<{
  ok: boolean;
  accountId: string;
  email: string;
  mode: InvoiceManualRunMode;
  monthKey?: string;
  missingConfig?: string[];
}> {
  let config = validateInvoiceAutomationConfig();
  if (!config.ok) {
    tryAutoReloadAccountingEnv();
    config = validateInvoiceAutomationConfig();
  }
  if (!config.ok) {
    await notifyConfigIssue(account, config.missing).catch(() => {});
    return {
      ok: false,
      accountId: account.id,
      email: account.email,
      mode: options.mode || 'daily',
      missingConfig: config.missing,
    };
  }

  const mode = options.mode || 'daily';
  if (mode === 'daily') {
    await runDailyInvoiceCollectorForAccount(account, { runKind: 'manual' });
    return { ok: true, accountId: account.id, email: account.email, mode };
  }

  const monthKey = mode === 'previous_month' ? previousMonthKey() : options.monthKey;
  if (!monthKey) throw new Error('monthKey szükséges month módhoz');
  const range = monthRangeFromKey(monthKey);
  await runDailyInvoiceCollectorForAccount(account, {
    ...range,
    limit: 2000,
    runKind: 'manual',
  });
  return { ok: true, accountId: account.id, email: account.email, mode, monthKey };
}

export async function getInvoiceAutomationStatusForAccount(accountId: string): Promise<{
  config: { ok: boolean; missing: string[] };
  ai: ReturnType<typeof getInvoiceAutomationAIStatus>;
  schedule: { daily: string; monthly: string; retry: string; previousMonthKey: string };
  recentMarkers: Array<{ key: string; value: unknown; updatedAt: number }>;
}> {
  let config = validateInvoiceAutomationConfig();
  if (!config.ok) {
    tryAutoReloadAccountingEnv();
    config = validateInvoiceAutomationConfig();
  }
  const markers = await queryAll<{ key: string; value: string; updated_at: number }>(
    `SELECT key, value, updated_at
     FROM user_settings
     WHERE account_id = ?
       AND (
         key LIKE 'invoice_daily_collected_%'
         OR key LIKE 'invoice_monthly_collected_%'
         OR key LIKE 'invoice_monthly_preview_sent_%'
         OR key LIKE 'invoice_monthly_sent_%'
         OR key LIKE 'invoice_config_instruction_alert_%'
       )
     ORDER BY updated_at DESC
     LIMIT 20`,
    [accountId],
  );
  return {
    config,
    ai: getInvoiceAutomationAIStatus(),
    schedule: {
      daily: 'Europe/Budapest szerint 07:00 után, naponta egyszer, legutóbbi 7 napra.',
      monthly:
        'Minden hónap 1-jén 07:00 után először teljes előző havi gyűjtés, utána havi előnézet/kiküldés jóváhagyási kapuval.',
      retry:
        'A kézi újrafuttatás a UI-ból elérhető; hash- és linkmarkerek miatt idempotens, nem küld automatikusan duplán.',
      previousMonthKey: previousMonthKey(),
    },
    recentMarkers: markers.map((marker) => {
      let parsed: unknown = marker.value;
      try {
        parsed = JSON.parse(marker.value);
      } catch {
        // keep raw value
      }
      return { key: marker.key, value: parsed, updatedAt: marker.updated_at };
    }),
  };
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
    const lines = items
      .slice(0, 50)
      .map((it) => `- ${it.fileName}: ${it.driveLink}`)
      .join('\n');
    blocks.push(`\n${company} (${items.length} db) -> ${recipients.join(', ')}\n${lines}`);
  }

  const approvalHint = `Jóváhagyáshoz hívd: POST /api/invoice-automation/approve { \"monthKey\": \"${monthKey}\" }`;
  const body = `Előnézeti havi számla-kiküldés (${monthKey}) - JÓVÁHAGYÁS SZÜKSÉGES\n${blocks.join('\n')}\n\n${approvalHint}`;

  await sendEmail(gmail, account.id, {
    to: account.email,
    subject: `[APPROVAL REQUIRED] ${monthKey} havi számla-kiküldési előnézet`,
    body,
  });

  await markMonthlyPreviewSent(account.id, monthKey, {
    sentAt: Date.now(),
    companies: Array.from(byCompany.keys()),
  });
}

async function runMonthlyDistributionForAccount(
  account: { id: string; email: string },
  monthKey: string,
): Promise<void> {
  const byCompany = await getMonthlyInvoicesByCompany(account.id, monthKey);
  if (byCompany.size === 0) return;

  const approved = await isMonthlyApproved(account.id, monthKey);
  if (!approved) {
    const previewSent = await hasMonthlyPreviewSent(account.id, monthKey);
    if (!previewSent) {
      await sendMonthlyPreviewForApproval(account, monthKey, byCompany);
      logger.warn(
        `Monthly invoice distribution waiting approval for ${account.email} (${monthKey})`,
      );
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
    const already = await queryOne<{ value: string }>(
      'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
      [account.id, markerKey],
    );
    if (already) continue;

    const lines = items.map((it) => `- ${it.fileName}: ${it.driveLink}`).join('\n');

    const body = `Sziasztok,\n\n${monthKey} havi ${company} számlagyűjtés:\n\n${lines}\n\nAutomatikus küldés: Junior Invoice Automation.`;

    for (const recipient of recipients) {
      await sendEmail(gmail, account.id, {
        to: recipient,
        subject: `[Junior] ${monthKey} havi számlagyűjtés - ${company}`,
        body,
      });
    }

    await execute(
      `INSERT INTO user_settings (id, account_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [
        randomUUID(),
        account.id,
        markerKey,
        JSON.stringify({ sentAt: Date.now(), count: items.length, recipients }),
        Date.now(),
      ],
    );
  }
}

function budapestNow(now = new Date()): {
  hour: number;
  minute: number;
  day: number;
  monthKeyPrev: string;
  dateKey: string;
} {
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
    [
      randomUUID(),
      accountId,
      key,
      JSON.stringify({ status: 'started', at: Date.now() }),
      Date.now(),
    ],
  );
  return Boolean(row?.key);
}

async function markDailyCollected(accountId: string, dateKey: string): Promise<void> {
  await execute(
    'UPDATE user_settings SET value = ?, updated_at = ? WHERE account_id = ? AND key = ?',
    [
      JSON.stringify({ status: 'done', at: Date.now() }),
      Date.now(),
      accountId,
      `invoice_daily_collected_${dateKey}`,
    ],
  );
}

async function claimMonthlyCollectionSlot(accountId: string, monthKey: string): Promise<boolean> {
  const key = `invoice_monthly_collected_${monthKey}`;
  const row = await queryOne<{ key: string }>(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO NOTHING
     RETURNING key`,
    [
      randomUUID(),
      accountId,
      key,
      JSON.stringify({ status: 'started', at: Date.now() }),
      Date.now(),
    ],
  );
  return Boolean(row?.key);
}

// Hiba esetén felszabadítjuk a slotot, hogy a következő cron tick újrapróbálhassa.
// Enélkül a "started" marker örökre foglalt maradna, és aznap/abban a hónapban
// nem futna többé automatikus gyűjtés.
async function releaseCollectionSlot(accountId: string, key: string): Promise<void> {
  await execute('DELETE FROM user_settings WHERE account_id = ? AND key = ?', [accountId, key]);
}

async function markMonthlyCollected(accountId: string, monthKey: string): Promise<void> {
  await execute(
    'UPDATE user_settings SET value = ?, updated_at = ? WHERE account_id = ? AND key = ?',
    [
      JSON.stringify({ status: 'done', at: Date.now() }),
      Date.now(),
      accountId,
      `invoice_monthly_collected_${monthKey}`,
    ],
  );
}

async function notifyConfigIssue(
  account: { id: string; email: string },
  missing: string[],
): Promise<void> {
  const markerKey = `invoice_config_instruction_alert_${new Date().toISOString().slice(0, 10)}`;
  const already = await queryOne<{ value: string }>(
    'SELECT value FROM user_settings WHERE account_id = ? AND key = ?',
    [account.id, markerKey],
  );
  if (already) return;

  const instruction = {
    type: 'JUNIOR_PROCESS_ALERT',
    severity: 'critical',
    source: 'invoice_automation_config',
    accountId: account.id,
    accountEmail: account.email,
    missingEnv: missing,
    action:
      'Junior azonnal javítsa a hiányzó ACCOUNTING_* env változókat, majd futtassa újra az invoice automatizációt.',
    createdAt: Date.now(),
  };

  logger.debug(
    `[invoice-automation] Konfig hiány (ACCOUNTING_*): ${missing.join(', ')} — user_settings marker elmentve.`,
  );

  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), account.id, markerKey, JSON.stringify(instruction), Date.now()],
  );
}

export async function runInvoiceAutomation(
  accounts: Array<{ id: string; email: string }>,
): Promise<void> {
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
          try {
            await runDailyInvoiceCollectorForAccount(account);
            await markDailyCollected(account.id, dateKey);
          } catch (err) {
            await releaseCollectionSlot(account.id, `invoice_daily_collected_${dateKey}`).catch(
              () => {},
            );
            throw err;
          }
        }
      }

      if (dueMonthly) {
        const monthlyClaimed = await claimMonthlyCollectionSlot(account.id, monthKeyPrev);
        if (monthlyClaimed) {
          try {
            await runDailyInvoiceCollectorForAccount(account, {
              ...monthRangeFromKey(monthKeyPrev),
              limit: 2000,
              runKind: 'monthly',
            });
            await markMonthlyCollected(account.id, monthKeyPrev);
          } catch (err) {
            await releaseCollectionSlot(
              account.id,
              `invoice_monthly_collected_${monthKeyPrev}`,
            ).catch(() => {});
            throw err;
          }
        }
        await runMonthlyDistributionForAccount(account, monthKeyPrev);
      }
    } catch (err) {
      logger.error(`Invoice automation failed for ${account.email}`, err);
    }
  }
}
