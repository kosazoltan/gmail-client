# Gmail Client - VPS Deployment

Ez a dokumentáció leírja, hogyan telepítheted a Gmail Client alkalmazást VPS-re, hogy több gépről is elérhető legyen.

## Előfeltételek

### VPS követelmények
- Ubuntu 20.04+ vagy Debian 11+
- Minimum 1GB RAM
- Minimum 10GB tárhely
- Root hozzáférés

### Domain beállítás (Cloudflare)
1. Hozz létre egy `A` rekordot a Cloudflare-ben:
   - **Name**: `mail` (vagy amit szeretnél)
   - **IPv4 address**: A VPS IP címe
   - **Proxy status**: Proxied (narancssárga felhő) vagy DNS only

2. Ha proxied módban használod, állítsd be:
   - SSL/TLS → Full (strict)
   - Edge Certificates → Always Use HTTPS: On

### Google Cloud Console
1. Menj a [Google Cloud Console](https://console.cloud.google.com/) oldalra
2. Hozz létre egy új projektet vagy válaszd ki a meglévőt
3. Engedélyezd a Gmail API-t
4. OAuth 2.0 beállítások:
   - **Authorized JavaScript origins**: `https://mail.mindenes.org`
   - **Authorized redirect URIs**: `https://mail.mindenes.org/api/auth/callback`

## Telepítési módok

### 1. Automatikus telepítés GitHub Actions-szal (ajánlott)

#### GitHub Secrets beállítása

A repository Settings → Secrets and variables → Actions menüpontban add hozzá:

| Secret neve | Leírás |
|------------|--------|
| `VPS_SSH_PRIVATE_KEY` | SSH privát kulcs a VPS-hez |
| `VPS_SERVER_IP` | VPS IP címe |
| `VPS_SSH_USER` | SSH felhasználó (általában `root`) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `SESSION_SECRET` | Random string a session titkosításhoz |

#### SSH kulcs generálás (ha még nincs)
```bash
# Lokális gépen
ssh-keygen -t ed25519 -C "github-actions"

# A privát kulcsot (~/.ssh/id_ed25519) másold be a VPS_SSH_PRIVATE_KEY secret-be

# A publikus kulcsot (~/.ssh/id_ed25519.pub) add hozzá a VPS-en:
# VPS-en: cat >> ~/.ssh/authorized_keys
```

#### Deployment indítása
- Push a `main` vagy `master` branch-re automatikusan elindítja a deployment-et
- Vagy manuálisan: Actions → Deploy Gmail Client to VPS → Run workflow

### 2. Manuális telepítés

#### SSH kapcsolat a VPS-sel
```bash
ssh root@your-vps-ip
```

#### Telepítés
```bash
# Repository klónozása
cd /var/www
git clone https://github.com/kosazoltan/gmail-client.git
cd gmail-client

# Telepítési script futtatása
chmod +x deployment/install.sh
sudo ./deployment/install.sh mail.mindenes.org
```

#### .env fájl beállítása
```bash
nano /var/www/gmail-client/server/.env
```

Tartalom:
```env
PORT=5000
SESSION_SECRET=your-random-secret-here
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://mail.mindenes.org/api/auth/callback
FRONTEND_URL=https://mail.mindenes.org
NODE_ENV=production
```

#### Szolgáltatás indítása
```bash
sudo systemctl start gmail-client-backend
sudo systemctl status gmail-client-backend
```

## Frissítés

### GitHub Actions-szal
Push a main/master branch-re.

### Manuálisan
```bash
cd /var/www/gmail-client
sudo ./deployment/update.sh
```

## Hibaelhárítás

### Backend logok
```bash
sudo journalctl -u gmail-client-backend -f
```

### Nginx logok
```bash
sudo tail -f /var/log/nginx/gmail-client-*.log
```

### Szolgáltatás újraindítása
```bash
sudo systemctl restart gmail-client-backend
sudo systemctl reload nginx
```

### SSL tanúsítvány megújítása
```bash
sudo certbot renew
```

### Portok ellenőrzése
```bash
sudo ss -tlnp | grep -E '(5000|80|443)'
```

## Architektúra

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (DNS/Proxy)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      VPS        │
                    │                 │
┌───────────────────┴─────────────────┴───────────────────┐
│                                                         │
│  ┌─────────────────┐      ┌─────────────────────────┐   │
│  │     Nginx       │      │   Gmail Client Backend  │   │
│  │   (Port 80/443) │─────▶│      (Port 5000)        │   │
│  │                 │      │                         │   │
│  │  - SSL          │      │  - Express.js           │   │
│  │  - Static files │      │  - Google OAuth         │   │
│  │  - Reverse proxy│      │  - Gmail API            │   │
│  └─────────────────┘      │  - SQLite DB            │   │
│                           └─────────────────────────┘   │
│                                                         │
│  /var/www/gmail-client/                                 │
│  ├── client/dist/  (React build)                        │
│  └── server/       (Node.js backend)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Biztonság

1. **Firewall**: Csak a 22, 80, 443 portok nyitva
2. **SSL**: Let's Encrypt tanúsítvány automatikus megújítással
3. **Rate limiting**: API végpontokra korlátozva
4. **Session**: HttpOnly, Secure cookie-k production módban
5. **OAuth**: Csak engedélyezett redirect URI-k

## Hasznos parancsok

```bash
# Szolgáltatás státusz
sudo systemctl status gmail-client-backend

# Backend újraindítás
sudo systemctl restart gmail-client-backend

# Nginx konfig teszt
sudo nginx -t

# SSL tanúsítvány info
sudo certbot certificates

# Tárhely ellenőrzés
df -h

# Memória ellenőrzés
free -m
```
