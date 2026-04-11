import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import logger from '../utils/logger.js';

const { Pool, types } = pg;

// PostgreSQL BIGINT (OID 20) returns strings by default — parse as numbers
types.setTypeParser(20, (val: string) => {
  const num = Number(val);
  if (num > Number.MAX_SAFE_INTEGER) {
    logger.warn(`BIGINT value exceeds MAX_SAFE_INTEGER: ${val}`);
    return val;
  }
  return num;
});

function getValidatedPgSchema(): string | null {
  const raw = process.env.ZMAIL_PG_SCHEMA?.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(raw)) {
    logger.error(
      'FATAL: ZMAIL_PG_SCHEMA must be lowercase identifier: ^[a-z][a-z0-9_]*$ (pl. zmail)',
    );
    process.exit(1);
  }
  return raw;
}

function appendLibpqCompatForSslMode(url: string): string {
  try {
    const u = new URL(url);
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (!sslmode || sslmode === 'verify-full' || sslmode === 'disable') return url;
    if (
      ['require', 'prefer', 'verify-ca'].includes(sslmode) &&
      !u.searchParams.has('uselibpqcompat')
    ) {
      u.searchParams.set('uselibpqcompat', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function buildConnectionString(baseUrl: string, schema: string | null): string {
  if (!schema) return baseUrl;
  try {
    const u = new URL(baseUrl);
    if (u.searchParams.has('options')) {
      logger.warn(
        'DATABASE_URL already contains options= — remove it or set search_path there; ignoring ZMAIL_PG_SCHEMA append.',
      );
      return baseUrl;
    }
    u.searchParams.set('options', `-csearch_path=${schema},public`);
    return u.toString();
  } catch {
    logger.warn('DATABASE_URL parse failed; using without ZMAIL_PG_SCHEMA options.');
    return baseUrl;
  }
}

export const zmailPgSchema: string | null = getValidatedPgSchema();

const baseConnectionString = process.env.DATABASE_URL;
if (!baseConnectionString) {
  logger.error(
    '[ZMAIL][PROD_ENV][DATABASE_URL_MISSING] DATABASE_URL nincs beállítva — PostgreSQL connection string kötelező (Neon / Render). A szerver nem indul.',
  );
  process.exit(1);
}

const connectionString = appendLibpqCompatForSslMode(
  buildConnectionString(baseConnectionString, zmailPgSchema),
);
if (zmailPgSchema) {
  logger.info(`PostgreSQL schema isolation: search_path=${zmailPgSchema},public (ZMAIL_PG_SCHEMA)`);
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Math.min(
    60000,
    Math.max(10000, parseInt(process.env.ZMAIL_PG_CONNECT_TIMEOUT_MS || '25000', 10) || 25000),
  ),
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err);
});

// Transaction context via AsyncLocalStorage
export const txStorage = new AsyncLocalStorage<pg.PoolClient>();

export function getTarget(): pg.Pool | pg.PoolClient {
  return txStorage.getStore() || pool;
}

/** Get the raw pool for direct access (vacuum, AI queries, etc.) */
export function getPool(): pg.Pool {
  return pool;
}

/** Close pool (graceful shutdown) */
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed.');
  } catch (err) {
    logger.error('Error closing database pool:', err);
  }
}
