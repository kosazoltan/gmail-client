---
id: wiki_zmail_overview
type: semantic
domain: wiki
title: "ZMail — projekt attekintes (wiki)"
summary: "L2 synthesis: ZMail teljes attekintes egy oldalon. Stack, funkciok, deploy, biztonsag, CI/CD, tortenelem."
entities:
  - ZMail
tags:
  - wiki
  - overview
  - synthesis
importance: 0.95
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: current
source_refs:
  - memory:proj_zmail_state_001
  - memory:sem_arch_stack_001
  - memory:sem_arch_deploy_001
  - memory:sem_arch_features_001
retrieval_hints:
  lexical:
    - ZMail
    - attekintes
    - overview
    - osszefoglalas
    - projekt
  semantic:
    - project overview
    - what is ZMail
    - project summary
---

# ZMail — projekt attekintes

## Mi a ZMail?

Modern, reszponziv Gmail kliens webalkalmazas. Szemelyes hasznalatra keszult,
bovitett email elmennyel: smart szervezes, AI funkciok, valos ideju adatok.

## Stack (2026-04)

**Frontend:** React 19 + Vite 7 + Tailwind CSS 4 + TypeScript → Vercel (mail.mindenes.org)
**Backend:** Express 5 + TypeScript + Node.js 20 → Render Frankfurt (api.mindenes.org)
**Database:** Neon PostgreSQL (eu-west-2 pooler)
**DNS:** Cloudflare (api = DNS only!)
**CI/CD:** GitHub Actions (CI → Deploy healthcheck → Security)

## Fo funkciok

- Gmail API integracioEmail olvasas/kuldes/valasz/tovabbitas
- Smart szervezes: felado, tema, idoszak, kategoria
- Command Palette (Ctrl+K)
- AI Dashboard + Inline Copilot + Daily AI Brief
- Thread View + SSE Real-time Push
- RSS News + Crypto Prices
- PDF/DOCX AI Analysis
- Offline Compose (IndexedDB)
- Dark mode (Tailwind 4 class-based)
- PWA (standalone, safe area)

## Biztonsag

- Production fail-closed: kotelezo env ellenorzes indulaskor
- Watchdog: percenkenti kritikus job monitoring
- OAuth token titkositas (AES-256, Neon persistent)
- CORS whitelist
- Delete protection middleware
- Gitleaks + npm audit (GitHub Actions)

## Tortenelem

| Datum      | Esemeny                                          |
| ---------- | ------------------------------------------------ |
| 2026-02-16 | CORS hiba javitasa (tobb origin tamogatas)       |
| 2026-02-27 | 2026 Redesign (code splitting, TW4, design)      |
| 2026-02-27 | Stack modernizacio (React 19, Vite 7, Express 5) |
| 2026-03-11 | sql.js → Neon PostgreSQL migracio                |
| 2026-04-10 | Memoriarendszer letrehozasa                      |

## Kapcsolodo memoriak

- Reszletes stack: `sem_arch_stack_001`
- Deployment: `sem_arch_deploy_001`
- Database: `sem_db_neon_001`
- OAuth: `sem_oauth_google_001`
- Szabalyok: `proc_rules_critical_001`
- Korlatozasok: `proj_zmail_constraints_001`
