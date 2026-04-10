---
id: sem_infra_env_001
type: semantic
domain: infrastructure
title: "Osszes kornyezeti valtozo referencia"
summary: "Teljes kornyezeti valtozo lista: szerver, OAuth, adatbazis, CI/CD, piaci adatok, watchdog."
entities:
  - environment variables
  - server/.env
  - Render
  - Vercel
tags:
  - environment
  - configuration
  - secrets
  - env-vars
importance: 0.95
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-03-11
source_refs:
  - file:server/.env.example
  - file:CLAUDE.md
  - file:server/docs/PRODUCTION-HARDENING.md
  - file:render.yaml
retrieval_hints:
  lexical:
    - env
    - environment
    - variable
    - secret
    - VITE_API_URL
    - DATABASE_URL
    - SESSION_SECRET
  semantic:
    - configuration reference
    - environment setup
    - secret management
---

# Kornyezeti valtozok teljes referencia

## Szerver alap

| Valtozo        | Pelda                      | Kotelezo |
| -------------- | -------------------------- | -------- |
| `PORT`         | `5000` (Render: `10000`)   | nem      |
| `NODE_ENV`     | `production`               | nem      |
| `FRONTEND_URL` | `https://mail.mindenes.org`| igen*    |
| `BACKEND_URL`  | `https://api.mindenes.org` | igen*    |

## Google OAuth

| Valtozo                | Leiras                              |
| ---------------------- | ----------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth Client ID                     |
| `GOOGLE_CLIENT_SECRET` | GOCSPX- prefixu secret             |
| `GOOGLE_REDIRECT_URI`  | `https://api.mindenes.org/api/auth/callback` |

## Session / Titkositas

| Valtozo               | Kovetelmeny            |
| --------------------- | ---------------------- |
| `SESSION_SECRET`      | ≥16 karakter, random   |
| `ENCRYPTION_KEY`      | ≥16 karakter, hex kulcs|
| `ERRORLOG_HMAC_SECRET`| ≥16 kar, NEM repo default |

## Adatbazis

| Valtozo                    | Leiras                           |
| -------------------------- | -------------------------------- |
| `DATABASE_URL`             | Neon pooler connection string     |
| `ZMAIL_PG_SCHEMA`          | Opcionalis sema (pl. `zmail`)    |
| `ZMAIL_USE_DB_TOKEN_VAULT` | `1` = DB vault (Render default)  |
| `ZMAIL_TOKEN_VAULT_FILE`   | Opcionalis fajl vault            |

## Watchdog

| Valtozo                        | Default    |
| ------------------------------ | ---------- |
| `ZMAIL_CRITICAL_JOBS_SLA_MS`   | 900000 (15 perc) |
| `ZMAIL_CRITICAL_JOBS_WATCHDOG` | `1` (aktiv)|

## Frontend (Vercel)

| Valtozo        | Ertek                              |
| -------------- | ---------------------------------- |
| `VITE_API_URL` | `https://api.mindenes.org/api` (KOTELEZO!) |

## Szinkronizacio

| Valtozo           | Default   |
| ----------------- | --------- |
| `SYNC_DAYS_BACK`  | 30        |
| `SYNC_INTERVAL_MS`| 120000    |

## CI/CD (GitHub Secrets)

| Secret                   | Hasznalat                  |
| ------------------------ | -------------------------- |
| `GITHUB_PAT`             | GitHub REST API (opcio)    |
| `RENDER_API_KEY`         | Render REST API (`rnd_...`)|
| `DEPLOY_HEALTHCHECK_URL` | Deploy utani hook URL      |

## AI / Piaci adatok (opcionalis)

| Valtozo              | Szolgaltatas        |
| -------------------- | ------------------- |
| `ANTHROPIC_API_KEY`  | Claude AI elemzesek |
| `TWELVEDATA_API_KEY` | Forex arfolyamok    |
| `FINNHUB_API_KEY`    | GBP/HUF + hirek    |
| `ALPHAVANTAGE_API_KEY`| Hir sentiment      |

## Production enforcement

| Valtozo                       | Leiras                            |
| ----------------------------- | --------------------------------- |
| `ZMAIL_PRODUCTION_ENFORCEMENT`| `1` = kenyszerit dev gepen is     |
| `ZMAIL_ALLOW_NON_GOCSPX_SECRET`| `1` = nem GOCSPX is mehet (NEM ajanlott) |
