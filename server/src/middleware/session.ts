import session from 'express-session';
import type { RequestHandler } from 'express';
import { PgSessionStore } from '../db/session-store.js';
import logger from '../utils/logger.js';

// Session típus kiterjesztés
declare module 'express-session' {
  interface SessionData {
    accountIds: string[];
    activeAccountId: string | null;
    oauthState?: string; // CSRF protection for OAuth2 flow
  }
}

let sessionStore: PgSessionStore | null = null;

export function createSessionMiddleware(): RequestHandler {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.FRONTEND_URL?.startsWith('https://');

  // Production ellenőrzés - kötelező SESSION_SECRET
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET környezeti változó kötelező production módban!');
  }

  // PostgreSQL session store létrehozása (perzisztens session-ök)
  sessionStore = new PgSessionStore();

  // Cookie domain meghatározása a FRONTEND_URL és BACKEND_URL alapján
  const frontendUrl = process.env.FRONTEND_URL || '';
  const backendUrl = process.env.BACKEND_URL || '';
  let cookieDomain: string | undefined;
  if (isProduction && frontendUrl && backendUrl) {
    try {
      const feUrl = new URL(frontendUrl);
      const beUrl = new URL(backendUrl);
      const feParts = feUrl.hostname.split('.');
      const beParts = beUrl.hostname.split('.');
      // Közös parent domain keresése (pl. mail.mindenes.org + api.mindenes.org → .mindenes.org)
      const feParent = feParts.slice(-2).join('.');
      const beParent = beParts.slice(-2).join('.');
      if (feParent === beParent && feParts.length >= 2) {
        cookieDomain = '.' + feParent;
      }
      // Ha különböző domain (pl. vercel.app vs onrender.com): cookieDomain marad undefined
      // Ilyenkor a böngésző a backend domain-jéhez köti a cookie-t
    } catch (err) {
      logger.warn('Failed to parse URLs for cookie domain', { frontendUrl, backendUrl, error: err });
    }
  }

  return session({
    store: sessionStore,
    name: 'zmail.sid', // Egyedi session cookie név
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me-32chars!!',
    resave: false, // FIX: Only save if modified to prevent race conditions
    saveUninitialized: false, // Üres session-öket nem mentjük
    rolling: true, // Session cookie lejárat megújítása minden kérésnél
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site (different subdomains)
      secure: isProduction, // true for HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 nap (hosszabb, mert perzisztens)
      domain: cookieDomain, // Dinamikus domain a FRONTEND_URL-ből
      path: '/', // Cookie érvényes minden útvonalra
    },
  });
}

export function getSessionStore(): PgSessionStore | null {
  return sessionStore;
}
