# Neon / PostgreSQL és a ZMail adatbázis

## Mi van a repóban?

| Elem                                                       | Állapot                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon Management API** (projekt, branch, kulcsok REST-en) | **Nincs** beépítve a kódba — a Neon konzolból / CI-ből kezeled. Dokumentáció: [Neon API](https://api-docs.neon.tech/).                      |
| **`@neondatabase/serverless` npm csomag**                  | **Nem használt** — a szerver a hagyományos **`pg`** poolt és a **`DATABASE_URL`** (vagy `NEON_DATABASE_URL`) connection stringet használja. |
| **Adatmodell**                                             | Egy PostgreSQL adatbázis (pl. Neon `neondb`), alapértelmezés szerint táblák a **`public`** sémában (vagy lásd `ZMAIL_PG_SCHEMA` lentebb).   |

## Táblák (ZMail tulajdonú objektumok)

Az alkalmazás **`initializeDatabase()`**-ben létrehozza többek között:  
`accounts`, `emails`, `attachments`, `categories`, `topics`, `sessions`, `contacts`, `templates`, `workflows`, `ai_conversations`, `detected_tasks`, `scheduled_emails`, `user_settings`, … (teljes lista: `server/src/db/index.ts`).

Ezek **névterület szinten** általános nevek (`sessions`, `contacts`, …) — ha **ugyanazt a `DATABASE_URL`-t** megosztod egy másik programmal ugyanabban az adatbázisban, **ütközhet** a táblanevek és a séma.

## „Meg van-e osztva valakivel?” — ezt a repó nem tudja

A kódból **nem látható**, hogy a Neon projektet / connection stringet más app is használja-e. Ezt csak te tudod:

- Neon Console → **Project** → **Roles & Databases** / **Branches** — kik férnek hozzá.
- Ugyanaz a connection string több deploy-ban = **megosztott** adatbázis-logikai szinten.

## Ajánlott elkülönítés (erősorrend)

1. **Külön Neon branch vagy külön adatbázis** csak a ZMailnek + saját `DATABASE_URL` a Renderen — **legtisztább**, nincs kód változás.
2. **Ugyanazon a Postgres példányon**, de **külön séma** csak ZMailnek: állítsd be a **`ZMAIL_PG_SCHEMA`** környezeti változót (pl. `zmail`). A szerver a connection stringhez hozzáfűzi a `search_path`-ot, és a DDL a kiválasztott sémában hozza létre a táblákat.
   - **Fontos:** csak **új vagy üres** DB-n kapcsold be — a már **`public`**-ban lévő adat **nem** költözik át automatikusan.
3. **Ne** oszd ugyanazt a DB-t olyan appokkal, amelyek szintén `emails` / `sessions` táblákat hoznak létre a `public`-ban, hacsak nem használsz külön sémát vagy külön adatbázist.

## Környezeti változók

| Változó           | Kötelező                        | Leírás                                                  |
| ----------------- | ------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`    | igen (vagy `NEON_DATABASE_URL`) | Neon / Postgres connection string.                      |
| `ZMAIL_PG_SCHEMA` | nem                             | Pl. `zmail` — dedikált séma + `search_path`. Lásd fent. |

## Kapcsolódó npm scriptek

- `npm run db:init` — séma inicializálás (Neonon / Postgresen).
- `npm run db:migrate:rfc2047` — egyszeri RFC2047 migráció bizonyos email mezőkön.
