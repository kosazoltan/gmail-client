import logger from '../utils/logger.js';

/** Dev-only placeholderek — productionben tiltottak. */
export const DEV_SESSION_SECRET_PLACEHOLDER = 'dev-secret-change-me-32chars!!';
export const DEV_ENCRYPTION_KEY_PLACEHOLDER = 'dev-only-encryption-key-32chars!';
export const DEFAULT_ERRORLOG_HMAC_SECRET = 'errorlog-hmac-s3cr3t-zmail-2026-kz';

export interface ProdEnvViolation {
  /** Gépi kód (log / monitoring), pl. PROD_ENV_MISSING:SESSION_SECRET */
  code: string;
  /** Ember számára olvasható magyarázat */
  detail: string;
}

/**
 * Production runtime: NODE_ENV, Render, vagy kényszerített flag.
 * ZMAIL_PRODUCTION_ENFORCEMENT=0 → kikapcsolja (csak fejlesztői környezetben használd).
 */
export function isProductionRuntime(): boolean {
  if (process.env.ZMAIL_PRODUCTION_ENFORCEMENT === '0') return false;
  if (process.env.ZMAIL_PRODUCTION_ENFORCEMENT === '1') return true;
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.FLY_APP_NAME)
  );
}

function pushHttpsUrl(
  violations: ProdEnvViolation[],
  envName: string,
  raw: string | undefined,
  code: string,
): void {
  const v = raw?.trim();
  if (!v) {
    violations.push({
      code,
      detail: `${envName} kötelező productionben, és https:// URL legyen (CORS / cookie / OAuth).`,
    });
    return;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') {
      violations.push({
        code: `${code}_NOT_HTTPS`,
        detail: `${envName} csak https:// lehet productionben (jelenleg: ${u.protocol}).`,
      });
    }
  } catch {
    violations.push({
      code: `${code}_INVALID_URL`,
      detail: `${envName} nem érvényes URL: ${v.slice(0, 80)}`,
    });
  }
}

/**
 * Összegyűjti a production környezeti hibákat (üres lista = OK).
 * Nem lép ki — hívó dönthet (assertProductionEnvironment).
 */
