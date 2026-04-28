# 📋 REPO STATE — Gmail Client (ZMail)

> Frissítve: 2026-04-28

## 2026-04-28 repo felmérés

- A lokális `main` fast-forwarddal frissítve lett az `origin/main` állapotára (`ci: add auto-review workflow`).
- Lokális ágak: `feature/2026-redesign`, `fix/compose-editor-cursor-jump`, `fix/mobile-list-full-width` már be vannak olvasztva a `main`-be.
- Távoli ágak: `origin/claude/pull-latest-changes-GeBbR` már be van olvasztva a `main`-be.
- Nem merge-elt távoli ág: `origin/claude/vector-database-docs-kLiej`. Tartalma egy `memory/` tudásbázis volt, ezt a felmérés során beemeltük a munkafába.
- Dokumentációs korrekció: az AI provider a kódban OpenAI/Anthropic absztrakció (`server/src/ai/provider.ts`), nem Google Gemini.
- Frontend korrekció: a hibajelentő endpointok most a központi `API_BASE` értékre épülnek, így a kötelező production `VITE_API_URL=https://api.mindenes.org/api` mellett nem duplázódik az `/api` útvonal.

## ⚡ Főbb Változások

Ez a frissítés jelentős áttérést hoz az adatbázis-kezelésben és új funkciókat vezet be.

---

### 🚀 Főbb Módosítások:

- **DB Engine:** `sql.js` (in-memory SQLite) helyett **Neon PostgreSQL** (cloud, hordozható).
- **Neon (ZMail dedikált):** pooler host `ep-empty-hill-abv67xx3-pooler.eu-west-2.aws.neon.tech`, adatbázis `neondb` — connection string csak `DATABASE_URL`-ben (Render + helyi `.env`), **ne** commitolva.
- **SQL Konverzió:** Automatikus `?` → `$1,$2` átalakítás és `COLLATE NOCASE` → `ILIKE` módosítás a lekérdezésekben.
- **BIGINT Migráció:** Minden `epoch ms` oszlop `INTEGER` típusból `BIGINT`-re lett konvertálva.
- **pg type parser:** OID 20 (BIGINT) hozzárendelve a `Number()` típushoz.

### ✨ Új Funkciók és Szolgáltatások:

- **Command Palette:** Gyors parancsok elérése `Ctrl+K`-val.
- **AI Dashboard:** Intelligens áttekintés `Bento Grid` elrendezésben.
- **Inline Copilot:** Email részleteknél elérhető AI műveletsáv.
- **Thread View:** Levelek szálakba rendezése.
- **SSE Real-time Push:** Valós idejű adatok pusholása szerverről.
- **Daily AI Brief:** Napi AI összefoglaló (cron `8:00`-kor).
- **RSS News:** Hírcsatorna integráció.
- **Crypto Prices:** Valós idejű kriptovaluta árfolyamok.
- **PDF/DOCX AI Analysis:** Dokumentumok AI alapú elemzése.
- **Offline Compose:** Levelek offline összeállítása `IndexedDB` segítségével.
- **Új Service-ek:** `news.service`, `crypto.service`, `document-parser.service`, `ai-market.service`.

### 📦 Új Dependencies:

- `pg` (Neon / Postgres pool; `@neondatabase/serverless` nincs a stackben)
- `pdf-parse`
- `mammoth` (server)

### 📈 Repozitórium Állapot:

- **Összes Commit:** 31 új commit.
- **Render Deployment:** `srv-d6h9il450q8c73af5lk0`
- **Vercel Deployment:** `mail.mindenes.org`

---

### 🛠️ Fejlesztői Infók:

- **Server Routes:** Jelentős bővülés az új szolgáltatásokhoz.
- **Database:** Áttérés Neon PostgreSQL-re.
- **Code Quality:** Folyamatos fejlesztés és refaktorálás.
