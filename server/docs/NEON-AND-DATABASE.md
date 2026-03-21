# Neon / PostgreSQL és a ZMail adatbázis

## Mi van a repóban?

| Elem                                                       | Állapot                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon Management API** (projekt, branch, kulcsok REST-en) | **Nincs** beépítve a kódba — a Neon konzolból / CI-ből kezeled. Dokumentáció: [Neon API](https://api-docs.neon.tech/).                    |
| **`@neondatabase/serverless` npm csomag**                  | **Nem használt** — a szerver a **`pg`** poolt és csak a **`DATABASE_URL`** connection stringet használja.                                 |
| **Adatmodell**                                             | Egy PostgreSQL adatbázis (pl. Neon `neondb`), alapértelmezés szerint táblák a **`public`** sémában (vagy lásd `ZMAIL_PG_SCHEMA` lentebb). |

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

| Változó           | Kötelező | Leírás                                                                                                                                                                                                |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | igen     | Neon / Postgres connection string (pooler, `sslmode=require`). A szerver szükség esetén hozzáfűzi a `uselibpqcompat=true` paramétert, hogy a Node `pg` ne írjon SSL deprecation warningot induláskor. |
| `ZMAIL_PG_SCHEMA` | nem      | Pl. `zmail` — dedikált séma + `search_path`. Lásd fent.                                                                                                                                               |

## Render (`gmail-client-api`) — dedikált Neon

1. Neon Console → a ZMailnek szánt projekt / branch → **Connection string** (pooler, `sslmode=require`).
2. Render → **gmail-client-api** → **Environment** → **`DATABASE_URL`** = a teljes `postgresql://…` sor (egy az egyben a jegyzetfájlból / Neonból).
3. Deploy / újraindítás után az alkalmazás **`initializeDatabase()`**-je létrehozza / frissíti a táblákat és indexeket (Express indulás).
4. Helyi fejlesztés: `server/.env` → ugyanaz a `DATABASE_URL`, majd `cd server && npm run db:init` üres DB első feltöltésére (vagy elég az első `npm run dev` is).

**Régió:** a példa Neon **eu-west-2**; a Render service **Frankfurt** lehet — működik, csak nőhet a DB-késleltetés. Ha zavar, Neon branch Frankfurt környéken is létrehozható.

## Kapcsolódó npm scriptek

- `npm run db:init` — séma inicializálás (Neonon / Postgresen).
- `npm run db:migrate:rfc2047` — egyszeri RFC2047 migráció bizonyos email mezőkön.
