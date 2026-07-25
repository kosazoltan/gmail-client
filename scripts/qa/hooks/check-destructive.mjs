#!/usr/bin/env node
// PreToolUse destructive-command policy guard. This is a bounded matcher, not a shell sandbox.

import { readFileSync } from 'node:fs';
import { currentBranch, gitWorkingDirectory, isGitPush, normalizeCommand } from '../lib/command-policy.mjs';

function out(value) {
  process.stdout.write(JSON.stringify(value));
}

function deny(reason) {
  out({ hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `[agentic-qa-kit] TILTOTT destruktív parancs: ${reason}`,
  } });
  process.exit(0);
}

function warn(message) {
  out({ systemMessage: `[agentic-qa-kit] FIGYELEM (destruktív határeset): ${message}` });
  process.exit(0);
}

function catastrophicRm(command) {
  for (const match of command.matchAll(/(?:^|[;&|]\s*)rm\s+([^;&|]+)/g)) {
    const tokens = match[1].match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    let recursive = false;
    let force = false;
    let target = '';
    for (const raw of tokens) {
      const token = raw.replace(/^['"]|['"]$/g, '');
      if (token === '--') continue;
      if (token.startsWith('--')) {
        recursive ||= token === '--recursive';
        force ||= token === '--force';
      } else if (/^-[a-z]+$/.test(token)) {
        recursive ||= token.slice(1).includes('r');
        force ||= token.slice(1).includes('f');
      } else if (!target) {
        target = token;
      }
    }
    if (recursive && force && /^(?:\/\*?|[a-z]:[\\/]?\*?)$/i.test(target)) return true;
  }
  return false;
}

try {
  const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
  if (!['Bash', 'PowerShell'].includes(payload.tool_name || '')) process.exit(0);
  const rawCommand = payload.tool_input?.command;
  const command = normalizeCommand(rawCommand);
  if (!command) process.exit(0);

  if (catastrophicRm(command)) deny('rm rekurzív és kényszerített törlés meghajtó-gyökérre vagy /-re');
  if (/\b(?:rd|rmdir)\s+\/s(?:\s+\/q)?\s+["']?[a-z]:[\\/]?["']?(?:\s|$)/.test(command))
    deny('rd /s meghajtó-gyökérre');
  if (/\b(?:remove-item|ri|del|erase)\b[^|;]*["']?[a-z]:[\\/]?["']?\s*(?:-recurse|-force|\s|$)/.test(command)
      && !/[a-z]:[\\/][\w.~$-]/.test(command))
    deny('rekurzív törlés meghajtó-gyökérre');
  if (/\b(?:rd|rmdir|rm|remove-item|del)\b[^|;]*[a-z]:[\\/](?:windows|users)["'\\/ ]*(?:\s|$)/.test(command)
      && !/[a-z]:[\\/](?:windows|users)[\\/][\w.~$-]/.test(command))
    deny('Windows/Users rendszermappa törlése');
  if (/\bformat(?:-volume)?\b\s+(?:-driveletter\s+)?["']?[a-z]:?\b/.test(command)) deny('meghajtó formázása');
  if (/\bmkfs(?:\.|\s)/.test(command)) deny('fájlrendszer-formázás (mkfs)');
  if (/\bdiskpart\b/.test(command)) deny('diskpart particionáló');
  if (/\bclear-disk\b/.test(command)) deny('Clear-Disk');
  if (/\bdrop\s+(?:table|database|schema)\b/.test(command)) deny('DROP TABLE/DATABASE/SCHEMA');
  if (/\bprisma\s+migrate\s+reset\b/.test(command)) deny('prisma migrate reset');

  if (isGitPush(command)) {
    const hasForceFlag = /(?:^|\s)(?:--force(?!-with-lease)(?:=\S+)?|-f)(?=\s|$)/.test(command);
    const hasForcedRefspec = /(?:^|\s)\+\S+/.test(command);
    const forcedProtectedRefspec = /(?:^|\s)\+(?:[^\s:]+:)?(?:refs\/heads\/)?(?:main|master)(?=\s|$)/.test(command);
    const explicitProtected = /(?:^|[\s:])(?:refs\/heads\/)?(?:main|master)(?=\s|$)/.test(command);
    const branchCwd = gitWorkingDirectory(rawCommand, payload.cwd || process.cwd());
    const implicitProtected = hasForceFlag && !explicitProtected && ['main', 'master'].includes(currentBranch(branchCwd));
    if ((hasForceFlag && (explicitProtected || implicitProtected)) || forcedProtectedRefspec)
      deny('force-push védett main/master ágra');
    if (hasForceFlag || hasForcedRefspec)
      warn('force-push nem védett ágra — ellenőrizd a célágat és az együttműködőket.');
  }

  if (/\bgit\s+reset\s+--hard\b/.test(command)) warn('git reset --hard — nem commitolt munka elveszhet.');
  if (/\bgit\s+clean\s+-[a-z]*f/.test(command)) warn('git clean -f — nem követett fájlok elvesznek.');
  if (/\btruncate\s+table\b/.test(command)) warn('TRUNCATE TABLE — auditálhatatlan tömeges törlés.');
  if (/\brm\b[^;&|]*(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive|--force)/.test(command))
    warn('rekurzív/kényszerített rm — ellenőrizd kétszer a célútvonalat.');

  process.exit(0);
} catch {
  process.exit(0);
}
