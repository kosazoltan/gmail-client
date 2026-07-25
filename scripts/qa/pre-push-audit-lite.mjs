#!/usr/bin/env node
// Teljes pre-push audit. Sentinel csak minden konfigurált kapu sikere után készül.

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const isWin = process.platform === 'win32';

function git(root, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: root,
    encoding,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function fingerprint(root) {
  return createHash('sha256').update(git(root, ['diff', '--binary', 'HEAD', '--'], null)).digest('hex');
}

let root;
try {
  root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
} catch {
  console.error('[audit] Nem git repository.');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(join(root, '.agentic-qa-kit.json'), 'utf8')).audit;
} catch {
  console.error('[audit] Hiányzó vagy sérült .agentic-qa-kit.json.');
  process.exit(1);
}

const sentinelName = typeof config?.sentinel === 'string' && config.sentinel ? config.sentinel : '.audit-ok';
const sentinelPath = join(root, sentinelName);
rmSync(sentinelPath, { force: true });

const commands = config?.commands;
if (!Array.isArray(commands) || commands.length === 0 || commands.some((name) => typeof name !== 'string' || !name)) {
  console.error('[audit] Az audit.commands kötelező, nem üres scriptnév-lista.');
  process.exit(1);
}
if (process.argv.includes('--skip-tests') && commands.some((name) => name.startsWith('test'))) {
  console.error('[audit] Teljes auditnál a tesztek nem hagyhatók ki.');
  process.exit(1);
}

const packagePath = join(root, 'package.json');
if (!existsSync(packagePath)) {
  console.error('[audit] Nincs package.json.');
  process.exit(1);
}
const scripts = JSON.parse(readFileSync(packagePath, 'utf8')).scripts || {};
for (const name of commands) {
  if (!scripts[name]) {
    console.error(`[audit] Hiányzó kötelező npm script: ${name}`);
    process.exit(1);
  }
}

const auditedHead = git(root, ['rev-parse', 'HEAD']).trim();
const auditedFingerprint = fingerprint(root);

console.log(`[audit] Futtatás: ${commands.join(' → ')}`);
for (const name of commands) {
  console.log(`\n=== npm run ${name} ===`);
  try {
    if (isWin) execFileSync('cmd', ['/d', '/s', '/c', 'npm', 'run', name], { cwd: root, stdio: 'inherit' });
    else execFileSync('npm', ['run', name], { cwd: root, stdio: 'inherit' });
  } catch {
    console.error(`\n[audit] BUKÁS: npm run ${name}; sentinel nem készült.`);
    process.exit(1);
  }
}

const finalHead = git(root, ['rev-parse', 'HEAD']).trim();
const finalFingerprint = fingerprint(root);
if (finalHead !== auditedHead || finalFingerprint !== auditedFingerprint) {
  console.error('\n[audit] BUKÁS: a repository állapota megváltozott az audit közben; sentinel nem készült.');
  process.exit(1);
}

const sentinel = {
  version: 1,
  head: auditedHead,
  worktreeFingerprint: auditedFingerprint,
  commands,
  completedAt: new Date().toISOString(),
};
writeFileSync(sentinelPath, `${JSON.stringify(sentinel, null, 2)}\n`, { mode: 0o600 });
console.log(`\n[audit] MINDEN ZÖLD — ${sentinelName} sentinel frissítve.`);
