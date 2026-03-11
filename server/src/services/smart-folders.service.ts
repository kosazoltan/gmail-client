import { queryAll, queryOne, execute, runInTransaction } from '../db/index.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// --- Types ---

export interface SmartFolderRule {
  field:
    | 'from'
    | 'to'
    | 'subject'
    | 'labels'
    | 'has_attachments'
    | 'is_read'
    | 'date_age_days'
    | 'subject_or_snippet_keywords'
    | 'ai_tags_contains'
    | 'content_semantic'
    | 'unanswered';
  operator: 'contains' | 'equals' | 'not_contains' | 'greater_than' | 'less_than' | 'contains_any';
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

      case 'subject_or_snippet_keywords':
        if (rule.operator === 'contains_any' && rule.value) {
          const keywords = rule.value.split(/[,|]/).map((k) => k.trim()).filter(Boolean);
          if (keywords.length > 0) {
            const orParts = keywords.map(() => "(LOWER(COALESCE(subject,'') || ' ' || COALESCE(snippet,'')) LIKE ?)");
            conditions.push(`(${orParts.join(' OR ')})`);
            keywords.forEach((kw) => params.push(`%${kw.toLowerCase()}%`));
          }
        }
        break;

      case 'ai_tags_contains':
        if (rule.value) {
          const tag = rule.value.toLowerCase().trim();
          conditions.push("(ai_tags IS NOT NULL AND ai_tags != '' AND ai_tags LIKE ?)");
          params.push(`%"${tag}"%`);
        }
        break;

      case 'content_semantic': {
        const kind = rule.value.toLowerCase();
        if (kind === 'financial') {
          const kw = 'számla,invoice,fizetés,payment,bank,átutalás,receipt,nyugta,díj,költség,fizetendő,befizetés'.split(',');
          const orParts = kw.map(() => "(LOWER(COALESCE(subject,'') || ' ' || COALESCE(snippet,'')) LIKE ?)");
          orParts.push("(ai_tags IS NOT NULL AND ai_tags != '' AND ai_tags LIKE ?)");
          conditions.push(`(${orParts.join(' OR ')})`);
          kw.forEach((k) => params.push(`%${k}%`));
          params.push('%"financial"%');
        } else if (kind === 'legal') {
          const kw = 'jogi,jogász,ügyvéd,compliance,mnb,hatóság,contract,szerződés,gdpr,jog,vélemény,per,ítélet'.split(',');
          const orParts = kw.map(() => "(LOWER(COALESCE(subject,'') || ' ' || COALESCE(snippet,'')) LIKE ?)");
          orParts.push("(ai_tags IS NOT NULL AND ai_tags != '' AND ai_tags LIKE ?)");
          conditions.push(`(${orParts.join(' OR ')})`);
          kw.forEach((k) => params.push(`%${k}%`));
          params.push('%"legal"%');
        }
        break;
      }

      case 'unanswered': {
        // Levelek, ahol nincs válasz a threadben (SENT) a beérkezés után
        const days = parseInt(rule.value, 10) || 2;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        conditions.push(`date < ?`);
        params.push(cutoff);
        conditions.push(`(labels LIKE '%INBOX%' OR labels LIKE '%inbox%')`);
        conditions.push(`(labels NOT LIKE '%SENT%' AND labels NOT LIKE '%sent%')`);
        conditions.push(`(labels NOT LIKE '%TRASH%' AND labels NOT LIKE '%trash%')`);
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM emails reply
          WHERE reply.account_id = emails.account_id
            AND reply.thread_id = emails.thread_id
            AND (reply.labels LIKE '%SENT%' OR reply.labels LIKE '%sent%')
            AND reply.date > emails.date
        )`);
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

export async function getSmartFolders(accountId: string): Promise<SmartFolder[]> {
  const rows = await queryAll<SmartFolderRow>(
    'SELECT * FROM smart_folders WHERE account_id = ? ORDER BY sort_order, name',
    [accountId],
  );

  const folders = rows.map(row => rowToSmartFolder(row));
  for (const folder of folders) {
    try {
      const { sql, params } = buildWhereClause(folder.rules, accountId);
      const countResult = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM emails WHERE ${sql}`, params);
      folder.emailCount = countResult?.cnt || 0;
    } catch {
      folder.emailCount = 0;
    }
  }
  return folders;
}

export async function getSmartFolderById(folderId: string): Promise<SmartFolder | undefined> {
  const row = await queryOne<SmartFolderRow>('SELECT * FROM smart_folders WHERE id = ?', [folderId]);
  if (!row) return undefined;
  return rowToSmartFolder(row);
}