export function collectProductionEnvViolations(): ProdEnvViolation[] {
  if (!isProductionRuntime()) return [];

  const violations: ProdEnvViolation[] = [];

  const session = process.env.SESSION_SECRET?.trim() || '';
  if (!session) {
    violations.push({
      code: 'PROD_ENV_MISSING:SESSION_SECRET',
      detail:
        'SESSION_SECRET kötelező productionben (session aláírás). Render: generateValue vagy erős random.',
    });
  } else if (session.length < 16) {
    violations.push({
      code: 'PROD_ENV_WEAK:SESSION_SECRET',
      detail: 'SESSION_SECRET legalább 16 karakter legyen productionben.',
    });
  } else if (session === DEV_SESSION_SECRET_PLACEHOLDER) {
    violations.push({
      code: 'PROD_ENV_FORBIDDEN:SESSION_SECRET',
      detail: 'A dev alapértelmezett SESSION_SECRET nem használható productionben.',
    });
  }

  const enc = process.env.ENCRYPTION_KEY?.trim() || '';
  if (!enc) {
    violations.push({
      code: 'PROD_ENV_MISSING:ENCRYPTION_KEY',
      detail:
        'ENCRYPTION_KEY kötelező productionben (token vault / legacy titkosítás). Min. 16 karakter.',
    });
  } else if (enc.length < 16) {
    violations.push({
      code: 'PROD_ENV_WEAK:ENCRYPTION_KEY',
      detail:
        'ENCRYPTION_KEY legalább 16 karakter legyen productionben (CLAUDE.md: ENCRYPTION_KEY).',
    });
  } else if (enc === DEV_ENCRYPTION_KEY_PLACEHOLDER) {
    violations.push({
      code: 'PROD_ENV_FORBIDDEN:ENCRYPTION_KEY',
      detail: 'A dev alapértelmezett ENCRYPTION_KEY nem használható productionben.',
    });
  }

  const gid = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  if (!gid) {
    violations.push({
      code: 'PROD_ENV_MISSING:GOOGLE_CLIENT_ID',
      detail: 'GOOGLE_CLIENT_ID kötelező productionben (Google OAuth).',
    });
  }

  const gsec = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  if (!gsec) {
    violations.push({
      code: 'PROD_ENV_MISSING:GOOGLE_CLIENT_SECRET',
      detail: 'GOOGLE_CLIENT_SECRET kötelező productionben (Google OAuth).',
    });
  } else if (process.env.ZMAIL_ALLOW_NON_GOCSPX_SECRET !== '1' && !gsec.startsWith('GOCSPX-')) {
    violations.push({
      code: 'PROD_ENV_INVALID:GOOGLE_CLIENT_SECRET',
      detail:
        'Google OAuth Client Secret productionben GOCSPX- prefix-sel kell kezdődjön. Ha szándékosan más: ZMAIL_ALLOW_NON_GOCSPX_SECRET=1 (nem ajánlott).',
    });
  }

  const redir = process.env.GOOGLE_REDIRECT_URI?.trim() || '';
  if (!redir) {
    violations.push({
      code: 'PROD_ENV_MISSING:GOOGLE_REDIRECT_URI',
      detail:
        'GOOGLE_REDIRECT_URI kötelező productionben (pl. https://api.mindenes.org/api/auth/callback).',
    });
  } else {
    pushHttpsUrl(violations, 'GOOGLE_REDIRECT_URI', redir, 'PROD_ENV_INVALID:GOOGLE_REDIRECT_URI');
  }

  pushHttpsUrl(
    violations,
    'FRONTEND_URL',
    process.env.FRONTEND_URL,
    'PROD_ENV_MISSING:FRONTEND_URL',
  );
  pushHttpsUrl(violations, 'BACKEND_URL', process.env.BACKEND_URL, 'PROD_ENV_MISSING:BACKEND_URL');

  const hmac = process.env.ERRORLOG_HMAC_SECRET?.trim() || '';
  if (!hmac || hmac === DEFAULT_ERRORLOG_HMAC_SECRET) {
    violations.push({
      code: 'PROD_ENV_FORBIDDEN:ERRORLOG_HMAC_SECRET',
      detail:
        'ERRORLOG_HMAC_SECRET kötelező productionben, és ne az alapértelmezett repó-beli érték legyen (error report / static audit aláírás).',
    });
  } else if (hmac.length < 16) {
    violations.push({
      code: 'PROD_ENV_WEAK:ERRORLOG_HMAC_SECRET',
      detail: 'ERRORLOG_HMAC_SECRET legalább 16 karakter legyen productionben.',
    });
  }

  return violations;
}

/**
 * Production env ellenőrzés indulás előtt — fail-closed: hiba esetén process.exit(1).
 */
export function assertProductionEnvironment(): void {
  const violations = collectProductionEnvViolations();
  if (violations.length === 0) {
    if (isProductionRuntime()) {
      logger.info('[ZMAIL][PROD] Környezeti validáció rendben (production runtime).');
    }
    return;
  }

  logger.error(
    `[ZMAIL][PROD_ENV] ${violations.length} kötelező production beállítás hibás vagy hiányzik — a szerver nem indul (fail-closed).`,
  );
  for (const x of violations) {
    logger.error(`[ZMAIL][PROD_ENV][${x.code}] ${x.detail}`);
  }
  logger.error(
    '[ZMAIL][PROD_ENV] Teendő: Render / Vercel Dashboard → Environment, illetve CLAUDE.md (OAuth, SESSION_SECRET, ENCRYPTION_KEY).',
  );
  process.exit(1);
}
