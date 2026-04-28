---
id: proj_zmail_open_001
type: project
domain: open_questions
title: 'Nyitott kerdesek es kovetkezo lepesek'
summary: 'Nyitott kerdesek: Google OAuth verifikacio, E2E tesztek bovitese, rate limiting, input validacio, PostgreSQL migracio optimalizacio.'
entities:
  - open questions
  - future work
tags:
  - open-questions
  - future
  - todo
  - roadmap
importance: 0.80
confidence: 0.90
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: current
source_refs:
  - file:MODERNIZATION_SUMMARY.md
  - file:docs/google-oauth-verification.md
retrieval_hints:
  lexical:
    - nyitott
    - kerdes
    - kovetkezo
    - teendo
    - roadmap
    - future
  semantic:
    - open questions
    - future work
    - pending items
    - roadmap
---

# Nyitott kerdesek es kovetkezo lepesek

## Kozepes prioritas

- [ ] **Rate Limiting** — API vedelem (express-rate-limit)
- [ ] **Input Validacio** — Zod/Yup schema validation
- [ ] **CSRF vedelem** — csurf middleware
- [ ] **API dokumentacio** — OpenAPI/Swagger
- [ ] **Google OAuth verifikacio** — bekuldes Google-nek (docs/google-oauth-verification.md)

## Alacsony prioritas

- [ ] **Monorepo tooling** — Turborepo/Nx
- [ ] **E2E tesztek bovitese** — tobb Playwright teszt
- [ ] **Error tracking** — Sentry integracio
- [ ] **Monitoring** — Application metrics
- [ ] **Neon regio optimalizacio** — Frankfurt branch (Render melletti regio)

## Megoldott kerdesek

- [x] sql.js → Neon PostgreSQL migracio (2026-03-11)
- [x] React 19 + Vite 7 + Tailwind 4 + Express 5 upgrade (2026-02-27)
- [x] CORS tobb origin tamogatas (2026-02-16)
- [x] Docker kontennerizacio
- [x] Winston logging
- [x] Vitest testing setup
- [x] Production hardening (fail-closed env check)
- [x] CI/CD pipeline (GitHub Actions)
