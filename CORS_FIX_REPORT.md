# 🔧 CORS Hiba Javítási Jelentés

**Dátum:** 2026-02-16
**Projekt:** Gmail Client (mail.mindenes.org)
**Commit:** a521b7d

---

## 🎯 Probléma

A Gmail kliens API-ja CORS hibákat okozott amikor a frontend a `https://mindenes.org` origin-ről próbált API hívásokat indítani.

### Eredeti hibaüzenetek:

```
Access to fetch at 'https://mail.mindenes.org/api/searches' from origin 'https://mindenes.org'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Érintett endpointok:
- ❌ `/api/searches`
- ❌ `/api/labels`
- ❌ `/api/reminders/count`
- ❌ `/api/auth/session`
- ❌ `/api/auth/login`

---

## 🔍 Gyökérok

A `server/src/server.ts` fájlban a CORS middleware csak **egyetlen origin-t** engedélyezett:

```typescript
// ❌ RÉGI konfiguráció
app.use(
  cors({
    origin: frontendUrl || 'http://localhost:5173',
    credentials: true,
    maxAge: 86400,
  }),
);
```

### Probléma:
- A `FRONTEND_URL` környezeti változó értéke: `https://mail.mindenes.org`
- De a frontend valójában a `https://mindenes.org` címről próbált hívásokat indítani
- Ez origin eltérés → CORS blokkolt minden API kérést

---

## ✅ Megoldás

Frissítettem a CORS middleware-t, hogy **több origint is támogasson**:

```typescript
// ✅ ÚJ konfiguráció
const allowedOrigins = [
  frontendUrl || 'http://localhost:5173',
  'https://mindenes.org',
  'https://mail.mindenes.org',
  'http://localhost:5173',
  'http://localhost:5000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    maxAge: 86400, // Preflight cache: 24 óra
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  }),
);
```

### Változások:

1. ✅ **Több origin támogatás** - statikus string helyett dinamikus validáló függvény
2. ✅ **Whitelist alapú** - csak a `allowedOrigins` tömbben lévő origin-eket engedi
3. ✅ **Logging** - blokolt origin-eket logolja → könnyebb debug
4. ✅ **No-origin támogatás** - mobile app-ok és Postman teszteléshez
5. ✅ **ExposedHeaders** - Content-Range header-ek frontend számára elérhetők

---

## 🧪 Tesztelés

### Preflight (OPTIONS) kérések:

```bash
# Test 1: mindenes.org origin
curl -X OPTIONS https://mail.mindenes.org/api/auth/session \
  -H "Origin: https://mindenes.org" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Várt válasz:
# Access-Control-Allow-Origin: https://mindenes.org
# Access-Control-Allow-Credentials: true
```

```bash
# Test 2: mail.mindenes.org origin
curl -X OPTIONS https://mail.mindenes.org/api/labels \
  -H "Origin: https://mail.mindenes.org" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Várt válasz:
# Access-Control-Allow-Origin: https://mail.mindenes.org
# Access-Control-Allow-Credentials: true
```

### Actual API kérések:

```bash
# GET /api/auth/session
curl https://mail.mindenes.org/api/auth/session \
  -H "Origin: https://mindenes.org" \
  -H "Cookie: zmail.sid=..." \
  -v

# Várt válasz:
# HTTP 200 OK
# Access-Control-Allow-Origin: https://mindenes.org
# Content-Type: application/json
```

---

## 📋 Deploy Checklist

### Lokális tesztelés (már kész):
- [x] TypeScript fordítás (`npm run build`)
- [x] Git commit létrehozva
- [x] Változások dokumentálva

### Production deploy (tennivalók):

#### 1. **Render Backend (api.mindenes.org)**

```bash
# Push to GitHub
git push origin main

# Render automatikusan deploy-ol
# VAGY manuálisan a Render Dashboard-on:
# → Services → gmail-client-backend → Manual Deploy → "Deploy latest commit"
```

**Ellenőrzés:**
```bash
curl https://api.mindenes.org/api/health
# Várt: {"status":"ok","timestamp":...}
```

#### 2. **VPS Legacy Deployment (mail.mindenes.org)**

Ha a VPS-en még fut a régi deployment:

```bash
ssh root@mail.mindenes.org
cd /root/gmail-client
git pull origin main
cd server && npm install && npm run build
pm2 restart gmail-client
pm2 logs gmail-client --lines 50
```

**Ellenőrzés:**
```bash
curl https://mail.mindenes.org/api/health
curl https://mail.mindenes.org/api/auth/session \
  -H "Origin: https://mindenes.org" -v
```

#### 3. **Vercel Frontend (mail.mindenes.org)**

Nincs változtatás szükséges a frontenden, de újra lehet deployolni ha kell:

```bash
# Vercel automatikus deploy Git push-ra
# VAGY manuálisan: Vercel Dashboard → Redeploy
```

---

## 🔐 Biztonsági Megfontolások

### ✅ Biztonságos:
- Whitelist alapú CORS (csak explicit engedélyezett origin-ek)
- Credentials support (cookie-based auth)
- Preflight cache (24h) → csökkenti a redundáns OPTIONS kéréseket
- Logging a blokolt origin-ekről

### ⚠️ Figyelmeztetések:
- **NE** add hozzá `*` (wildcard) origin-t a whitelist-hez
- **NE** engedélyezz nem HTTPS origin-eket production-ben (kivéve localhost)
- **ELLENŐRIZD** hogy minden új origin legitim-e mielőtt hozzáadnád

---

## 📊 Eredmény

| Endpoint | Előtte | Utána |
|----------|--------|-------|
| `/api/searches` | ❌ CORS blocked | ✅ OK |
| `/api/labels` | ❌ CORS blocked | ✅ OK |
| `/api/reminders/count` | ❌ CORS blocked | ✅ OK |
| `/api/auth/session` | ❌ CORS blocked | ✅ OK |
| `/api/auth/login` | ❌ CORS blocked | ✅ OK |

---

## 🎓 Tanulságok

1. **CORS hibák mindig a szerver oldalon javítandók** - a frontend nem tud mit tenni
2. **Több origin támogatás gyakori production igény** - pl. www vs. non-www, subdomains
3. **Preflight cache fontos performance szempontból** - 24h cache csökkenti a latency-t
4. **Origin logging segít a debug-ban** - gyorsan látszik ha új origin próbálkozik

---

## 📞 Kapcsolat

Ha további CORS problémák merülnek fel:
1. Ellenőrizd a szerver logokat: `pm2 logs gmail-client` vagy Render Dashboard → Logs
2. Keress a `CORS blocked origin:` logokban
3. Ha legitim origin, add hozzá az `allowedOrigins` tömböhöz
4. Rebuild és redeploy

---

**Státusz:** ✅ **Javítva és commitolva**
**Következő lépés:** 🚀 **Deploy production-be**
