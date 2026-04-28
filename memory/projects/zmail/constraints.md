---
id: proj_zmail_constraints_001
type: project
domain: constraints
title: 'ZMail aktiv korlatozasok es tiltasok'
summary: 'Aktiv projekt korlatozasok: VITE_API_URL ne torolve, DNS szurke felho, render.yaml figyelmen kivul, PowerShell tiltas, GOCSPX prefix.'
entities:
  - constraints
  - rules
  - restrictions
tags:
  - constraints
  - restrictions
  - must-not
  - active-rules
importance: 1.00
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:CLAUDE.md
retrieval_hints:
  lexical:
    - tiltas
    - ne
    - tilos
    - constraint
    - restriction
    - must not
  semantic:
    - project restrictions
    - forbidden actions
    - active constraints
---

# Aktiv korlatozasok

## TILOS (NE csinald!)

1. **NE hasznalj PowerShell-t** package.json szerkesztesre (UTF-8 BOM hiba)
2. **NE torold a VITE_API_URL-t** Vercel-en (cookie forwarding nem mukodik rewrite-tal)
3. **NE allitsd Proxy-ra** az `api` DNS rekordot Cloudflare-ben (403 Render SSL)
4. **NE valtoztasd az ENCRYPTION_KEY-t** deploy kozben (OAuth tokenek elvesznek)
5. **NE commitolj titkot** a repoban (server/.env gitignored)
6. **NE hasznalj `*` wildcard origint** CORS-ban
7. **NE engedelyezz nem-HTTPS origint** production-ben (localhost kivetel)
8. **NE torolj** `.db-wal` / `.db-shm` fajlokat (SQLite WAL — legacy)
9. **NE tedd** `@types/*`-ot dependencies-be (mindig devDependencies)
10. **NE vard** hogy a render.yaml frissuljon meglevo service-nel (Dashboard felulirja)

## KOTELEZO (mindig csinald!)

1. **MINDIG** futtass lint + tsc + build-et push elott
2. **MINDIG** harom helyen egyeztess OAuth redirect_uri-t
3. **MINDIG** GOCSPX- prefix-szel kezdodo Client Secret-et hasznalj
4. **MINDIG** `@custom-variant dark` legyen az index.css-ben (TW4)
5. **MINDIG** production-ben kotelezo env-ek legyenek beallitva (fail-closed)
