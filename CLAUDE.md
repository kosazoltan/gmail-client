CLAUDE.md - ZMail Fejlesztesi Szabalyok

KOTELEZO olvasmany minden AI agent szamara.

KRITIKUS TANULSAGOK

1. SOHA NE HASZNALJ PowerShell-t package.json szerkesztesre!
PowerShell ConvertFrom-Json UTF-8 BOM-ot es rossz formatumot general.
MINDIG Node.js-sel vagy npm-mel szerkeszd!

2. @types es typescript MINDIG devDependencies!
render.yaml: npm install --include=dev -> devDeps telepul.

3. Tailwind 4 dark mode: @custom-variant dark kell az index.css-ben.

4. Delete Protection aktiv (server/src/middleware/delete-protection.ts)

5. Deploy: Render backend + Vercel frontend autoDeploy. GitHub Actions NINCS.

Stack: React 19+TS+Tailwind4+Vite (Vercel) / Express 5+TS+sql.js (Render)

Push Checklist:
1. cd server && npx tsc --noEmit && npm run build
2. cd client && npx tsc --noEmit && npm run build
3. git push origin main

6. VITE_API_URL NE LEGYEN beallitva Vercel-en!
A frontend /api keresei a Vercel rewrite-on menjenek at (same-origin).
Ha VITE_API_URL be van allitva, cross-origin lesz es a session cookie
elveszik (Chrome SameSite policy). A vercel.json tartalmazza a rewrite-ot.

7. OAuth callback FONTOS: A Google redirect_uri (api.mindenes.org/api/auth/callback)
a backend domain-re mutat. A backend ONNAN redirect-al a FRONTEND_URL-re.
A session cookie Domain=.mindenes.org igy same-site marad.
DE ha a frontend kozvetlenul hivja az API-t (VITE_API_URL), a cookie
third-party context-ben jon letre es a bongeszo blokkolja.