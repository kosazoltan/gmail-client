#!/bin/bash
# Gmail Client gyors frissítési script (deploy)
# Használat: sudo ./update.sh

set -e

PROJECT_DIR="/var/www/gmail-client"

echo "=========================================="
echo "Gmail Client Frissítése"
echo "=========================================="

cd "$PROJECT_DIR"

# Git pull
echo "Kód frissítése..."
git pull origin main || git pull origin master

# Backend frissítés
echo "Backend frissítése..."
cd server
npm ci --production
npm run build || npx tsc

# Frontend frissítés
echo "Frontend frissítése..."
cd ../client
npm ci
npm run build

# Backend újraindítás
echo "Backend újraindítása..."
sudo systemctl restart gmail-client-backend

# Nginx újratöltése
echo "Nginx újratöltése..."
sudo systemctl reload nginx

echo ""
echo "✓ Frissítés befejezve!"
echo ""
echo "Státusz ellenőrzése:"
sudo systemctl status gmail-client-backend --no-pager -l | head -15
