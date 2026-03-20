import { v4 as uuidv4 } from 'uuid';
import { execute, queryAll, queryOne } from '../db/index.js';

export interface InboxRule {
  id: string;
  account_id: string;
  name: string;
  conditions: string;
  actions: string;
  is_active: number;
  sort_order: number;
  created_at: number;
}

export async function ensureInboxRulesTable(): Promise<void> {
  await execute(`CREATE TABLE IF NOT EXISTS inbox_rules (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  )`);
}

export async function listInboxRules(accountId: string): Promise<InboxRule[]> {
  await ensureInboxRulesTable();
  return queryAll<InboxRule>(
    'SELECT * FROM inbox_rules WHERE account_id = ? ORDER BY sort_order ASC, created_at ASC',
    [accountId],
  );
}

export async function createInboxRule(
  accountId: string,
  data: {
    name: string;
    conditions: unknown;
    actions: unknown;
    is_active?: number;
    sort_order?: number;
  },
): Promise<InboxRule> {
  await ensureInboxRulesTable();
  const row: InboxRule = {
    id: uuidv4(),
    account_id: accountId,
    name: data.name,
    conditions: JSON.stringify(data.conditions ?? {}),
    actions: JSON.stringify(data.actions ?? {}),
    is_active: data.is_active ?? 1,
    sort_order: data.sort_order ?? 0,
    created_at: Date.now(),
  };
  await execute(
    'INSERT INTO inbox_rules (id, account_id, name, conditions, actions, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      row.id,
      row.account_id,
      row.name,
      row.conditions,
      row.actions,
      row.is_active,
      row.sort_order,
      row.created_at,
    ],
  );
  return row;
}

export async function updateInboxRule(
  accountId: string,
  id: string,
  patch: Partial<{
    name: string;
    conditions: unknown;
    actions: unknown;
    is_active: number;
    sort_order: number;
  }>,
): Promise<InboxRule | null> {
  const existing = await queryOne<InboxRule>(
    'SELECT * FROM inbox_rules WHERE id = ? AND account_id = ?',
    [id, accountId],
  );
  if (!existing) return null;
  const next = {
    ...existing,
    ...patch,
    conditions:
      patch.conditions !== undefined ? JSON.stringify(patch.conditions) : existing.conditions,
    actions: patch.actions !== undefined ? JSON.stringify(patch.actions) : existing.actions,
  } as InboxRule;
  await execute(
    'UPDATE inbox_rules SET name = ?, conditions = ?, actions = ?, is_active = ?, sort_order = ? WHERE id = ? AND account_id = ?',
    [next.name, next.conditions, next.actions, next.is_active, next.sort_order, id, accountId],
  );
  return next;
}

export async function deleteInboxRule(accountId: string, id: string): Promise<void> {
  await execute('DELETE FROM inbox_rules WHERE id = ? AND account_id = ?', [id, accountId]);
}
