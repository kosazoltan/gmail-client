import { execSync } from 'child_process';
import { queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

export interface AuditCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail?: string;
}

/**
 * Run static audit checks for ZMail.
 * Returns results for 6 checks.
 */
export async function runStaticAudit(): Promise<AuditCheck[]> {
  const results: AuditCheck[] = [];

  // 1. DB connection test
  try {
    await queryOne('SELECT 1');
    results.push({ name: 'db_connection', status: 'pass' });
  } catch (err) {
    results.push({ name: 'db_connection', status: 'fail', detail: String(err) });
  }

  // 2. Required env vars
  const missingEnvs: string[] = [];
  if (!process.env.DATABASE_URL) {
    missingEnvs.push('DATABASE_URL');
  }
  for (const k of ['ERRORLOG_HMAC_SECRET', 'JUNIOR_EMAIL_PASSWORD'] as const) {
    if (!process.env[k]) missingEnvs.push(k);
  }
  if (missingEnvs.length === 0) {
    results.push({ name: 'env_vars', status: 'pass' });
  } else {
    results.push({
      name: 'env_vars',
      status: process.env.NODE_ENV === 'production' ? 'fail' : 'warn',
      detail: `Missing: ${missingEnvs.join(', ')}`,
    });
  }

  // 3. TSC typecheck
  try {
    execSync('npx tsc --noEmit', { cwd: process.cwd(), stdio: 'pipe' });
    results.push({ name: 'tsc_typecheck', status: 'pass' });
  } catch (err) {
    const output = (err as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? String(err);
    results.push({ name: 'tsc_typecheck', status: 'fail', detail: output.slice(0, 500) });
  }

  // 4. No 'as any' usage
  try {
    const out = execSync('findstr /s /n "as any" src\\**\\*.ts', {
      cwd: process.cwd(),
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (out) {
      results.push({ name: 'no_as_any', status: 'warn', detail: out.slice(0, 300) });
    } else {
      results.push({ name: 'no_as_any', status: 'pass' });
    }
  } catch {
    results.push({ name: 'no_as_any', status: 'pass' });
  }

  // 5. No console.log (use logger)
  try {
    const out = execSync('findstr /s /n "console\\.log" src\\**\\*.ts', {
      cwd: process.cwd(),
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (out) {
      results.push({ name: 'no_console_log', status: 'warn', detail: out.slice(0, 300) });
    } else {
      results.push({ name: 'no_console_log', status: 'pass' });
    }
  } catch {
    results.push({ name: 'no_console_log', status: 'pass' });
  }

  // 6. uncaughtException handler registered
  const listenerCount = process.listenerCount('uncaughtException');
  results.push({
    name: 'uncaught_exception_handler',
    status: listenerCount > 0 ? 'pass' : 'warn',
    detail: `${listenerCount} listener(s) registered`,
  });

  // Log summary
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.name);
  if (failed.length > 0) {
    logger.warn(`[static-audit] FAILED checks: ${failed.join(', ')}`);
  } else {
    logger.info('[static-audit] All checks passed');
  }

  return results;
}
