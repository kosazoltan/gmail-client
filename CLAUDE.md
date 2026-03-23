CLAUDE.md - ZMail Fejlesztesi Szabalyok

KOTELEZO olvasmany minden AI agent szamara.

KRITIKUS TANULSAGOK (2026-02-28)

1. SOHA NE HASZNALJ PowerShell-t package.json szerkesztesre!
   PowerShell ConvertFrom-Json UTF-8 BOM-ot es rossz formatumot general.
   MINDIG Node.js-sel vagy npm-mel szerkeszd!

2. @types es typescript MINDIG devDependencies!
   Render buildCommand: npm install --include=dev && npm run build
   render.yaml-t a Render FIGYELMEN KIVUL HAGYJA ha a service mar letezik!
   A Dashboard / API beallitas ervenyesul.

3. Tailwind 4 dark mode: @custom-variant dark kell az index.css-ben.

4. Delete Protection aktiv (server/src/middleware/delete-protection.ts)

4b. **Production hardening** (`server/docs/PRODUCTION-HARDENING.md`): production runtime-ben (`NODE_ENV=production`, `RENDER`, stb.) indulás előtt **kötelező env** ellenőrzés — hiány/gyenge érték → `process.exit(1)` + `[ZMAIL][PROD_ENV][KÓD]` log. Ide tartozik: `SESSION_SECRET`, `ENCRYPTION_KEY`, Google OAuth trio (`GOOGLE_CLIENT_SECRET` tipikusan **GOCSPX-**), `FRONTEND_URL`/`BACKEND_URL` **https**, `ERRORLOG_HMAC_SECRET` (ne a repó default). **Watchdog:** percenkénti kritikus jobok (szundi + ütemezett levél); ha SLA túllépés (`ZMAIL_CRITICAL_JOBS_SLA_MS`, alap 15 perc), **`/api/health` → 503** fail-closed + `audit_log` `system_watchdog_overdue` (ritkítva). Render: `ERRORLOG_HMAC_SECRET` — új blueprint `generateValue`; **meglévő service** Dashboardon add hozzá, különben az új assert miatt nem indul.

5. Deploy: Render backend (Frankfurt) + Vercel frontend autoDeploy.
   GitHub Actions: **CI** (`.github/workflows/ci.yml`) — `npm run lint`, `tsc`, `npm run build` (server + client). **Deploy healthcheck** (`.github/workflows/deploy-healthcheck.yml`) csak **sikeres CI után** fut a `main`-en (`workflow_run`); `scripts/verify-production.py`: `/api/health` (JSON: status+database+timestamp), `/api/auth/login` (OAuth URL), frontend `/` (#root + prod jelző), `/manifest.json` (ZMail). Opcionális **Variables**: `ZMAIL_API_BASE`, `ZMAIL_API_HEALTH_URL`, `ZMAIL_FRONTEND_URL`, `VERIFY_SKIP_INITIAL_SLEEP`. Opcionális **Secrets**: `DEPLOY_HEALTHCHECK_URL` (verify után GET), `RENDER_API_KEY`, `GITHUB_PAT` — **`docs/CI-SECRETS.md`**, `npm run secrets:sync-github` (`gh` + `server/.env`). **API secrets smoke:** `.github/workflows/api-smoke.yml`. **Render Deploy Hook** _új deployt_ indít. Titkok ne kerüljenek gitbe; `server/.env` gitignore-olt.
   Ha Actions piros: nézd **Render** (Deploy / Logs) és **Vercel** (Deployment → Build log) — javítás, újra merge/push.
   Render web service neve: **gmail-client-api**. Adatbázis env kulcs: **DATABASE_URL** (Neon connection string, egyetlen kanonikus kulcs).
   Opcionalis megosztott Neon/Postgres: `ZMAIL_PG_SCHEMA=zmail` — ZMail tablak kulon semaban (`server/docs/NEON-AND-DATABASE.md`).
   Neon Management API nincs a repoban; futas: `pg` + connection string. `@neondatabase/serverless` nem hasznalt.
   **OAuth token (Render / Neon):** `ENCRYPTION_KEY` min. 16 karakter. **Renderen alapertelmezett:** `oauth_token_store` PostgreSQL tabla (ZMAIL_USE_DB_TOKEN_VAULT, RENDER=true) — a refresh token **ujrainditas / uj deploy utan is megmarad** (Neon). Opcionalis duplikatum: `ZMAIL_TOKEN_VAULT_FILE=/data/.secure/...` + perzisztens disk. `ZMAIL_USE_DB_TOKEN_VAULT=0` kikapcsolja a DB vaultot. `RENDER=true` eseten keytar nem toltodik.

6. VITE_API_URL KOTELEZO a Vercel-en!
   Erteke: https://api.mindenes.org/api
   NE torold, NE ird at, NE probald Vercel rewrite proxy-val helyettesiteni!
   A Vercel rewrite NEM tovabbitja a bongeszo cookie-jait a backend fele.
   A frontend KOZVETLENUL hivja az api.mindenes.org-t (cross-origin).

7. Google OAuth redirect_uri HAROM helyen kell egyeznie:
   - Google Cloud Console -> Credentials -> Authorized redirect URIs
   - Render env var: GOOGLE_REDIRECT_URI
   - Kodban: auth.service.ts -> createOAuth2Client()
     Jelenlegi: https://api.mindenes.org/api/auth/callback
8. Google Client Secret MINDIG GOCSPX- prefix-szel kezdodik!
   Ha nem azzal kezdodik -> ROSSZ secret, auth_failed lesz.

9. Cloudflare DNS: api rekord SZURKE felho (DNS only)!
   Narancssarga felho (Proxy) -> 403 hiba a Render SSL utkozese miatt.

10. Session cookie config:
    Domain=.mindenes.org; SameSite=None; Secure; HttpOnly
    Ez mukodik cross-subdomain (mail.mindenes.org <-> api.mindenes.org).

Stack: React 19+TS+Tailwind4+Vite (Vercel) / Express 5+TS+PostgreSQL/Neon (Render Frankfurt)

Push Checklist:

1. cd server && npm run lint && npx tsc --noEmit && npm run build
2. cd client && npm run lint && npx tsc --noEmit && npm run build
3. git push origin main (vagy PR → merge `main`-re; a repo életútja: lint + build lokálisan/CI-n, merge, majd platform deploy)
4. GitHub → Actions: **CI** zöld a `main`-en → **Deploy healthcheck** lefut (zöld = tartalmi smoke OK + opcionális `DEPLOY_HEALTHCHECK_URL` GET). Hiba esetén deploy logok (Render/Vercel) + javítás.
