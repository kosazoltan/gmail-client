---
id: ev_2026_03_11_001
type: episodic
domain: migration
title: "sql.js → Neon PostgreSQL migracio"
summary: "Teljes adatbazis migracio sql.js (in-memory SQLite) → Neon PostgreSQL (cloud). SQL konverziok, BIGINT migracio, pg type parser."
entities:
  - sql.js
  - Neon
  - PostgreSQL
  - migration
  - BIGINT
tags:
  - migration
  - database
  - breaking-change
  - infrastructure
importance: 0.93
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
event_time: 2026-03-11T00:00:00Z
time_scope: event
source_refs:
  - file:REPO_STATE.md
  - file:server/MIGRATION_PLAN.md
links:
  relates_to:
    - sem_db_neon_001
  supersedes:
    - ev_sqlite_setup
retrieval_hints:
  lexical:
    - migracio
    - sql.js
    - Neon
    - PostgreSQL
    - BIGINT
    - SQLite
  semantic:
    - database migration
    - SQLite to PostgreSQL
    - infrastructure change
---

# sql.js → Neon PostgreSQL migracio (2026-03-11)

## Regi allapot

- **sql.js** v1.12.0 (WebAssembly SQLite)
- Teljes DB memoriaban
- Periodikus export (30s) + debounced (1s) `db.export()` → fajl
- Render Persistent Disk: `/data/gmail-client.db`
- **Hatranyok:** magas RAM, lassu export, nincs WAL, WASM overhead, race condition kockazat

## Uj allapot

- **Neon PostgreSQL** (cloud, pooler)
- `pg` driver (NEM `@neondatabase/serverless`)
- `DATABASE_URL` connection string
- EU-West-2 regio

## SQL konverziok

| Regi (SQLite)       | Uj (PostgreSQL)        |
| ------------------- | ---------------------- |
| `?` parameter       | `$1, $2, ...`          |
| `COLLATE NOCASE`    | `ILIKE`                |
| `INTEGER` epoch ms  | `BIGINT`               |

## Egyeb valtozasok a migracioval egyidejuleg

- Command Palette (`Ctrl+K`)
- AI Dashboard (Bento Grid)
- Inline Copilot
- Thread View
- SSE Real-time Push
- Daily AI Brief (cron 8:00)
- RSS News, Crypto Prices
- PDF/DOCX AI Analysis
- Offline Compose (IndexedDB)
- Uj service-ek: news, crypto, document-parser, ai-market

## Deploy

- Render: `srv-d6h9il450q8c73af5lk0`
- Vercel: `mail.mindenes.org`
- 31 uj commit
