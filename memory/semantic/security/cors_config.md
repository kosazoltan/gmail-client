---
id: sem_sec_cors_001
type: semantic
domain: security
title: "CORS konfiguracio"
summary: "Whitelist alapu CORS: tobb origin tamogatas, credentials, 24h preflight cache. Allowed origins: mindenes.org, mail.mindenes.org, localhost."
entities:
  - CORS
  - origin
  - whitelist
tags:
  - security
  - CORS
  - cross-origin
  - API
importance: 0.88
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-02-16
source_refs:
  - file:CORS_FIX_REPORT.md
  - file:server/src/server.ts
retrieval_hints:
  lexical:
    - CORS
    - origin
    - whitelist
    - cross-origin
    - preflight
  semantic:
    - cross-origin policy
    - allowed origins
    - API security
---

# CORS konfiguracio

## Allowed origins

```typescript
const allowedOrigins = [
  frontendUrl || 'http://localhost:5173',
  'https://mindenes.org',
  'https://mail.mindenes.org',
  'http://localhost:5173',
  'http://localhost:5000'
];
```

## Mukodes

- **Whitelist alapu** — dinamikus validalo fuggveny
- **No-origin** engedelyezve (mobile app, Postman)
- **Credentials:** true (cookie-based auth)
- **Preflight cache:** 24 ora (`maxAge: 86400`)
- **ExposedHeaders:** `Content-Range`, `X-Content-Range`
- **Logging:** blokkolt origin-ek logolva (`CORS blocked origin: ...`)

## Szabalyok

- NE adj hozza `*` (wildcard) origin-t
- NE engedelyezz nem HTTPS origin-eket production-ben (localhost kivetel)
- Uj origin hozzaadasa: `allowedOrigins` tomb szerkesztese `server/src/server.ts`-ben
