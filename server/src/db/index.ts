import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

// Render Persistent Disk: DATABASE_URL=/data/gmail-client.db
// Lokális fejlesztés: DATABASE_URL=./data/gmail-client.db
const dbPath = process.env.DATABASE_URL || './data/gmail-client.db';
const dbDir = path.dirname(dbPath);

let _db: SqlJsDatabase;

// Adatbázis inicializálás (aszinkron, egyszer kell hívni)
export async function initializeDatabase(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  // Könyvtár létrehozása ha nem létezik
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Meglévő DB betöltése ha van
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  // Foreign keys engedélyezés
  _db.run('PRAGMA foreign_keys = ON;');

  // Táblák létrehozása
  _db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expiry INTEGER NOT NULL,
      history_id TEXT,
      last_sync_at INTEGER,
      created_at INTEGER NOT NULL,
      color TEXT DEFAULT '#3B82F6'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280',
      icon TEXT NOT NULL DEFAULT 'folder',
      is_system INTEGER NOT NULL DEFAULT 0,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_subject TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      thread_id TEXT,
      subject TEXT,
      from_email TEXT,
      from_name TEXT,
      to_email TEXT,
      cc_email TEXT,
      snippet TEXT,
      body TEXT,
      body_html TEXT,
      date INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      labels TEXT,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      category_id TEXT REFERENCES categories(id),
      topic_id TEXT REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      gmail_attachment_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorization_rules (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sender_groups (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      domain TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      messages_processed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      frequency INTEGER NOT NULL DEFAULT 1,
      last_used_at INTEGER NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(email, account_id)
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      icon TEXT DEFAULT 'search',
      color TEXT DEFAULT '#6B7280',
      use_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, name)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      shortcut TEXT,
      use_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, name)
    );

    CREATE TABLE IF NOT EXISTS snoozed_emails (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      snooze_until INTEGER NOT NULL,
      processing_instance TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      remind_at INTEGER NOT NULL,
      note TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS newsletter_senders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      sender_email TEXT NOT NULL,
      sender_name TEXT,
      is_newsletter INTEGER DEFAULT 1,
      is_muted INTEGER DEFAULT 0,
      email_count INTEGER DEFAULT 0,
      last_email_at INTEGER,
      UNIQUE(account_id, sender_email)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, endpoint)
    );

    CREATE TABLE IF NOT EXISTS pinned_emails (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      pinned_at INTEGER NOT NULL,
      UNIQUE(email_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT,
      updated_at INTEGER NOT NULL,
      UNIQUE(account_id, key)
    );

    CREATE TABLE IF NOT EXISTS scheduled_emails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT,
      subject TEXT,
      body TEXT,
      scheduled_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      processing_instance TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vip_senders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, email)
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT DEFAULT '{}',
      steps TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'running',
      trigger_email_id TEXT,
      steps_completed INTEGER NOT NULL DEFAULT 0,
      result TEXT DEFAULT '{}',
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      context_type TEXT,
      context_data TEXT DEFAULT '{}',
      messages TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS smart_folders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      rules TEXT NOT NULL,
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      due_date INTEGER,
      is_done INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS detected_tasks (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      thread_id TEXT,
      subject TEXT,
      from_email TEXT,
      from_name TEXT,
      email_date INTEGER,
      detection_type TEXT NOT NULL,
      reason TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      snoozed_until INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  // Indexek
  _db.run(`
    CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
    CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
    CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category_id);
    CREATE INDEX IF NOT EXISTS idx_emails_topic ON emails(topic_id);
    CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
    CREATE INDEX IF NOT EXISTS idx_sender_groups_account ON sender_groups(account_id);
    CREATE INDEX IF NOT EXISTS idx_sender_groups_email ON sender_groups(email);
    CREATE INDEX IF NOT EXISTS idx_categories_account ON categories(account_id);
    CREATE INDEX IF NOT EXISTS idx_topics_account ON topics(account_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_frequency ON contacts(frequency DESC);
    CREATE INDEX IF NOT EXISTS idx_saved_searches_account ON saved_searches(account_id);
    CREATE INDEX IF NOT EXISTS idx_templates_account ON templates(account_id);
    CREATE INDEX IF NOT EXISTS idx_snoozed_account ON snoozed_emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_snoozed_until ON snoozed_emails(snooze_until);
    CREATE INDEX IF NOT EXISTS idx_reminders_account ON reminders(account_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_newsletter_senders_account ON newsletter_senders(account_id);
    CREATE INDEX IF NOT EXISTS idx_pinned_emails_account ON pinned_emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_pinned_emails_email ON pinned_emails(email_id);
    CREATE INDEX IF NOT EXISTS idx_user_settings_account ON user_settings(account_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_emails_account ON scheduled_emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_vip_senders_account ON vip_senders(account_id);

    -- Workflow indexek
    CREATE INDEX IF NOT EXISTS idx_workflows_account ON workflows(account_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
    CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_account ON workflow_runs(account_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_account ON ai_conversations(account_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);

    -- Smart folders & action items indexek
    CREATE INDEX IF NOT EXISTS idx_smart_folders_account ON smart_folders(account_id);
    CREATE INDEX IF NOT EXISTS idx_smart_folders_sort ON smart_folders(sort_order);
    CREATE INDEX IF NOT EXISTS idx_action_items_email ON action_items(email_id);
    CREATE INDEX IF NOT EXISTS idx_action_items_account ON action_items(account_id);
    CREATE INDEX IF NOT EXISTS idx_action_items_done ON action_items(is_done);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at);

    -- Detected tasks indexek
    CREATE INDEX IF NOT EXISTS idx_detected_tasks_account ON detected_tasks(account_id, status);
    CREATE INDEX IF NOT EXISTS idx_detected_tasks_email ON detected_tasks(email_id);

    -- Extra indexek a teljesítmény javításához
    CREATE INDEX IF NOT EXISTS idx_emails_account_date ON emails(account_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
    CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject);
    CREATE INDEX IF NOT EXISTS idx_emails_starred ON emails(is_starred);
    CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);

    -- Keresési indexek - COLLATE NOCASE a case-insensitive kereséshez
    CREATE INDEX IF NOT EXISTS idx_emails_search_subject ON emails(subject COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_emails_search_from_email ON emails(from_email COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_emails_search_from_name ON emails(from_name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_emails_search_body ON emails(body COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_emails_search_snippet ON emails(snippet COLLATE NOCASE);
  `);

  // Add undo send columns to scheduled_emails (safe: ALTER TABLE IF NOT EXISTS not supported,
  // so we check column existence via pragma)
  try {
    const cols = _db.exec("PRAGMA table_info(scheduled_emails)");
    const colNames = cols.length > 0 ? cols[0].values.map((row: unknown[]) => row[1] as string) : [];
    if (!colNames.includes('in_reply_to')) {
      _db.run("ALTER TABLE scheduled_emails ADD COLUMN in_reply_to TEXT");
    }
    if (!colNames.includes('thread_id')) {
      _db.run("ALTER TABLE scheduled_emails ADD COLUMN thread_id TEXT");
    }
    if (!colNames.includes('attachments_json')) {
      _db.run("ALTER TABLE scheduled_emails ADD COLUMN attachments_json TEXT");
    }
    if (!colNames.includes('is_undo_send')) {
      _db.run("ALTER TABLE scheduled_emails ADD COLUMN is_undo_send INTEGER DEFAULT 0");
    }
  } catch (err) {
    logger.error('Failed to add undo send columns:', err);
  }

  // Add user-category columns to categories table + email_categories join table
  try {
    const catCols = _db.exec("PRAGMA table_info(categories)");
    const catColNames = catCols.length > 0 ? catCols[0].values.map((row: unknown[]) => row[1] as string) : [];
    if (!catColNames.includes('description')) {
      _db.run("ALTER TABLE categories ADD COLUMN description TEXT");
    }
    if (!catColNames.includes('sort_order')) {
      _db.run("ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0");
    }
    if (!catColNames.includes('created_at')) {
      _db.run("ALTER TABLE categories ADD COLUMN created_at INTEGER DEFAULT 0");
    }

    // Email-category join table for user-created categories
    _db.run(`
      CREATE TABLE IF NOT EXISTS email_categories (
        email_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        PRIMARY KEY (email_id, category_id)
      )
    `);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_email_categories_category ON email_categories(category_id)`);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_email_categories_account ON email_categories(account_id)`);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_email_categories_email ON email_categories(email_id)`);
  } catch (err) {
    logger.error('Failed to add category migration columns:', err);
  }

  logger.info('Adatbázis inicializálva.');
  return _db;
}

// Szinkron DB hozzáférés (az initializeDatabase után)
export function getDb(): SqlJsDatabase {
  if (!_db)
    throw new Error(
      'Az adatbázis még nincs inicializálva! Hívd meg az initializeDatabase()-t először.',
    );
  return _db;
}

// DB mentése fájlba
export function saveDatabase() {
  if (!_db) return;
  try {
    const data = _db.export();
    const buffer = Buffer.from(data);
    // Write to temp file first, then rename for atomicity
    const tmpPath = dbPath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);
  } catch (err) {
    logger.error('Database save failed:', err);
    // Clean up temp file if it exists
    try {
      const tmpPath = dbPath + '.tmp';
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Automatikus mentés - 30 másodpercenként
let saveInterval: NodeJS.Timeout | null = null;

// Debounced save - megakadályozza a túl gyakori fájlba írást
let pendingSave: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY_MS = 1000; // 1 másodperc várakozás az utolsó írás után

function debouncedSave() {
  // Töröljük a korábbi pending save-et
  if (pendingSave) {
    clearTimeout(pendingSave);
  }
  // Beállítunk egy újat
  pendingSave = setTimeout(() => {
    try {
      saveDatabase();
    } catch (err) {
      logger.error('Debounced save failed:', err);
    }
    pendingSave = null;
  }, DEBOUNCE_DELAY_MS);
}

export function startAutoSave() {
  if (saveInterval) return;
  saveInterval = setInterval(() => {
    saveDatabase();
  }, 30000);
}

export function stopAutoSave() {
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  // Pending save törlése és azonnali mentés
  if (pendingSave) {
    clearTimeout(pendingSave);
    pendingSave = null;
  }
  saveDatabase(); // Utolsó mentés
}

// Segéd: egy sor lekérése
export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) {
      return stmt.getAsObject() as T;
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

// Segéd: több sor lekérése
export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

// Segéd: INSERT/UPDATE/DELETE
export function execute(sql: string, params: unknown[] = []) {
  const db = getDb();
  db.run(sql, params);
  debouncedSave(); // Debounced mentés a race condition elkerüléséhez
}

// Transaction wrapper for atomic multi-step operations
export function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    debouncedSave();
    return result;
  } catch (error) {
    try {
      db.run('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Transaction rollback failed:', rollbackError);
    }
    throw error;
  }
}

// Async transaction wrapper for operations with async calls
export async function runInTransactionAsync<T>(fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    const result = await fn();
    db.run('COMMIT');
    debouncedSave();
    return result;
  } catch (error) {
    try {
      db.run('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Transaction rollback failed:', rollbackError);
    }
    throw error;
  }
}
