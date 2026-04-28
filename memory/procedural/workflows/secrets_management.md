---
id: proc_secrets_mgmt_001
type: procedural
domain: workflow
title: 'Titkok es API kulcsok kezelese'
summary: 'Titkok kezelese: server/.env (gitignored), GitHub Secrets, Render Dashboard. Szinkronizalas: npm run secrets:sync-github.'
entities:
  - secrets
  - GitHub Secrets
  - Render
  - .env
tags:
  - secrets
  - security
  - workflow
  - API keys
importance: 0.94
confidence: 0.99
status: active
owner: system
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:docs/CI-SECRETS.md
  - file:server/.env.example
retrieval_hints:
  lexical:
    - secret
    - API key
    - titok
    - .env
    - GitHub Secrets
    - sync
  semantic:
    - secret management
    - API key setup
    - credentials handling
---

# Titkok es API kulcsok kezelese

## Alapszabaly

- **SOHA ne commitolj** titkos kulcsot a repoban
- `server/.env` **gitignore-olt** — ide tedd a helyi kulcsokat
- CI: GitHub → Settings → Secrets and variables → Actions

## Szinkronizalas GitHubra

```bash
# 1. Kulcsok beallitasa server/.env-ben
# 2. GitHub login
gh auth login
# 3. Szinkron
npm run secrets:sync-github
# VAGY: node scripts/sync-actions-secrets.mjs
```

Alternativ forras: `ZMAIL_DOTENV_PATH=.env.secrets node scripts/sync-actions-secrets.mjs`

## GitHub Secrets megfeltetes

| Lokalis (`server/.env`)  | GitHub Secret            | Hasznalat                   |
| ------------------------ | ------------------------ | --------------------------- |
| `GITHUB_PAT`             | `GITHUB_PAT`             | GitHub REST API (opcio)     |
| `RENDER_API_KEY`         | `RENDER_API_KEY`         | Render REST API (`rnd_...`) |
| `DEPLOY_HEALTHCHECK_URL` | `DEPLOY_HEALTHCHECK_URL` | Deploy utani hook URL       |

## Render Dashboard

- API kulcs: **Account Settings → API Keys** → `rnd_...`
- Deploy Hook: **Service → Deploy → Deploy Hook**
- Env vars: **Service → Environment** (DATABASE*URL, GOOGLE*\*, stb.)

## Uj titok hozzaadasa

1. Add hozzad a `server/.env`-hez es `server/.env.example`-hoz (placeholder!)
2. Ha CI-nek is kell: `npm run secrets:sync-github`
3. Ha Rendernek kell: Dashboard → Environment → Add
4. Ha Vercelnek kell: Dashboard → Settings → Environment Variables
