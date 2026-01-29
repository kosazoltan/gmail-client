#!/bin/bash
# Gmail Client telepítési script VPS-re
# Használat: sudo ./install.sh [domain]
# Példa: sudo ./install.sh mail.mindenes.org

set -e

echo "=========================================="
echo "Gmail Client Telepítése VPS-re"
echo "=========================================="

# Színkódok
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Változók
PROJECT_DIR="/var/www/gmail-client"
DOMAIN="${1:-mail.mindenes.org}"

# Ellenőrzések
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Kérlek futtasd root-ként: sudo ./install.sh${NC}"
    exit 1
fi

# 1. Rendszer frissítés
echo -e "${GREEN}[1/9] Rendszer frissítése...${NC}"
apt update && apt upgrade -y

# 2. Node.js telepítése
echo -e "${GREEN}[2/9] Node.js telepítése...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "Node.js telepítve: $(node -v)"
else
    echo "Node.js már telepítve: $(node -v)"
fi

# 3. Szükséges csomagok telepítése
echo -e "${GREEN}[3/9] Szükséges csomagok telepítése...${NC}"
apt install -y \
    nginx \
    git \
    curl \
    certbot \
    python3-certbot-nginx \
    ufw

# 4. Projekt könyvtár létrehozása
echo -e "${GREEN}[4/9] Projekt könyvtár létrehozása...${NC}"
mkdir -p $PROJECT_DIR
chown -R www-data:www-data $PROJECT_DIR

# 5. Git repository klónozása
echo -e "${GREEN}[5/9] Git repository klónozása...${NC}"
if [ ! -d "$PROJECT_DIR/.git" ]; then
    cd /var/www
    rm -rf gmail-client
    git clone https://github.com/kosazoltan/gmail-client.git gmail-client
    cd gmail-client
else
    cd $PROJECT_DIR
    git pull origin main || git pull origin master
fi

# 6. Backend telepítése
echo -e "${GREEN}[6/9] Backend telepítése...${NC}"
cd $PROJECT_DIR/server
npm ci --production

# TypeScript fordítás
npm run build || npx tsc

# .env fájl létrehozása (ha nincs)
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Hozd létre a .env fájlt: $PROJECT_DIR/server/.env${NC}"
    cat > .env.example << 'ENVFILE'
PORT=5000
SESSION_SECRET=change-this-to-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://mail.mindenes.org/api/auth/callback
FRONTEND_URL=https://mail.mindenes.org
NODE_ENV=production
ENVFILE
    cp .env.example .env
    echo -e "${RED}FONTOS: Szerkeszd a .env fájlt a valós értékekkel!${NC}"
fi

# 7. Frontend build
echo -e "${GREEN}[7/9] Frontend build...${NC}"
cd $PROJECT_DIR/client
npm ci

# Production .env
echo "VITE_API_URL=https://$DOMAIN/api" > .env.production

npm run build

# 8. Nginx és Systemd konfiguráció
echo -e "${GREEN}[8/9] Nginx és Systemd konfiguráció...${NC}"

# Systemd service
cp $PROJECT_DIR/deployment/gmail-client-backend.service /etc/systemd/system/
sed -i "s|mail.mindenes.org|$DOMAIN|g" /etc/systemd/system/gmail-client-backend.service
systemctl daemon-reload
systemctl enable gmail-client-backend

# Nginx konfig
cp $PROJECT_DIR/deployment/nginx.conf /etc/nginx/sites-available/gmail-client
sed -i "s|mail.mindenes.org|$DOMAIN|g" /etc/nginx/sites-available/gmail-client
ln -sf /etc/nginx/sites-available/gmail-client /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx teszt és újraindítás
nginx -t && systemctl reload nginx

# 9. Firewall beállítása
echo -e "${GREEN}[9/9] Firewall beállítása...${NC}"
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw --force enable

# Jogosultságok
chown -R www-data:www-data $PROJECT_DIR

# SSL tanúsítvány
echo ""
echo -e "${GREEN}SSL Tanúsítvány Telepítése...${NC}"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
    echo -e "${YELLOW}SSL tanúsítvány telepítése sikertelen. Futtasd kézzel:${NC}"
    echo "certbot --nginx -d $DOMAIN"
}

# Összefoglaló
echo ""
echo -e "${GREEN}=========================================="
echo "Telepítés befejezve!"
echo "==========================================${NC}"
echo ""
echo "Következő lépések:"
echo "1. Szerkeszd a .env fájlt: $PROJECT_DIR/server/.env"
echo "   - Állítsd be a GOOGLE_CLIENT_ID és GOOGLE_CLIENT_SECRET értékeket"
echo "   - Állítsd be a SESSION_SECRET-et"
echo ""
echo "2. Indítsd el a backend szolgáltatást:"
echo "   sudo systemctl start gmail-client-backend"
echo ""
echo "3. Ellenőrizd a státuszt:"
echo "   sudo systemctl status gmail-client-backend"
echo "   sudo systemctl status nginx"
echo ""
echo "Az alkalmazás elérhető: https://$DOMAIN"
echo ""
echo "Logok:"
echo "  Backend: sudo journalctl -u gmail-client-backend -f"
echo "  Nginx: sudo tail -f /var/log/nginx/gmail-client-*.log"
echo ""
