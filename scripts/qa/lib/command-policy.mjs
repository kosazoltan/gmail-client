import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function normalizeCommand(raw) {
  let command = String(raw ?? '').toLowerCase().replace(/''|""/g, '').replace(/\s+/g, ' ').trim();
  const variables = new Map();
  for (const match of command.matchAll(/(?:^|[;&]\s*)([a-z_][a-z0-9_]*)\s*=\s*(['"]?)([a-z][a-z0-9_-]*)\2\s*(?=;|&|$)/g)) {
    variables.set(match[1], match[3]);
  }
  for (const [name, value] of variables) {
    command = command.replace(new RegExp(`\\$\\{?${name}\\}?\\b`, 'g'), value);
  }
  return command;
}

export function isGitPush(command) {
  return /\bgit\b[^|;&\n]*\bpush\b/i.test(normalizeCommand(command));
}

export function gitWorkingDirectory(raw, fallback = process.cwd()) {
  const command = String(raw ?? '').replace(/''|""/g, '');
  const match = /\b[gG][iI][tT]\b\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/.exec(command);
  return match ? resolve(fallback, match[1] || match[2] || match[3]) : fallback;
}

export function currentBranch(cwd) {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().toLowerCase();
  } catch {
    return '';
  }
}
