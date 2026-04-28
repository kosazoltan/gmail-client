---
id: sem_code_client_api_001
type: semantic
domain: codebase
title: 'Client API kliens — osszes endpoint (70+)'
summary: 'lib/api.ts: 1369 sor, 70+ endpoint. Auth, emails, views, categories, contacts, snooze, reminders, labels, newsletters, calendar, tasks, market, AI, workflows, analytics.'
entities:
  - api.ts
  - endpoints
  - TanStack Query
tags:
  - codebase
  - client
  - API
  - endpoints
  - data-fetching
importance: 0.93
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:client/src/lib/api.ts
retrieval_hints:
  lexical:
    - api.ts
    - endpoint
    - fetch
    - API kliens
    - emails.list
    - emails.send
  semantic:
    - API client code
    - endpoint reference
    - data fetching
    - HTTP calls
---

# Client API kliens (lib/api.ts)

1369 sor, 70+ endpoint. Hiba kezeles: exponential backoff (max 5), 30s timeout,
API degradation tracking, custom error tipusok (TimeoutError, HttpStatusError,
ApiTemporarilyUnavailableError).

## Endpoint csoportok

### Auth

`auth.getLoginUrl()`, `auth.getSession()`, `auth.logout(accountId)`,
`auth.switchAccount(accountId)`

### Accounts

`accounts.getAll()`, `accounts.delete(id)`, `accounts.sync(id, full?)`,
`accounts.resync(id)`, `accounts.updateColor(id, color)`

### Emails (CRUD + batch)

`emails.list(params)`, `emails.get(id)`, `emails.getThread(id)`,
`emails.send(data)`, `emails.reply(data)`, `emails.markRead(id, isRead)`,
`emails.toggleStar(id)`, `emails.delete(id)`, `emails.batchDelete(ids)`,
`emails.batchMarkRead(ids, isRead)`

### Views (szervezett nezetek)

`views.inbox()`, `views.unified()`, `views.bySender()`,
`views.bySenderEmails()`, `views.byTopic()`, `views.byTopicEmails()`,
`views.byTime()`, `views.byTimeEmails()`, `views.byCategory()`,
`views.byCategoryEmails()`, `views.trash()`

### Categories (AI osztályozas)

`categories.list()`, `categories.create()`, `categories.update()`,
`categories.getForEmail()`, `categories.addEmail()`,
`categories.removeEmail()`, `categories.rules()`

### Contacts

`contacts.search()`, `contacts.frequent()`, `contacts.add()`,
`contacts.update()`, `contacts.harvest()`

### Snooze es Reminders

`snooze.create()`, `snooze.remove()`,
`reminders.list()`, `reminders.create()`, `reminders.update()`,
`reminders.complete()`

### Labels (Gmail)

`labels.list()`, `labels.create()`, `labels.delete()`,
`labels.addToEmail()`, `labels.removeFromEmail()`

### Newsletters

`newsletters.list()`, `newsletters.sync()`, `newsletters.emails()`,
`newsletters.mute()`, `newsletters.delete()`

### Scheduled / Templates / Searches

`scheduled.*`, `templates.*`, `searches.*`

### Pinned / VIP

`pinned.toggle()`, `pinned.list()`,
`vip.list()`, `vip.add()`, `vip.remove()`, `vip.toggle()`

### Calendar (Google Calendar)

`calendar.list()`, `calendar.create()`, `calendar.update()`,
`calendar.delete()`, `calendar.suggestions()`, `calendar.syncSuggestion()`

### Tasks (Google Tasks)

`tasks.listLists()`, `tasks.getList()`, `tasks.create()`,
`tasks.update()`, `tasks.delete()`

### Market (kripto/arfolyam)

`market.briefing()`, `market.deepAnalysis()`, `market.trend(days)`

### Intelligence (AI)

`intelligence.actionItems()`, `intelligence.detectTasks()`,
`intelligence.sentiment()`, `intelligence.replySuggestions()`,
`intelligence.relatedEmails()`, `intelligence.weeklyReport()`

### AI Chat

`ai.chat()`, `ai.smartSearch()`, `ai.conversations()`,
`ai.deleteConversation()`

### Smart Folders

`smartFolders.list()`, `smartFolders.create()`, `smartFolders.update()`,
`smartFolders.delete()`, `smartFolders.emails()`, `smartFolders.classify()`

### Analytics

`analytics.priorities()`, `analytics.data(period)`, `analytics.daily()`

### Workflows (automatizacio)

`workflows.list()`, `workflows.create()`, `workflows.update()`,
`workflows.delete()`, `workflows.run()`, `workflows.runs()`

### Database

`database.stats()`, `database.deleteOldEmails()`, `database.backup()`,
`database.deleteBackup()`

### Push Notifications

`push.subscribe()`, `push.unsubscribe()`, `push.test()`

### Detected Tasks

`detectedTasks.list()`, `detectedTasks.stats()`, `detectedTasks.update()`,
`detectedTasks.delete()`, `detectedTasks.snooze()`

### Inbox Rules

`inboxRules.list()`, `inboxRules.create()`, `inboxRules.update()`,
`inboxRules.delete()`

## State management

- **TanStack Query** (React Query 5.90): primary (cache, infinite queries, mutations)
- **ThemeContext**: sotet/vilagos tema
- **localStorage**: keresesi elozmeny, tema preferencia, beallitasok
