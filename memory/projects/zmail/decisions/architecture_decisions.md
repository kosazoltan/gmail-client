---
id: proj_zmail_dec_arch_001
type: project
domain: decisions
title: "Architekturalis dontesek"
summary: "Fobb architekturalis dontesek: Vercel+Render hosting, Neon PostgreSQL, cross-origin cookie auth, Tailwind 4 class-based dark mode."
entities:
  - architecture
  - decisions
tags:
  - decisions
  - architecture
  - rationale
importance: 0.92
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:CLAUDE.md
  - file:DEPLOY_INSTRUCTIONS.md
  - file:server/docs/NEON-AND-DATABASE.md
  - file:server/MIGRATION_PLAN.md
retrieval_hints:
  lexical:
    - dontes
    - decision
    - miert
    - rationale
    - architektura
  semantic:
    - architecture decisions
    - design rationale
    - why decisions
---

# Architekturalis dontesek

## D1: Vercel + Render (nem egyetlen platform)

**Dontes:** Frontend Vercel-en, backend Render-en, kulonallo platformok.
**Ok:** Vercel kivaloan alkalmas React/Vite frontend-re (CDN, edge), Render jobban
kezeli a Node.js backend-et (persistent disk, Frankfurt regio EU adatokhoz).
**Kovetkezmeny:** Cross-origin architektura kell (CORS, SameSite=None cookie-k).

## D2: Neon PostgreSQL (sql.js → Neon migracio)

**Dontes:** In-memory SQLite (sql.js) lecserelese Neon PostgreSQL-re.
**Ok:** sql.js a teljes DB-t memoriaban tartotta (512MB Render limit), periodikus
export race condition kockazattal, nincs WAL mode, nincs concurrent read.
**Kovetkezmeny:** Cloud DB (Neon pooler), `pg` driver, SQL szintaxis konverziok.

## D3: Cross-origin cookie auth (nem Vercel rewrite proxy)

**Dontes:** A frontend kozvetlenul hivja az `api.mindenes.org`-t, nem Vercel proxy-n at.
**Ok:** A Vercel rewrite NEM tovabbitja a bongeszo cookie-jait. A `.mindenes.org` domain
cookie (SameSite=None, Secure, HttpOnly) mukodik cross-subdomain.

## D4: Tailwind 4 class-based dark mode

**Dontes:** `@custom-variant dark` explicit konfiguracio az index.css-ben.
**Ok:** TW4 alapertelmezetten `prefers-color-scheme` media query-t hasznal, de a ZMail
class-based toggling-ot hasznal (felhasznaloi beallitas).

## D5: Chunk size warning 1100 KB

**Dontes:** `chunkSizeWarningLimit` 450 → 1100 KB.
**Ok:** A ResizablePanels kozos chunk szandekosan ~1055 KB. A 450 KB limit
allandoan hamis pozitivot ad. 1100 KB meg mindig elkap valos regressziot.

## D6: OAuth token DB vault (Neon)

**Dontes:** OAuth tokenek PostgreSQL `oauth_token_store` tablaban, AES titkositva.
**Ok:** Render ujrainditas / uj deploy utan is megmaradnak a tokenek (Neon persistent).
Alternativa: fajl vault persistent disk-en (opcionalis masolat).

## D7: ESM modul rendszer

**Dontes:** `"type": "module"` a server package.json-ben.
**Ok:** Modern Node.js, jobb fa-rengetes, import/export szintaxis.
