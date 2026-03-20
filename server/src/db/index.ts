import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import logger from '../utils/logger.js';

const { Pool, types } = pg;

// PostgreSQL BIGINT (OID 20) returns strings by default — parse as numbers
// Safe for epoch ms timestamps (max ~8.6e15, well within Number.MAX_SAFE_INTEGER 9e15)
types.setTypeParser(20, (val: string) => {
  const num = Number(val);
  if (num > Number.MAX_SAFE_INTEGER) {
    logger.warn(`BIGINT value exceeds MAX_SAFE_INTEGER: ${val}`);
    return val; // Keep as string for safety
  }
  return num;
});

// Fail-closed: Database URL is required (supports both env var names)
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  logger.error('FATAL: NEON_DATABASE_URL or DATABASE_URL environment variable is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err);
});

// Transaction context via AsyncLocalStorage — queryOne/queryAll/execute
// automatically use the transaction client when inside runInTransaction()
const txStorage = new AsyncLocalStorage<pg.PoolClient>();

/**
 * Convert SQLite-style SQL to PostgreSQL:
 * 1. ? → $1, $2, $3...
 * 2. LIKE/NOT LIKE $N COLLATE NOCASE → ILIKE/NOT ILIKE $N
 * 3. = $N COLLATE NOCASE → ILIKE $N
 * 4. Strip remaining COLLATE NOCASE
 */
function convertSql(sql: string): string {
  let i = 0;
  let result = sql.replace(/\?/g, () => `$${++i}`);
  // NOT LIKE before LIKE (more specific first)
  result = result.replace(/\bNOT\s+LIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'NOT ILIKE $1');
  result = result.replace(/\bLIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/=\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/\s+COLLATE\s+NOCASE/gi, '');
  return result;
}

function getTarget(): pg.Pool | pg.PoolClient {
  return txStorage.getStore() || pool;
}

/** Get the raw pool for direct access (vacuum, AI queries, etc.) */
export function getPool(): pg.Pool {
  return pool;
}

/** Query one row */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const target = getTarget();
  const result = await target.query(convertSql(sql), params);
  return result.rows[0] as T | undefined;
}

/** Query all rows */
export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const target = getTarget();
  const result = await target.query(convertSql(sql), params);
  return result.rows as T[];
}

/** Execute INSERT/UPDATE/DELETE */
export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const target = getTarget();
  await target.query(convertSql(sql), params);
}

/**
 * Transaction wrapper — uses AsyncLocalStorage so queryOne/queryAll/execute
 * inside the callback automatically use the transaction client.
 */