export async function getSmartFolderEmails(folderId: string, page = 1, limit = 50): Promise<{ emails: EmailRow[]; total: number }> {
  const folder = await getSmartFolderById(folderId);
  if (!folder) throw new Error('Smart folder nem található');

  const { sql, params } = buildWhereClause(folder.rules, folder.accountId);
  const offset = (page - 1) * limit;

  const emails = await queryAll<EmailRow>(
    `SELECT id, subject, from_email, from_name, to_email, snippet, date, is_read, is_starred, labels, has_attachments, thread_id
     FROM emails WHERE ${sql} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const countResult = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM emails WHERE ${sql}`, params);
  const total = countResult?.cnt || 0;

  return { emails, total };
}

export async function createSmartFolder(
  accountId: string,
  name: string,
  rules: SmartFolderRule[],
  icon = '📁',
  isSystem = false,
): Promise<SmartFolder> {
  const id = crypto.randomUUID();
  const now = Date.now();

  // Get next sort order
  const maxOrder = await queryOne<{ maxOrder: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM smart_folders WHERE account_id = ?',
    [accountId],
  );
  const sortOrder = (maxOrder?.maxOrder || 0) + 1;

  await execute(
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

export async function updateSmartFolder(
  folderId: string,
  updates: { name?: string; icon?: string; rules?: SmartFolderRule[]; sortOrder?: number },
): Promise<SmartFolder | undefined> {
  const existing = await getSmartFolderById(folderId);
  if (!existing) return undefined;
  if (existing.isSystem) throw new Error('Rendszermappa nem módosítható');

  const now = Date.now();
  const name = updates.name ?? existing.name;
  const icon = updates.icon ?? existing.icon;
  const rules = updates.rules ?? existing.rules;
  const sortOrder = updates.sortOrder ?? existing.sortOrder;

  await execute(
    'UPDATE smart_folders SET name = ?, icon = ?, rules = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    [name, icon, JSON.stringify(rules), sortOrder, now, folderId],
  );

  return { ...existing, name, icon, rules, sortOrder, updatedAt: now };
}

export async function deleteSmartFolder(folderId: string): Promise<boolean> {
  const existing = await getSmartFolderById(folderId);
  if (!existing) return false;
  if (existing.isSystem) throw new Error('Rendszermappa nem törölhető');

  await execute('DELETE FROM smart_folders WHERE id = ?', [folderId]);
  return true;
}

// --- Seed default smart folders ---

const UPGRADED_RULES: Record<string, SmartFolderRule[]> = {
  'Megválaszolatlan 48h+': [{ field: 'unanswered', operator: 'greater_than', value: '2' }],
  'Pénzügyi': [{ field: 'content_semantic', operator: 'equals', value: 'financial' }],
  'Jogi/Compliance': [{ field: 'content_semantic', operator: 'equals', value: 'legal' }],
};

export async function migrateSystemFolderRules(accountId: string): Promise<void> {
  for (const [name, rules] of Object.entries(UPGRADED_RULES)) {
    await execute(
      'UPDATE smart_folders SET rules = ?, updated_at = ? WHERE account_id = ? AND name = ? AND is_system = 1',
      [JSON.stringify(rules), Date.now(), accountId, name],
    );
  }
}

export async function seedDefaultSmartFolders(accountId: string): Promise<void> {
  const existing = await queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM smart_folders WHERE account_id = ?',
    [accountId],
  );

  if (existing && existing.cnt > 0) {
    await migrateSystemFolderRules(accountId);
    return;
  }

  logger.info(`Seeding default smart folders for account ${accountId}`);

  const defaults: Array<{ name: string; icon: string; rules: SmartFolderRule[] }> = [
    {
      name: 'Megválaszolatlan 48h+',
      icon: '⏰',
      rules: [
        { field: 'unanswered', operator: 'greater_than', value: '2' },
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
      rules: [{ field: 'content_semantic', operator: 'equals', value: 'financial' }],
    },
    {
      name: 'Jogi/Compliance',
      icon: '⚖️',
      rules: [{ field: 'content_semantic', operator: 'equals', value: 'legal' }],
    },
  ];

  await runInTransaction(async () => {
    for (let i = 0; i < defaults.length; i++) {
      const d = defaults[i];
      await createSmartFolder(accountId, d.name, d.rules, d.icon, true);
    }
  });
}
