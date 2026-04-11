# ZMail — Database Migration Plan

> Last updated: 2026-04-11
> Schema source: `server/src/db/migrations.ts`

## Architecture

```
server/src/db/
├── pool.ts        — Connection pool, SSL, schema validation, BIGINT parser
├── queries.ts     — SQL conversion, queryOne/queryAll/execute, transactions
├── migrations.ts  — DDL: tables, indexes, column migrations, FK constraints
└── index.ts       — Barrel re-export (backward compatible public API)
```

## Migration Strategy

### Current: Startup DDL (v1)

All schema changes are applied at application startup via `initializeDatabase()`:

1. **CREATE TABLE IF NOT EXISTS** — idempotent table creation (31 tables)
2. **ALTER TABLE ADD COLUMN IF NOT EXISTS** — column migrations
3. **ALTER TABLE ALTER COLUMN TYPE** — type upgrades (e.g., INTEGER → BIGINT)
4. **CREATE INDEX IF NOT EXISTS** — performance indexes
5. **DO $$ BEGIN ... EXCEPTION WHEN duplicate_object** — FK constraints (idempotent)
6. **INSERT INTO ... ON CONFLICT DO NOTHING** — seed data (system categories)
7. **Backfill** — data migration for new columns (e.g., `topics.latest_date`)
8. **Orphan cleanup** — remove dangling FK references

### Key Design Decisions

| Decision                                | Rationale                                                           |
| --------------------------------------- | ------------------------------------------------------------------- |
| No migration framework (no Flyway/Knex) | Single-process app, startup DDL sufficient                          |
| All DDL idempotent                      | Safe restart/retry without manual rollback                          |
| BIGINT for timestamps                   | `Number.MAX_SAFE_INTEGER` safety via `types.setTypeParser(20, ...)` |
| Schema-qualified queries                | `ZMAIL_PG_SCHEMA` env var → `SET search_path` per connection        |
| FK via `DO $$ ... EXCEPTION`            | Avoids `IF NOT EXISTS` syntax gap for constraints                   |

## Schema Overview (31 tables)

### Core

| Table              | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `accounts`         | Gmail accounts (OAuth credentials, sync state) |
| `emails`           | Email messages (headers, body, flags)          |
| `attachments`      | Email attachments metadata                     |
| `categories`       | User/system email categories                   |
| `email_categories` | Many-to-many: emails ↔ categories              |
| `topics`           | Conversation threading                         |
| `contacts`         | Contact book                                   |
| `labels`           | Gmail label sync                               |

### Features

| Table                | Purpose                      |
| -------------------- | ---------------------------- |
| `saved_searches`     | Saved search queries         |
| `templates`          | Email draft templates        |
| `snoozed_emails`     | Snooze scheduler             |
| `reminders`          | Follow-up reminders          |
| `scheduled_emails`   | Timed send queue             |
| `pinned_emails`      | Pinned/starred emails        |
| `vip_senders`        | VIP sender list              |
| `newsletter_senders` | Newsletter detection         |
| `push_subscriptions` | Web push notification tokens |
| `user_settings`      | Per-account preferences      |

### AI & Automation

| Table                    | Purpose                         |
| ------------------------ | ------------------------------- |
| `workflows`              | Automation workflow definitions |
| `workflow_runs`          | Workflow execution log          |
| `ai_conversations`       | AI chat sessions                |
| `ai_messages`            | AI chat message history         |
| `smart_folders`          | AI-generated smart folders      |
| `action_items`           | Extracted action items          |
| `email_event_candidates` | Calendar event detection        |
| `detected_tasks`         | Unanswered email detection      |
| `daily_briefs`           | AI daily summary                |

### Infrastructure

| Table                  | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `sessions`             | Express session store (connect-pg-simple) |
| `oauth_token_store`    | Encrypted OAuth token vault               |
| `sync_log`             | Background sync history                   |
| `categorization_rules` | Auto-categorization rules                 |
| `sender_groups`        | Sender grouping/analytics                 |

## Column Migrations (active)

These `ALTER TABLE` statements run at every startup (idempotent):

