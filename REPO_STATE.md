# 📋 REPO STATE — Gmail Client (ZMail)
> Utoljára frissítve: 2026-03-08 | Commit: ca60e82 | Branch: main

## ⚡ GYORS ÖSSZEFOGLALÓ (olvasd ELŐSZÖR)
- **Mi ez:** AI-vezérelt Gmail kliens (mindenes.org)
- **Stack:** React 19 + TS + Tailwind 4 + Vite (Vercel) / Express 5 + TS + sql.js (Render Frankfurt)
- **Frontend:** mail.mindenes.org (Vercel)
- **Backend:** api.mindenes.org (Render Frankfurt, srv-d6h9il450q8c73af5lk0)
- **DB:** sql.js (in-memory SQLite, Render disk persist)
- **AI:** Anthropic — Haiku 4.5 (egyszerű), Sonnet 4.6 (komplex)
- **GitHub:** kosazoltan/gmail-client

## 📊 MÉRET
| Elem | Darab |
|------|-------|
| Server route fájl | 31 |
| Server service | 16 |
| Client view | 21 |
| Client hook | 29 |
| Types (index.ts) | 605 sor |
| DB schema (db/index.ts) | 556 sor |
| DB tábla | ~25 |
| DB index | 55+ |
| Összes commit | 210 |

## 🏗️ ARCHITEKTÚRA
```
client/                          server/
├── src/                         ├── src/
│   ├── App.tsx (28 route)       │   ├── server.ts (entry, 31 route reg)
│   ├── lib/api.ts (centrális)   │   ├── db/index.ts (schema+query)
│   ├── types/index.ts           │   ├── routes/ (31 fájl)
│   ├── hooks/ (29 hook)         │   ├── services/ (16 fájl)
│   ├── components/              │   ├── middleware/ (auth, error, delete-prot)
│   │   ├── views/ (21 view)    │   └── utils/ (logger)
│   │   ├── layout/ (Sidebar)   │
│   │   ├── email/ (detail,list)│
│   │   └── ai/ (SmartSearch)   │
│   └── lib/ (api, utils)       │
```

## 🔑 KRITIKUS FÁJLOK (mindig olvasd be fejlesztés előtt)
1. `client/src/lib/api.ts` — MINDEN frontend API hívás itt van (centralizált)
2. `client/src/types/index.ts` — MINDEN TypeScript típus
3. `server/src/db/index.ts` — DB séma + query helper-ek
4. `server/src/server.ts` — Route regisztráció, middleware, cron
5. `client/src/App.tsx` — Route definíciók
6. `client/src/components/layout/Sidebar.tsx` — Navigáció

## 🎯 FEJLESZTÉSI ÁLLAPOT
### Kész funkciók ✅
- Email kezelés (list, read, send, reply, star, delete, batch)
- Multi-account (OAuth2, account switch)
- Smart kategóriák (system + user, M:N email_categories)
- AI Asszisztens (chat, smart search, action items, sentiment)
- Workflow engine (trigger → action chain, cron)
- Naptár CRUD (Google Calendar API)
- Piaci elemzés (Frankfurter API + AI deep analysis)
- Smart Folders (AI szabály-alapú)
- Feladat detektálás (SSE scan + unread detection)
- Hírlevél kezelés, sablonok, emlékeztetők
- VIP küldők, szundi, ütemezett küldés
- Mellékletek, címkék, kontaktok
- Offline SW cache, push notification
- Cross-account keresés, mentett keresések

### Aktív fejlesztés 🔧
- Console.log → logger migráció (22 fájl, ~100 hívás)
- Type safety javítás (SmartSearchBar `as unknown` maradt)
- Általános code quality emelés

### Ismert hiányosságok ⚠️
- Nincs end-to-end teszt (Playwright)
- Chunk méret warning (Vite build, DocumentViewer 503KB)
- SmartSearchBar-ban maradt 1 `as unknown`

## ⚠️ KIEMELT FIGYELMEZTETŐ PONTOK
1. **api.ts centralizált** — MINDEN API hívás ITT van. Új endpoint = ide is kell!
2. **DB schema = db/index.ts** — Nincs Flyway/migration, CREATE IF NOT EXISTS
3. **Session-based auth** — express-session, cookie, CORS credentials:include
4. **Cross-origin setup** — SameSite=None; Secure; Domain=.mindenes.org
5. **Render cold start** — 502 → CORS error a böngészőben (nem valós CORS hiba)
6. **sql.js in-memory** — Render disk persist, de restart = reload from disk
7. **Frankfurter API** — Rate limit nincs, de napi ~5-10 hívás javasolt
8. **Anthropic API key** — env var: ANTHROPIC_API_KEY
9. **Google OAuth** — Project 819982945323, Internal app
10. **DELETE body NEM megbízható** — POST használata törléshez

## 📝 PARANCSSOR ÖSSZEFOGLALÓ
```bash
# TSC ellenőrzés
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Build
cd server && npm run build
cd client && npm run build

# Dev
cd server && npm run dev     # localhost:3001
cd client && npm run dev     # localhost:5173

# Git
git log --oneline -10
git diff HEAD~1 --stat
git push origin main
```

## 🔄 UTOLSÓ SESSION MUNKÁJA (2026-03-08)
- Tanács konzílium: 6 tag (Junior+Tamás+Eszter+Gábor+Nóra+Bence) értékelés + kutatás
- Törvény konszolidáció: SOUL.md 52KB→39KB (-26%), 8-17 törvény → skill
- 18. törvény: Öngyógyító, önfejlesztő rendszer
- CI/CD pipeline: GitHub Actions (TSC+build+E2E)
- AI SQL Security Layer: 23 tiltott keyword, parameterized user filter, audit trail
- Severity Classifier: gépi döntési fa (CRITICAL→INFO)
- Playwright E2E: 10 spec, 31 teszt, mock-based
- sql.js migráció terv: better-sqlite3 + WAL mode roadmap
- Console→logger: 100% server lefedettség
- Type safety: as unknown hack-ek eltávolítva
- Eszter review: 2C+3H+4M → mind javítva