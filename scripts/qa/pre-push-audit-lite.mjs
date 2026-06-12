#!/usr/bin/env node
// agentic-qa-kit — könnyű pre-push audit kis repókhoz (TECH-001/015 lite)
// Lefuttatja a package.json-ban LÉTEZŐ ellenőrző scripteket (lint, typecheck, test),
// és siker esetén frissíti a .audit-ok sentinelt, amit a check-audit-ok hook figyel.
//
// Használat: node scripts/qa/pre-push-audit-lite.mjs [--skip-tests]
// Konfig (opcionális) .agentic-qa-kit.json: { "audit": { "commands": ["lint","test"] } }

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const skipTests = process.argv.includes('--skip-tests');
const isWin = process.platform === 'win32';

let root;
try {
  root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
} catch {
  root = process.cwd();
}

let candidates = ['lint', 'typecheck', 'type-check', 'test:ci', 'test'];
const cfgPath = join(root, '.agentic-qa-kit.json');
if (existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    if (Array.isArray(cfg.audit?.commands)) candidates = cfg.audit.commands;
  } catch { /* default marad */ }
}

const pkgPath = join(root, 'package.json');
if (!existsSync(pkgPath)) {
  console.log('[audit-lite] Nincs package.json — sentinel teszt nélkül NEM írható. Kilépés.');
  process.exit(1);
}
const scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts || {};

// typecheck/type-check és test:ci/test duplikáció kiszűrése: az első létezőt visszük
const plan = [];
const seenGroup = new Set();
for (const c of candidates) {
  const group = c.startsWith('type') ? 'type' : c.startsWith('test') ? 'test' : c;
  if (seenGroup.has(group)) continue;
  if (!scripts[c]) continue;
  if (group === 'test' && skipTests) continue;
  plan.push(c);
  seenGroup.add(group);
}

if (plan.length === 0) {
  console.log('[audit-lite] Egy ellenőrző script sem található a package.json-ban — sentinel NEM íródik.');
  process.exit(1);
}

console.log(`[audit-lite] Futtatás: ${plan.join(' → ')}`);
for (const s of plan) {
  console.log(`\n=== npm run ${s} ===`);
  try {
    // execFileSync argumentum-tömbbel, shell nélkül: nincs string-interpoláció -> injekció-mentes.
    // Windows: cmd /c az npm.cmd futtatásához (Node CVE-2024-27980 miatt nincs közvetlen .cmd exec).
    if (isWin) execFileSync('cmd', ['/c', 'npm', 'run', s], { cwd: root, stdio: 'inherit' });
    else execFileSync('npm', ['run', s], { cwd: root, stdio: 'inherit' });
  } catch {
    console.log(`\n[audit-lite] BUKÁS: npm run ${s} — a sentinel NEM frissül. Javítsd, majd futtasd újra.`);
    process.exit(1);
  }
}

writeFileSync(join(root, '.audit-ok'), new Date().toISOString() + '\n');
console.log('\n[audit-lite] MINDEN ZÖLD — .audit-ok sentinel frissítve. Pusholhatsz (10 percen belül).');
