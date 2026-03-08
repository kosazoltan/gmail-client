import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import { getPool } from '../db/index.js';

// --- Interfaces ---

export interface AIQueryRequest {
  naturalLanguage: string;
  generatedSQL: string;
  accountId: string;
}

export interface AIQueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  auditId: string;
}

// --- Constants ---

const BLOCKED_KEYWORDS: readonly string[] = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'EXEC',
  'EXECUTE',
  'SQLITE_MASTER',
  'PRAGMA',
  'ATTACH',
  'DETACH',
  'VACUUM',
  'REINDEX',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'INTO',
  'LOAD_EXTENSION',
] as const;

const DEFAULT_MAX_ROWS = 1000;

// --- Security Functions ---

/**
 * Checks if a SQL query is safe to execute.
 * Only SELECT statements are allowed. All mutation/DDL keywords are blocked.
 */
export function isQuerySafe(sql: string): boolean {
  const normalised = sql.trim().replace(/\s+/g, ' ');
  const upper = normalised.toUpperCase();

  // Must start with SELECT (after optional whitespace / opening paren)
  const stripped = upper.replace(/^\(+\s*/, '');
  if (!stripped.startsWith('SELECT')) {
    return false;
  }

  // Check for blocked keywords (word-boundary match to avoid false positives)
  for (const keyword of BLOCKED_KEYWORDS) {
    // \b word-boundary ensures we don't match substrings like "CREATED_AT"
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(normalised)) {
      logger.warn('Blocked SQL keyword detected', { keyword, sql: normalised.slice(0, 200) });
      return false;
    }
  }

  // Block multiple statements (semicolon followed by another statement)
  if (/;\s*\S/.test(normalised)) {
    logger.warn('Multiple SQL statements detected', { sql: normalised.slice(0, 200) });
    return false;
  }

  return true;
}

/**
 * Injects an account_id filter into the WHERE clause of a SQL query.
 * Uses parenthesis-level tracking to find the OUTER query's WHERE clause,
 * avoiding incorrect injection into subqueries.
 * Returns parameterized SQL with ? placeholder instead of string interpolation.
 */
export function injectUserFilter(sql: string, accountId: string): { sql: string; params: string[] } {
  const normalised = sql.trim();
  const upperSql = normalised.toUpperCase();

  // Find the OUTER WHERE (at parenthesis depth 0) by scanning character-by-character
  let outerWhereIndex = -1;
  let depth = 0;
  for (let i = 0; i < upperSql.length; i++) {
    if (upperSql[i] === '(') {
      depth++;
    } else if (upperSql[i] === ')') {
      depth--;
    } else if (depth === 0 && upperSql.startsWith('WHERE', i)) {
      // Verify it's a word boundary (not part of "SOMEWHERE")
      const before = i === 0 || /\s|\)/.test(upperSql[i - 1]);
      const after = i + 5 >= upperSql.length || /\s|\(/.test(upperSql[i + 5]);
      if (before && after) {
        outerWhereIndex = i;
      }
    }
  }

  // Find the first trailing clause (GROUP BY / ORDER BY / LIMIT / HAVING) at depth 0
  function findOuterClauseIndex(startFrom: number): number {
    let d = 0;
    for (let i = startFrom; i < upperSql.length; i++) {
      if (upperSql[i] === '(') d++;
      else if (upperSql[i] === ')') d--;
      else if (d === 0) {
        for (const clause of ['GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING']) {
          if (upperSql.startsWith(clause.replace(' ', '\\s+') ? clause : clause, i)) {
            // Check with regex for flexible whitespace
            const pattern = new RegExp(`\\b${clause.replace(' ', '\\s+')}\\b`, 'i');
            const remaining = upperSql.slice(i);
            const m = remaining.match(pattern);
            if (m && m.index === 0) {
              return i;
            }
          }
        }
      }
    }
    return -1;
  }

  if (outerWhereIndex !== -1) {
    // Has outer WHERE — insert AND account_id = ? before trailing clauses or at end
    const clauseIdx = findOuterClauseIndex(outerWhereIndex + 5);
    if (clauseIdx !== -1) {
      return {
        sql: `${normalised.slice(0, clauseIdx)}AND account_id = ? ${normalised.slice(clauseIdx)}`,
        params: [accountId],
      };
    }
    return {
      sql: `${normalised} AND account_id = ?`,
      params: [accountId],
    };
  }

  // No outer WHERE — add WHERE account_id = ? before trailing clauses or at end
  const clauseIdx = findOuterClauseIndex(0);
  if (clauseIdx !== -1) {
    return {
      sql: `${normalised.slice(0, clauseIdx)}WHERE account_id = ? ${normalised.slice(clauseIdx)}`,
      params: [accountId],
    };
  }

  return {
    sql: `${normalised} WHERE account_id = ?`,
    params: [accountId],
  };
}

/**
 * Validates and truncates query results to a maximum number of rows.
 */
export function validateQueryResult(
  result: unknown[],
  maxRows: number = DEFAULT_MAX_ROWS,
): unknown[] {
  if (!Array.isArray(result)) {
    return [];
  }

  const effectiveMax = Math.min(Math.max(1, maxRows), DEFAULT_MAX_ROWS);
  return result.slice(0, effectiveMax);
}

/**
 * Logs an AI-generated SQL query for audit trail purposes.
 */
export function logAIQuery(
  accountId: string,
  naturalLanguage: string,
  generatedSQL: string,
  rowCount: number,
): void {
  logger.info('AI Query executed', {
    type: 'AI_QUERY_AUDIT',
    accountId,
    naturalLanguage: naturalLanguage.slice(0, 500),
    generatedSQL: generatedSQL.slice(0, 2000),
    rowCount,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Executes an AI-generated SQL query with full security checks.
 * This is a framework function — the actual DB execution must be provided.
 *
 * NOTE: This function validates and transforms the query.
 * The actual database execution should be wired up by the caller
 * using the project's existing DB connection (PostgreSQL pool).
 */
export async function executeAISafeQuery(req: AIQueryRequest): Promise<AIQueryResult> {
  const auditId = randomUUID();
  const { naturalLanguage, generatedSQL, accountId } = req;

  // 1. Safety check
  if (!isQuerySafe(generatedSQL)) {
    logger.error('Unsafe AI query blocked', {
      auditId,
      accountId,
      naturalLanguage: naturalLanguage.slice(0, 500),
      generatedSQL: generatedSQL.slice(0, 200),
    });
    throw new Error('AI query blocked: contains forbidden SQL keywords or is not a SELECT query');
  }

  // 2. Inject user filter for data isolation (parameterized)
  const { sql: filteredSQL, params } = injectUserFilter(generatedSQL, accountId);

  // 3. Execute query via PostgreSQL pool
  logger.info('Executing AI-safe query', {
    auditId,
    accountId,
    filteredSQL: filteredSQL.slice(0, 2000),
  });

  const pool = getPool();
  // Convert ? params to $1, $2... for PostgreSQL
  let paramIdx = 0;
  const pgSQL = filteredSQL.replace(/\?/g, () => `$${++paramIdx}`);
  const queryResult = await pool.query(pgSQL, params);
  const rawResult = queryResult.rows as Record<string, unknown>[];

  // 4. Validate and truncate results
  const validated = validateQueryResult(rawResult, DEFAULT_MAX_ROWS) as Record<string, unknown>[];
  const truncated = rawResult.length > DEFAULT_MAX_ROWS;

  // 5. Audit log
  logAIQuery(accountId, naturalLanguage, filteredSQL, validated.length);

  return {
    data: validated,
    rowCount: validated.length,
    truncated,
    auditId,
  };
}
