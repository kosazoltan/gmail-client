import { execute, queryAll } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

export type AuditEventType =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'bulk_delete'
  | 'inbox_rule_created'
  | 'inbox_rule_updated'
  | 'settings_changed'
  | 'failed_auth_attempt'
  /** Kritikus percenkénti jobok SLA túllépés — /api/health fail-closed */
  | 'system_watchdog_overdue';

export interface AuditLogEntry {
  id: string;
  event_type: AuditEventType;
  account_id: string | null;
  details: string;
  ip: string | null;
  created_at: number;
}

export async function ensureAuditLogTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      account_id TEXT,
      details TEXT,
      ip TEXT,
      created_at BIGINT NOT NULL
    )
  `);
}

export async function logAuditEvent(params: {
  eventType: AuditEventType;
  accountId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await execute(
    'INSERT INTO audit_log (id, event_type, account_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      uuidv4(),
      params.eventType,
      params.accountId || null,
      JSON.stringify(params.details || {}),
      params.ip || null,
      Date.now(),
    ],
  );
}

export async function getRecentAuditEvents(
  accountId: string,
  limit = 50,
): Promise<AuditLogEntry[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return queryAll<AuditLogEntry>(
    'SELECT id, event_type, account_id, details, ip, created_at FROM audit_log WHERE account_id = ? ORDER BY created_at DESC LIMIT ?',
    [accountId, safeLimit],
  );
}
