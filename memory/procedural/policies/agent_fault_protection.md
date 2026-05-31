---
id: proc_agent_fault_protection_001
type: procedural
domain: policy
title: 'AI Agent Hibavédelmi Protokoll (2026 május v2)'
summary: 'A 2026. májusi AI ügynök hibavédelmi protokoll (v2). Tartalmazza a doom loop elleni védelmet, a variáció-csapda elkerülését, a Kísérlet-Naplót, a Stratégia-Rotációs tengelyeket és a Drop a Gear kitörési mechanizmusokat.'
entities:
  - AI Agent Fault Protection Protocol
  - Stratégia-Rotáció
  - Kísérlet-Napló
tags:
  - rules
  - policy
  - fault-protection
  - strategy-rotation
  - doom-loop
importance: 1.00
confidence: 1.00
status: active
owner: system
created_at: 2026-05-31T21:40:00Z
updated_at: 2026-05-31T21:40:00Z
time_scope: persistent
source_refs:
  - file:AGENTS.md
  - file:CLAUDE.md
---

# AI AGENT HIBAVÉDELMI PROTOKOLL v2 (KÖTELEZŐ)

Ez a szabályzat megelőzi és megszakítja az AI ágenseknél 2026-ban feltárt hibatípusokat: a gondolati hurkokat (doom loop), a variáció-csapdákat, a kontextus-romlást és a hamis haladás-jelentést.

---

## 1. Tényalapúság & Bizonyítás

- **Hamis haladás tilos:** SOHA ne jelentsd, hogy egy feladat "kész", "működik" vagy a "tesztek zöldek", hacsak közvetlenül le nem futtattad az igazoló parancsot, és be nem illesztetted annak teljes kimenetét.
- **Bizonytalanság vállalása:** Ha egy kódot vagy adatbázis sémát nem olvastál le közvetlenül, vagy bizonytalan vagy benne, mondd ki nyíltan. Ne próbáld elfedni.

---

## 2. Kísérlet-napló (Attempt Ledger)

Minden komplex feladat megkezdésekor az ügynök köteles vezetni egy belső naplót:

- **Formátum:** megközelítés | hipotézis a hibáról | parancs | eredmény | hibaüzenet lényege.
- **Hipotézis-diverzitás:** Induláskor fogalmazz meg **2–3 egymástól eltérő hipotézist**, hogy legyen hová rotálni, ha az első megbukik.
- **Visszaolvasási kényszer:** Minden új próbálkozás előtt OLVASD VISSZA a naplót. **Már megcáfolt megoldást vagy annak puszta variációját SOHA ne ismételd meg.**

---

## 3. Hurok- és Variáció-észlelés

ÁLLJ MEG AZONNAL, és válts stratégiát, ha a következők bármelyike teljesül:

1. Ugyanazt a parancsot vagy tesztet **2×** futtattad változatlan eredménnyel.
2. Ugyanazt a fájlt **3×** szerkesztetted, és a hiba még mindig fennáll.
3. A tervezett lépésed **ugyanannak a megközelítésnek a variációja**, ami már korábban megbukott.
4. Ugyanazt a hibaüzenetet **2×** látod a kimenetben.

---

## 4. STRATÉGIA-ROTÁCIÓ (Elakadáskor Kötelező)

Ha egy próbálkozás megbukott, a következő lépés **ne az eddigi gondolatmenet finomítása vagy variációja legyen, hanem egy gyökeresen más, lehetőleg ellentétes vagy ortogonális megközelítés.**

Válts egy MÁSIK tengelyre az alábbiak közül:

1. **Hipotézist válts, ne javítást:** Feltételezz gyökeresen **más hibaokot** ahelyett, hogy az eddigi hibaokot próbálnád másképp orvosolni.
2. **Réteget válts:** Ha eddig a kód logikáját módosítottad, vizsgáld meg a **specifikációt, konfigurációt, adatbázis adatot vagy a környezetet**.
3. **Fordítsd meg a feltételezést:** Tételezd fel az ellenkezőjét annak, amit eddig igaznak vettél, és célzott kis teszttel igazold vagy cáfold.
4. **Irányt válts:** Felülről-lefelé helyett alulról-felfelé; általánosítás helyett minimal repró; „javítsuk meg" helyett „izoláljuk a szegmenst".
5. **Hagyd el az utat:** 2–3 sikertelen variáció után ne csiszolj tovább. Töröld az eddigi megközelítést, és kezdj egy teljesen független próbálkozást friss kontextusból, a 2.2 szerinti alternatív hipotézissel.

---

## 5. Kitörés és Helyreállítás (Drop a Gear)

A hurokból való kitörés sorrendje:

1. **Drop a gear (fokozatcsökkentés):** Szűkítsd a feladat hatókörét, csökkentsd a lépésméretet, egyszerűsíts a végletekig egy biztosan ellenőrizhető részfeladatra.
2. **Stratégia-rotáció:** Válts ortogonális tengelyre (lásd 4. szekció).
3. **Replan:** Ne foltozz elromlott tervet. Tervezz újra a bukás pontjától kiindulva az eddigi tanulságokkal és egy más hipotézissel.
4. **Friss kontextus:** Indíts tiszta alügynököt, átadva neki a pontos ÁLLAPOTOT (módosított fájlok + git history + utolsó hiba + kísérlet-napló).
5. **Szelektív feladás és eszkaláció:** Ha minden út hibás vagy kockázatos, **állj le és kérj emberi döntést**. A "nem tudom megbízhatóan megoldani" érvényes és biztonságos válasz, különösen kritikus rendszereknél.

---

## 6. Kontextus-gazdálkodás & Célsodródás elleni védelem

- **Token fill%:** Figyeld a kontextus töltöttségét. **~60% felett proaktívan tömöríts**, a nagy eszköz-kimeneteket szűkítsd le.
- **Explicit fókuszcél:** Nagyobb kiterjedésű fájl beolvasása előtt határozz meg egy explicit célt (pl. "csak a szinkronizációs hibakezelést olvasom"), és csak a releváns részeket tartsd meg a kontextusban.
- **Strukturált válaszforma:** A célsodródás ellen minden körben tudatosítsd:
  - _Aktuális cél:_ ...
  - _Már próbáltam:_ ...
  - _Következő lépés (melyik rotációs tengelyen):_ ...