export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStorage.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      logger.error('Transaction rollback failed:', rbErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Alias for backward compatibility — same as runInTransaction (all async now) */
export const runInTransactionAsync = runInTransaction;

/** Initialize database schema (PostgreSQL DDL) */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Tables
    await client.query(`
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
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL DEFAULT 0
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
        expire BIGINT NOT NULL
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
        processing_started_at BIGINT,
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
        trigger_email_id TEXT REFERENCES emails(id) ON DELETE SET NULL,
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
        due_date BIGINT,
        source_quote TEXT,
        priority TEXT DEFAULT 'medium',
        confidence REAL DEFAULT 0.5,
        suggested_action TEXT,
        workflow_origin TEXT,
        calendar_event_id TEXT,
        is_done INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      );

      CREATE TABLE IF NOT EXISTS email_event_candidates (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        thread_id TEXT,
        title TEXT NOT NULL,
        event_type TEXT NOT NULL,
        start_at BIGINT NOT NULL,
        end_at BIGINT,
        is_all_day INTEGER DEFAULT 0,
        timezone TEXT DEFAULT 'Europe/Budapest',
        location TEXT,
        participants_json TEXT,
        source_quote TEXT,
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'suggested',
        google_event_id TEXT,
        google_event_link TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        UNIQUE(email_id, title, start_at)
      );

      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS detected_tasks (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        thread_id TEXT,
        subject TEXT,
        from_email TEXT,
        from_name TEXT,
        email_date BIGINT,
        detection_type TEXT NOT NULL,
        reason TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        snoozed_until BIGINT,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      );

      CREATE TABLE IF NOT EXISTS daily_briefs (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        summary TEXT NOT NULL,
        highlights TEXT,
        action_items_count INTEGER DEFAULT 0,
        urgent_count INTEGER DEFAULT 0,
        total_emails INTEGER DEFAULT 0,
        generated_at INTEGER NOT NULL,
        UNIQUE(account_id, date)
      );

      CREATE TABLE IF NOT EXISTS email_categories (
        email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        PRIMARY KEY (email_id, category_id)
      );
    `);

    // Startup-critical legacy column backfills must run before index creation.
    // Older production schemas can miss these fields even though the current
    // table definitions and startup queries already depend on them.
    await client.query(`
      ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
      ALTER TABLE smart_folders ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
      ALTER TABLE detected_tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
      ALTER TABLE detected_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
      ALTER TABLE detected_tasks ADD COLUMN IF NOT EXISTS snoozed_until BIGINT;
      ALTER TABLE detected_tasks ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
      ALTER TABLE email_event_candidates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'suggested';
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS ai_tags TEXT;
      ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS generated_at BIGINT DEFAULT 0;
      ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS metadata TEXT;
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_id_account_unique ON emails(id, account_id);
      CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
      CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
      CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category_id);
      CREATE INDEX IF NOT EXISTS idx_emails_topic ON emails(topic_id);
      CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
      CREATE INDEX IF NOT EXISTS idx_sender_groups_account ON sender_groups(account_id);
      CREATE INDEX IF NOT EXISTS idx_sender_groups_email ON sender_groups(email);
      CREATE INDEX IF NOT EXISTS idx_categories_account ON categories(account_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_id_account_unique ON categories(id, account_id);
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

      CREATE INDEX IF NOT EXISTS idx_workflows_account ON workflows(account_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
      CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_account ON workflow_runs(account_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at);
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_account ON ai_conversations(account_id);
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_smart_folders_account ON smart_folders(account_id);
      CREATE INDEX IF NOT EXISTS idx_smart_folders_sort ON smart_folders(sort_order);
      CREATE INDEX IF NOT EXISTS idx_action_items_email ON action_items(email_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_account ON action_items(account_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_done ON action_items(is_done);
      CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items(due_date);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at);

      CREATE INDEX IF NOT EXISTS idx_detected_tasks_account ON detected_tasks(account_id, status);
      CREATE INDEX IF NOT EXISTS idx_detected_tasks_email ON detected_tasks(email_id);
      CREATE INDEX IF NOT EXISTS idx_detected_tasks_status_snoozed ON detected_tasks(account_id, status, snoozed_until);

      CREATE INDEX IF NOT EXISTS idx_event_candidates_account ON email_event_candidates(account_id);
      CREATE INDEX IF NOT EXISTS idx_event_candidates_email ON email_event_candidates(email_id);
      CREATE INDEX IF NOT EXISTS idx_event_candidates_start ON email_event_candidates(start_at);
      CREATE INDEX IF NOT EXISTS idx_event_candidates_status ON email_event_candidates(status);
      CREATE INDEX IF NOT EXISTS idx_event_candidates_account_status_start ON email_event_candidates(account_id, status, start_at);

      CREATE INDEX IF NOT EXISTS idx_daily_briefs_account_date ON daily_briefs(account_id, date DESC);

      CREATE INDEX IF NOT EXISTS idx_emails_account_date ON emails(account_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
      CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject);
      CREATE INDEX IF NOT EXISTS idx_emails_starred ON emails(is_starred);
      CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);

      CREATE INDEX IF NOT EXISTS idx_email_categories_category ON email_categories(category_id);
      CREATE INDEX IF NOT EXISTS idx_email_categories_account ON email_categories(account_id);
      CREATE INDEX IF NOT EXISTS idx_email_categories_email ON email_categories(email_id);
    `);

    // Column migrations (PostgreSQL ADD COLUMN IF NOT EXISTS)
    await client.query(`
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS bcc_addresses TEXT;
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS in_reply_to TEXT;
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS thread_id TEXT;
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS attachments_json TEXT;
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS is_undo_send INTEGER DEFAULT 0;
      ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS processing_started_at BIGINT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT 0;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS source_quote TEXT;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS confidence REAL DEFAULT 0.5;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS suggested_action TEXT;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS workflow_origin TEXT;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
      ALTER TABLE action_items ADD COLUMN IF NOT EXISTS updated_at BIGINT;
      ALTER TABLE email_event_candidates ADD COLUMN IF NOT EXISTS google_event_link TEXT;

    `);

    // Create indexes for columns that may have been added by migrations above.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority);
    `);

    // Fix INTEGER → BIGINT for epoch ms columns (INTEGER max 2.1B, Date.now() ~1.77T)
    const bigintMigrations = [
      'ALTER TABLE sessions ALTER COLUMN expire TYPE BIGINT',
      'ALTER TABLE accounts ALTER COLUMN token_expiry TYPE BIGINT',
      'ALTER TABLE accounts ALTER COLUMN last_sync_at TYPE BIGINT',
      'ALTER TABLE accounts ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE emails ALTER COLUMN date TYPE BIGINT',
      'ALTER TABLE topics ALTER COLUMN last_message_at TYPE BIGINT',
      'ALTER TABLE sender_groups ALTER COLUMN last_message_at TYPE BIGINT',
      'ALTER TABLE sync_log ALTER COLUMN started_at TYPE BIGINT',
      'ALTER TABLE sync_log ALTER COLUMN completed_at TYPE BIGINT',
      'ALTER TABLE contacts ALTER COLUMN last_used_at TYPE BIGINT',
      'ALTER TABLE saved_searches ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE templates ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE snoozed_emails ALTER COLUMN snooze_until TYPE BIGINT',
      'ALTER TABLE snoozed_emails ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE reminders ALTER COLUMN remind_at TYPE BIGINT',
      'ALTER TABLE reminders ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE newsletter_senders ALTER COLUMN last_email_at TYPE BIGINT',
      'ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE pinned_emails ALTER COLUMN pinned_at TYPE BIGINT',
      'ALTER TABLE user_settings ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE scheduled_emails ALTER COLUMN scheduled_at TYPE BIGINT',
      'ALTER TABLE scheduled_emails ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE vip_senders ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE workflows ALTER COLUMN last_run_at TYPE BIGINT',
      'ALTER TABLE workflows ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE workflows ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE workflow_runs ALTER COLUMN started_at TYPE BIGINT',
      'ALTER TABLE workflow_runs ALTER COLUMN completed_at TYPE BIGINT',
      'ALTER TABLE ai_conversations ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE ai_conversations ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE smart_folders ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE smart_folders ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE action_items ALTER COLUMN due_date TYPE BIGINT',
      'ALTER TABLE action_items ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE action_items ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE ai_messages ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE daily_briefs ALTER COLUMN generated_at TYPE BIGINT',
      'ALTER TABLE categories ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE detected_tasks ALTER COLUMN email_date TYPE BIGINT',
      'ALTER TABLE detected_tasks ALTER COLUMN snoozed_until TYPE BIGINT',
      'ALTER TABLE detected_tasks ALTER COLUMN created_at TYPE BIGINT',
      'ALTER TABLE detected_tasks ALTER COLUMN updated_at TYPE BIGINT',
      'ALTER TABLE email_categories ALTER COLUMN created_at TYPE BIGINT',
    ];
    for (const sql of bigintMigrations) {
      try {
        await client.query(sql);
      } catch (err) {
        // Already BIGINT or column doesn't exist — safe to ignore
        logger.debug(`BIGINT migration skipped: ${sql} — ${(err as Error).message}`);
      }
    }

    // Clean mismatched account-linked records before composite FK migrations
    try {
      await client.query(`
        DELETE FROM action_items ai
        WHERE NOT EXISTS (
          SELECT 1 FROM emails e WHERE e.id = ai.email_id AND e.account_id = ai.account_id
        );
        DELETE FROM detected_tasks dt
        WHERE NOT EXISTS (
          SELECT 1 FROM emails e WHERE e.id = dt.email_id AND e.account_id = dt.account_id
        );
        DELETE FROM email_event_candidates ec
        WHERE NOT EXISTS (
          SELECT 1 FROM emails e WHERE e.id = ec.email_id AND e.account_id = ec.account_id
        );
        DELETE FROM email_categories ec
        WHERE NOT EXISTS (
          SELECT 1 FROM emails e WHERE e.id = ec.email_id AND e.account_id = ec.account_id
        );
        DELETE FROM email_categories ec
        WHERE NOT EXISTS (
          SELECT 1 FROM categories c WHERE c.id = ec.category_id AND c.account_id = ec.account_id
        );
      `);
    } catch (err) {
      logger.debug(`Composite FK cleanup skipped: ${(err as Error).message}`);
    }

    // FK migrations for existing tables (idempotent — skips if constraint already exists)
    const fkMigrations = [
      // detected_tasks: add FK to accounts and emails
      `DO $$ BEGIN
        ALTER TABLE detected_tasks ADD CONSTRAINT fk_detected_tasks_account
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE detected_tasks ADD CONSTRAINT fk_detected_tasks_email
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE detected_tasks ADD CONSTRAINT fk_detected_tasks_email_account
          FOREIGN KEY (email_id, account_id) REFERENCES emails(id, account_id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE action_items ADD CONSTRAINT fk_action_items_email_account
          FOREIGN KEY (email_id, account_id) REFERENCES emails(id, account_id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE email_event_candidates ADD CONSTRAINT fk_event_candidates_email_account
          FOREIGN KEY (email_id, account_id) REFERENCES emails(id, account_id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      // email_categories: add FK to emails, categories, accounts
      `DO $$ BEGIN
        ALTER TABLE email_categories ADD CONSTRAINT fk_email_categories_email
          FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE email_categories ADD CONSTRAINT fk_email_categories_category
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE email_categories ADD CONSTRAINT fk_email_categories_account
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE email_categories ADD CONSTRAINT fk_email_categories_email_account
          FOREIGN KEY (email_id, account_id) REFERENCES emails(id, account_id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN
        ALTER TABLE email_categories ADD CONSTRAINT fk_email_categories_category_account
          FOREIGN KEY (category_id, account_id) REFERENCES categories(id, account_id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      // workflow_runs.trigger_email_id: add FK to emails (SET NULL on delete)
      `DO $$ BEGIN
        ALTER TABLE workflow_runs ADD CONSTRAINT fk_workflow_runs_trigger_email
          FOREIGN KEY (trigger_email_id) REFERENCES emails(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ];

    for (const sql of fkMigrations) {
      try {
        await client.query(sql);
      } catch (err) {
        logger.debug(`FK migration skipped: ${(err as Error).message}`);
      }
    }

    // Clean orphan records that violate the new FK constraints
    try {
      await client.query(`
        DELETE FROM detected_tasks WHERE email_id NOT IN (SELECT id FROM emails);
        DELETE FROM detected_tasks WHERE account_id NOT IN (SELECT id FROM accounts);
        DELETE FROM action_items WHERE email_id NOT IN (SELECT id FROM emails);
        DELETE FROM action_items WHERE account_id NOT IN (SELECT id FROM accounts);
        DELETE FROM email_event_candidates WHERE email_id NOT IN (SELECT id FROM emails);
        DELETE FROM email_event_candidates WHERE account_id NOT IN (SELECT id FROM accounts);
        DELETE FROM email_categories WHERE email_id NOT IN (SELECT id FROM emails);
        DELETE FROM email_categories WHERE category_id NOT IN (SELECT id FROM categories);
        DELETE FROM email_categories WHERE account_id NOT IN (SELECT id FROM accounts);
        UPDATE workflow_runs SET trigger_email_id = NULL WHERE trigger_email_id IS NOT NULL AND trigger_email_id NOT IN (SELECT id FROM emails);
      `);
    } catch (err) {
      logger.debug(`Orphan cleanup skipped: ${(err as Error).message}`);
    }

    logger.info('Database initialized (Neon PostgreSQL).');
  } finally {
    client.release();
  }
}

/** Close pool (graceful shutdown) */
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed.');
  } catch (err) {
    logger.error('Error closing database pool:', err);
  }
}
