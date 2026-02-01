import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

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
      created_at INTEGER NOT NULL
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

  console.log('Adatbázis inicializálva.');
  return _db;
}

// Szinkron DB hozzáférés (az initializeDatabase után)
export function getDb(): SqlJsDatabase {
  if (!_db) throw new Error('Az adatbázis még nincs inicializálva! Hívd meg az initializeDatabase()-t először.');
  return _db;
}

// DB mentése fájlba
export function saveDatabase() {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
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
    saveDatabase();
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
export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject() as T;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

// Segéd: több sor lekérése
export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Segéd: INSERT/UPDATE/DELETE
export function execute(sql: string, params: unknown[] = []) {
  const db = getDb();
  db.run(sql, params);
  debouncedSave(); // Debounced mentés a race condition elkerüléséhez
}
