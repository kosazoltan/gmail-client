const BULK_SENDER_PATTERNS = [
  'noreply',
  'no-reply',
  'do-not-reply',
  'donotreply',
  'mailer-daemon',
  'postmaster',
  'newsletter',
  'digest',
  'notifications@',
  'notification@',
];

const BULK_SUBJECT_PATTERNS = [
  'newsletter',
  'weekly digest',
  'daily digest',
  'unsubscrib',
  'marketing',
  'promó',
  'promotion',
  'summary',
  'összefoglaló',
  'new login',
  'security alert',
];

const OPERATIONAL_SENDER_PATTERNS = [
  'github.com',
  'render.com',
  'vercel.com',
  'netlify.com',
  'circleci.com',
  'sentry.io',
  'datadoghq.com',
  'cloudflare.com',
  'google.com',
  'amazonaws.com',
  'supabase.co',
];

const OPERATIONAL_SUBJECT_PATTERNS = [
  'deploy',
  'deployment',
  'build failed',
  'build error',
  'pipeline',
  'workflow failed',
  'incident',
  'outage',
  'monitor',
  'alert',
  'error',
  'exception',
  'warning',
  'cron',
  'healthcheck',
  'downtime',
  'ci/cd',
];

function normalize(text: string | null | undefined): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getDomain(email: string | null | undefined): string {
  const normalized = normalize(email);
  const [, domain = ''] = normalized.split('@');
  return domain;
}

export function isLikelyBulkNoise(input: {
  fromEmail?: string | null;
  subject?: string | null;
  snippet?: string | null;
}): boolean {
  const fromEmail = normalize(input.fromEmail);
  const subject = normalize(input.subject);
  const snippet = normalize(input.snippet);
  const combined = `${subject} ${snippet}`.trim();

  return (
    BULK_SENDER_PATTERNS.some((pattern) => fromEmail.includes(pattern)) ||
    BULK_SUBJECT_PATTERNS.some((pattern) => combined.includes(pattern))
  );
}

export function isLikelyOperationalAlert(input: {
  fromEmail?: string | null;
  subject?: string | null;
  snippet?: string | null;
}): boolean {
  const domain = getDomain(input.fromEmail);
  const subject = normalize(input.subject);
  const snippet = normalize(input.snippet);
  const combined = `${subject} ${snippet}`.trim();

  return (
    OPERATIONAL_SENDER_PATTERNS.some((pattern) => domain.includes(pattern)) ||
    OPERATIONAL_SUBJECT_PATTERNS.some((pattern) => combined.includes(pattern))
  );
}

export function buildOperationalGroupKey(input: {
  fromEmail?: string | null;
  subject?: string | null;
  title?: string | null;
}): string {
  const domain = getDomain(input.fromEmail) || 'unknown';
  const baseText = normalize(input.title || input.subject)
    .replace(/#[a-z0-9_-]+/gi, ' ')
    .replace(/\b[0-9a-f]{6,}\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `${domain}::${baseText || 'operational-alert'}`;
}
