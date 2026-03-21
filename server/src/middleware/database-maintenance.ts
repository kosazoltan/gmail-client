import type { Request, Response, NextFunction } from 'express';

export const DATABASE_MAINTENANCE_HEADER = 'x-database-maintenance-secret';

/**
 * Global DB maintenance (cleanup, vacuum): in production a secret is mandatory.
 * When DATABASE_MAINTENANCE_SECRET is set, every environment must send the matching header.
 * When unset in non-production, session-only routes can still run (local dev convenience).
 */
export function requireDatabaseMaintenanceSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.DATABASE_MAINTENANCE_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !secret) {
    res.status(503).json({
      error:
        'Adatbázis-karbantartó végpontok kikapcsolva: állítsd be a DATABASE_MAINTENANCE_SECRET környezeti változót a szerveren.',
    });
    return;
  }

  if (!secret) {
    next();
    return;
  }

  const provided = (req.headers[DATABASE_MAINTENANCE_HEADER] as string | undefined)?.trim();
  if (provided !== secret) {
    res
      .status(403)
      .json({
        error: 'Érvénytelen vagy hiányzó karbantartó kulcs (X-Database-Maintenance-Secret).',
      });
    return;
  }

  next();
}

/** Encoding fix: prod requires secret; dev allows localhost if secret unset */
export function assertFixEncodingAccess(
  req: Request,
): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.DATABASE_MAINTENANCE_SECRET?.trim();
  if (secret) {
    const provided = (req.headers[DATABASE_MAINTENANCE_HEADER] as string | undefined)?.trim();
    if (provided !== secret) {
      return { ok: false, status: 403, error: 'Érvénytelen vagy hiányzó karbantartó kulcs.' };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      status: 503,
      error:
        'Karakterkódolás javítás kikapcsolva: állítsd be a DATABASE_MAINTENANCE_SECRET értékét.',
    };
  }

  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!isLocalhost) {
    return { ok: false, status: 403, error: 'Csak localhost-ról érhető el (fejlesztői mód).' };
  }
  return { ok: true };
}
