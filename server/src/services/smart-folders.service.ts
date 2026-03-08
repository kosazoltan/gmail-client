import { queryAll, queryOne, execute, runInTransaction } from '../db/index.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// --- Types ---

export interface SmartFolderRule {
  field: 'from' | 'to' | 'subject' | 'labels' | 'has_attachments' | 'is_read' | 'date_age_days';
  operator: 'contains' | 'equals' | 'not_contains' | 'greater_than' | 'less_than';
  value: string;
}

export interface SmartFolder {
  id: string;
  accountId: string;
  name: string;
  icon: string;
  rules: SmartFolderRule[];
  isSystem: boolean;
  sortOrder: number;
  emailCount?: number;
  createdAt: number;
  updatedAt: number;
}

interface SmartFolderRow {
  id: string;
  account_id: string;
  name: string;
  icon: string;
  rules: string;
  is_system: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

interface EmailRow {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  snippet: string | null;
  date: number;
  is_read: number;
  is_starred: number;
  labels: string | null;
  has_attachments: number;
  thread_id: string | null;
}

// --- Helpers ---

function rowToSmartFolder(row: SmartFolderRow): SmartFolder {
  let rules: SmartFolderRule[] = [];
  try {
    rules = JSON.parse(row.rules);
  } catch {
    logger.warn(`Invalid rules JSON for smart folder ${row.id}`);
  }
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    icon: row.icon,
    rules,
    isSystem: row.is_system === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhereClause(rules: SmartFolderRule[], accountId: string): { sql: string; params: unknown[] } {
  const conditions: string[] = ['account_id = ?', "labels NOT LIKE '%TRASH%'"];
  const params: unknown[] = [accountId];

  for (const rule of rules) {
    switch (rule.field) {
      case 'from':
        if (rule.operator === 'contains') {
          conditions.push('(from_email LIKE ? COLLATE NOCASE OR from_name LIKE ? COLLATE NOCASE)');
          params.push(`%${rule.value}%`, `%${rule.value}%`);
        } else if (rule.operator === 'equals') {
          conditions.push('from_email = ? COLLATE NOCASE');
          params.push(rule.value);
        } else if (rule.operator === 'not_contains') {
          conditions.push('from_email NOT LIKE ? COLLATE NOCASE AND from_name NOT LIKE ? COLLATE NOCASE');
          params.push(`%${rule.value}%`, `%${rule.value}%`);
        }
        break;

      case 'to':
        if (rule.operator === 'contains') {
          conditions.push('to_email LIKE ? COLLATE NOCASE');
          params.push(`%${rule.value}%`);
        }
        break;

      case 'subject':
        if (rule.operator === 'contains') {
          conditions.push('subject LIKE ? COLLATE NOCASE');
          params.push(`%${rule.value}%`);
        } else if (rule.operator === 'not_contains') {
          conditions.push('(subject NOT LIKE ? COLLATE NOCASE OR subject IS NULL)');
          params.push(`%${rule.value}%`);
        }
        break;

      case 'labels':
        if (rule.operator === 'contains') {
          conditions.push('labels LIKE ?');
          params.push(`%${rule.value}%`);
        } else if (rule.operator === 'not_contains') {
          conditions.push('(labels NOT LIKE ? OR labels IS NULL)');
          params.push(`%${rule.value}%`);
        }
        break;

      case 'has_attachments':
        conditions.push(`has_attachments = ?`);
        params.push(rule.value === 'true' || rule.value === '1' ? 1 : 0);
        break;

      case 'is_read':
        conditions.push(`is_read = ?`);
        params.push(rule.value === 'true' || rule.value === '1' ? 1 : 0);
        break;

      case 'date_age_days': {
        const days = parseInt(rule.value, 10);
        if (!isNaN(days)) {
          const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
          if (rule.operator === 'greater_than') {
            // Older than N days
            conditions.push('date < ?');
            params.push(cutoff);
          } else if (rule.operator === 'less_than') {
            // Newer than N days
            conditions.push('date >= ?');
            params.push(cutoff);
          }
        }
        break;
      }
    }
  }

  return {
    sql: conditions.join(' AND '),
    params,
  };
}

// --- CRUD ---

export function getSmartFolders(accountId: string): SmartFolder[] {
  const rows = queryAll<SmartFolderRow>(
    'SELECT * FROM smart_folders WHERE account_id = ? ORDER BY sort_order, name',
    [accountId],
  );

  return rows.map(row => {
    const folder = rowToSmartFolder(row);
    // Count emails matching rules
    try {
      const { sql, params } = buildWhereClause(folder.rules, accountId);
      const countResult = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM emails WHERE ${sql}`, params);
      folder.emailCount = countResult?.cnt || 0;
    } catch {
      folder.emailCount = 0;
    }
    return folder;
  });
}

export function getSmartFolderById(folderId: string): SmartFolder | undefined {
  const row = queryOne<SmartFolderRow>('SELECT * FROM smart_folders WHERE id = ?', [folderId]);
  if (!row) return undefined;
  return rowToSmartFolder(row);
}

export function getSmartFolderEmails(folderId: string, page = 1, limit = 50): { emails: EmailRow[]; total: number } {
  const folder = getSmartFolderById(folderId);
  if (!folder) throw new Error('Smart folder nem található');

  const { sql, params } = buildWhereClause(folder.rules, folder.accountId);
  const offset = (page - 1) * limit;

  const emails = queryAll<EmailRow>(
    `SELECT id, subject, from_email, from_name, to_email, snippet, date, is_read, is_starred, labels, has_attachments, thread_id
     FROM emails WHERE ${sql} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const countResult = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM emails WHERE ${sql}`, params);
  const total = countResult?.cnt || 0;

  return { emails, total };
}

export function createSmartFolder(
  accountId: string,
  name: string,
  rules: SmartFolderRule[],
  icon = '📁',
  isSystem = false,
): SmartFolder {
  const id = crypto.randomUUID();
  const now = Date.now();

  // Get next sort order
  const maxOrder = queryOne<{ maxOrder: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM smart_folders WHERE account_id = ?',
    [accountId],
  );
  const sortOrder = (maxOrder?.maxOrder || 0) + 1;

  execute(
    'INSERT INTO smart_folders (id, account_id, name, icon, rules, is_system, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, accountId, name, icon, JSON.stringify(rules), isSystem ? 1 : 0, sortOrder, now, now],
  );

  return {
    id,
    accountId,
    name,
    icon,
    rules,
    isSystem,
    sortOrder,
    emailCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateSmartFolder(
  folderId: string,
  updates: { name?: string; icon?: string; rules?: SmartFolderRule[]; sortOrder?: number },
): SmartFolder | undefined {
  const existing = getSmartFolderById(folderId);
  if (!existing) return undefined;
  if (existing.isSystem) throw new Error('Rendszermappa nem módosítható');

  const now = Date.now();
  const name = updates.name ?? existing.name;
  const icon = updates.icon ?? existing.icon;
  const rules = updates.rules ?? existing.rules;
  const sortOrder = updates.sortOrder ?? existing.sortOrder;

  execute(
    'UPDATE smart_folders SET name = ?, icon = ?, rules = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    [name, icon, JSON.stringify(rules), sortOrder, now, folderId],
  );

  return { ...existing, name, icon, rules, sortOrder, updatedAt: now };
}

export function deleteSmartFolder(folderId: string): boolean {
  const existing = getSmartFolderById(folderId);
  if (!existing) return false;
  if (existing.isSystem) throw new Error('Rendszermappa nem törölhető');

  execute('DELETE FROM smart_folders WHERE id = ?', [folderId]);
  return true;
}

// --- Seed default smart folders ---

export function seedDefaultSmartFolders(accountId: string): void {
  const existing = queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM smart_folders WHERE account_id = ?',
    [accountId],
  );

  if (existing && existing.cnt > 0) return; // Already seeded

  logger.info(`Seeding default smart folders for account ${accountId}`);

  const defaults: Array<{ name: string; icon: string; rules: SmartFolderRule[] }> = [
    {
      name: 'Megválaszolatlan 48h+',
      icon: '⏰',
      rules: [
        { field: 'is_read', operator: 'equals', value: '0' },
        { field: 'date_age_days', operator: 'greater_than', value: '2' },
      ],
    },
    {
      name: 'Csatolmányos',
      icon: '📎',
      rules: [
        { field: 'has_attachments', operator: 'equals', value: '1' },
      ],
    },
    {
      name: 'Pénzügyi',
      icon: '💰',
      rules: [
        { field: 'subject', operator: 'contains', value: 'számla' },
      ],
    },
    {
      name: 'Jogi/Compliance',
      icon: '⚖️',
      rules: [
        { field: 'from', operator: 'contains', value: 'mnb' },
      ],
    },
  ];

  runInTransaction(() => {
    for (let i = 0; i < defaults.length; i++) {
      const d = defaults[i];
      createSmartFolder(accountId, d.name, d.rules, d.icon, true);
    }
  });
}
