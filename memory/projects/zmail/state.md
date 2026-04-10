---
id: proj_zmail_state_001
type: project
domain: project_state
title: "ZMail projekt aktualis allapota"
summary: "ZMail: modern Gmail kliens. React 19 + Express 5 + Neon PostgreSQL. Production: mail.mindenes.org + api.mindenes.org. Allapot: aktiv fejlesztes."
entities:
  - ZMail
  - gmail-client
  - mindenes.org
tags:
  - project-state
  - current
  - overview
importance: 0.99
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: current
source_refs:
  - file:REPO_STATE.md
  - file:CLAUDE.md
  - file:package.json
retrieval_hints:
  lexical:
    - ZMail
    - projekt
    - allapot
    - state
    - attekintes
  semantic:
    - project overview
    - current state
    - project summary
---

# ZMail projekt allapot

## Azonosito

- **Nev:** ZMail (Gmail Client)
- **Repo:** kosazoltan/gmail-client
- **Monorepo:** root + `server/` + `client/`
- **Licence:** private

## Production URL-ek

| Szolgaltatas | URL                          |
| ------------ | ---------------------------- |
| Frontend     | https://mail.mindenes.org    |
| Backend API  | https://api.mindenes.org     |
| API Health   | https://api.mindenes.org/api/health |

## Technologiai stack

- **Frontend:** React 19.2.4 + Vite 7.3.1 + Tailwind CSS 4.1.18 + TypeScript
- **Backend:** Express 5.2.1 + TypeScript + Node.js 20.18.1
- **DB:** Neon PostgreSQL (eu-west-2 pooler)
- **Hosting:** Vercel (frontend) + Render Frankfurt (backend)
- **DNS:** Cloudflare
- **CI/CD:** GitHub Actions

## Foebb funkciok

- Email olvasas/kuldes/valasz/tovabbitas (Gmail API)
- Smart szervezes (felado, tema, idoszak, kategoria)
- Command Palette (Ctrl+K)
- AI Dashboard, Inline Copilot, Daily AI Brief
- Thread View, SSE Real-time Push
- RSS News, Crypto Prices
- PDF/DOCX AI Analysis
- Offline Compose (IndexedDB)
- Dark mode, PWA, reszponziv

## Statisztikak (2026-03-11)

- 31+ commit
- Render: `srv-d6h9il450q8c73af5lk0`
- Index chunk: 248KB (gzip: 75KB)
- Build ido: ~3.2s (client), ~4.3s (server)
