#!/usr/bin/env node
// PreToolUse gate: a push csak a jelenlegi HEAD/worktree teljes, friss auditja után engedett.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isGitPush, gitWorkingDirectory } from '../lib/command-policy.mjs';

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[agentic-qa-kit] ${reason}`,
    },
  }));
  process.exit(0);
}

function git(root, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: root,
    encoding,
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function fingerprint(root) {
  const diff = git(root, ['diff', '--binary', 'HEAD', '--'], null);
  return createHash('sha256').update(diff).digest('hex');
}

try {
  const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
  if (!['Bash', 'PowerShell'].includes(payload.tool_name || '')) process.exit(0);
  const command = payload.tool_input?.command;
  if (!isGitPush(command)) process.exit(0);

  let root;
  try {
    const commandCwd = gitWorkingDirectory(command, payload.cwd || process.cwd());
    root = git(commandCwd, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    process.exit(0);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(join(root, '.agentic-qa-kit.json'), 'utf8')).audit;
  } catch {
    deny('Az audit konfiguráció hiányzik vagy sérült.');
  }
  if (config?.enabled === false) process.exit(0);

  const sentinelName = typeof config?.sentinel === 'string' && config.sentinel ? config.sentinel : '.audit-ok';
  const maxAgeMinutes = Number(config?.maxAgeMinutes ?? 10);
  const expectedCommands = config?.commands;
  if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes <= 0 || !Array.isArray(expectedCommands) || expectedCommands.length === 0) {
    deny('Az audit konfiguráció érvénytelen.');
  }

  const sentinelPath = join(root, sentinelName);
  if (!existsSync(sentinelPath)) deny(`A push előtti audit hiányzik. Futtasd: npm run qa:audit.`);

  let sentinel;
  try {
    sentinel = JSON.parse(readFileSync(sentinelPath, 'utf8'));
  } catch {
    deny('Az audit sentinel sérült. Futtasd újra: npm run qa:audit.');
  }

  const completedMs = Date.parse(sentinel.completedAt);
  const ageMs = Date.now() - completedMs;
  const valid =
    typeof sentinel.head === 'string' &&
    sentinel.head === git(root, ['rev-parse', 'HEAD']).trim() &&
    sentinel.worktreeFingerprint === fingerprint(root) &&
    JSON.stringify(sentinel.commands) === JSON.stringify(expectedCommands) &&
    Number.isFinite(completedMs) &&
    ageMs >= 0 &&
    ageMs <= maxAgeMinutes * 60_000;

  if (!valid) deny(`Az audit elavult vagy nem ehhez a HEAD/worktree állapothoz tartozik. Futtasd: npm run qa:audit.`);
} catch {
  deny('Az audit állapota nem ellenőrizhető; biztonsági okból a push letiltva.');
}
