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

  // SQLite session store létrehozása (perzisztens session-ök)
  sessionStore = new SqliteSessionStore();

  return session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site (different subdomains)
      secure: isProduction, // true for HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 nap (hosszabb, mert perzisztens)
      domain: isProduction ? '.mindenes.org' : undefined, // Share across subdomains
    },
  });
}

export function getSessionStore(): SqliteSessionStore | null {
  return sessionStore;
}
