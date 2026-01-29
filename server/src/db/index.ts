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
  saveDatabase();
}
