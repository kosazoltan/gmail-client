---
id: sem_code_client_types_001
type: semantic
domain: codebase
title: "Client TypeScript tipusok (90+ interface)"
summary: "types/index.ts: 90+ interface. Email, Account, Thread, Attachment, Contact, Category, Template, Reminder, DetectedTask, CalendarEvent, MarketBriefing, SmartFolder, Workflow, stb."
entities:
  - types/index.ts
  - Email
  - Account
  - interface
tags:
  - codebase
  - client
  - types
  - TypeScript
  - interfaces
importance: 0.88
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:client/src/types/index.ts
retrieval_hints:
  lexical:
    - type
    - interface
    - Email
    - Account
    - TypeScript
    - types/index.ts
  semantic:
    - TypeScript types
    - data models
    - type definitions
    - interfaces
---

# Client TypeScript tipusok (90+ interface)

## Core domain

- `Email` — email uzenet metaadatokkal
- `Account` — Gmail fiok
- `ThreadConversation` — teljes email szal
- `Attachment` — csatolmany
- `Contact` — email kontakt

## Funkciok

- `Category` — AI kategoria
- `SenderGroup` — felado szerint csoportositva
- `Topic` — tema szerint csoportositva
- `TimePeriod` — datum szerint csoportositva
- `Template` — gyors valasz sablon
- `SavedSearch` — mentett kereses
- `SnoozedEmail` — elaltatott level
- `Reminder` — emlekezteto
- `ScheduledEmail` — idozitett piszkozat
- `VipSender` — VIP felado
- `NewsletterSender` — hirlevel feliratkozas

## AI / Intelligencia

- `DetectedTask` — automatikusan eszlelt teendo
- `ActionItem` — email torzsebol kivont teendo
- `SentimentResult` — erzelmi elemzes
- `ReplySuggestion` — AI valasz javaslat
- `RelatedEmail` — hasonlo levelek

## Calendar es Tasks

- `CalendarEvent` — Google Calendar esemeny
- `GoogleTask` — Google Tasks elem
- `TaskList` — feladatlista

## Dashboard es riporting

- `DashboardData` — prioritasos elemek, naptar, taskok
- `ActionCenterItem` — teendo (email, task, esemeny)
- `DailyBriefData` — napi osszefoglalo
- `WeeklyReportData` — heti metrikak
- `AnalyticsData` — valaszidok, felado rangsorok

## Piaci elemzes

- `MarketBriefingData` — kripto/arfolyam + AI elemzes
- `MarketAnalysisItem` — bull/bear elemzes
- `DeepAnalysisData` — reszletes arfolyam elorejelzes

## Smart Folders es Workflows

- `SmartFolder` — egyedi szurt nezet
- `SmartFolderRule` — szuro szabaly (felado, targy, csatolmany)
- `WorkflowData` — email automatizacio
- `WorkflowStep` — munkafolyamat lepes (szures, cimke, tovabbitas, AI valasz)
- `RunLogEntry` — vegrehajtasi naplo

## Kereses es chat

- `SmartSearchResult`, `SearchSuggestion`
- `ChatMessage`, `Conversation`, `AiAgentResponse`
- `PendingAgentAction` — felhasznaloi jovahagyas var

## Beallitasok

- `UserSettings` — tema, suruseg, ertesites, signatura
- `SwipeAction` — mobil swipe irany
- `CategorizationRule` — auto-kategorizalas

## Database

- `DatabaseStats`, `DatabaseEmail`, `Backup`
