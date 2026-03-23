#!/usr/bin/env node
/**
 * Lokális .env → GitHub Actions Secrets (gh CLI).
 * Futtatás: repó gyökeréből, `gh auth login` után.
 *
 * ZMAIL_DOTENV_PATH — alapértelmezés: server/.env
 *
 * Nem logol értékeket. Nem commitolandó fájlokból olvas.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const dotenvPath = process.env.ZMAIL_DOTENV_PATH
  ? path.resolve(root, process.env.ZMAIL_DOTENV_PATH)
  : path.join(root, 'server', '.env');

function parseDotEnv(content) {
  const map = {};
  for (const line of content.split(/\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) map[key] = val;
  }
  return map;
}

function ghSecretSet(name, value) {
  const r = spawnSync('gh', ['secret', 'set', name, '--body', value], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(`[sync-actions-secrets] gh secret set ${name} sikertelen (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
  console.log(`[sync-actions-secrets] OK: ${name}`);
}

if (!fs.existsSync(dotenvPath)) {
  console.error(`[sync-actions-secrets] Nincs ilyen fájl: ${dotenvPath}`);
  process.exit(1);
}

const env = parseDotEnv(fs.readFileSync(dotenvPath, 'utf8'));

const pat = env.GITHUB_PAT || env.GH_TOKEN;
if (pat) ghSecretSet('GITHUB_PAT', pat);

if (env.RENDER_API_KEY) ghSecretSet('RENDER_API_KEY', env.RENDER_API_KEY);

if (env.DEPLOY_HEALTHCHECK_URL) ghSecretSet('DEPLOY_HEALTHCHECK_URL', env.DEPLOY_HEALTHCHECK_URL);

if (!pat && !env.RENDER_API_KEY && !env.DEPLOY_HEALTHCHECK_URL) {
  console.warn(
    '[sync-actions-secrets] Egyik kulcs sem található: GITHUB_PAT|GH_TOKEN, RENDER_API_KEY, DEPLOY_HEALTHCHECK_URL',
  );
  console.warn(`[sync-actions-secrets] Forrás: ${dotenvPath}`);
  process.exit(2);
}

console.log('[sync-actions-secrets] Kész.');
