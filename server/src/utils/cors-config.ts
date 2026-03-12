/**
 * H1: Shared CORS origin configuration.
 * Used by both server.ts (cors middleware) and error-handler.ts (fallback CORS headers).
 */
export function buildAllowedOrigins(): string[] {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  // ADDITIONAL_ORIGINS: comma-separated extra origins (e.g. Render preview URLs)
  // Example: ADDITIONAL_ORIGINS=https://gmail-client-pr123.onrender.com,https://staging.mindenes.org
  const additionalOrigins = (process.env.ADDITIONAL_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return [
    frontendUrl,
    'https://mindenes.org',
    'https://www.mindenes.org',
    'https://mail.mindenes.org',
    // Render service direct URL (onrender.com) — used when custom domain is not active
    // or when the frontend is accessed via the Render URL directly
    'https://gmail-client-api.onrender.com',
    'https://gmail-client-backend.onrender.com',
    // Vercel deployment URL (frontend on Vercel)
    'https://gmail-client-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000',
    ...additionalOrigins,
  ].filter((x): x is string => Boolean(x));
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
  const normalized = origin.trim();
  if (allowedOrigins.includes(normalized)) return true;
  return false;
}
