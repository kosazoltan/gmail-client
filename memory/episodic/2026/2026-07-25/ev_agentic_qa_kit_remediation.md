---
id: ev_2026_07_25_001
type: episodic
domain: qa
title: 'Agentic QA Kit v1 remediation és bizonyíték-alapú audit'
summary: 'A 81124be munkamenet auditja megerősítette a hiányzó memória-lezárást, a bekötetlen hookokat, a részleges auditot és több matcher-megkerülést; a remediation bekötötte és tesztelte a hookokat, teljessé tette a kapukat, és reprodukálhatóvá tette a QA eszközöket.'
entities:
  - ZMail
  - agentic-qa-kit
  - Husky
  - Claude PreToolUse
  - dependency-cruiser
  - jscpd
tags:
  - qa
  - remediation
  - hooks
  - testing
  - memory
importance: 1.00
event_time: 2026-07-25
confidence: 1.00
status: active
created_at: 2026-07-25T15:46:14Z
updated_at: 2026-07-25T15:46:14Z
time_scope: event
valid_from: 2026-07-25
source_refs:
  - commit:81124be0951b1cd0c0715601faddae1010f5028c
  - file:docs/specs/2026-07-25-agentic-qa-kit-remediation.md
  - file:scripts/qa/tests/remediation.test.mjs
  - file:.claude/settings.json
  - file:.husky/pre-push
---

# Agentic QA Kit v1 remediation

## Megerősített hibák

1. A 2026-06-12-i sikeres munkamenethez nem készült epizodikus memória-bejegyzés, és az index fejlécének dátuma 2026-04-10 maradt.
2. A három PreToolUse hook közvetlenül működött, de nem volt követett `.claude/settings.json` bekötés; a `.claude/` teljes könyvtár ignorált volt.
3. A `qa:audit` csak a root `lint` scriptet találta, amely kizárólag a klienst lintelte, mégis sikeres sentinelt írhatott.
4. A destruktív parancs és push matcher több valós parancsalakkal megkerülhető volt; a sentinel csak fájl-mtime alapján élt.
5. A dependency-cruiser és jscpd konfigurációkhoz nem tartozott lokálisan pinelt futtató és npm script; a PR-size script érvénytelen limitet elfogadott.

## Javítások

- A root `lint`, `typecheck`, `test` és `build` scriptek mindkét csomagot aggregálják; a kliens teszt nem interaktív.
- A Husky pre-push a teljes `qa:audit` kaput futtatja, a Claude hookok követett settings fájlból indulnak.
- A sentinel JSON a HEAD-hez, a tracked worktree diff SHA-256 lenyomatához, a parancslistához és friss, nem jövőbeli időponthoz kötött.
- Node regressziós tesztek fedik a bekötést, sentinelt, case/CWD/quote push alakokat, destruktív rm és force-push variánsokat, tesztútvonalakat és PR-size validációt.
- A dependency-cruiser, jscpd és TypeScript root devDependency-ként pinelt; lokális-only futtató megakadályozza a véletlen hálózati letöltést.

## Verifikáció és tanulság

A kötelező server/client lint, TypeScript, build és unit tesztek zöldek voltak. A QA regressziós suite 12/12 tesztet teljesített. A jscpd ténylegesen lefutott és 6,22% duplikációt mért a 10%-os küszöb alatt. A dependency-cruiser immár 332 modult és 1083 függőséget vizsgált, és négy, a remediation hatókörén kívüli meglévő körkörös függőséget jelzett; ezeket nem rejtettük el és nem gyengítettük a gate-et. Tanulság: egy telepített policy réteg csak akkor valódi védelem, ha a bekötése, teljes kaputerve és regressziós tesztje is repo-szinten követett és végrehajtott.
