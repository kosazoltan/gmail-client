# 🚀 Production Deployment: Vercel + Render

## Architektúra

| Komponens                     | Platform               | Domain                  |
| ----------------------------- | ---------------------- | ----------------------- |
| **Frontend** (React/Vite)     | Vercel                 | `mail.mindenes.org`     |
| **Backend** (Express/Node.js) | Render                 | `api.mindenes.org`      |
| **Adatbázis** (SQLite)        | Render Persistent Disk | `/data/gmail-client.db` |

---

## Első telepítés

### 1. Render Backend

1. **Render Dashboard** → New → Blueprint
2. Kösd össze a GitHub repo-val
3. A `render.yaml` automatikusan konfigurálja:
   - Node.js web service (Frankfurt régió)
   - 1 GB Persistent Disk (`/data`) az SQLite adatbázishoz
   - Health check: `/api/health`
4. **Kézi Secret beállítás** a Render Dashboard → Environment fülön:
   - `GOOGLE_CLIENT_ID` — Google Cloud Console-ból
   - `GOOGLE_CLIENT_SECRET` — Google Cloud Console-ból
   - `ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
   - `SESSION_SECRET` — automatikusan generálva a Blueprint-ben
   - `ERRORLOG_HMAC_SECRET` — erős random (error report / audit aláírás); **új** blueprint `generateValue`; meglévő szolgáltatásnál add hozzá kézzel, különben production indulás **fail-closed** lehet
5. **Saját domain**: Settings → Custom Domain → `api.mindenes.org`
   - DNS-ben CNAME rekord: `api.mindenes.org` → `<render-service>.onrender.com`

### 2. Vercel Frontend

1. **Vercel Dashboard** → New Project → Import Git Repository
2. **Root Directory**: `client`
3. **Framework**: Vite (automatikusan felismeri)
4. **Környezeti változó** beállítása:
   - `VITE_API_URL` = `https://api.mindenes.org/api`
5. **Saját domain**: Settings → Domains → `mail.mindenes.org`
   - DNS-ben CNAME rekord: `mail.mindenes.org` → `cname.vercel-dns.com`

### 3. Google OAuth frissítés

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Az OAuth 2.0 Client módosítása:
   - **Authorized JavaScript origins**: `https://mail.mindenes.org`
   - **Authorized redirect URIs**: `https://api.mindenes.org/api/auth/callback`

### 4. DNS beállítások

A domain registrátornál (pl. Cloudflare):

| Típus | Név    | Cél                           |
| ----- | ------ | ----------------------------- |
| CNAME | `mail` | `cname.vercel-dns.com`        |
| CNAME | `api`  | `<service-name>.onrender.com` |

---

## Deploy folyamat

### Automatikus (ajánlott)

- **Push a `main` branch-ra** → Vercel és Render is automatikusan deployol
- Nincs szükség kézi beavatkozásra

### Kötelező minőségsor (ajánlott folyamat)

1. **PR / merge előtt:** lokálisan vagy a CI-n lefut **ESLint** + **TypeScript** + **production build** (`.github/workflows/ci.yml` — `server` + `client` jobok).
2. **Merge a `main`-re** → CI újra lefut a `main`-en.
3. **CI zöld** után automatikusan elindul a **Deploy healthcheck** workflow: **tartalmi** ellenőrzés (`scripts/verify-production.py`), majd opcionális **GET** a `DEPLOY_HEALTHCHECK_URL` secretre. API kulcsok feltöltése GitHubra: **`docs/CI-SECRETS.md`** és `npm run secrets:sync-github` (lokális `server/.env`-ből, `gh` login után). **API secrets smoke** workflow: kézi ellenőrzés `RENDER_API_KEY` / `GITHUB_PAT` ellen.
4. **Ha bármelyik workflow piros:** nyisd meg a **Render** service → _Logs_ / legutóbbi _Deploy_ kimenetét, és a **Vercel** projekt → _Deployments_ → sikertelen build _View Build Log_; javíts a kódon / env-en, majd új PR vagy push.

> **Megjegyzés:** GitHubon érdemes _branch protection_-t beállítani: a **CI** legyen kötelező check a merge előtt.

### Kézi

- **Render**: Dashboard → Manual Deploy → "Deploy latest commit"
- **Vercel**: Dashboard → Deployments → "Redeploy"

---

## Ellenőrzés (deploy után)

1. **GitHub Actions:** _Deploy healthcheck_ job zöld = a script lefuttatta az alábbiakat is (nem csak HTTP 200).
2. **Helyi egyeztetés a scripttel:**
   ```bash
   # gyors ellenőrzés (45s várakozás nélkül)
   VERIFY_SKIP_INITIAL_SLEEP=1 VERIFY_API_RETRIES=1 python3 scripts/verify-production.py
   ```
3. **Backend health check:**

   ```bash
   curl https://api.mindenes.org/api/health
   # Várt: {"status":"ok","database":"connected","timestamp":...}
   ```

4. **Frontend:**
   - `https://mail.mindenes.org` megnyitása → React app betöltődik
   - DevTools → Network: API hívások `api.mindenes.org`-ra mennek

5. **OAuth bejelentkezés:**
   - Login gomb → Google engedélyezés → Átirányítás vissza
   - DevTools → Application → Cookies: `zmail.sid` cookie megjelenik

6. **Perzisztencia teszt:**
   - Render Dashboard → Manual Deploy → Restart
   - Bejelentkezés után az adatok megmaradtak

---

## Hibaelhárítás

### CORS hiba a böngészőben

- Ellenőrizd a Render env var-okat: `FRONTEND_URL=https://mail.mindenes.org`
- DevTools → Console: a hiba mutatja melyik origin blokkolva

### Cookie nem mentődik

- `sameSite: 'none'` + `secure: true` kell (automatikus production-ben)
- Ha közös domain (mindenes.org): a cookie domain `.mindenes.org` lesz

### Render cold start (Free Tier)

- Free Tier esetén 15 perc inaktivitás után leáll a service
- Starter Plan ($7/hó) esetén mindig aktív

### Adatbázis elveszett

- Render Persistent Disk mentések ellenőrzése
- Ha nincs Persistent Disk: az adatbázis törlődik minden deploy-nál!

---

## Legacy (VPS) Deploy

<details>
<summary>Régi VPS deployment (mail.mindenes.org szerver)</summary>

**SSH Details:**

- Host: `mail.mindenes.org`
- User: `root`

### Automated Script

```bash
ssh root@mail.mindenes.org
cd /root/gmail-client
bash deploy.sh
```

### Manual Commands

```bash
ssh root@mail.mindenes.org
cd /root/gmail-client
git pull origin main
cd server && npm install && npm run build
cd ../client && npm install && npm run build
cd ../server && pm2 restart gmail-client
pm2 logs gmail-client --lines 50
```

### Verify

```bash
pm2 status
curl https://mail.mindenes.org/api/auth/session
```

</details>
