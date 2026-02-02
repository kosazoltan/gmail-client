#!/bin/bash

# Gmail Client Production Deployment Script
# Run this on the production server: mail.mindenes.org

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/root/gmail-client"
PM2_APP_NAME="gmail-client"

# Navigate to app directory
echo -e "${YELLOW}📂 Navigating to application directory...${NC}"
cd "$APP_DIR" || { echo -e "${RED}❌ Failed to navigate to $APP_DIR${NC}"; exit 1; }

# Check current git status
echo -e "${YELLOW}📊 Current git status:${NC}"
git status

# Stash any local changes (if any)
echo -e "${YELLOW}💾 Stashing local changes...${NC}"
git stash

# Pull latest code from main branch
echo -e "${YELLOW}⬇️  Pulling latest code from GitHub...${NC}"
git pull origin main || { echo -e "${RED}❌ Git pull failed${NC}"; exit 1; }

# Install dependencies (backend)
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$APP_DIR/server"
npm install || { echo -e "${RED}❌ Backend npm install failed${NC}"; exit 1; }

# Install dependencies (frontend)
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd "$APP_DIR/client"
npm install || { echo -e "${RED}❌ Frontend npm install failed${NC}"; exit 1; }

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
npm run build || { echo -e "${RED}❌ Frontend build failed${NC}"; exit 1; }

# Build backend (TypeScript compilation)
echo -e "${YELLOW}🔨 Building backend...${NC}"
cd "$APP_DIR/server"
npm run build || { echo -e "${RED}❌ Backend build failed${NC}"; exit 1; }

# Check if PM2 is managing the app
echo -e "${YELLOW}🔍 Checking PM2 process...${NC}"
if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo -e "${YELLOW}🔄 Restarting PM2 process...${NC}"
    pm2 restart "$PM2_APP_NAME"
    pm2 save
else
    echo -e "${YELLOW}🆕 Starting new PM2 process...${NC}"
    cd "$APP_DIR/server"
    pm2 start npm --name "$PM2_APP_NAME" -- start
    pm2 save
fi

# Show PM2 logs
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}📋 Recent logs:${NC}"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo -e "${YELLOW}🌐 Application should be running at: https://mail.mindenes.org${NC}"
echo ""
echo -e "To monitor logs: ${YELLOW}pm2 logs $PM2_APP_NAME${NC}"
echo -e "To check status: ${YELLOW}pm2 status${NC}"
echo -e "To restart: ${YELLOW}pm2 restart $PM2_APP_NAME${NC}"
