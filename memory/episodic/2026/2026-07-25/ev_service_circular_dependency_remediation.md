---
id: ev_2026_07_25_002
type: episodic
domain: architecture
title: 'Szolgáltatási körfüggőségek megszüntetése háttérszinkron-regiszterrel'
summary: 'A négy server service körfüggőséget egy függőségmentes háttérszinkron-regiszter szüntette meg; a fióktörlés saját stop invariánsa és a nyilvános sync API változatlan maradt, regressziós fake-timer tesztekkel és teljes QA-val igazolva.'
entities:
  - ZMail
  - dependency-cruiser
  - auth.service
  - sync.service
  - background-sync-registry
tags:
  - architecture
  - circular-dependency
  - background-sync
  - regression-testing
  - qa
importance: 0.95
event_time: 2026-07-25
confidence: 1.00
status: active
created_at: 2026-07-25T16:42:31Z
updated_at: 2026-07-25T16:42:31Z
time_scope: event
valid_from: 2026-07-25
source_refs:
  - commit:2a9ef81cd4c8d1a67252a9f4fdb8729147ed5675
  - file:docs/specs/2026-07-25-service-circular-dependency-remediation.md
  - file:server/src/services/background-sync-registry.ts
  - file:server/src/services/background-sync-registry.test.ts
  - file:server/src/services/auth.service.test.ts
---

# Szolgáltatási körfüggőségek megszüntetése

## Kiinduló helyzet

A dependency-cruiser 332 modul és 1083 függőség vizsgálatakor négy `no-circular` hibát jelzett. Mindegyik kör tartalmazta az `auth.service.ts -> sync.service.ts` élt, amely kizárólag a fióktörlés előtti `stopBackgroundSync` hívás miatt létezett. A teljes szerverkeresés szerint a `deleteAccount` egyetlen hívója az account DELETE route; a `stopBackgroundSync` hívói a route és maga a `deleteAccount` voltak. A stop művelet már idempotens volt.

## Döntés és javítás

A stop felelősség puszta route-ra emelését elvetettük, mert az exportált `deleteAccount` saját takarítási invariánsát gyengítette volna. A háttérszinkron Map és életciklus-műveletei a függőségmentes `background-sync-registry.ts` modulba kerültek. Az auth közvetlenül ezt használja, a sync pedig továbbra is változatlan néven exportálja a stop API-kat. A route és a `deleteAccount` kettős, idempotens stop hívása megmaradt, ezért a futási viselkedés és a jövőbeli közvetlen hívók biztonsága sem változott.

## Regressziós bizonyíték

A fake-timer tesztek igazolják az ismeretlen és ismételt stop no-op viselkedését, a jövőbeli tickek megszűnését, az újraregisztrálhatóságot és a több account teljes takarítását. Az auth tesztek igazolják, hogy az intervallum már az account lookup, token-vault törlés és account SQL törlés előtt leáll, továbbá e lépések bármely hibája után sem marad aktív időzítő. A célzott suite 2 fájlban 6/6 tesztet teljesített; a teljes szerver suite 13 fájlban 86/86, a kliens 7 fájlban 86/86 tesztet teljesített.

## QA és tanulság

A `qa:deps` 335 modult és 1087 függőséget vizsgált: 0 hiba, 2 változatlan `no-orphans` figyelmeztetés. A `qa:test` 13/13, a lint, typecheck és build sikeres, a duplikáció 6,20%, a 10%-os küszöb alatt. A két orphan fájl működő, önálló segédkód, de jelenleg nincs importálója; törlésük nem volt indokolt a körfüggőségi remediation részeként. Tanulság: az alacsony szintű életciklus-állapot külön modulba emelése megszünteti a kétirányú service függést úgy, hogy a magas szintű törlési invariáns megmarad.
