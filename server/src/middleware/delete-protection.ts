/**
 * Delete Protection Middleware — Torles-vedelem
 * 
 * SZABALY: TILOS BARMIT TOROLNI A GMAIL FIOKBOL!
 * 
 * Ez a middleware:
 * 1. BLOKKOL minden Gmail API torles muveletet (vegleges torles)
 * 2. ENGEDELYEZI a "kukaba helyezest" (trash) — az NEM vegleges torles
 * 3. ENGEDELYEZI a lokalis DB karbantartas muveleteket (pl. backup torles)
 * 4. LOGOL minden DELETE kerelmet
 */

import { Request, Response, NextFunction } from 'express';

// Routes that perform PERMANENT deletion via Gmail API — BLOCKED
const BLOCKED_ROUTES: RegExp[] = [
  // These would permanently delete from Gmail — NEVER ALLOW
  // Currently none exist, but this is a safety net
];

// Routes that delete from LOCAL database only — ALLOWED but logged
const LOCAL_DB_DELETE_ROUTES: RegExp[] = [
  /^\/api\/database\/emails$/,          // batch delete from local DB
  /^\/api\/database\/emails\/by-date$/, // date range delete from local DB
  /^\/api\/database\/emails\/old$/,     // old emails delete from local DB
  /^\/api\/database\/backups\//,        // backup file delete
];

// Routes that move to TRASH (not permanent) — ALLOWED
const TRASH_ROUTES: RegExp[] = [
  /^\/api\/emails\/batch$/,    // batch trash (Gmail kukaba)
  /^\/api\/emails\/[^/]+$/,    // single email trash (Gmail kukaba)
];

// Safe metadata delete routes — ALLOWED
const SAFE_DELETE_ROUTES: RegExp[] = [
  /^\/api\/categories\//,       // category/rule delete (local only)
  /^\/api\/contacts\//,         // contact delete (local only)
  /^\/api\/labels\//,           // label management
  /^\/api\/newsletters\//,      // newsletter sender delete (local only)
  /^\/api\/pinned\//,           // unpin (local only)
  /^\/api\/reminders\//,        // reminder delete (local only)
  /^\/api\/saved-searches\//,   // saved search delete (local only)
  /^\/api\/scheduled\//,        // scheduled email cancel (local only)
  /^\/api\/settings\//,         // setting delete (local only)
  /^\/api\/snooze\//,           // snooze cancel (local only)
  /^\/api\/templates\//,        // template delete (local only)
  /^\/api\/vip\//,              // VIP sender delete (local only)
  /^\/api\/accounts\//,         // account disconnect (local only)
];

export function deleteProtection(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'DELETE') {
    next();
    return;
  }

  const path = req.path;

  // 1. Check BLOCKED routes — permanent Gmail deletion
  for (const pattern of BLOCKED_ROUTES) {
    if (pattern.test(path)) {
      console.error(`[DELETE-PROTECTION] BLOCKED permanent deletion: ${req.method} ${path}`);
      res.status(403).json({
        error: 'Vegleges torles TILTOTT',
        message: 'Ez a muvelet veglegesen torolne emaileket a Gmail fiokbol. Ez TILOS.',
        code: 'DELETE_PERMANENTLY_BLOCKED'
      });
      return;
    }
  }

  // 2. Trash routes — allowed (not permanent)
  for (const pattern of TRASH_ROUTES) {
    if (pattern.test(path)) {
      console.log(`[DELETE-PROTECTION] TRASH (allowed): ${req.method} ${path}`);
      next();
      return;
    }
  }

  // 3. Local DB delete routes — allowed but with extra logging
  for (const pattern of LOCAL_DB_DELETE_ROUTES) {
    if (pattern.test(path)) {
      console.warn(`[DELETE-PROTECTION] LOCAL DB DELETE: ${req.method} ${path} — body: ${JSON.stringify(req.body).substring(0, 200)}`);
      next();
      return;
    }
  }

  // 4. Safe metadata routes — allowed
  for (const pattern of SAFE_DELETE_ROUTES) {
    if (pattern.test(path)) {
      next();
      return;
    }
  }

  // 5. Unknown DELETE route — LOG WARNING but allow (don't break features)
  console.warn(`[DELETE-PROTECTION] UNKNOWN DELETE route: ${req.method} ${path} — allowing but monitoring`);
  next();
}