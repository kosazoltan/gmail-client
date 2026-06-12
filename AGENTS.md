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

<!-- agentic-qa-kit:begin v1 — NE szerkeszd kézzel a blokkon belül; frissítés: update-all.mjs -->

## Agentic QA szabályok (agentic-qa-kit v1)

### Eszkaláció — Stop and Ask

Állj meg és kérdezz (NE folytasd), ha:

1. a szükséges engedély/hozzáférés hiányzik;
2. explicit szabály tiltja a műveletet;
3. két követelmény ütközik, és nincs biztonságos default;
4. a spec kétértelmű, és a rossz értelmezés kárt okozna;
5. ugyanazt a tervet 3+ alkalommal strukturáltad át (oszcilláció);
6. egy eszköz ismételten hibázik, és emberi diagnózis kell;
7. a bemenet egyik specifikált esethez sem illik;
8. a feladat a kijelölt hatókörön kívüli fájlok módosítását igényelné.

### Teszt-integritás

Tesztet a bukás elkerülésére gyengíteni, törölni vagy kikommentezni TILOS — ilyenkor
az implementációt javítsd, amíg a tesztek zöldek. Jogos teszt-módosítás csak: új teszt,
kifejezetten tesztírási feladat, vagy valódi, dokumentált spec-változás.

### Stuck-state protokoll

Ha 5 iteráció eltelt érdemi haladás (commit/zöld teszt) nélkül, vagy 3× váltottál
megközelítést ugyanazon a ponton: állj meg, írd le tömören az akadályt, a kipróbált
utakat és 2-3 biztonságos opciót — NE iterálj tovább vakon.

### Spec-kötelezettség

3+ fájlt érintő vagy bizonytalan megközelítésű feladatnál ELŐBB spec a
`docs/specs/` sablon szerint (cél / nem-cél / edge case-ek / EARS-elfogadás),
emberi jóváhagyással — csak utána implementáció.

### Contract-first (pénzügyi/kritikus logika)

Pénzmozgást, egyenleget, díjat, számlát vagy visszavonhatatlan műveletet érintő új
funkciónál a kód ELŐTT írj szerződést (`docs/specs/contract-template.yaml` séma:
preconditions / postconditions / invariants / error_contracts / behavioral),
hagyasd jóvá, és a szerződésből vezesd le a teszteket.

### PR-méret és atomi munka

Irányelv: egy PR ~400 sor diff alatt; egy szelet = egy vertikálisan teljes egység.
Nagyobb munka: bontsd előre szeletekre a specben. Minden lezárt részfeladat után
atomi commit.

### Review-evidencia

Code-review findinget csak fájl:sor hivatkozással és konkrét evidenciával adj ki;
evidencia nélküli finding érvénytelen. Kritikus findingnál előbb próbáld megcáfolni
(refuter-kör), csak megerősítés után jelentsd.

### Destruktív műveletek

A destruktív-parancs hook (check-destructive) döntéseit tartsd tiszteletben: a DENY
nem kerülhető meg parancs-átfogalmazással; ha a művelet valóban szükséges, az
embertől kérj kifejezett megerősítést.

<!-- agentic-qa-kit:end -->
