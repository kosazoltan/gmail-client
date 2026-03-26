#!/usr/bin/env node
import { spawnSync } from 'child_process';

/**
 * Pre-commit guard:
 * blokkolja a tipikus generált/cache/report fájlokat a staged változásokban.
 */
const BLOCKED_PATTERNS = [
  {
    test: (p) => /(^|\/)node_modules\//i.test(p),
    reason: 'node_modules mappa nem commitolandó',
  },
  {
    test: (p) => /(^|\/)(dist|build)\//i.test(p),
    reason: 'build output nem commitolandó',
  },
  {
    test: (p) => /(^|\/)\.next\//i.test(p),
    reason: '.next cache nem commitolandó',
  },
  {
    test: (p) => /(^|\/)\.cache\//i.test(p),
    reason: 'cache mappa nem commitolandó',
  },
  {
    test: (p) => /(^|\/)coverage\//i.test(p),
    reason: 'coverage report nem commitolandó',
  },
  {
    test: (p) => /(^|\/)(playwright-report|test-results)\//i.test(p),
    reason: 'teszt report artifact nem commitolandó',
  },
  {
    test: (p) => /\.tsbuildinfo$/i.test(p),
    reason: 'TypeScript build cache nem commitolandó',
  },
  {
    test: (p) => /\.eslintcache$/i.test(p),
    reason: 'ESLint cache nem commitolandó',
  },
  {
    test: (p) => /\.log$/i.test(p),
    reason: 'log fájl általában nem commitolandó',
  },
  {
    test: (p) => /(^|\/)\.DS_Store$/i.test(p) || /(^|\/)Thumbs\.db$/i.test(p),
    reason: 'OS metadata fájl nem commitolandó',
  },
];

function getStagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || '[hygiene] Nem sikerült lekérni a staged fájlokat.\n');
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/\\/g, '/'));
}

function main() {
  const files = getStagedFiles();
  if (files.length === 0) {
    process.exit(0);
  }

  const violations = [];

  for (const file of files) {
    for (const rule of BLOCKED_PATTERNS) {
      if (rule.test(file)) {
        violations.push({ file, reason: rule.reason });
        break;
      }
    }
  }

  if (violations.length === 0) {
    process.stdout.write('[hygiene] OK: nincs tiltott artifact a staged fájlok között.\n');
    process.exit(0);
  }

  process.stderr.write(
    '\n[hygiene] Commit blokkolva: zaj/artifact fájl a staged változások között:\n',
  );
  for (const v of violations) {
    process.stderr.write(` - ${v.file} (${v.reason})\n`);
  }
  process.stderr.write(
    '\n[hygiene] Javaslat: vedd ki a stage-ből ezeket a fájlokat, vagy add a megfelelő mintát a .gitignore-hoz.\n',
  );
  process.exit(1);
}

main();
