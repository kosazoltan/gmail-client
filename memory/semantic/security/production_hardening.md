---
id: sem_sec_hardening_001
type: semantic
domain: security
title: 'Production hardening es kotelezo env valtozok'
summary: 'Production runtime-ben kotelezo kornyezeti valtozok ellenorzese indulaskor. Hianyzik vagy gyenge → process.exit(1). Watchdog percenkent ellenorzi a kritikus jobokat.'
entities:
  - SESSION_SECRET
  - ENCRYPTION_KEY
  - ERRORLOG_HMAC_SECRET
  - watchdog
  - fail-closed
tags:
  - security
  - production
  - environment
  - hardening
  - watchdog
  - health-check
importance: 0.97
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-03-11
source_refs:
  - file:server/docs/PRODUCTION-HARDENING.md
  - file:CLAUDE.md
retrieval_hints:
  lexical:
    - production
    - hardening
    - SESSION_SECRET
    - ENCRYPTION_KEY
    - ERRORLOG_HMAC_SECRET
    - watchdog
    - health
    - fail-closed
  semantic:
    - production security
    - mandatory environment
    - startup validation
    - health check
---

# Production hardening

## Kotelezo env valtozok (fail-closed indulas)

Production runtime: `NODE_ENV=production`, `RENDER=true`, vagy `FLY_APP_NAME` beallitva.
`assertProductionEnvironment()` ellenorzi indulaskor.

| Valtozo                | Kovetelmeny                       |
| ---------------------- | --------------------------------- |
| `DATABASE_URL`         | Kotelezo (db/index betolteskor)   |
| `SESSION_SECRET`       | ≥16 karakter, nem dev placeholder |
| `ENCRYPTION_KEY`       | ≥16 karakter, nem dev placeholder |
| `GOOGLE_CLIENT_ID`     | Kotelezo                          |
| `GOOGLE_CLIENT_SECRET` | Kotelezo, GOCSPX- prefix          |
| `GOOGLE_REDIRECT_URI`  | Kotelezo, https                   |
| `FRONTEND_URL`         | Kotelezo, https                   |
| `BACKEND_URL`          | Kotelezo, https                   |
| `ERRORLOG_HMAC_SECRET` | ≥16 kar, NEM repo default         |

Hiany / gyenge ertek → `process.exit(1)` + `[ZMAIL][PROD_ENV][KOD]` log.

## Watchdog

- Percenkent: `processExpiredSnoozes` + `processScheduledEmails`
- Mindketto sikeres → `zmail_runtime_watchdog` tabla frissul
- SLA: **15 perc** (alap, `ZMAIL_CRITICAL_JOBS_SLA_MS`)
- SLA tullepes → `/api/health` → **HTTP 503**
  - `code: WATCHDOG_CRITICAL_JOBS_OVERDUE` vagy `WATCHDOG_NO_ROW`
  - Render health check elhasal → forgalom levalasztas
- Kikapcsolas (debug): `ZMAIL_CRITICAL_JOBS_WATCHDOG=0`

## Audit log

- Watchdog fail: `audit_log` tabla, `event_type = system_watchdog_overdue`
- Legfeljebb 5 percenkent egyszer

## Delete Protection

- Aktiv middleware: `server/src/middleware/delete-protection.ts`
- Vedi a kritikus DELETE muveleteket

## API hibakodok

- `AppError` harmadik parameter: opcionalis `code` → JSON `{ error, code? }`
- Health 503: `HEALTH_DATABASE_UNAVAILABLE`, watchdog kodok
