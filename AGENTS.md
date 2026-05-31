# AGENTS.md — Supreme Agentic Protocol and Tiered Memory System

> [!IMPORTANT]
> Ez a dokumentum a repozitóriumban dolgozó összes mesterséges intelligencia ágens, fejlesztőasszisztens és munkafolyamat-koordinátor számára kötelező érvényű és felülírhatatlan működési elvet tartalmaz. Minden ügynök köteles ezt a protokollt és a helyi memóriát követni és karbantartani.

---

## 1. Supreme Protocol (Legfőbb Ügynök Protokoll)

A repóban végzett minden munkát a [Universal Agent Protocol](file:///C:/Users/K%C3%B3sa%20Zolt%C3%A1n/Downloads/universal_agent_protocol.md) szabályoz. E szabályok megszegése nem elfogadható.

### A Négy Alaptörvény:

1. **Tényalapúság (Hallucináció Tilalom):** SOHA ne hivatkozz olyan fájlra vagy sémára, amit közvetlenül nem olvastál be és ellenőriztél. Ha bizonytalan vagy, mondd ki nyíltan!
2. **Bizonyíték-kényszer (Hazugság Tilalom):** Állítást csak bizonyítékkal (futtatott parancsok és kimenetük) együtt tehetsz. Tilos a tényleges futtatás nélküli sikerjelentés.
3. **Teljesség (Lustaság és Csonkítás Tilalom):** Félkész, csonkolt kódok vagy `// TODO` placeholder leadása TILOS.
4. **Mértéktartó Dokumentálás és Kód-prioritás:** A dokumentáció legyen tömör és célszerű, az energia a kódminőségre és a QA kapukra fókuszáljon.

---

## 2. QMD YAML Cogni Vectoros Memória Rendszer

A repozitórium egy teljesen működőképes, többszintű YAML + Markdown alapú memóriarendszerrel rendelkezik a `memory/` könyvtárban.

### Keresés a memóriában (KÖTELEZŐ induláskor):

Mielőtt bármilyen feladatot elkezdenél, köteles vagy lekérdezni a memóriát, hogy megismerd a korábbi döntéseket és a környezetet:

```bash
node memory/search.mjs "keresett kifejezés"
```

Vagy szűrt kereséssel:

```bash
node memory/search.mjs --type semantic "Neon PostgreSQL"
node memory/search.mjs --type procedural "deploy"
node memory/search.mjs --type episodic "CORS"
```

### Memória Struktúra (`memory/`):

- `memory/semantic/` — Stabil tények, architektúra, konfiguráció, adatbázis sémák és Google OAuth leírások.
- `memory/episodic/` — Idővonalak, korábbi incidensek (pl. CORS hibák) és migrációk (pl. Neon PG és BIGINT migrációk).
- `memory/procedural/` — Hogyan kell csinálni: deploy checklista, secrets kezelés és kritikus szabályok.
- `memory/projects/` — Aktív projektek állapota, korlátozások, nyitott kérdések és döntések.
- `memory/indexes/index.yml` — A teljes memóriát leíró master katalógus a chunkok metaadataival.

---

## 3. Kritikus Technikai Szabályok (ZMail Parity)

| ID     | Szabály                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** | PowerShell használata **TILOS** `package.json` szerkesztésre! Csak Node.js/npm.                                                                              |
| **R2** | `@types/*` és `typescript` **MINDIG** `devDependencies`!                                                                                                     |
| **R3** | `VITE_API_URL` **KÖTELEZŐ** a Vercel frontend-en (`https://api.mindenes.org/api`).                                                                           |
| **R4** | A Google Redirect URI-nak **három** helyen pontosan egyeznie kell (`https://api.mindenes.org/api/auth/callback`).                                            |
| **R5** | Cloudflare DNS api rekord: **SZÜRKE felhő** (DNS only) kötelező! A narancssárga felhő 403-as hibát okoz a Render SSL ütközése miatt.                         |
| **R6** | Delete Protection aktív a backend-en (`server/src/middleware/delete-protection.ts`).                                                                         |
| **R7** | `ENCRYPTION_KEY` min. 16 karakter, a Google Client Secret-nek `GOCSPX-` előtaggal kell kezdődnie.                                                            |
| **R8** | Éles környezetben a `SESSION_SECRET`, `ENCRYPTION_KEY` és `ERRORLOG_HMAC_SECRET` megléte és erőssége kötelező, hiányukban a szerver fail-closed módon leáll. |

---

## 4. Szállítási Folyamat & QA Kapuk

1. **Pre-Flight Validation:** Bármilyen commit, push vagy deploy előtt köteles vagy helyi szinten lefutó linter, build és típusellenőrzést végezni:
   ```bash
   cd server && npm run lint && npx tsc --noEmit && npm run build
   cd ../client && npm run lint && npx tsc --noEmit && npm run build
   ```
2. **Valuable Final Product (VFP):** A fejlesztési mérföldkő befejezésekor a felépített produkciós telepítő- vagy terjesztési csomagot (pl. desktop/native alkalmazás EXE telepítője) automatikusan le kell szállítani a Windows letöltések mappájába:
   `C:\Users\Kósa Zoltán\Downloads`
   Webes alkalmazások (web app) esetén, amelyeknek nincs külön telepítője, ez a lépés NEM kötelező (helyette a helyi lint, build, test és a sikeres push/deploy folyamat jelenti a szállítást). A sikeres lezáráshoz ilyenkor elegendő a QA kapuk teljesülésének igazolása.
3. **Memória Karbantartás:** A munkamenet sikeres lezárásakor rögzítsd az epizodikus memóriában a tanulságokat, és futtasd le az indexek újragenerálását:
   ```bash
   node memory/search.mjs --reindex
   ```

---

## 5. AI Agent Hibavédelmi Protokoll (2026 május v2)

Minden ügynök köteles szigorúan követni a `memory/procedural/policies/agent_fault_protection.md` fájlban leírt hibavédelmi protokollt.

### Legfontosabb szabályok:

1. **Kísérlet-napló (Attempt Ledger) kötelező:** Jegyezd fel a megközelítéseket, parancsokat, teszteredményeket és hibaüzeneteket.
2. **Doom loop / variáció-csapda tilalom:** Ha egy parancs/teszt 2× vagy egy fájl 3× elbukik, állj meg! Ne próbáld meg finomítani az eddigi megközelítés puszta variációival.
3. **STRATÉGIA-ROTÁCIÓ elakadáskor:** Válts ortogonális tengelyre (másik hipotézis, réteg, ellenkező feltételezés, Drop a Gear kitörés).
4. **Biztonságos eszkaláció:** Ha a feladat megbízhatóan nem oldható meg, a szelektív feladás és emberi segítségkérés érvényes és biztonságos válasz.
