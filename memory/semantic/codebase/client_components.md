---
id: sem_code_client_components_001
type: semantic
domain: codebase
title: 'Client komponensek es hookok reszletes listaja'
summary: '37 custom hook, 22 email komponens, 11 settings panel, 5 viewer, AI komponensek (assistant, copilot, daily brief, workflow builder).'
entities:
  - hooks
  - components
  - email
  - settings
  - viewers
  - AI
tags:
  - codebase
  - client
  - components
  - hooks
  - detailed
importance: 0.90
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:client/src/hooks/
  - file:client/src/components/
retrieval_hints:
  lexical:
    - hook
    - component
    - useEmails
    - useSearch
    - EmailList
    - EmailCompose
    - EmailDetail
  semantic:
    - React hooks
    - UI components
    - frontend components
    - email components
---

# Client komponensek es hookok

## Custom hookok (37 db)

### Adat lekerdezes

| Hook                                  | Funkcio                               |
| ------------------------------------- | ------------------------------------- |
| `useEmails()` / `useEmailsInfinite()` | Email lista paginacioval              |
| `useEmailDetail()`                    | Egyetlen email reszletei              |
| `useThreadConversation()`             | Teljes email szal                     |
| `useInbox()` / `useInboxInfinite()`   | Inbox infinite scroll                 |
| `useUnreadCount()`                    | Olvasatlan szamlalo (adaptiv polling) |
| `useSearch()`                         | Kereses                               |
| `useLabels()`                         | Gmail cimkek                          |
| `useCategories()`                     | AI kategoriak                         |
| `useAttachments()`                    | Csatolmanyok paginacioval             |
| `useSavedSearches()`                  | Mentett keresek                       |
| `useNewsletters()`                    | Hirlevel feladok                      |
| `usePinnedEmails()`                   | Rogzitett levelek                     |
| `useReminders()`                      | Emlekeztetok                          |
| `useSnooze()`                         | Elaltatott levelek                    |
| `useScheduledEmails()`                | Idozitett piszkozatok                 |
| `useVip()`                            | VIP felado whitelist                  |

### Fiok es auth

`useAccounts()`, `useSession()`, `useLockScreen()`

### AI es intelligencia

`useDashboard()`, `useDailyBrief()`, `useMarketAnalysis()`,
`useDetectedTasks()`, `useIntelligence()`, `useAnalytics()`

### Beallitasok, offline, egyeb

`useSettings()`, `useOfflineSync()`, `useOnlineStatus()`,
`useKeyboardShortcuts()`, `useTasks()`, `useCalendar()`,
`useSmartFolders()`, `useInfiniteScroll()`, `useDragDrop()`,
`useTemplates()`, `useTranslate()`, `useTrash()`, `useUnifiedInbox()`

### Ertesitesek

`usePushNotifications()`, `useDesktopNotifications()`,
`useNewEmailNotification()`, `useVoiceInput()`

## Email komponensek (22 fajl)

| Komponens                | Funkcio                                  |
| ------------------------ | ---------------------------------------- |
| `EmailList.tsx`          | Paginalt email lista threading-gel       |
| `ThreadedEmailList.tsx`  | Beszelgetes-szalas nezet                 |
| `UnifiedEmailList.tsx`   | Tobb fios email lista                    |
| `EmailItem.tsx`          | Egyetlen email sor/kartya                |
| `SwipeableEmailItem.tsx` | Mobil swipe gestus-ok                    |
| `EmailDetail.tsx`        | Teljes email nezet                       |
| `ConversationView.tsx`   | Thread beszelgetes nezet                 |
| `EmailCompose.tsx`       | Level iras piszkozattal                  |
| `ComposerToolbar.tsx`    | Formatazo toolbar                        |
| `EmailAutocomplete.tsx`  | Cimzett autocomplete                     |
| `QuickReply.tsx`         | Gyors valasz javaslatok                  |
| `TemplateSelector.tsx`   | Sablon valaszto                          |
| `AttachmentView.tsx`     | Csatolmany lista                         |
| `AttachmentPreview.tsx`  | Inline csatolmany elonezet               |
| `PrintView.tsx`          | Nyomtatas-barat nezet                    |
| `BulkActionBar.tsx`      | Tobbszoros kivalasztas muveletek         |
| `LabelManager.tsx`       | Gmail cimke kezeles                      |
| `SnoozeMenu.tsx`         | Elaltatas datum/ido valaszto             |
| `ReminderMenu.tsx`       | Emlekezteto beallitas                    |
| `ScheduleMenu.tsx`       | Idozitett kuldes                         |
| `VoiceInputButton.tsx`   | Hang atiras compose-hoz                  |
| `AdvancedSearch.tsx`     | Gmail-stilus szuro (felado, datum, stb.) |

## Settings panelek (11 db)

`AccountColorSettings`, `DensitySettings`, `InboxRulesSettings`,
`NotificationPreferences`, `QuietHoursSettings`, `SignatureSettings`,
`SwipeSettings`, `TemplatesManager`, `ToolbarSettings`,
`UndoSendSettings`, `VIPSettings`

## Viewer komponensek (5 db)

`PDFViewer` (PDF.js), `ImageViewer`, `DocumentViewer` (mammoth/DOCX),
`OfficeViewer` (Excel/PPT), `SpreadsheetViewer` (xlsx)

## AI komponensek (4 db)

`AIAssistantView` — Chat interface, `DailyBriefView` — Napi osszefoglalo,
`InlineCopilotBar` — Inline AI bar compose-ban,
`WorkflowBuilder` — Vizualis automatizacio szerkeszto
