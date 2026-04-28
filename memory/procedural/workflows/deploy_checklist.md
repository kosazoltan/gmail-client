---
id: proc_deploy_checklist_001
type: procedural
domain: workflow
title: 'Deploy es push checklist'
summary: 'Teljes deploy eljaras: lokalis lint+tsc+build, git push, CI zold, Deploy healthcheck, Render/Vercel auto deploy.'
entities:
  - deploy
  - CI
  - lint
  - build
  - push
tags:
  - deploy
  - checklist
  - workflow
  - CI/CD
importance: 0.99
confidence: 0.99
status: active
owner: system
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:CLAUDE.md
  - file:DEPLOY_INSTRUCTIONS.md
retrieval_hints:
  lexical:
    - deploy
    - push
    - checklist
    - lint
    - build
    - merge
  semantic:
    - deployment procedure
    - release process
    - code shipping
---

# Deploy es push checklist

## 1. Lokalis ellenorzes (KOTELEZO push elott)

```bash
# Server
cd server && npm run lint && npx tsc --noEmit && npm run build

# Client
cd client && npm run lint && npx tsc --noEmit && npm run build
```

## 2. Git push

```bash
git push origin main
# VAGY PR → merge `main`-re
```

## 3. GitHub Actions CI

- Automatikusan lefut push/PR eseten
- Server job: lint + tsc + build
- Client job: lint + tsc + build
- E2E job: Playwright (continue-on-error)

## 4. Deploy healthcheck

- CI zold → Deploy healthcheck workflow automatikusan indul
- `scripts/verify-production.py`:
  - `/api/health` (JSON: status + database + timestamp)
  - `/api/auth/login` (OAuth URL valasz)
  - Frontend `/` (#root + prod jelzo)
  - `/manifest.json` (ZMail)
- Opcionalis: `DEPLOY_HEALTHCHECK_URL` GET (Render Deploy Hook)

## 5. Ellenorzes (deploy utan)

```bash
# Gyors lokalis ellenorzes
VERIFY_SKIP_INITIAL_SLEEP=1 VERIFY_API_RETRIES=1 python3 scripts/verify-production.py

# Kezi health check
curl https://api.mindenes.org/api/health
# Vart: {"status":"ok","database":"connected","timestamp":...}
```

## 6. Hibaelharitas

- **Actions piros:** nezd Render (Deploy/Logs) es Vercel (Build log)
- **CORS hiba:** ellenorizd `FRONTEND_URL` env var-t Renderen
- **Cookie nem mentodik:** `sameSite: none` + `secure: true` kell
- **Render cold start:** Starter Plan mindig aktiv

## Kezi deploy (veszhelyzet)

- **Render:** Dashboard → Manual Deploy → "Deploy latest commit"
- **Vercel:** Dashboard → Deployments → "Redeploy"
