---
id: sem_code_server_db_schema_001
type: semantic
domain: codebase
title: 'Server adatbazis sema — 36 tabla reszletezve'
summary: 'PostgreSQL sema: 36 tabla. accounts, emails (indexelt), attachments, categories, oauth_token_store, sessions, contacts, smart_folders, workflows, ai_conversations, detected_tasks, daily_briefs, stb.'
entities:
  - db/index.ts
  - tables
  - schema
  - PostgreSQL
tags:
  - codebase
  - server
  - database
  - schema
  - tables
importance: 0.96
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:server/src/db/index.ts
retrieval_hints:
  lexical:
    - tabla
    - table
    - schema
    - column
    - index
    - emails
    - accounts
    - db/index.ts
  semantic:
    - database schema
    - table structure
    - data model
    - database tables
---

# Server adatbazis sema (36 tabla)

## Core DB reteg (db/index.ts, 867 sor)

- **Pool:** max 10, idle timeout 30s, connect timeout 25s
- **Schema izolacio:** opcionalis `ZMAIL_PG_SCHEMA` env
- **SQL konverzio:** `?` → `$1,$2`, `COLLATE NOCASE` → `ILIKE`
- **Tranzakcio:** AsyncLocalStorage-alapu context propagacio

### Exportalt fuggvenyek

```typescript
(getPool(),
  queryOne<T>(),
  queryAll<T>(),
  execute(),
  runInTransaction<T>(),
  initializeDatabase(),
  closeDatabase());
```

## Tablak kategoriankent

### Fiok es auth (3)

| Tabla               | Fo oszlopok                                                                                          | Kulcs             |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| `accounts`          | id, email (UNIQUE), name, access_token, refresh_token, token_expiry, history_id, last_sync_at, color | PK: id            |
| `oauth_token_store` | account_email, ciphertext (AES-GCM), updated_at                                                      | PK: account_email |
| `sessions`          | sid, sess (JSON), expire (BIGINT)                                                                    | PK: sid           |

### Email core (3)

| Tabla         | Fo oszlopok                                                                                                                                                                                          | Indexek                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `emails`      | id, account_id, thread_id, subject, from_email, from_name, to_email, cc_email, snippet, body, body_html, date (BIGINT), is_read, is_starred, labels, has_attachments, category_id, topic_id, ai_tags | account+date, from, thread, category, topic, date, read, starred, subject |
| `attachments` | id, email_id, filename, mime_type, size, gmail_attachment_id                                                                                                                                         | email_id                                                                  |
| `topics`      | id, name, normalized_subject, message_count, account_id                                                                                                                                              |                                                                           |

### Kategorizalas (3)

| Tabla                  | Fo oszlopok                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `categories`           | id, name, color, icon, is_system, account_id, description, sort_order |
| `categorization_rules` | id, category_id, type, value, priority, account_id                    |
| `email_categories`     | email_id + category_id (composite PK), account_id                     |

### Smart szervezes (1)

`smart_folders` — id, account_id, name, icon, rules (JSON), is_system, sort_order

### Kontakt kezeles (2)

| Tabla           | Fo oszlopok                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| `contacts`      | id, email, name, frequency, last_used_at, source, account_id, UNIQUE(email, account_id) |
| `sender_groups` | id, email, name, domain, message_count, last_message_at, account_id                     |

### Gmail integracio (1)

`sync_log` — id, account_id, started_at, completed_at, messages_processed, status, error

### Felhasznaloi funkciok (8)

| Tabla                | Fo oszlopok                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `saved_searches`     | id, account_id, name, query, icon, color, use_count                                                               |
| `templates`          | id, account_id, name, subject, body, shortcut, use_count                                                          |
| `snoozed_emails`     | id, email_id, account_id, snooze_until (BIGINT), processing_instance                                              |
| `reminders`          | id, email_id, account_id, remind_at (BIGINT), note, is_completed                                                  |
| `pinned_emails`      | id, email_id, account_id, pinned_at (BIGINT)                                                                      |
| `scheduled_emails`   | id, account_id, to/cc/bcc, subject, body, scheduled_at (BIGINT), status, in_reply_to, thread_id, attachments_json |
| `newsletter_senders` | id, account_id, sender_email, sender_name, is_newsletter, is_muted, email_count                                   |
| `vip_senders`        | id, account_id, email, name                                                                                       |

### Push es beallitasok (2)

| Tabla                | Fo oszlopok                                         |
| -------------------- | --------------------------------------------------- |
| `push_subscriptions` | id, account_id, endpoint, p256dh, auth              |
| `user_settings`      | id, account_id, key, value, UNIQUE(account_id, key) |

### Automatizacio (2)

| Tabla           | Fo oszlopok                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------- |
| `workflows`     | id, account_id, name, trigger_type, trigger_config (JSON), steps (JSON), is_active, run_count |
| `workflow_runs` | id, workflow_id, account_id, status, trigger_email_id, steps_completed, result (JSON)         |

### AI es intelligencia (5)

| Tabla                    | Fo oszlopok                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ai_conversations`       | id, account_id, title, context_type, context_data (JSON), messages (JSON)                                            |
| `ai_messages`            | id, conversation_id, role, content, metadata                                                                         |
| `action_items`           | id, email_id, account_id, text, due_date (BIGINT), priority, confidence, is_done                                     |
| `email_event_candidates` | id, email_id, account_id, title, event_type, start_at (BIGINT), location, participants_json, status, google_event_id |
| `detected_tasks`         | id, account_id, email_id, detection_type, reason, priority, status, snoozed_until (BIGINT)                           |

### Napi osszefoglalo (1)

`daily_briefs` — id, account_id, date, summary, highlights (JSON), action_items_count, urgent_count

### Logolas (3)

`error_log`, `audit_log`, `zmail_runtime_watchdog`

### Inbox szabalyok (1)

`inbox_rules` — (inbox-rules.service.ts)
