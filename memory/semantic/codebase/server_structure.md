---
id: sem_code_server_structure_001
type: semantic
domain: codebase
title: 'Server kodbazis struktura es entry point'
summary: 'Express 5 backend: server.ts (627 sor), 40 route fajl, 41 service, 8 middleware, PostgreSQL pool. Hatter jobok: snooze, scheduled, workflow, task detection, daily brief.'
entities:
  - server/src
  - server.ts
  - Express
  - middleware
  - routes
tags:
  - codebase
  - server
  - structure
  - entry-point
  - middleware
importance: 0.95
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:server/src/server.ts
retrieval_hints:
  lexical:
    - server
    - backend
    - Express
    - middleware
    - route
    - server.ts
    - entry point
  semantic:
    - server architecture
    - backend structure
    - Express setup
    - middleware chain
---

# Server kodbazis struktura

## Konyvtar fa

```
server/src/
  server.ts               # Fo entry point (627 sor)
  ai/
    provider.ts           # AI provider absztrakcio (OpenAI/Anthropic)
  config/
    production-env.ts     # Production env validacio
  db/
    index.ts              # Core DB reteg (PostgreSQL, 867 sor)
    error-log.ts          # Error logging tabla
    session-store.ts      # Express session store (PgSessionStore)
  middleware/ (8 fajl)
    ai-sql-security.ts    # AI SQL injection vedelem
    database-maintenance.ts # Karbantartas mod
    delete-protection.ts  # DELETE muveletek logolasa
    error-handler.ts      # Globalis hibakezelő
    rate-limiter.ts       # Rate limiting
    request-id.ts         # X-Request-ID tracking
    security-headers.ts   # CSP + biztonsagi fejlecek
    session.ts            # Session middleware (PostgreSQL store)
  routes/ (40 fajl)       # API endpointok
  services/ (41 fajl)     # Uzleti logika
  lib/ (3 fajl)           # email-validator, error-mailer, static-audit
  utils/ (4 fajl)         # cors-config, logger, mime-headers, severity-classifier
  scripts/ (2 fajl)       # init-neon-schema, migrate-decode-rfc2047
```

## Entry point (server.ts)

### Middleware lancol (sorrend)

1. `helmet()` — biztonsagi fejlecek (CSP kikapcsolva Vite kompatibilitas)
2. `cors()` — tobb origin tamogatas (`buildAllowedOrigins()`)
3. `requestIdMiddleware` — X-Request-ID tracking
4. Trust proxy (Cloudflare)
5. `express.json({ limit: '2mb' })`
6. `createSessionMiddleware()` — PostgreSQL session store
7. `deleteProtection` — veszelyes torlesi muveletek logolasa
8. `securityHeaders` — CSP, X-Frame-Options, X-Content-Type-Options

### Rate limiterek

- `authLimiter`: 20 req / 15 perc (auth endpointok)
- `apiLimiter`: 120 req / perc (altalanos API)

### Indulasi sorrend

1. `assertProductionEnvironment()` — env validacio
2. `initializeDatabaseWithRetry()` — max 5 probalkozas, 5s kozottuk
3. `ensureErrorLogTable()`, `ensureAuditLogTable()`, `ensureRuntimeWatchdogTable()`
4. `seedRuntimeWatchdogIfNeeded()`
5. Listen PORT (default 5000, Render: 10000)

### Hatter jobok (intervallumok)

| Job                   | Intervallum      | Leiras                                                                  |
| --------------------- | ---------------- | ----------------------------------------------------------------------- |
| Snooze + Scheduled    | 60s              | `processExpiredSnoozes` + `processScheduledEmails` + watchdog heartbeat |
| Workflow              | 60s              | `processScheduledWorkflows`                                             |
| Task Detection        | 300s             | Napi scan (elso: 180 nap, utana: 30 nap)                                |
| Daily Brief           | 300s             | 8:00 CET: `generateAISummary`, 7/12/17 CET: digest                      |
| Operational Reprocess | 900s             | Fiokonkent min 6h                                                       |
| Background Sync       | SYNC_INTERVAL_MS | OAuth fiokok szinkronizalasa                                            |
| Memory Monitor        | 300s             | Heap hasznalat, 300MB warning, manualis GC                              |

### Graceful shutdown

SIGTERM/SIGINT: hatter taskok leallitasa → intervallumok torlese →
session store cleanup → DB pool bezarasa → HTTP server bezarasa (10s timeout)
