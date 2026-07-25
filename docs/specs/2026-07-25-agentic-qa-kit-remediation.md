# Spec: agentic-qa-kit v1 javítása és lezárási hiány pótlása

> Dátum: 2026-07-25 · Szerző: Orchestrator · Állapot: JÓVÁHAGYVA
> Jóváhagyás alapja: a felhasználó explicit remediation missionje a 81124be munkamenet auditjára, javítására, teljes QA-jára és memória-lezárására.

## 1. Cél

A 81124be commit által telepített QA-réteg ténylegesen, reprodukálhatóan fusson ezen a repón és Windows/MSYS környezetben. A push előtti audit mindkét csomag kötelező lint, típusellenőrzési, unit test és build kapuját hajtsa végre; a hookok legyenek nyomon követetten bekötve, a bizonyított megkerülések kapjanak regressziós tesztet. A kihagyott 2026-06-12-i és a jelenlegi remediation munkamenet epizodikus memóriája kerüljön az indexbe.

## 2. NEM cél (out of scope)

- Push, PR, deploy, Render/Vercel/Neon vagy bármely külső mellékhatás.
- Alkalmazásfunkció, adatbázis-séma, OAuth, secret vagy környezeti változó módosítása.
- Meglévő alkalmazásteszt gyengítése, törlése vagy kihagyása.
- A teljes shell nyelv biztonsági parserének megvalósítása; a hook helyi policy guard, nem ellenséges OS-sandbox.

## 3. Érintett területek

- `.agentic-qa-kit.json`, `.gitignore`, `.claude/settings.json`, `.husky/pre-push`, `package.json`, `package-lock.json`
- `scripts/qa/` futtatók, hookok és új regressziós tesztek
- `docs/specs/` jelen spec
- `memory/episodic/2026/2026-06-12/`, `memory/episodic/2026/2026-07-25/`, `memory/indexes/index.yml`

## 4. Rögzített döntések és kényszerek

- A root npm scriptek aggregálják a server és client kapukat; a kliens Vitest nem interaktív `run` módban fut.
- `.husky/pre-push` a teljes `qa:audit` kaput hívja.
- A Claude PreToolUse hookok repo-szintű, követett `.claude/settings.json` fájlból futnak; más `.claude` tartalom továbbra is ignorált.
- Az audit-sentinel a commit- és worktree-állapothoz, a parancslistához és befejezési időhöz kötött JSON; jövőbeli vagy elavult állapot elutasítandó.
- A bizonyított matcher-megkerülések javítása fail-closed regressziós tesztekkel történik.
- A dependency-cruiser és jscpd csak akkor tekinthető használhatónak, ha lokálisan pinelt devDependency és npm script futtatja.
- R1-R8 változatlan marad.

## 5. Edge case-ek

- `Git push`, `git -C <repo> push`, `git pu''sh` és egyszerű változós git-hívás.
- `rm -r -f /`, `rm --recursive --force /`, `rm -rf -- /`.
- `git push --force`, `git push origin +HEAD:main`, explicit és implicit védett ág.
- Érvénytelen/NaN PR-méret limit.
- Python/JS segédfájl a `test/` vagy `tests/` könyvtárban.
- Sentinel: hiányzó, sérült, jövőbeli, lejárt, eltérő HEAD vagy eltérő worktree.
- Hiányzó dependency vagy környezeti gate-hiba: őszinte non-zero eredmény, sentinel nélkül.

## 6. Elfogadási kritériumok (EARS)

- WHEN `npm run qa:audit` fut THEN the system SHALL futtatni a lint, typecheck, test és build aggregátumokat mindkét csomagra, és csak teljes siker után írhat sentinelt.
- WHEN a követett fájl vagy HEAD az audit után változik THEN the system SHALL megtagadni a push-engedélyt a sentinel alapján.
- WHEN bármely felsorolt destruktív vagy force-push variáns érkezik THEN the system SHALL DENY döntést adni.
- WHEN egy releváns tesztkönyvtári fájlt szerkesztenek THEN the system SHALL figyelmeztetést adni.
- WHEN a PR-size limit érvénytelen THEN the system SHALL non-zero hibával leállni.
- WHEN friss clone-on `npm ci` megtörténik THEN the system SHALL lokálisan futtatni a dependency és duplikáció ellenőrző scripteket.
- WHEN a remediation lezárul THEN the system SHALL tartalmazni mindkét hiányzó epizodikus bejegyzést és újragenerált keresési indexet.

## 7. Tesztterv

- Node beépített test runnerrel regressziós tesztek a QA hookokra, sentinelre és PR-size validációra.
- Direkt crafted-stdin smoke minden hookra.
- `npm run qa:size`, `npm run qa:deps`, `npm run qa:duplication`, `npm run qa:audit`.
- Kötelező server/client lint, `tsc --noEmit`, build és unit tesztek külön, teljes kimenettel.
- `node memory/search.mjs --reindex`, majd keresés mindkét új epizódra.
- `git diff --check`, független reviewer/security és két verifier eredmény.

## 8. Kockázatok / visszavonási terv

A pre-push teljes kapu lassabb lehet, de megfelel az AGENTS.md előírásának. A hook regexek nem helyettesítenek OS-sandboxot; a tesztelt veszélyes alakok fail-closed módon kezelendők, az ismeretlen összetett shell-formákra a Stop-and-Ask szabály marad. Visszavonás: kizárólag lokális atomi commit revertje; külső állapot nem változik.
