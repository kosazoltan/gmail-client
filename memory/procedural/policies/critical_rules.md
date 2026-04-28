---
id: proc_rules_critical_001
type: procedural
domain: policy
title: 'Kritikus fejlesztesi szabalyok (CLAUDE.md)'
summary: 'Kritikus tanulsagok: PowerShell tiltas, devDependencies szabaly, Tailwind 4 dark mode, production hardening, VITE_API_URL kotelezo, OAuth redirect harom helyen, DNS szurke felho.'
entities:
  - CLAUDE.md
  - PowerShell
  - devDependencies
  - VITE_API_URL
tags:
  - rules
  - policy
  - critical
  - constraints
  - CLAUDE.md
importance: 1.00
confidence: 0.99
status: active
owner: system
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:CLAUDE.md
retrieval_hints:
  lexical:
    - szabaly
    - rule
    - CLAUDE.md
    - tiltas
    - kotelezo
    - PowerShell
    - VITE_API_URL
  semantic:
    - development rules
    - critical constraints
    - must-follow policies
---

# Kritikus fejlesztesi szabalyok

Forras: `CLAUDE.md` — KOTELEZO olvasmany minden AI agent szamara.

## 1. PowerShell tiltas

**SOHA** ne hasznalj PowerShell-t `package.json` szerkesztesre!
PowerShell `ConvertFrom-Json` UTF-8 BOM-ot es rossz formatumot general.
**MINDIG** Node.js-sel vagy npm-mel szerkeszd!

## 2. devDependencies

`@types/*` es `typescript` **MINDIG** devDependencies!
Render buildCommand: `npm install --include=dev && npm run build`
`render.yaml`-t a Render **FIGYELMEN KIVUL HAGYJA** ha a service mar letezik!

## 3. Tailwind 4 dark mode

`@custom-variant dark` kell az `index.css`-ben (class-based dark mode).

## 4. Delete Protection

Aktiv middleware: `server/src/middleware/delete-protection.ts`

## 5. Production hardening

Production runtime-ban (`NODE_ENV=production`, `RENDER`, stb.) indulaskor kotelezo env validacio fut.
Hianyzo vagy gyenge `SESSION_SECRET`, `ENCRYPTION_KEY`, Google OAuth trio,
`FRONTEND_URL` / `BACKEND_URL` vagy `ERRORLOG_HMAC_SECRET` eseten a szerver fail-closed modon kilep.

Watchdog: a kritikus percenkenti jobok (szundi + utemezett level) elmaradasa productionben
`/api/health` 503-at okoz.

## 6. VITE_API_URL

**KOTELEZO** a Vercel-en! Erteke: `https://api.mindenes.org/api`

- NE torold, NE ird at
- NE probald Vercel rewrite proxy-val helyettesiteni
- A Vercel rewrite NEM tovabbitja a bongeszo cookie-jait
- A frontend KOZVETLENUL hivja az `api.mindenes.org`-t (cross-origin)

## 7. OAuth redirect_uri

**HAROM** helyen kell egyeznie:

1. Google Cloud Console → Credentials → Authorized redirect URIs
2. Render env var: `GOOGLE_REDIRECT_URI`
3. Kodban: `auth.service.ts` → `createOAuth2Client()`

Jelenlegi: `https://api.mindenes.org/api/auth/callback`

## 8. Google Client Secret

**MINDIG** `GOCSPX-` prefix-szel kezdodik!
Ha nem → ROSSZ secret → `auth_failed`

## 9. Cloudflare DNS

`api` rekord **SZURKE felho** (DNS only)!
Narancssarga felho (Proxy) → 403 hiba (Render SSL utkozese)

## 10. Session cookie

`Domain=.mindenes.org; SameSite=None; Secure; HttpOnly`
Cross-subdomain mukodik: `mail.mindenes.org` ↔ `api.mindenes.org`

## 11. render.yaml figyelmen kivul hagyasa

Render a **mar letezo** service-nel a render.yaml-t **FIGYELMEN KIVUL HAGYJA**.
A Dashboard / API beallitas ervenyesul.
