# ZMail — Gmail Client

Full-featured Gmail kliens a [mindenes.org](https://mindenes.org) platformhoz.

## Tech Stack

| Layer          | Technológia                                                            |
| -------------- | ---------------------------------------------------------------------- |
| **Frontend**   | React 19 + TypeScript + Vite + TailwindCSS                             |
| **Backend**    | Node.js + Express + TypeScript                                         |
| **Database**   | PostgreSQL 16                                                          |
| **Auth**       | Google OAuth 2.0                                                       |
| **AI**         | OpenAI vagy Anthropic provider (AI chat, kategorizáció, összefoglalás) |
| **Testing**    | Vitest + Testing Library                                               |
| **API Docs**   | Swagger / OpenAPI 3.0                                                  |
| **Monitoring** | Sentry (server + client)                                               |

## Könyvtárszerkezet

```
gmail-client/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # UI komponensek
│   │   ├── hooks/           # React hookok
│   │   ├── lib/             # Utility-k (dateFormatter, sanitize, stb.)
│   │   ├── pages/           # Oldalak / nézetek
│   │   ├── test/            # Test setup
│   │   └── utils/           # Sentry, stb.
│   └── vitest.config.ts
├── server/                  # Express backend
│   ├── src/
│   │   ├── db/              # Adatbázis réteg (pool, queries, migrations)
│   │   ├── middleware/       # Request ID, CORS, security headers, delete protection
│   │   ├── routes/          # 40 API route modul
│   │   ├── services/        # Üzleti logika (auth, gmail, sync, AI, stb.)
│   │   ├── utils/           # Logger, CORS config, Sentry, Swagger
│   │   ├── app.ts           # Express app factory
│   │   ├── cron.ts          # Háttérfeladatok
│   │   └── server.ts        # Startup orchestrator
│   └── vitest.config.ts
├── docs/                    # Dokumentáció
│   └── MIGRATION_PLAN.md    # DB migrációs terv (31 tábla)
└── package.json
```

## Gyors indítás

### Előfeltételek

- Node.js 20+
- PostgreSQL 16+
- Google Cloud Console projekt OAuth 2.0 beállítással

### Telepítés

```bash
# Clone
git clone https://github.com/kosazoltan/gmail-client.git
cd gmail-client

# Server
cd server
npm install
cp .env.example .env   # Töltsd ki a szükséges értékeket
npm run dev

# Client (másik terminál)
cd client
npm install
npm run dev
```

### Környezeti változók (server `.env`)

| Változó                | Leírás                                            | Kötelező                                                           |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`         | PostgreSQL connection string                      | ✅                                                                 |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID                            | ✅                                                                 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret                        | ✅                                                                 |
| `SESSION_SECRET`       | Express session titkosítás                        | ✅                                                                 |
| `FRONTEND_URL`         | Frontend URL (CORS)                               | ✅                                                                 |
| `PORT`                 | Server port                                       | ❌ (default: 5000)                                                 |
| `SENTRY_DSN`           | Sentry error tracking                             | ❌                                                                 |
| `AI_PROVIDER`          | `openai` vagy `anthropic`                         | ❌ (default: openai)                                               |
| `AI_MODEL`             | Provider modell neve                              | ❌ (default: OpenAI `gpt-5.4-mini`, Anthropic `claude-sonnet-4-6`) |
| `OPENAI_API_KEY`       | OpenAI-alapú AI funkciókhoz                       | ❌                                                                 |
| `ANTHROPIC_API_KEY`    | Anthropic-alapú AI funkciókhoz / piaci elemzéshez | ❌                                                                 |
| `ERRORLOG_HMAC_SECRET` | Error report aláírás productionben                | ✅ productionben                                                   |
| `BACKEND_URL`          | Backend publikus URL productionben                | ✅ productionben                                                   |
| `ZMAIL_PG_SCHEMA`      | PostgreSQL schema                                 | ❌ (default: public)                                               |

### Tesztek

```bash
# Server tesztek
cd server && npm test

# Client tesztek
cd client && npx vitest run

# Coverage
cd server && npm run test:coverage
cd client && npm run test:coverage
```

### API dokumentáció

Development módban a Swagger UI elérhető: `http://localhost:5000/api-docs`

JSON spec: `http://localhost:5000/api-docs.json`

## Fő funkciók

- **Multi-fiók kezelés** — több Gmail fiók egyidejű használata
- **Valós idejű szinkronizálás** — push notifikációk + háttér sync
- **AI kategorizáció** — provider-alapú automatikus levél-kategorizálás (OpenAI/Anthropic)
- **AI összefoglalás** — napi brief, thread összefoglaló
- **AI chat** — levelekkel kapcsolatos kérdések
- **Intelligens keresés** — mentett keresések, smart folderek
- **Sablonkezelés** — email sablonok változókkal
- **Szundi (snooze)** — levelek későbbi visszahozása
- **Számla automatizálás** — számlák felismerése és feldolgozása
- **Naptár integráció** — Google Calendar események
- **Workflow automatizálás** — szabály-alapú műveletek
- **VIP kezelés** — kiemelt kontaktok
- **Push notifikációk** — Web Push API
- **Offline mód** — PWA + IndexedDB
- **Dark mode** — teljes sötét téma
- **Audit log** — minden művelet nyomon követése

## Architektúra

```
Client (React) ──> Express API ──> PostgreSQL
                        │
                        ├── Google Gmail API
                        ├── Google Calendar API
                        ├── OpenAI / Anthropic AI provider
                        └── Sentry (monitoring)
```

A backend moduláris felépítésű:

- **`app.ts`** — HTTP alkalmazás (middleware, route-ok, health check)
- **`cron.ts`** — Háttérfeladatok (snooze, scheduled email, watchdog, AI digest)
- **`server.ts`** — Indítás (DB init, graceful shutdown)

## Fejlesztés

Pipeline: **Junior** (implement) → **Eszter** (review) → **Tamás** (test) → **Bence** (deploy)

Commit / push előtt kötelező:

```bash
cd server && npm run lint && npx tsc --noEmit && npm run build
cd ../client && npm run lint && npx tsc --noEmit && npm run build
```

A GitHub Actions CI ugyanezt futtatja külön server és client jobban. A Playwright e2e job jelenleg `continue-on-error: true`, tehát regressziójelző, nem merge-blokkoló gate.

## Licenc

Private — © 2026 Kósa Zoltán / Exclusive Best Change Zrt.
