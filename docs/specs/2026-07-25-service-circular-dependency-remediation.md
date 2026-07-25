# Spec: szolgáltatási körfüggőségek megszüntetése viselkedésváltozás nélkül

> Dátum: 2026-07-25 · Szerző: Orchestrator · Állapot: JÓVÁHAGYVA
> Jóváhagyás alapja: a felhasználó explicit remediation missionje a négy `no-circular` hiba megszüntetésére, regressziós tesztekkel és teljes helyi QA-val.

## 1. Cél

A `server/src/services` négy körkörös függőségi hibájának megszüntetése úgy, hogy a háttérszinkron életciklusa és a fióktörlés futási viselkedése változatlan maradjon. A fiók törlése minden valós elérési úton továbbra is állítsa le a hozzá tartozó intervallumot, és ne maradhasson árva időzítő.

## 2. NEM cél (out of scope)

- Dependency-cruiser szabály, kizárás vagy súlyosság gyengítése.
- Adatbázis-séma, OAuth, alkalmazásfunkció, secret vagy környezeti változó módosítása.
- A már futó interval callback megszakítási szemantikájának megváltoztatása vagy új versenyhelyzet-kezelés bevezetése.
- A két `no-orphans` figyelmeztetés kódjának törlése kizárólag a gate elnémításáért.
- Push, PR, deploy vagy külső szolgáltatás módosítása.

## 3. Bizonyított kiinduló állapot

- `auth.service.ts:6` a `sync.service.ts`-ből csak a `stopBackgroundSync` függvényt importálja; `auth.service.ts:328` a fióktörlés elején hívja.
- A `deleteAccount` egyetlen szerveren belüli hívója az `accounts.routes.ts:39`; a route előtte az `accounts.routes.ts:38` soron szintén leállítja a szinkront.
- A `stopBackgroundSync` hívói kizárólag az `accounts.routes.ts:38` és `auth.service.ts:328`; definíciója a `sync.service.ts:923`.
- A `sync.service.ts:923-929` implementáció idempotens: csak létező Map-bejegyzésnél töröl időzítőt és kulcsot.
- A négy jelentett kör mindegyike tartalmazza az `auth.service.ts -> sync.service.ts` élt; ennek eltávolítása megszünteti az összes jelenlegi nemtriviális szolgáltatási komponenst.

## 4. Kísérlet-napló és döntés

1. Hívói felelősségre emelés: minimális diff, de gyengítené az exportált `deleteAccount` saját takarítási invariánsát; elvetve.
2. Függőségmentes háttérszinkron-regiszter: a Map és a stop műveletek alacsony szintű modulba kerülnek; az auth és a sync egyirányúan függ tőle; kiválasztva.
3. Életciklus-callback regisztráció: működhetne, de felesleges indirekciót és inicializálási sorrend-kockázatot adna; elvetve.

A kiválasztott megoldás megtartja mindkét jelenlegi stop hívást. A route védekező hívása és a `deleteAccount` belső invariánsa változatlan marad; az idempotencia miatt a kettős hívás szemantikája azonos.

## 5. Tervezett módosítások

- Új, függőségmentes `background-sync-registry.ts` a Map, regisztráció, lekérdezés, egyedi és teljes leállítás számára.
- `sync.service.ts` a regisztert használja, és változatlan néven újra exportálja a stop API-kat.
- `auth.service.ts` közvetlenül a regiszterből importálja a stop műveletet; így megszűnik az auth → sync él.
- Célzott Vitest regressziós tesztek a regiszter idempotenciájára, újraindíthatóságára, teljes takarítására és a `deleteAccount` stop-előtti törlési sorrendjére.

## 6. Edge case-ek

- Ismeretlen account ID leállítása no-op.
- Ugyanazon account kétszeri leállítása no-op a második hívásnál.
- Leállítás után ugyanaz az account új intervallumot regisztrálhat.
- Több account teljes leállítása minden időzítőt töröl.
- A token- vagy adatbázis-törlés későbbi hibája esetén az intervallum már leállt.
- A route és a `deleteAccount` kettős stop hívása nem okoz hibát.

## 7. Elfogadási kritériumok (EARS)

- WHEN a háttérszinkron elindul THEN the system SHALL account ID szerint pontosan egy időzítőt tartani nyilván.
- WHEN `stopBackgroundSync(accountId)` egyszer vagy többször lefut THEN the system SHALL az adott account jövőbeli interval tickjeit megszüntetni, hiba nélkül.
- WHEN `deleteAccount(accountId)` bármely valós hívási útvonalon lefut THEN the system SHALL a token- és account-törlés előtt leállítani az account háttérszinkronját.
- WHEN a törlés későbbi lépése hibát dob THEN the system SHALL nem hagyni aktív intervallumot az accounthoz.
- WHEN `npm run qa:deps` lefut THEN the system SHALL nulla `no-circular` hibát jelenteni, szabálygyengítés nélkül.
- WHEN a teljes kötelező QA fut THEN the system SHALL megtartani a lint, typecheck, test, build, QA-test és duplikációs kapuk sikerét.

## 8. Tesztterv

- RED: a még nem létező regiszter API-ra írt fake-timer tesztek és a `deleteAccount` életciklus-teszt bukása.
- GREEN: minimális regiszter-kivonás és importirány-módosítás.
- Célzott Vitest futás, majd teljes `npm run qa:deps`, `npm run qa:test`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run qa:duplication`.
- `git diff --check`, független review és verifikáció.

## 9. Kockázatok / visszavonási terv

A mechanikus Map-kivonás kockázata az export- és inicializálási szemantika véletlen módosítása. Ezt változatlan sync-service re-exportokkal és fake-timer regressziókkal zárjuk ki. A már futó callbacket a `clearInterval` korábban sem szakította meg; ezt nem változtatjuk. Visszavonás: kizárólag lokális atomi commit revertje; külső állapot nem változik.
