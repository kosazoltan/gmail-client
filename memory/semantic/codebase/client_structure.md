---
id: sem_code_client_structure_001
type: semantic
domain: codebase
title: "Client kodbazis struktura es routing"
summary: "React 19 frontend: 23 page view, 25+ lazy-loaded route, App.tsx routing, main.tsx entry point, Tailwind 4, PWA service worker."
entities:
  - client/src
  - App.tsx
  - main.tsx
  - React Router
  - lazy loading
tags:
  - codebase
  - client
  - structure
  - routing
  - frontend
importance: 0.94
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:client/src/App.tsx
  - file:client/src/main.tsx
retrieval_hints:
  lexical:
    - client
    - frontend
    - route
    - view
    - page
    - component
    - App.tsx
    - main.tsx
  semantic:
    - frontend structure
    - client architecture
    - routing setup
    - page components
---

# Client kodbazis struktura

## Konyvtar fa

```
client/src/
  components/
    accounts/       # Fiok valtas, kivalasztas
    ai/             # AI features (assistant, daily brief, copilot)
    auth/           # Bejelentkezes, zarolasi kepernyo
    common/         # Kozos UI komponensek (banner, skeleton, toast)
    database/       # DB kezelo UI
    email/          # Email komponensek (22 fajl: lista, detail, compose)
    layout/         # Elrendezes (sidebar, header, theme toggle)
    pages/          # Statikus oldalak (privacy, terms)
    pwa/            # PWA (install prompt, push notifications)
    settings/       # Beallitasok (11 panel)
    viewers/        # Fajlmegjelenito (PDF, Office, kep)
    views/          # Oldal-szintu nezetek (23 route)
  contexts/         # React Context providerek
  hooks/            # Custom React hookok (37 darab)
  lib/              # Segedprogramok, API kliens (api.ts: 1369 sor, 70+ endpoint)
  types/            # TypeScript tipusdefiniciok (90+ interface)
  test/             # Unit tesztek
  App.tsx           # Root component, routing
  main.tsx          # Entry point
  index.css         # Globalis stilusok (Tailwind 4)
```

## Routing (App.tsx)

25+ lazy-loaded route React Router 7.1-gyel:

| Route                 | View komponens       | Cél                           |
| --------------------- | -------------------- | ----------------------------- |
| `/`                   | InboxView            | Fo beerkezett levelek          |
| `/dashboard`          | DashboardView        | AI action center               |
| `/unified`            | UnifiedInboxView     | Tobb fios egyesitett inbox     |
| `/by-sender`          | BySenderView         | Felado szerinti csoportositas  |
| `/by-topic`           | ByTopicView          | Tema szerinti                  |
| `/by-time`            | ByTimeView           | Idoszak szerinti               |
| `/by-category`        | CategoryView         | AI kategoria szerinti          |
| `/personal`           | PersonalView         | Szemelyes levelek              |
| `/invoices`           | InvoicesView         | Szamlak/nyugtak                |
| `/trash`              | TrashView            | Torolt levelek                 |
| `/label/:labelId`     | LabelView            | Gmail cimke szures             |
| `/attachments`        | AttachmentsView      | Csatolmanyos levelek           |
| `/reminders`          | RemindersView        | Emlekeztetok                   |
| `/newsletters`        | NewslettersView      | Hirevelek                      |
| `/scheduled`          | ScheduledView        | Idozitett levelek              |
| `/search`             | SearchResults        | Kereses eredmenyek             |
| `/settings`           | SettingsView         | Beallitasok                    |
| `/calendar`           | CalendarView         | Google Calendar                |
| `/tasks`              | TasksView            | Google Tasks                   |
| `/market`             | MarketAnalysisView   | Piaci elemzes                  |
| `/smart-folders`      | SmartFoldersView     | Okos mappak                    |
| `/ai-assistant`       | AIAssistantView      | AI chat                        |
| `/thread/:threadId`   | ThreadView           | Email beszelgetes szal          |
| `/analytics`          | AnalyticsView        | Email metrikak                 |
| `/compose`            | ComposeView          | Uj level irasa                 |
| `/privacy`            | PrivacyPolicy        | Adatvedelmi iranyelvek         |
| `/terms`              | TermsOfService       | Felhasznalasi feltetelek       |

## Reszponziv breakpointok

- Mobile: < 768px (Samsung Fold: < 680px)
- Tablet: 768px - 1024px
- Desktop: >= 1024px
- Sidebar overlay + backdrop mobil eseten
