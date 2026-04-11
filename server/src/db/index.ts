/**
 * Database barrel — re-exports from pool, queries, migrations.
 * All consumers continue importing from '../db/index.js' unchanged.
 */

export { zmailPgSchema, pool, getPool, closeDatabase } from './pool.js';
export { queryOne, queryAll, execute, runInTransaction, runInTransactionAsync } from './queries.js';
export { initializeDatabase } from './migrations.js';
