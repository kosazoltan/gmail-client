---
id: sem_comp_aquamail_vs_zmail_001
type: semantic
domain: competitors
title: "Aqua Mail vs ZMail osszehasonlitas"
summary: "Aqua Mail (mobil, 300+ feature, S/MIME, Exchange) vs ZMail (web, AI Dashboard, Gmail API, Neon PostgreSQL). Kulonbsegek es hasonlosagok."
entities:
  - Aqua Mail
  - ZMail
  - comparison
tags:
  - competitor
  - comparison
  - AquaMail
  - ZMail
  - feature-comparison
importance: 0.90
confidence: 0.90
status: active
created_at: 2026-04-10T11:00:00Z
updated_at: 2026-04-10T11:00:00Z
time_scope: current
source_refs:
  - memory:sem_comp_aquamail_features_001
  - memory:sem_arch_features_001
  - memory:proj_zmail_state_001
retrieval_hints:
  lexical:
    - Aqua Mail vs ZMail
    - osszehasonlitas
    - comparison
    - kulonbseg
    - hasonlosag
  semantic:
    - feature comparison
    - competitor analysis
    - how do they compare
    - strengths weaknesses
---

# Aqua Mail vs ZMail osszehasonlitas

## Altalanos osszehasonlitas

| Szempont            | Aqua Mail                          | ZMail                              |
| ------------------- | ---------------------------------- | ---------------------------------- |
| **Tipus**           | Mobil email kliens (app)           | Web email kliens                   |
| **Platform**        | Android, iOS                       | Web (Vercel), API (Render)         |
| **Fejleszto**       | MobiSystems                        | Egyeni projekt                     |
| **Email forras**    | IMAP/POP3/SMTP/EWS (tobbes)       | Gmail API (Google OAuth)           |
| **Adatbazis**       | Helyi eszkoz                       | Neon PostgreSQL (cloud)            |
| **Uzleti modell**   | Free + Premium (elofizetés)        | Szemelyes (self-hosted)            |
| **Nyelvek**         | 20                                 | Magyar + angol                     |
| **Kor**             | 10+ ev                             | ~1 ev aktiv fejlesztes             |

## Funkcio osszehasonlitas

### Mindkettoben megvan

| Funkcio                | Aqua Mail        | ZMail              |
| ---------------------- | ---------------- | ------------------ |
| Tobb fiok              | Igen (IMAP/EWS)  | Igen (Gmail multi) |
| Dark mode              | 4 tema           | Tailwind 4 class   |
| Kereses                | Felado/Targy/All | Smart search       |
| Thread/conversation    | Igen             | Thread View        |
| Signaturak             | HTML, fiok-spec  | Igen               |
| Rich text editor       | Igen             | Igen               |
| Push ertesitesek       | Exchange push    | SSE Real-time Push |
| Offline tamogatas      | Nativan (app)    | Offline Compose    |
| Naptar integracio      | Exchange/O365    | -                  |
| Snooze                 | Igen             | Igen               |
| Schedule send          | Igen             | Igen               |

### Csak Aqua Mail-ben

| Funkcio                    | Leiras                                   |
| -------------------------- | ---------------------------------------- |
| **S/MIME titkositas**      | E2E encryption (3DES, AES256, RC2)       |
| **EWS Exchange**           | Exchange Web Services teljes tamogatas    |
| **POP3 tamogatas**         | POP3 protokoll                           |
| **Wear OS / Android Wear** | Okosora integracio, hangos valasz         |
| **Tasker integracio**      | Automatizacio, %aqmfolder valtozo        |
| **Home screen widgetek**   | Natív Android/iOS widgetek               |
| **Cloud backup**           | Dropbox, OneDrive, Google Drive          |
| **EML fajl export**        | Egyes levelek EML formaban               |
| **Save as PDF**            | Levelek PDF-be mentese                   |
| **SSL cert tracking**      | Man-in-the-Middle vedelem                |
| **DKIM/SPF validacio**     | Email hamisitas elleni vedelem           |
| **20 nyelv**               | Szeles nyelvi tamogatas                  |

### Csak ZMail-ben

| Funkcio                    | Leiras                                   |
| -------------------------- | ---------------------------------------- |
| **AI Dashboard**           | Intelligens attekintes Bento Grid        |
| **Inline Copilot**         | AI segitseg                              |
| **Daily AI Brief**         | Napi AI osszefoglalo (cron 8:00)         |
| **Command Palette**        | Ctrl+K gyors parancsok                   |
| **RSS News**               | Hircsatorna integracio                   |
| **Crypto Prices**          | Valos ideju kriptovaluta arfolyamok      |
| **PDF/DOCX AI Analysis**   | Dokumentumok AI elemzese                 |
| **Web interface**          | Bongeszobol elerheto                     |
| **Cloud PostgreSQL**       | Neon DB, tobb gep kozott szinkron        |
| **PWA**                    | Progressive Web App                      |
| **CI/CD pipeline**         | GitHub Actions, automatikus deploy       |
| **Production hardening**   | Fail-closed env check, watchdog          |

## Eros pontok

### Aqua Mail erosségei

1. **Erett, stabil** — 10+ ev, 300+ funkcio
2. **Tobbes protokoll** — IMAP, POP3, EWS (barmelyik email szolgaltato)
3. **Natív mobil** — okosora, widget, Tasker
4. **S/MIME** — ipari szintu vegponti titkositas
5. **Szeles nyelvi tamogatas** — 20 nyelv

### ZMail erosségei

1. **AI-natív** — Dashboard, Copilot, Daily Brief, PDF/DOCX elemzes
2. **Web-alapu** — barmelyik gep, bongeszobol
3. **Modern stack** — React 19, Express 5, PostgreSQL, TypeScript
4. **Cloud-natív** — Neon DB, Vercel + Render
5. **Nyilt forras** — teljes kontroll, testreszabhatosag

## Gyengesegek

### Aqua Mail gyengesegei

- Nincs AI funkciok
- Nincs web interface
- Nincs desktop app
- Elofizeteses modell vita (Pro → Premium kenyszerites)
- Nincs EAS (Exchange ActiveSync)
- Nincs OpenPGP

### ZMail gyengesegei

- Csak Gmail API (nem IMAP/POP3/Exchange)
- Nincs natív mobil app (PWA)
- Nincs S/MIME / E2E encryption
- Nincs okosora tamogatas
- Kisebb felhasznaloi bázis
- Szemelyes projekt (nem vallalati tamogatas)
