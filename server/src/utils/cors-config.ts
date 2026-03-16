/**
 * H1: Shared CORS origin configuration.
 * Used by both server.ts (cors middleware) and error-handler.ts (fallback CORS headers).
 */
export function buildAllowedOrigins(): string[] {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  // ALLOWED_ORIGINS / ADDITIONAL_ORIGINS: comma-separated extra origins
  // (e.g. Render preview URLs)
  // Example: ALLOWED_ORIGINS=https://api.mindenes.org,https://staging.mindenes.org
  const envOrigins = [process.env.ALLOWED_ORIGINS ?? '', process.env.ADDITIONAL_ORIGINS ?? '']
    .flatMap((value) => value.split(','))
    .map((o) => o.trim())
    .filter(Boolean);

  return Array.from(new Set([
    frontendUrl,
    'https://mindenes.org',
    'https://www.mindenes.org',
    'https://mail.mindenes.org',
    'https://api.mindenes.org',
    'https://gmail-client-7gc9rv71u-kosa-zoltans-projects.vercel.app',
    'https://gmail-client-m9scbaznv-kosa-zoltans-projects.vercel.app',
    'https://gmail-client-ly41jy423-kosa-zoltans-projects.vercel.app',
    'https://gmail-client-62dqbihas-kosa-zoltans-projects.vercel.app',
    'https://gmail-client-b9du39b54-kosa-zoltans-projects.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000',
    ...envOrigins,
  ].filter((x): x is string => Boolean(x))));
}

/**
 * Returns true if the given origin should be allowed.
 * Handles edge cases:
 * - undefined/empty origin (mobile apps, Postman, server-to-server) → allow
 * - string "null" origin (PWA, Capacitor, some Electron builds) → allow
 * - exact match against allowed list
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin || origin === 'null') return true;

  const normalizeOrigin = (value: string): string => value.trim().replace(/\/$/, '').toLowerCase();
  const normalized = normalizeOrigin(origin);

  // Robust match: handle accidental casing/trailing slash differences.
  if (allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized)) return true;

  if (
    normalized.startsWith('https://gmail-client-') &&
    normalized.endsWith('-kosa-zoltans-projects.vercel.app')
  ) {
    return true;
  }
  return false;
}
