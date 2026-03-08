# sql.js → better-sqlite3 Migráció Terv

## 1. Jelenlegi Állapot

- **Lib:** `sql.js` v1.12.0 (WebAssembly-based SQLite)
- **Működés:** A DB fájlt a memóriába tölti (`new SQL.Database(buffer)`), majd periodikusan (30s) és debounced módban (1s) exportálja a teljes DB-t fájlba (`db.export()` → `Buffer` → `fs.writeFileSync`)
- **Tárolás:** Render Persistent Disk — `/data/gmail-client.db` (env: `DATABASE_URL`)
- **Hátrányok:**
  - Teljes DB memóriában → magas RAM használat (Render 512MB limit!)
  - `db.export()` az EGÉSZ DB-t szerializálja minden mentésnél → lassú nagy DB-nél
  - Nincs WAL mode → nincs concurrent read
  - WASM overhead → lassabb mint native
  - Race condition kockázat: crash a `writeFileSync` és `renameSync` között → adatvesztés

## 2. Cél

- **Lib:** `better-sqlite3` — native C++ SQLite binding
- **Működés:** Közvetlen file-based SQLite, WAL mode
- **Előnyök:**
  - Natív teljesítmény (3-10x gyorsabb mint sql.js)
  - File-based: nincs memória-másolás, nincs export loop
  - WAL mode: concurrent reads + single writer
  - Alacsonyabb memória footprint
  - Szinkron API — egyszerűbb hibakezelés

## 3. Változtatandó Fájlok

| Fájl | Változás |
|------|----------|
| `server/package.json` | `sql.js` → `better-sqlite3` + `@types/better-sqlite3` (devDep) |
| `server/src/db/index.ts` | Teljes refaktor (lásd alább) |
| `server/src/db/session-store.ts` | API adaptáció (ha sql.js specifikus) |
| `server/src/types/sql.js.d.ts` | TÖRÖLNI — nem kell többé |
| `server/tsconfig.json` | Ellenőrizni: `types` mező |
| Minden service ami `getDb()`, `queryOne`, `queryAll`, `execute` használ | **NEM kell változtatni** — a wrapper függvények megmaradnak |

### db/index.ts Főbb Változások

```typescript
// RÉGI (sql.js)
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
const SQL = await initSqlJs();
_db = new SQL.Database(buffer);
db.run(sql, params);            // void
const stmt = db.prepare(sql);   // Statement
stmt.bind(params); stmt.step(); stmt.getAsObject();
db.export() → Buffer → writeFile

// ÚJ (better-sqlite3)
import Database from 'better-sqlite3';
_db = new Database(dbPath);
_db.pragma('journal_mode = WAL');
_db.pragma('synchronous = NORMAL');
db.exec(sql);                      // DDL
db.prepare(sql).run(...params);    // INSERT/UPDATE/DELETE
db.prepare(sql).get(...params);    // queryOne
db.prepare(sql).all(...params);    // queryAll
// NINCS export/save loop — file-based, automatikus
```

## 4. WAL Mode + Synchronous Config

```typescript
// Inicializálás után azonnal:
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');   // Biztonságos WAL-lal, gyorsabb mint FULL
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');    // 5s várakozás lock esetén
db.pragma('cache_size = -20000');    // 20MB cache
```

**WAL előnyei:**
- Olvasók NEM blokkolják az írót (és fordítva)
- Crash-safe (WAL + checkpoint)
- `synchronous = NORMAL` WAL-lal equivalens a `FULL`-lal journal mode-ban

## 5. Backup Stratégia

### Online Backup (ajánlott)
```typescript
// better-sqlite3 natív backup API:
await db.backup(`${dbPath}.backup`);
```

### Periodic File Copy (egyszerű)
- Cron job: `/data/gmail-client.db` → `/data/backups/gmail-client-YYYY-MM-DD.db`
- WAL checkpoint ELŐTTE: `db.pragma('wal_checkpoint(TRUNCATE)')`
- Retention: utolsó 7 nap

### Render-specifikus
- Render Persistent Disk snapshot (heti)
- `.db-wal` és `.db-shm` fájlok is a /data-ban lesznek — TILOS törölni!

## 6. Rollback Terv

1. **Git branch:** `feature/better-sqlite3-migration` — NEM direkt main-re
2. **sql.js megmarad** `package.json`-ban amíg a migráció tesztelve nincs
3. **Rollback lépések:**
   - `git revert` a migration commit-okat
   - `npm install` (visszaáll sql.js)
   - DB fájl kompatibilis (mindkettő ugyanazt a SQLite formátumot használja)
4. **Feature flag lehetőség:** env var `DB_ENGINE=better-sqlite3|sql.js` — opcionális

## 7. Becsült Effort

| Feladat | Idő |
|---------|-----|
| db/index.ts refaktor + better-sqlite3 API | 4-6 óra |
| session-store.ts adaptáció | 1-2 óra |
| Service-ek tesztelése | 2-3 óra |
| Render deploy + tesztelés | 2-3 óra |
| Edge case-ek, hibakezelés | 2-4 óra |
| **Összesen** | **~2-3 munkanap** |

## 8. Kockázatok és Mitigáció

| Kockázat | Hatás | Mitigáció |
|----------|-------|-----------|
| **API különbségek** | sql.js: `stmt.bind() → step() → getAsObject()` vs better-sqlite3: `stmt.get()` | Wrapper függvények (`queryOne`, `queryAll`, `execute`) elrejtik — csak `db/index.ts` változik |
| **Render build** | better-sqlite3 natív addon → `node-gyp` build szükséges | Render Node.js buildpack natívan támogatja; `npm install --include=dev` |
| **DB fájl lock** | better-sqlite3 file lock → ha 2 instance indul → crash | Render 1 instance, de: `busy_timeout` + graceful shutdown |
| **WAL fájlok** | `.db-wal` és `.db-shm` keletkezik | Persistent Disk-en maradnak, backup-nál mindkettőt menteni |
| **Memória** | better-sqlite3 kevesebb RAM, de a cache_size figyelendő | `cache_size = -20000` (20MB) — monitorozni |
| **sql.js → better-sqlite3 átmenet** | Régi in-memory save logika nem kell | `saveDatabase()`, `startAutoSave()`, `debouncedSave()` TÖRLENDŐK |
| **Node.js verzió** | better-sqlite3 requires Node >=14 (Render: >=20, OK) | Nincs probléma |

## 9. Implementációs Sorrend

1. Új branch: `feature/better-sqlite3-migration`
2. `npm install better-sqlite3 @types/better-sqlite3`
3. `npm uninstall sql.js` + törlés `types/sql.js.d.ts`
4. Refaktor `db/index.ts`:
   - `initializeDatabase()` → szinkronná (nem kell `await initSqlJs()`)
   - `queryOne`, `queryAll`, `execute` adapter
   - `saveDatabase`, `startAutoSave`, `debouncedSave` TÖRLÉS
   - WAL + pragma beállítások
5. `session-store.ts` adaptáció
6. Lokális tesztelés (`npm run dev`)
7. `npx tsc --noEmit` — 0 hiba
8. Render deploy (staging, ha van)
9. Monitoring: RAM, response time, error rate
10. Merge to main
