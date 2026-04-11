import pg from 'pg';
import logger from '../utils/logger.js';
import { pool, txStorage, getTarget } from './pool.js';

/**
 * Convert SQLite-style SQL to PostgreSQL:
 * 1. ? → $1, $2, $3...
 * 2. LIKE/NOT LIKE $N COLLATE NOCASE → ILIKE/NOT ILIKE $N
 * 3. = $N COLLATE NOCASE → ILIKE $N
 * 4. Strip remaining COLLATE NOCASE
 */
function convertSql(sql: string): string {
  let i = 0;
  let result = sql.replace(/\?/g, () => `$${++i}`);
  result = result.replace(/\bNOT\s+LIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'NOT ILIKE $1');
  result = result.replace(/\bLIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/=\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/\s+COLLATE\s+NOCASE/gi, '');
  return result;
}

/** Query one row */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const target = getTarget();
  const result = await target.query(convertSql(sql), params);
  return result.rows[0] as T | undefined;
}

/** Query all rows */
export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const target = getTarget();
  const result = await target.query(convertSql(sql), params);
  return result.rows as T[];
}

/** Execute INSERT/UPDATE/DELETE */
export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const target = getTarget();
  await target.query(convertSql(sql), params);
}

/**
 * Transaction wrapper — uses AsyncLocalStorage so queryOne/queryAll/execute
 * inside the callback automatically use the transaction client.
 */
export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStorage.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      logger.error('Transaction rollback failed:', rbErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Alias for backward compatibility */
export const runInTransactionAsync = runInTransaction;
