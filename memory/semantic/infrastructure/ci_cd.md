---
id: sem_infra_cicd_001
type: semantic
domain: infrastructure
title: 'CI/CD pipeline es GitHub Actions'
summary: 'GitHub Actions: CI (lint+tsc+build), Deploy healthcheck (verify-production.py), API smoke, Security (Gitleaks+npm audit). E2E: Playwright.'
entities:
  - GitHub Actions
  - CI
  - Playwright
  - Gitleaks
tags:
  - CI/CD
  - GitHub Actions
  - testing
  - automation
  - pipeline
importance: 0.92
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-03-11
source_refs:
  - file:.github/workflows/ci.yml
  - file:.github/workflows/deploy-healthcheck.yml
  - file:.github/workflows/api-smoke.yml
  - file:.github/workflows/security.yml
  - file:CLAUDE.md
retrieval_hints:
  lexical:
    - CI
    - CD
    - GitHub Actions
    - workflow
    - lint
    - build
    - test
    - Playwright
    - healthcheck
  semantic:
    - continuous integration
    - automated testing
    - build pipeline
    - deployment verification
---

# CI/CD pipeline

## Workflow-k

### 1. CI (`.github/workflows/ci.yml`)

Trigger: push/PR a `main`-re

**Server job:**

```
cd server && npm ci && npm run lint && npx tsc --noEmit && npm run build
```

**Client job:**

```
cd client && npm ci && npm run lint && npx tsc --noEmit && npm run build
```

**E2E job** (continue-on-error):

- Playwright chromium
- Mock backend (port 5000)
- Artifact upload on failure

### 2. Deploy healthcheck (`.github/workflows/deploy-healthcheck.yml`)

Trigger: CI sikeres a `main`-en (`workflow_run`) + workflow_dispatch

- `scripts/verify-production.py` futtat:
  - `/api/health` (JSON: status + database + timestamp)
  - `/api/auth/login` (OAuth URL)
  - Frontend `/` (#root + prod jelzo)
  - `/manifest.json` (ZMail)
- Opcionalis `DEPLOY_HEALTHCHECK_URL` GET (Render Deploy Hook)

Valtozok: `ZMAIL_API_BASE`, `ZMAIL_API_HEALTH_URL`, `ZMAIL_FRONTEND_URL`, `VERIFY_SKIP_INITIAL_SLEEP`

### 3. API secrets smoke (`.github/workflows/api-smoke.yml`)

Trigger: workflow_dispatch (kezzel)

- `RENDER_API_KEY` ellenorzes (`rnd_...` → Render API v1)
- `GITHUB_PAT` ellenorzes (GitHub API /user)

### 4. Security (`.github/workflows/security.yml`)

Trigger: push barmelyik branchre, PR a main-re

- **Gitleaks:** titkos kulcsok keresese
- **npm audit:** high+ sebezhetosegek (continue-on-error)

## Lokalis ellenorzes (Push Checklist)

```bash
cd server && npm run lint && npx tsc --noEmit && npm run build
cd client && npm run lint && npx tsc --noEmit && npm run build
```
