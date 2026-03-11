import { isNewsletterEmail } from './newsletter.service.js';

export interface TaskRelevanceEmailInput {
  fromEmail: string | null;
  fromName?: string | null;
  subject: string | null;
  snippet?: string | null;
  body?: string | null;
  labels?: string | null;
}

export interface TaskRelevanceAssessment {
  isRelevant: boolean;
  positiveSignals: string[];
  negativeSignals: string[];
}

const AUTOMATED_SENDER_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /do-not-reply/i,
  /mailer-daemon/i,
  /notification@/i,
  /notifications@/i,
  /updates@/i,
  /status@/i,
  /hello@render\.com/i,
  /notifications@github\.com/i,
  /noreply@github\.com/i,
  /noreply@vercel\.com/i,
];

const NOISE_PATTERNS = [
  /unsubscribe/i,
  /manage preferences/i,
  /view in browser/i,
  /marketing/i,
  /\bpromo\b/i,
  /promotion/i,
  /discount/i,
  /special offer/i,
  /sale ends/i,
  /newsletter/i,
  /digest/i,
  /weekly roundup/i,
  /daily update/i,
  /release notes/i,
  /changelog/i,
  /deploy(ed|ment)?/i,
  /build successful/i,
  /build failed/i,
  /service recovered/i,
  /incident resolved/i,
  /status page/i,
  /follow us/i,
];

const POSITIVE_TASK_PATTERNS = [
  /kérlek/i,
  /kérem/i,
  /\bplease\b/i,
  /válaszolj/i,
  /\breply\b/i,
  /visszajelzés/i,
  /teendő/i,
  /feladat/i,
  /határidő/i,
  /deadline/i,
  /\basap\b/i,
  /sürgős/i,
  /urgent/i,
  /jóváhagy/i,
  /approve/i,
  /aláír/i,
  /\bsign\b/i,
  /fizet/i,
  /utal/i,
  /számla/i,
  /invoice/i,
  /meeting/i,
  /megbeszélés/i,
  /találkozó/i,
  /\bcall\b/i,
  /review/i,
  /ellenőrizd/i,
  /intézd/i,
  /küldd/i,
  /tudnád/i,
  /could you/i,
  /can you/i,
  /need you to/i,
];

const GENERIC_ACTION_NOISE_PATTERNS = [
  /unsubscribe/i,
  /newsletter/i,
  /digest/i,
  /deploy/i,
  /build/i,
  /service recovered/i,
  /marketing/i,
  /promotion/i,
  /release notes/i,
  /follow us/i,
];

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function assessEmailTaskRelevance(email: TaskRelevanceEmailInput): TaskRelevanceAssessment {
  const subject = normalize(email.subject);
  const snippet = normalize(email.snippet);
  const body = normalize(email.body).slice(0, 2000);
  const fromEmail = normalize(email.fromEmail).toLowerCase();
  const labels = normalize(email.labels).toLowerCase();
  const combined = `${subject}\n${snippet}\n${body}`.trim();

  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];

  if (!fromEmail) {
    negativeSignals.push('missing_sender');
  }

  if (fromEmail && isNewsletterEmail(fromEmail, email.fromName ?? null, subject || null)) {
    negativeSignals.push('newsletter_pattern');
  }

  if (AUTOMATED_SENDER_PATTERNS.some((pattern) => pattern.test(fromEmail))) {
    negativeSignals.push('automated_sender');
  }

  if (labels.includes('category_promotions') || labels.includes('promotions') || labels.includes('category_social')) {
    negativeSignals.push('promotions_label');
  }

  if (NOISE_PATTERNS.some((pattern) => pattern.test(combined) || pattern.test(subject) || pattern.test(fromEmail))) {
    negativeSignals.push('noise_content');
  }

  if (/\?/.test(combined) && !negativeSignals.includes('noise_content')) {
    positiveSignals.push('question');
  }

  if (POSITIVE_TASK_PATTERNS.some((pattern) => pattern.test(combined) || pattern.test(subject))) {
    positiveSignals.push('task_language');
  }

  if (fromEmail && !AUTOMATED_SENDER_PATTERNS.some((pattern) => pattern.test(fromEmail))) {
    positiveSignals.push('human_sender');
  }

  const isRelevant =
    positiveSignals.length >= 2 && negativeSignals.length === 0
      ? true
      : positiveSignals.length >= 3 && negativeSignals.length <= 1;

  return { isRelevant, positiveSignals, negativeSignals };
}

export function isMeaningfulActionItemText(text: string): boolean {
  const normalized = normalize(text).toLowerCase();
  if (!normalized || normalized.length < 8) return false;
  if (GENERIC_ACTION_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return POSITIVE_TASK_PATTERNS.some((pattern) => pattern.test(normalized)) || normalized.includes('?');
}
