# 🚀 Production Deployment Instructions

## Quick Deploy

**SSH Details:**
- Host: `mail.mindenes.org`
- User: `root`
- Password: `tckkihLmuCKa`

### Option 1: Automated Script (Recommended)

```bash
ssh root@mail.mindenes.org
cd /root/gmail-client
bash deploy.sh
```

The `deploy.sh` script will automatically:
- Pull latest code from GitHub
- Install dependencies (backend + frontend)
- Build both backend and frontend
- Restart PM2 process
- Show logs

### Option 2: Manual Commands

If the script doesn't work, run these commands manually:

```bash
ssh root@mail.mindenes.org

# Navigate to app directory
cd /root/gmail-client

# Pull latest code
git pull origin main

# Backend: Install dependencies and build
cd server
npm install
npm run build

# Frontend: Install dependencies and build
cd ../client
npm install
npm run build

# Restart PM2
cd ../server
pm2 restart gmail-client || pm2 start npm --name gmail-client -- start

# Check logs
pm2 logs gmail-client --lines 50
```

## Verify Deployment

After deployment, check:

1. **Server Status:**
   ```bash
   pm2 status
   pm2 logs gmail-client
   ```

2. **Website:**
   - Open: https://mail.mindenes.org
   - Try logging in with Google OAuth
   - Check browser console for errors

3. **API Health:**
   ```bash
   curl https://mail.mindenes.org/api/auth/session
   ```
   Should return JSON (not 502 error)

## Troubleshooting

### If PM2 process is stuck:
```bash
pm2 delete gmail-client
cd /root/gmail-client/server
pm2 start npm --name gmail-client -- start
pm2 save
```

### If port 5000 is in use:
```bash
lsof -i :5000
kill -9 <PID>
pm2 restart gmail-client
```

### Check system logs:
```bash
pm2 logs gmail-client --lines 200
journalctl -u gmail-client -n 100
```

## Recent Bug Fixes Included

This deployment includes 14 critical bug fixes:
- ✅ Memory leak fixes (PDF viewer cleanup)
- ✅ Race condition fixes (attachment preview)
- ✅ Error boundary for React crashes
- ✅ Database query error handling
- ✅ Content-Disposition encoding for special characters
- ✅ Keyboard shortcuts in image viewer
- ✅ Email navigation after delete
- ✅ And 7 more critical fixes

All TypeScript checks passed ✓
Production build succeeded ✓
