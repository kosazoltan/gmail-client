---
id: sem_db_neon_001
type: semantic
domain: database
title: 'Neon PostgreSQL adatbazis konfiguracio'
summary: 'ZMail dedikalt Neon PostgreSQL adatbazis: pooler host eu-west-2, DATABASE_URL egyetlen kanonikus kulcs, pg driver (nem @neondatabase/serverless).'
entities:
  - Neon
  - PostgreSQL
  - DATABASE_URL
  - pg
tags:
  - database
  - Neon
  - PostgreSQL
  - connection
  - schema
importance: 0.96
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-03-11
source_refs:
  - file:server/docs/NEON-AND-DATABASE.md
  - file:REPO_STATE.md
  - file:CLAUDE.md
supersedes:
  - sem_db_sqlite_001
retrieval_hints:
  lexical:
    - DATABASE_URL
    - Neon
    - PostgreSQL
    - tablak
    - sema
    - connection string
    - pooler
  semantic:
    - database configuration
    - database schema
    - database tables
    - connection setup
---

# Neon PostgreSQL adatbazis

## Connection

- **Driver:** `pg` (Node.js PostgreSQL driver) — NEM `@neondatabase/serverless`
- **Kapcsolat:** `DATABASE_URL` egyetlen env var (pooler, `sslmode=require`)
- **Host:** `ep-empty-hill-abv67xx3-pooler.eu-west-2.aws.neon.tech`
- **DB:** `neondb`
- A szerver `uselibpqcompat=true` parametert fuzhet hozza SSL warning elkerulesehez

## Tablak (initializeDatabase)

`accounts`, `emails`, `attachments`, `categories`, `topics`, `sessions`,
`oauth_token_store`, `contacts`, `templates`, `workflows`, `ai_conversations`,
`detected_tasks`, `scheduled_emails`, `user_settings`, `zmail_runtime_watchdog`,
`audit_log`

Teljes lista: `server/src/db/index.ts`

## SQL konverziok (sql.js → PostgreSQL)

- `?` → `$1, $2, ...` parameterek
- `COLLATE NOCASE` → `ILIKE`
- `INTEGER` epoch ms → `BIGINT`
- OID 20 (BIGINT) → `Number()` type parser

## Sema elkulonites (opcionalis)

- `ZMAIL_PG_SCHEMA=zmail` → dedikalt sema + search_path
- Csak uj/ures DB-n kapcsold be (meglevo `public` adat nem migralt automatikusan)
- Ajanlott ha megosztott Neon/Postgres peldanyon fut

## OAuth token tarolas

- `oauth_token_store` tabla: titkositott Google OAuth tokenek
- `ENCRYPTION_KEY` min. 16 karakter (AES)
- `ZMAIL_USE_DB_TOKEN_VAULT=1` (Renderen alapertelmezett)
- Ujrainditas / uj deploy utan is megmarad (Neon)
- NE valtoztasd az `ENCRYPTION_KEY`-t deploy kozben (tokenek nem fejthetok vissza)

## Kornyezeti valtozok

| Valtozo                    | Kotelezo | Leiras                                     |
| -------------------------- | -------- | ------------------------------------------ |
| `DATABASE_URL`             | igen     | Neon pooler connection string              |
| `ZMAIL_PG_SCHEMA`          | nem      | Dedikalt sema (pl. `zmail`)                |
| `ZMAIL_USE_DB_TOKEN_VAULT` | nem      | `1` = DB vault, `0` = kikapcsol            |
| `ENCRYPTION_KEY`           | igen\*   | AES kulcs (min 16 kar) az oauth tokenekhez |
