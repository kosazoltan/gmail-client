/**
 * H1: Shared CORS origin configuration.
 * Used by both server.ts (cors middleware) and error-handler.ts (fallback CORS headers).
 */
export function buildAllowedOrigins(): string[] {
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  return [
    frontendUrl,
    'https://mindenes.org',
    'https://mail.mindenes.org',
    'http://localhost:5173',
    'http://localhost:5000',
  ].filter((x): x is string => Boolean(x));
}
