import session from 'express-session';
import type { RequestHandler } from 'express';
import { SqliteSessionStore } from '../db/session-store.js';

// Session típus kiterjesztés
declare module 'express-session' {
  interface SessionData {
    accountIds: string[];
    activeAccountId: string | null;
  }
}

let sessionStore: SqliteSessionStore | null = null;

export function createSessionMiddleware(): RequestHandler {
  const isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.FRONTEND_URL?.startsWith('https://');

  // Production ellenőrzés - kötelező SESSION_SECRET
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET környezeti változó kötelező production módban!');
  }

  // SQLite session store létrehozása (perzisztens session-ök)
  sessionStore = new SqliteSessionStore();

  // Cookie domain kinyerése a FRONTEND_URL-ből
  const frontendUrl = process.env.FRONTEND_URL || '';
  let cookieDomain: string | undefined;
  if (isProduction && frontendUrl) {
    try {
      const url = new URL(frontendUrl);
      // Subdomain támogatáshoz pont prefixet adunk
      const parts = url.hostname.split('.');
      if (parts.length >= 2) {
        cookieDomain = '.' + parts.slice(-2).join('.');
      }
    } catch {
      // URL parse hiba esetén nem állítunk be domain-t
    }
  }

  return session({
    store: sessionStore,
    name: 'zmail.sid', // Egyedi session cookie név
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me-32chars!!',
    resave: true, // Session mindig mentődik minden kérésnél
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

export function getSessionStore(): SqliteSessionStore | null {
  return sessionStore;
}
