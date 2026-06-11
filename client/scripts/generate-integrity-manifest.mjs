#!/usr/bin/env node
/**
 * SHA-256 integritás-manifest generálása a webes build (dist/) minden fájljáról.
 *
 * Kimenet: dist/integrity-manifest.sha256.txt
 *  - fejléc: build dátum, git SHA, fájlszám, összméret
 *  - soronként: <sha256>  <relatív útvonal>
 *
 * A manifest a deployolt oldalon publikusan elérhető (/integrity-manifest.sha256.txt),
 * így bárki ellenőrizheti, hogy a kiszolgált asset-ek bitre egyeznek a buildelttel.
 * (A manifest önmagát értelemszerűen nem tartalmazza.)
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const MANIFEST_NAME = 'integrity-manifest.sha256.txt';

if (!existsSync(distDir)) {
  console.error(`[integrity] dist/ nem található: ${distDir} — előbb futtasd a buildet.`);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const files = walk(distDir)
  .filter((f) => relative(distDir, f) !== MANIFEST_NAME)
  .sort((a, b) => relative(distDir, a).localeCompare(relative(distDir, b), 'en'));

let totalBytes = 0;
const lines = [];
for (const file of files) {
  const content = readFileSync(file);
  totalBytes += content.length;
  const hash = createHash('sha256').update(content).digest('hex');
  const relPath = relative(distDir, file).replaceAll('\\', '/');
  lines.push(`${hash}  ${relPath}`);
}

const header = [
  '# ZMail web client integrity manifest (SHA-256)',
  `# Build date: ${new Date().toISOString()}`,
  `# Git SHA: ${gitSha()}`,
  `# Files: ${files.length}`,
  `# Total bytes: ${totalBytes}`,
  '#',
  '# Ellenőrzés (PowerShell):  Get-FileHash -Algorithm SHA256 <fájl>',
  '# Ellenőrzés (bash):        sha256sum -c integrity-manifest.sha256.txt',
];

writeFileSync(join(distDir, MANIFEST_NAME), [...header, ...lines, ''].join('\n'), 'utf8');
console.log(
  `[integrity] ${MANIFEST_NAME} kész: ${files.length} fájl, ${(totalBytes / 1024 / 1024).toFixed(1)} MB összméret.`,
);
