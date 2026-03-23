import { queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';
import { isProductionRuntime } from '../config/production-env.js';

/**
 * Percenkénti kritikus jobok (szundi + ütemezett levelek) SLA ellenőrzése.
 * Ha túl sokáig nem futnak le sikeresen, /api/health 503 (fail-closed) — Render leválasztja a forgalmat.
 *
 * Env:
 *   ZMAIL_CRITICAL_JOBS_WATCHDOG=0  — kikapcsolja (csak vészhelyzet / debug)
 *   ZMAIL_CRITICAL_JOBS_SLA_MS      — max. milliszekundum két sikeres tick között (alap: 900000 = 15 perc)
 */
export function isCriticalJobsWatchdogEnabled(): boolean {
  if (!isProductionRuntime()) return false;
  if (process.env.ZMAIL_CRITICAL_JOBS_WATCHDOG === '0') return false;
  return true;
}

function slaMs(): number {
  const n = parseInt(process.env.ZMAIL_CRITICAL_JOBS_SLA_MS || '900000', 10);
  return Number.isFinite(n) && n >= 120_000 ? n : 900_000;
}

export async function ensureRuntimeWatchdogTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS zmail_runtime_watchdog (
      id TEXT PRIMARY KEY,
      last_critical_jobs_ok_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

/** Első indulás: egy sor, hogy az SLA a boot időponthoz képest értelmeződjön. */
export async function seedRuntimeWatchdogIfNeeded(): Promise<void> {
  const row = await queryOne<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM zmail_runtime_watchdog WHERE id = ?',
    ['singleton'],
  );
  const count = row?.n ?? 0;
  if (count === 0) {
    const now = Date.now();
    await execute(
      'INSERT INTO zmail_runtime_watchdog (id, last_critical_jobs_ok_at, updated_at) VALUES (?, ?, ?)',
      ['singleton', now, now],
    );
    logger.info('[ZMAIL][WATCHDOG] Kezdeti heartbeat (singleton) létrehozva.');
  }
}

export async function touchCriticalJobsOk(): Promise<void> {
  const now = Date.now();
  await execute(
    `INSERT INTO zmail_runtime_watchdog (id, last_critical_jobs_ok_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       last_critical_jobs_ok_at = EXCLUDED.last_critical_jobs_ok_at,
       updated_at = EXCLUDED.updated_at`,
    ['singleton', now, now],
  );
}

export type WatchdogHealthFailure = {
  code: string;
  message: string;
  detail: Record<string, unknown>;
};

/**
 * Ha fail-closed állapot van, adjon vissza objektumot; egyébként null.
 */
export async function getWatchdogHealthFailure(): Promise<WatchdogHealthFailure | null> {
  if (!isCriticalJobsWatchdogEnabled()) return null;

  const row = await queryOne<{ last_critical_jobs_ok_at: number }>(
    'SELECT last_critical_jobs_ok_at FROM zmail_runtime_watchdog WHERE id = ?',
    ['singleton'],
  );

  if (!row) {
    return {
      code: 'WATCHDOG_NO_ROW',
      message:
        'Kritikus háttérfeladatok heartbeat hiányzik (zmail_runtime_watchdog) — fail-closed. Ellenőrizd az adatbázis sémát.',
      detail: {},
    };
  }

  const last = Number(row.last_critical_jobs_ok_at);
  const elapsed = Date.now() - last;
  const limit = slaMs();

  if (elapsed > limit) {
    return {
      code: 'WATCHDOG_CRITICAL_JOBS_OVERDUE',
      message: `A percenkénti kritikus jobok (szundi + ütemezett levelek) túl régóta nem futottak le sikeresen (${Math.round(elapsed / 1000)} s). SLA: ${limit} ms.`,
      detail: { elapsedMs: elapsed, slaMs: limit, lastOkAt: last },
    };
  }

  return null;
}
