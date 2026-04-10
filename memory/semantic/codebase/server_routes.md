---
id: sem_code_server_routes_001
type: semantic
domain: codebase
title: "Server API route-ok teljes listaja (40 fajl)"
summary: "40 route fajl, 200+ endpoint. Auth, emails, views, categories, contacts, snooze, reminders, labels, newsletters, calendar, tasks, market, AI chat, workflows, analytics, SSE, stb."
entities:
  - routes
  - API
  - endpoints
  - REST
tags:
  - codebase
  - server
  - routes
  - API
  - endpoints
importance: 0.93
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:server/src/routes/
retrieval_hints:
  lexical:
    - route
    - endpoint
    - API
    - GET
    - POST
    - DELETE
    - PATCH
  semantic:
    - API endpoints
    - server routes
    - REST API
    - HTTP methods
---

# Server API route-ok (40 fajl, 200+ endpoint)

## Route → mount path

```
/api/auth           → auth.routes.ts
/api/emails         → emails.routes.ts
/api/accounts       → accounts.routes.ts
/api/categories     → categories.routes.ts
/api/search         → search.routes.ts
/api/views          → views.routes.ts
/api/attachments    → attachments.routes.ts
/api/contacts       → contacts.routes.ts
/api/database       → database.routes.ts
/api/searches       → saved-searches.routes.ts
/api/templates      → templates.routes.ts
/api/snooze         → snooze.routes.ts
/api/reminders      → reminders.routes.ts
/api/newsletters    → newsletters.routes.ts
/api/labels         → labels.routes.ts
/api/push           → push.routes.ts
/api/pinned         → pinned.routes.ts
/api/settings       → settings.routes.ts
/api/scheduled      → scheduled.routes.ts
/api/vip            → vip.routes.ts
/api/translate      → translate.routes.ts
/api/calendar       → calendar.routes.ts
/api/tasks          → tasks.routes.ts
/api/dashboard      → dashboard.routes.ts
/api/market         → market.routes.ts
/api/workflows      → workflow.routes.ts
/api/smart          → smart-features.routes.ts
/api/intelligence   → intelligence.routes.ts
/api/smart-folders  → smart-folders.routes.ts
/api/ai             → ai-chat.routes.ts
/api/detected-tasks → detected-tasks.routes.ts
/api/sse            → sse.routes.ts
/api/brief          → brief.routes.ts
/api/invoice-automation → invoice-automation.routes.ts
/api/error-report   → error-report.routes.ts
/api/static-audit   → static-audit.routes.ts
/api/quota          → quota.routes.ts
/api/inbox-rules    → inbox-rules.routes.ts
/api/audit          → audit.routes.ts
/api/analytics      → analytics.routes.ts
```

## Legfontosabb endpointok reszletezve

### Auth
`GET /login`, `GET /callback`, `GET /session`, `POST /logout`, `POST /switch-account`

### Emails
`GET /`, `GET /:id`, `GET /:id/thread`, `POST /send`, `POST /reply`,
`POST /batch-delete`, `POST /transcribe`, `DELETE /:id`,
`PATCH /:id/read`, `PATCH /:id/star`, `PATCH /batch-read`

### Views (szervezett nezetek)
`GET /inbox`, `GET /unified`, `GET /trash`,
`GET /by-sender`, `GET /by-sender/:email`,
`GET /by-topic`, `GET /by-topic/:id`,
`GET /by-time`, `GET /by-time/:periodId`,
`GET /by-category`, `GET /by-category/:id`

### Calendar
`GET /events`, `GET /suggestions`, `GET /today`, `GET /week`,
`POST /`, `POST /suggestions/from-email/:emailId`, `POST /suggestions/:id/sync`,
`PUT /:id`, `DELETE /:id`

### Intelligence (AI)
`GET /action-items/:emailId`, `GET /related/:emailId`, `GET /weekly-report`,
`POST /action-items/:emailId`, `POST /bulk-analyze`,
`POST /sentiment/:emailId`, `POST /suggest-reply/:emailId`

### AI Chat
`GET /conversations`, `POST /chat`, `POST /smart-search`,
`POST /confirm-action`, `DELETE /conversations/:id`

### Market
`GET /briefing`, `GET /news`, `GET /crypto`, `GET /trend`,
`POST /deep-analysis`

### Smart Folders
`GET /`, `GET /:id/emails`, `POST /`, `POST /classify`,
`POST /generate`, `PUT /:id`, `DELETE /:id`

### Workflows
`GET /`, `GET /:id/runs`, `POST /`, `POST /:id/run`,
`POST /generate`, `PUT /:id`, `DELETE /:id`

### SSE
`GET /events` — Server-Sent Events stream

### Health (server.ts, nem route fajl)
`GET /api/health` — DB + watchdog status (fail-closed)
