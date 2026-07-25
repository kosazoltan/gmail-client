#!/usr/bin/env node
// Runs an already-installed package binary without invoking npm/npx or fetching anything.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [packageName, binaryName, ...args] = process.argv.slice(2);
if (!packageName || !binaryName) {
  console.error('Usage: run-local-tool.mjs <package> <binary> [...args]');
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packagePath = join(root, 'node_modules', packageName, 'package.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
} catch {
  console.error(`[qa-tool] ${packageName} is not installed locally; refusing to fetch it.`);
  process.exit(1);
}

const relativeBinary = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binaryName];
if (!relativeBinary) {
  console.error(`[qa-tool] ${packageName} does not expose binary ${binaryName}.`);
  process.exit(1);
}

try {
  execFileSync(process.execPath, [join(root, 'node_modules', packageName, relativeBinary), ...args], {
    cwd: root,
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(typeof error.status === 'number' && error.status > 0 ? error.status : 1);
}
