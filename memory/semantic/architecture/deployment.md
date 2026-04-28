---
id: sem_arch_deploy_001
type: semantic
domain: architecture
title: 'ZMail deployment architektura'
summary: 'Vercel frontend (mail.mindenes.org) + Render backend Frankfurt (api.mindenes.org) + Neon PostgreSQL. Automatikus deploy GitHub push-ra.'
entities:
  - Vercel
  - Render
  - Neon
  - Cloudflare
  - mindenes.org
tags:
  - deployment
  - infrastructure
  - hosting
  - domain
  - DNS
importance: 0.97
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-02-16
source_refs:
  - file:DEPLOY_INSTRUCTIONS.md
  - file:CLAUDE.md
  - file:render.yaml
retrieval_hints:
  lexical:
    - deploy
    - Vercel
    - Render
    - Cloudflare
    - domain
    - DNS
    - hosting
  semantic:
    - deployment architecture
    - hosting platform
    - production environment
---

# ZMail deployment architektura

## Platformok

| Komponens   | Platform   | Domain             | Regio     |
| ----------- | ---------- | ------------------ | --------- |
| Frontend    | Vercel     | mail.mindenes.org  | Auto      |
| Backend API | Render     | api.mindenes.org   | Frankfurt |
| Adatbazis   | Neon       | eu-west-2 (pooler) | EU        |
| DNS/CDN     | Cloudflare | mindenes.org       | Global    |

## Render service

- Nev: **gmail-client-api**
- Plan: Starter ($7/ho)
- Disk: 1GB persistent (`/data`)
- Health check: `/api/health`
- Auto deploy: igen (main branch push)
- Blueprint: `render.yaml` (de meglevo service-nel a Dashboard felulirja)

## Vercel frontend

- Root directory: `client`
- Framework: Vite (auto-detect)
- **VITE_API_URL = `https://api.mindenes.org/api`** (KOTELEZO!)
- Auto deploy: igen (main branch push)

## DNS (Cloudflare)

| Tipus | Nev  | Cel                           | Proxy                        |
| ----- | ---- | ----------------------------- | ---------------------------- |
| CNAME | mail | cname.vercel-dns.com          | -                            |
| CNAME | api  | gmail-client-api.onrender.com | **SZURKE felho (DNS only!)** |

**KRITIKUS:** Az `api` rekord SZURKE felho (DNS only) kell legyen!
Narancssarga felho (Proxy) eseten 403 hiba a Render SSL utkozese miatt.

## Deploy folyamat

1. Push `main` branch-re
2. CI workflow lefut (lint + tsc + build)
3. CI zold → Render es Vercel automatikusan deployol
4. Deploy healthcheck workflow lefut (tartalmi smoke)
5. Opcionalis DEPLOY_HEALTHCHECK_URL GET

## Legacy VPS

- Host: mail.mindenes.org (root SSH)
- PM2 process manager
- Nginx reverse proxy
- Let's Encrypt SSL
- **Statusz: lecserelve Vercel + Render-re**
