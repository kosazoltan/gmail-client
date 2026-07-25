---
id: ev_2026_06_12_001
type: episodic
domain: qa
title: 'Agentic QA Kit v1.0.0 repo-szintű telepítése'
summary: 'A 81124be commit telepítette az agentic-qa-kit v1.0.0 T2 profilját: QA szabályblokkot, spec- és contract-sablonokat, PR-méret- és audit-scripteket, valamint Claude PreToolUse hookokat adott a repóhoz.'
entities:
  - ZMail
  - agentic-qa-kit
  - AGENTS.md
  - Husky
  - Claude PreToolUse
tags:
  - qa
  - protocol
  - tooling
  - hooks
  - specification
importance: 0.95
event_time: 2026-06-12
confidence: 1.00
status: active
created_at: 2026-06-12T10:57:37Z
updated_at: 2026-06-12T10:57:37Z
time_scope: event
valid_from: 2026-06-12
source_refs:
  - commit:81124be0951b1cd0c0715601faddae1010f5028c
  - file:.agentic-qa-kit.json
  - file:AGENTS.md
  - file:docs/specs/_TEMPLATE.md
  - file:scripts/qa/pre-push-audit-lite.mjs
---

# Agentic QA Kit v1.0.0 telepítése

## Összefoglaló

A 81124be commit repo-szinten telepítette az `agentic-qa-kit` v1.0.0 T2 profilját. A munkamenet az `AGENTS.md` végéhez hozzáadta a Stop-and-Ask, teszt-integritási, spec-first, contract-first, atomi munka, review-evidencia és destruktív műveleti szabályokat; létrehozta a `docs/specs/` sablonokat, a PR-méret- és audit-scripteket, valamint három Claude PreToolUse hookot.

## Létrehozott QA-réteg

1. `.agentic-qa-kit.json`: T2 profil és audit-sentinel konfiguráció.
2. `.dependency-cruiser.cjs` és `.jscpd.json`: függőségi és kódduplikációs alapkonfiguráció.
3. `docs/specs/_TEMPLATE.md` és `docs/specs/contract-template.yaml`: spec-first és contract-first sablonok.
4. `scripts/qa/`: PR-méret-ellenőrzés, pre-push audit és három policy hook.
5. `package.json`: `qa:size` és `qa:audit` npm scriptek.

## Utólag feltárt lezárási hiány

A munkamenet nem hozta létre ezt a kötelező epizodikus bejegyzést, nem regisztrálta azt a `memory/indexes/index.yml` fájlban, és a git history alapján nem rögzített memória-reindexet. Ezt a hiányt a 2026-07-25-i remediation munkamenet pótolta; a telepítés funkcionális hibáinak javítását külön epizód dokumentálja.
