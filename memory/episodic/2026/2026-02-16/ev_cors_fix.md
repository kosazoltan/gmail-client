---
id: ev_2026_02_16_001
type: episodic
domain: bugfix
title: 'CORS hiba javitasa'
summary: 'A frontend (mindenes.org) nem tudott API-t hivni, mert a CORS csak egyetlen origint engedelyezett (mail.mindenes.org). Megoldas: tobb origin tamogatas whitelist alapon.'
entities:
  - CORS
  - origin
  - mindenes.org
  - mail.mindenes.org
tags:
  - bugfix
  - CORS
  - production
  - incident
importance: 0.85
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
event_time: 2026-02-16T00:00:00Z
time_scope: event
source_refs:
  - file:CORS_FIX_REPORT.md
  - commit:a521b7d
links:
  relates_to:
    - sem_sec_cors_001
retrieval_hints:
  lexical:
    - CORS
    - hiba
    - javitas
    - origin
    - blocked
  semantic:
    - CORS error fix
    - origin mismatch
    - API access issue
---

# CORS hiba javitasa (2026-02-16)

## Problema

A frontend a `https://mindenes.org` origin-rol probalt API hivast inditani,
de a szerver CORS middleware csak `https://mail.mindenes.org`-t engedelyezte.

Erintett endpointok:

- `/api/searches`
- `/api/labels`
- `/api/reminders/count`
- `/api/auth/session`
- `/api/auth/login`

## Gyokerok

`server/src/server.ts`: a CORS middleware egyetlen statikus origin-t hasznalt
(`FRONTEND_URL` env var), de a bongeszo mas origin-rol (mindenes.org vs mail.mindenes.org)
hivott.

## Megoldas

- Dinamikus whitelist validalo fuggveny
- Tobb origin tamogatas
- Logging blokkolt origin-ekrol
- No-origin engedelyezes (mobile, Postman)
- 24h preflight cache

## Tanulsag

1. CORS hibak MINDIG szerver oldalon javitandok
2. Tobb origin tamogatas gyakori production igeny (www vs non-www, subdomains)
3. Origin logging segit debug-ban
