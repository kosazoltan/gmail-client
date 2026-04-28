---
id: sem_code_server_services_001
type: semantic
domain: codebase
title: 'Server service-ek teljes listaja (41 fajl)'
summary: '41 service: auth, gmail, sync, AI (agent, workflow, market), email intelligence, search, categorization, calendar, task detection, newsletter, push, watchdog.'
entities:
  - services
  - gmail.service
  - auth.service
  - sync.service
  - ai-agent.service
tags:
  - codebase
  - server
  - services
  - business-logic
importance: 0.93
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:server/src/services/
retrieval_hints:
  lexical:
    - service
    - gmail.service
    - auth.service
    - sync.service
    - ai-agent
    - workflow
  semantic:
    - backend services
    - business logic
    - service layer
    - Gmail integration
---

# Server service-ek (41 fajl)

## Auth es fiokkezeles

| Service                  | Funkcio                             |
| ------------------------ | ----------------------------------- |
| `auth.service.ts`        | OAuth handling, fiok kezeles        |
| `token-vault.service.ts` | Titkositott token tarolas (AES-GCM) |
| `crypto.service.ts`      | Titkositas/visszafejtes             |

## Gmail integracio

| Service                        | Funkcio                                            |
| ------------------------------ | -------------------------------------------------- |
| `gmail.service.ts`             | Gmail API wrapper (uzenetek, cimkek, csatolmanyok) |
| `sync.service.ts`              | Hatter email szinkronizacio                        |
| `contact-harvester.service.ts` | Kontaktok kinyerese emailekbol                     |

## Email intelligencia (AI)

| Service                           | Funkcio                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `email-intelligence.service.ts`   | Action items, sentiment, valasz javaslat, kapcsolodo levelek |
| `email-classification.service.ts` | Batch email osztlyozas                                       |
| `email-signal.service.ts`         | Bulk/operativ email kategorizalas                            |
| `task-detection.service.ts`       | Megvalaszolatlan/fuggo email detektalas                      |
| `task-relevance.service.ts`       | Email relevancia ertekeles taskokhoz                         |

## Kontakt kezeles

`contact.service.ts`, `contacts.service.ts`, `vip-suggestions.service.ts`

## Kereses es szures

| Service                     | Funkcio                                 |
| --------------------------- | --------------------------------------- |
| `search.service.ts`         | Full-text email kereses                 |
| `smart-features.service.ts` | Auto-prioritizalas, followup detektalas |
| `smart-folders.service.ts`  | Virtualis mappa letrehozas es ilesztes  |
| `categorization.service.ts` | Auto-kategorizalas                      |

## Automatizacio

| Service                          | Funkcio                           |
| -------------------------------- | --------------------------------- |
| `workflow.service.ts`            | Workflow vegrehajtasi motor       |
| `ai-workflow.service.ts`         | Workflow generalas promptbol      |
| `inbox-rules.service.ts`         | Inbox automatizalasi szabalyok    |
| `calendar-automation.service.ts` | Naptar esemeny kinyerese/szinkron |
| `invoice-automation.service.ts`  | Havi szamla elosztas              |
| `digest-scheduler.service.ts`    | AI digest utemezese               |

## AI es intelligencia

| Service                     | Funkcio                               |
| --------------------------- | ------------------------------------- |
| `ai-agent.service.ts`       | Agent tervezes es vegrehajtás         |
| `ai-agent-tools.service.ts` | AI agent eszkozok (kereses, workflow) |
| `ai-market.service.ts`      | Piaci elemzes generalas               |

## Adat es analitika

| Service                      | Funkcio                          |
| ---------------------------- | -------------------------------- |
| `analytics.service.ts`       | Analitika aggregalas             |
| `market-data.service.ts`     | Piaci arfolyamok, hirek, trendek |
| `news.service.ts`            | Hircikk lekerdezes               |
| `document-parser.service.ts` | Csatolmany elemzes (PDF, DOCX)   |

## Felhasznaloi funkciok

`newsletter.service.ts`, `attachment.service.ts`, `push.service.ts`,
`database.service.ts`

## Rendszer es monitoring

| Service                       | Funkcio                          |
| ----------------------------- | -------------------------------- |
| `audit-log.service.ts`        | Audit esemeny logolas            |
| `runtime-watchdog.service.ts` | Kritikus job egeszseg monitor    |
| `action-center.service.ts`    | Action center elemek aggregalasa |

## AI Provider (ai/provider.ts)

```typescript
callAI(messages, options?) → Promise<AIResponse>
```

- Tamogatott: OpenAI (default) vagy Anthropic
- Env: `AI_PROVIDER`, `AI_MODEL` (default: gpt-4o-mini)
- Kulcs: `OPENAI_API_KEY` vagy `ANTHROPIC_API_KEY`
