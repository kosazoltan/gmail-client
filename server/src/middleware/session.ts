import session from 'express-session';
import type { RequestHandler } from 'express';

// Session típus kiterjesztés
declare module 'express-session' {
  interface SessionData {
    accountIds: string[];
    activeAccountId: string | null;
  }
}

export function createSessionMiddleware(): RequestHandler {
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.FRONTEND_URL?.startsWith('https://');
  
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site (different subdomains)
      secure: isProduction, // true for HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 nap
      domain: isProduction ? '.mindenes.org' : undefined, // Share across subdomains
    },
  });
}
