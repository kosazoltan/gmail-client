---
id: sem_arch_stack_001
type: semantic
domain: architecture
title: 'ZMail technologiai stack'
summary: 'A ZMail projekt teljes technologiai stackje: React 19 + Vite 7 + Tailwind 4 frontend, Express 5 + TypeScript + PostgreSQL/Neon backend.'
entities:
  - ZMail
  - React
  - Vite
  - Tailwind
  - Express
  - PostgreSQL
  - Neon
  - TypeScript
tags:
  - stack
  - architecture
  - frontend
  - backend
  - framework
importance: 0.98
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-02-27
source_refs:
  - file:CLAUDE.md
  - file:MODERNIZATION_SUMMARY.md
  - file:REPO_STATE.md
retrieval_hints:
  lexical:
    - stack
    - React
    - Express
    - Vite
    - Tailwind
    - TypeScript
    - Neon
    - PostgreSQL
  semantic:
    - technology stack
    - framework versions
    - project architecture
---

# ZMail technologiai stack

## Frontend (Vercel — mail.mindenes.org)

| Technologia           | Verzio  | Megjegyzes                           |
| --------------------- | ------- | ------------------------------------ |
| React                 | 19.2.4  | React Compiler ready, Actions, use() |
| Vite                  | 7.3.1   | ~20% gyorsabb build                  |
| Tailwind CSS          | 4.1.18  | Oxide Engine, 10x gyorsabb build     |
| TypeScript            | latest  | Strict mode                          |
| @tanstack/react-query | 5.90.21 | Server state management              |
| lucide-react          | 0.563.0 | Ikonok                               |
| pdfjs-dist            | 5.4.624 | PDF megjeleniteshez                  |

### Frontend build

- `@tailwindcss/vite` plugin (nem postcss.config.js)
- `@custom-variant dark` az index.css-ben (class-based dark mode)
- Code splitting: 20 view lazy loaded (248KB index chunk)
- PWA: Safe area padding, standalone mode
- Chunk size warning limit: 1100 KB (ResizablePanels chunk: ~1055 KB)

## Backend (Render Frankfurt — api.mindenes.org)

| Technologia | Verzio  | Megjegyzes               |
| ----------- | ------- | ------------------------ |
| Express     | 5.2.1   | Async/await, modern MW   |
| TypeScript  | latest  | ESM (`"type": "module"`) |
| PostgreSQL  | Neon    | Cloud, pooler connection |
| Node.js     | 20.18.1 | Engine lock              |
| Winston     | latest  | Strukturalt logging      |
| googleapis  | 171.0.0 | Gmail API                |
| pg          | latest  | PostgreSQL driver        |
| pdf-parse   | latest  | PDF elemzes              |
| mammoth     | latest  | DOCX elemzes             |

### Backend build

- `npm install --include=dev && npm run build` (Render buildCommand)
- `@types/*` es `typescript` MINDIG devDependencies
- ESM modul rendszer: `"type": "module"` a package.json-ben

## Monorepo struktura

```
gmail-client/
  package.json          # Root workspace (husky, prettier, lint-staged)
  server/               # Express backend
    package.json        # "gmail-client-server"
  client/               # React frontend
    package.json        # "gmail-client-frontend"
```
