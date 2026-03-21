import type { Request, Response } from 'express';

/**
 * H1: Shared CORS origin configuration.
 * Used by server.ts (cors middleware), error-handler.ts, és middleware-ek közvetlen res.json() válaszaihoz.
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

  return Array.from(
    new Set(
      [
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
      ].filter((x): x is string => Boolean(x)),
    ),
  );
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

/**
 * Ha még nincs ACAO a válaszon, de cross-origin kérés engedélyezett originnel —
 * állítsuk be (különben a böngésző „No Access-Control-Allow-Origin”-t jelez).
 */
export function applyCorsHeadersIfAllowed(req: Request, res: Response): void {
  if (res.getHeader('Access-Control-Allow-Origin')) return;
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = buildAllowedOrigins();
  if (!isOriginAllowed(origin, allowed)) return;
  const value = origin.trim() === 'null' ? 'null' : origin.trim();
  res.setHeader('Access-Control-Allow-Origin', value);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
