---
id: sem_arch_features_001
type: semantic
domain: architecture
title: "ZMail funkciok es szolgaltatasok"
summary: "ZMail osszes funkcioja: Command Palette, AI Dashboard, Inline Copilot, Thread View, SSE Push, Daily AI Brief, RSS, Crypto, PDF/DOCX AI, Offline Compose."
entities:
  - ZMail
  - Command Palette
  - AI Dashboard
  - Copilot
  - SSE
  - RSS
  - Crypto
tags:
  - features
  - functionality
  - services
  - capabilities
importance: 0.90
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-03-11
source_refs:
  - file:REPO_STATE.md
  - file:docs/google-oauth-verification.md
retrieval_hints:
  lexical:
    - feature
    - function
    - service
    - Command Palette
    - AI Dashboard
    - Copilot
    - SSE
    - RSS
    - crypto
  semantic:
    - application features
    - product capabilities
    - service list
---

# ZMail funkciok

## Alapveto email funkciok

- Email olvasas, kuldes, valasz, tovabbitas
- Cimke (label) kezeles
- Keresesi muveletek (saved searches)
- Email emlekeztetok (reminders) es follow-up tracking
- Newsletter kezeles
- Csatolmany bongeszo (attachment browser)
- Multi-account tamogatas
- Dark mode
- Reszponziv dizajn (desktop + mobil)
- PWA tamogatas (standalone, safe area)

## Haladó funkciok (2026-03-11)

| Funkcio             | Leiras                                    |
| ------------------- | ----------------------------------------- |
| Command Palette     | Gyors parancsok: `Ctrl+K`                 |
| AI Dashboard        | Intelligens attekintes Bento Grid-ben      |
| Inline Copilot      | Kodszerkesztes kozbeni AI segitseg        |
| Thread View         | Levelek szalakba rendezese               |
| SSE Real-time Push  | Valos ideju adatok szerverre push          |
| Daily AI Brief      | Napi AI osszefoglalo (cron 8:00)          |
| RSS News            | Hircsatorna integracio                    |
| Crypto Prices       | Valos ideju kriptovaluta arfolyamok       |
| PDF/DOCX AI Analysis| Dokumentumok AI alapu elemzese           |
| Offline Compose     | Levelek offline osszeallitasa (IndexedDB) |

## Backend service-ek

- `news.service` — RSS hirek
- `crypto.service` — kriptovaluta arfolyamok
- `document-parser.service` — PDF/DOCX elemzes
- `ai-market.service` — AI piaci elemzesek

## Smart email szervezes

- Felado szerinti csoportositas
- Tema szerinti csoportositas
- Idoszak szerinti csoportositas
- Kategoria szerinti csoportositas
