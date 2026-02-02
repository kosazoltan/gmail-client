# 🚀 Production Deployment Instructions

## GitHub Actions: Deploy to VPS

The workflow `.github/workflows/deploy-to-vps.yml` runs on push to `main`/`master` or via **workflow_dispatch**.

### Required repository Secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Description |
|--------|-------------|
| `VPS_SSH_PRIVATE_KEY` | Full private key (PEM) for SSH; the key’s public part must be in `~/.ssh/authorized_keys` on the VPS |
| `VPS_SERVER_IP` | VPS hostname or IP (e.g. `mail.mindenes.org` or the server IP) |
| `VPS_SSH_USER` | SSH user (e.g. `root` or `ubuntu`) |
| `SESSION_SECRET` | Random string for session signing |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### If the workflow fails

1. **Fails at “Verify SSH connection”**  
   - `VPS_SSH_PRIVATE_KEY`, `VPS_SERVER_IP`, or `VPS_SSH_USER` missing/wrong.  
   - On the VPS, ensure the key is in `~/.ssh/authorized_keys` for `VPS_SSH_USER`.

2. **Fails at “Setup VPS Environment”**  
   - `apt-get`/install errors: VPS user needs sudo (or use `root`).  
   - Network/curl errors: VPS must reach the internet (e.g. nodesource, nginx).

3. **Fails at “Deploy Backend”**  
   - Clone fails: if the repo is private, use a deploy key or token (e.g. `git clone` with a token in the URL or use an SSH deploy key on the VPS).  
   - `npm ci` fails: check the workflow’s Node version and that `server/package-lock.json` is committed.

4. **Fails at “Create Backend Environment File”**  
   - One of the secrets above is empty or invalid; check each value in the repo Secrets.

5. **Fails at “Build Backend TypeScript” or “Verify Deployment”**  
   - Check the job logs for `npm run build` or runtime errors; ensure `dist/server.js` exists and the backend starts (e.g. `journalctl -u gmail-client-backend` on the VPS).

---

## Quick Deploy (manual)

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
