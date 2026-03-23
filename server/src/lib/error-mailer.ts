import { createHash, createHmac } from 'crypto';
import nodemailer from 'nodemailer';
import { execute, queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

// ─── App Constants ────────────────────────────────────────────────────────────
const APP_NAME = 'ZMail Gmail Kliens';
const REPO_PATH = 'D:\\repo\\gmail-client';
const GITHUB_REPO = 'kosazoltan/gmail-client';
const FORBIDDEN_REPO = 'D:\\repo\\Bookkeeper';
const ENVIRONMENT = process.env.NODE_ENV ?? 'production';

const HMAC_SECRET = process.env.ERRORLOG_HMAC_SECRET ?? 'change-me-in-env-not-in-repo';
const SMTP_USER = 'noraautomatizalas@gmail.com';
const SMTP_PASS = process.env.JUNIOR_EMAIL_PASSWORD;
const EMAIL_RECIPIENT = 'noraautomatizalas@gmail.com';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ErrorReportPayload {
  errorType: string;
  severity?: string;
  message: string;
  stack?: string;
  commitSha?: string;
  url?: string;
  requestId?: string;
  requestMethod?: string;
  requestBody?: string;
  userId?: string;
  userEmail?: string;
  browser?: string;
  breadcrumbs?: unknown[];
  timestamp?: string;
}

interface ErrorLogRow {
  id: string;
  occurrence_count: number;
  email_sent_at: string | null;
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────
function buildFingerprint(payload: ErrorReportPayload): string {
  const raw = `${APP_NAME}|${payload.errorType}|${payload.message.slice(0, 200)}`;
  return createHash('md5').update(raw).digest('hex');
}

// ─── SMTP transport ──────────────────────────────────────────────────────────
function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ─── Email body ──────────────────────────────────────────────────────────────
function buildEmailHtml(payload: ErrorReportPayload, occurrenceCount: number): string {
  const ts = payload.timestamp ?? new Date().toISOString();

  // HMAC signing
  const fpRaw = `${APP_NAME}|${payload.errorType}|${payload.message.slice(0, 200)}`;
  const fpHash = createHash('md5').update(fpRaw).digest('hex');
  const sig = createHmac('sha256', HMAC_SECRET).update(`${fpHash}:${ts}`).digest('hex');

  return `
<h2 style="color:#c0392b">[${payload.severity ?? 'ERROR'}] ${APP_NAME} — ${payload.errorType}</h2>
<table style="border-collapse:collapse;font-family:monospace;font-size:13px">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">App</td><td>${APP_NAME}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Repo</td><td>${REPO_PATH}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">GitHub</td><td>${GITHUB_REPO}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Env</td><td>${ENVIRONMENT}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Occurrences</td><td>${occurrenceCount}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Time</td><td>${ts}</td></tr>
  ${payload.commitSha ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">Commit</td><td>${payload.commitSha}</td></tr>` : ''}
  ${payload.url ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">URL</td><td>${payload.url}</td></tr>` : ''}
  ${payload.requestId ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">Request ID</td><td>${payload.requestId}</td></tr>` : ''}
  ${payload.userId ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">User ID</td><td>${payload.userId}</td></tr>` : ''}
  ${payload.userEmail ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">User Email</td><td>${payload.userEmail}</td></tr>` : ''}
  ${payload.browser ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">Browser</td><td>${payload.browser}</td></tr>` : ''}
</table>
<h3>Message</h3>
<pre style="background:#f4f4f4;padding:12px;border-radius:4px">${payload.message}</pre>
${payload.stack ? `<h3>Stack Trace</h3><pre style="background:#f4f4f4;padding:12px;border-radius:4px;font-size:11px">${payload.stack}</pre>` : ''}
${payload.breadcrumbs?.length ? `<h3>Breadcrumbs</h3><pre style="background:#f4f4f4;padding:12px;border-radius:4px;font-size:11px">${JSON.stringify(payload.breadcrumbs, null, 2)}</pre>` : ''}
<!-- ERRORLOG_SIGNATURE:${sig}:${ts} -->
<!-- ERRORLOG_FINGERPRINT:${fpHash} -->
<!-- ERRORLOG_APP:${APP_NAME} -->
<!-- ERRORLOG_REPO:${REPO_PATH} -->
`.trim();
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Log an error to DB and optionally send email notification.
 * - New errors: insert + send email
 * - Repeated errors: update occurrence count (throttled email: max 1 per hour)
 */
export async function sendErrorReport(payload: ErrorReportPayload): Promise<void> {
  // Safety: never touch FORBIDDEN_REPO
  if ((REPO_PATH as string) === FORBIDDEN_REPO) {
    logger.error('FORBIDDEN_REPO guard triggered — aborting error report');
    return;
  }

  const fingerprint = buildFingerprint(payload);
  const severity = payload.severity ?? 'ERROR';

  try {
    // Check for existing record
    const existing = await queryOne<ErrorLogRow>(
      `SELECT id, occurrence_count, email_sent_at FROM error_logs WHERE fingerprint = $1`,
      [fingerprint],
    );

    let occurrenceCount = 1;
    let shouldSendEmail = false;

    if (existing) {
      occurrenceCount = (existing.occurrence_count ?? 0) + 1;
      await execute(
        `UPDATE error_logs SET occurrence_count = $1, last_seen_at = NOW() WHERE fingerprint = $2`,
        [occurrenceCount, fingerprint],
      );

      // Throttle: send email max once per hour for repeated errors
      const lastSent = existing.email_sent_at ? new Date(existing.email_sent_at).getTime() : 0;
      shouldSendEmail = Date.now() - lastSent > 60 * 60 * 1000;
    } else {
      // Insert new record
      await execute(
        `INSERT INTO error_logs (
          fingerprint, error_type, severity, message, stack, commit_sha,
          app_name, repo_path, environment, breadcrumbs,
          url, request_id, request_method, request_body,
          user_id, user_email, browser
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          fingerprint,
          payload.errorType.slice(0, 50),
          severity,
          payload.message,
          payload.stack ?? null,
          payload.commitSha ?? null,
          APP_NAME,
          REPO_PATH,
          ENVIRONMENT,
          payload.breadcrumbs ? JSON.stringify(payload.breadcrumbs) : null,
          payload.url ?? null,
          payload.requestId ?? null,
          payload.requestMethod ?? null,
          payload.requestBody ?? null,
          payload.userId ?? null,
          payload.userEmail ?? null,
          payload.browser ?? null,
        ],
      );
      shouldSendEmail = true;
    }

    // Send email notification
    if (shouldSendEmail && SMTP_PASS) {
      try {
        const transport = createTransport();
        const subject = `[${severity}] ${APP_NAME} — ${payload.errorType} (×${occurrenceCount})`;
        await transport.sendMail({
          from: SMTP_USER,
          to: EMAIL_RECIPIENT,
          subject,
          html: buildEmailHtml(payload, occurrenceCount),
        });
        await execute(
          `UPDATE error_logs SET email_sent = true, email_sent_at = NOW() WHERE fingerprint = $1`,
          [fingerprint],
        );
        logger.info(`[error-mailer] Email sent: ${subject}`);
      } catch (emailErr) {
        logger.error('[error-mailer] Failed to send email notification:', emailErr);
      }
    }
  } catch (dbErr) {
    // Never crash the app due to error logging failures
    logger.error('[error-mailer] DB operation failed:', dbErr);
  }
}

// Expose constants for static-audit
export { APP_NAME, REPO_PATH, HMAC_SECRET };