| Table            | Column                | Type      | Default        | Purpose                 |
| ---------------- | --------------------- | --------- | -------------- | ----------------------- |
| `emails`         | `size`                | `BIGINT`  | —              | Large email support     |
| `emails`         | `priority`            | `TEXT`    | `'normal'`     | Priority classification |
| `emails`         | `category_confidence` | `REAL`    | —              | AI category score       |
| `emails`         | `auto_categorized`    | `BOOLEAN` | `false`        | AI categorization flag  |
| `emails`         | `language`            | `TEXT`    | —              | Detected language       |
| `emails`         | `sentiment`           | `TEXT`    | —              | Sentiment analysis      |
| `emails`         | `topic_id`            | `TEXT`    | —              | Thread grouping         |
| `categories`     | `created_at`          | `BIGINT`  | `0`            | Timestamp tracking      |
| `topics`         | `latest_date`         | `BIGINT`  | —              | Latest email date       |
| `contacts`       | `contact_group`       | `TEXT`    | —              | Group assignment        |
| `contacts`       | `interaction_score`   | `REAL`    | `0`            | Frequency score         |
| `contacts`       | `avatar_url`          | `TEXT`    | —              | Profile picture         |
| `detected_tasks` | `snoozed_until`       | `BIGINT`  | —              | Task snooze             |
| `detected_tasks` | `task_type`           | `TEXT`    | `'unanswered'` | Task classification     |
| `attachments`    | `thumbnail_url`       | `TEXT`    | —              | Preview image           |
| `daily_briefs`   | `generated_at`        | `BIGINT`  | —              | Generation timestamp    |

## Type Upgrades

| Table.Column                     | From      | To       | Reason            |
| -------------------------------- | --------- | -------- | ----------------- |
| `emails.internal_date`           | `INTEGER` | `BIGINT` | Unix ms precision |
| `emails.size`                    | `INTEGER` | `BIGINT` | Large attachments |
| `emails.received_at`             | `INTEGER` | `BIGINT` | Unix ms precision |
| `snoozed_emails.snooze_until`    | `INTEGER` | `BIGINT` | Unix ms precision |
| `snoozed_emails.original_date`   | `INTEGER` | `BIGINT` | Unix ms precision |
| `reminders.remind_at`            | `INTEGER` | `BIGINT` | Unix ms precision |
| `scheduled_emails.scheduled_for` | `INTEGER` | `BIGINT` | Unix ms precision |
| `contacts.last_contacted`        | `INTEGER` | `BIGINT` | Unix ms precision |

## Index Strategy

Performance indexes created at startup (all `IF NOT EXISTS`):

- `idx_emails_account_date` — account_id + internal_date DESC (inbox query)
- `idx_emails_thread_id` — thread grouping
- `idx_emails_message_id` — deduplication
- `idx_emails_topic` — topic-based views
- `idx_emails_account_read` — unread count
- `idx_emails_account_priority` — priority filtering
- `idx_emails_account_starred` — starred view
- `idx_contacts_account_email` — contact lookup
- `idx_contacts_account_score` — top contacts
- `idx_attachments_email` — attachment listing
- `idx_snoozed_active` — snooze expiry scan
- `idx_scheduled_pending` — scheduled send scan
- `idx_topics_account_date` — topic timeline

## Future: Migration Framework (v2)

When the schema stabilizes, consider:

1. **Versioned migrations** — numbered SQL files (`001_initial.sql`, `002_add_priority.sql`)
2. **Migration table** — `schema_migrations (version INT, applied_at TIMESTAMP)`
3. **Rollback support** — paired up/down scripts
4. **Zero-downtime** — `NOT VALID` + `VALIDATE CONSTRAINT` pattern for FK/check constraints

### Trigger for v2

- When 3+ developers contribute simultaneously
- When production deploys need rollback capability
- When schema changes become weekly

## Environment

| Env Var                       | Purpose                            | Example                     |
| ----------------------------- | ---------------------------------- | --------------------------- |
| `ZMAIL_PG_SCHEMA`             | Schema name (lowercase identifier) | `zmail`                     |
| `ZMAIL_PG_CONNECT_TIMEOUT_MS` | Connection timeout                 | `25000`                     |
| `DATABASE_URL`                | PostgreSQL connection string       | `postgresql://...`          |
| `PORT`                        | HTTP server port                   | `5000`                      |
| `FRONTEND_URL`                | CORS origin                        | `https://zmail.example.com` |
