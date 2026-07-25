import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const qa = join(repo, 'scripts', 'qa');

function runNode(script, { cwd = repo, input, args = [] } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function initFixture() {
  const root = mkdtempSync(join(tmpdir(), 'agentic-qa-remediation-'));
  mkdirSync(join(root, 'scripts', 'qa', 'hooks'), { recursive: true });
  mkdirSync(join(root, 'scripts', 'qa', 'lib'), { recursive: true });
  copyFileSync(join(qa, 'pre-push-audit-lite.mjs'), join(root, 'scripts', 'qa', 'pre-push-audit-lite.mjs'));
  copyFileSync(join(qa, 'hooks', 'check-audit-ok.mjs'), join(root, 'scripts', 'qa', 'hooks', 'check-audit-ok.mjs'));
  copyFileSync(join(qa, 'lib', 'command-policy.mjs'), join(root, 'scripts', 'qa', 'lib', 'command-policy.mjs'));
  writeFileSync(join(root, '.agentic-qa-kit.json'), JSON.stringify({
    audit: { sentinel: '.audit-ok', maxAgeMinutes: 10, enabled: true, commands: ['lint', 'typecheck', 'test', 'build'] },
  }));
  const scripts = Object.fromEntries(['lint', 'typecheck', 'test', 'build'].map((name) => [name, `node -e "process.stdout.write('${name}\\n')"`]));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts }));
  writeFileSync(join(root, 'tracked.txt'), 'initial\n');
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'qa@example.invalid']);
  git(root, ['config', 'user.name', 'QA Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'fixture']);
  return root;
}

function hook(script, command, cwd = repo, extra = {}) {
  const result = runNode(script, { cwd, input: { tool_name: 'Bash', cwd, tool_input: { command }, ...extra } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : {};
}

function denied(output) {
  return output.hookSpecificOutput?.permissionDecision === 'deny';
}

test('root scripts aggregate lint, typecheck, noninteractive tests, and builds for server and client', () => {
  const scripts = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).scripts;
  for (const gate of ['lint', 'typecheck', 'test', 'build']) {
    assert.match(scripts[gate] ?? '', /server/, `${gate} must include server`);
    assert.match(scripts[gate] ?? '', /client/, `${gate} must include client`);
  }
  assert.match(scripts.test, /vitest\s+run|--run/, 'client tests must be noninteractive');
  assert.equal(scripts['qa:audit'], 'node scripts/qa/pre-push-audit-lite.mjs');
  assert.match(scripts['qa:deps'] ?? '', /run-local-tool\.mjs dependency-cruiser depcruise/);
  assert.match(scripts['qa:duplication'] ?? '', /run-local-tool\.mjs jscpd jscpd/);
  assert.doesNotMatch(scripts['qa:deps'], /\bnpx\b/);
  assert.doesNotMatch(scripts['qa:duplication'], /\bnpx\b/);
});

test('tracked Claude settings wire all hooks and Husky pre-push invokes qa:audit', () => {
  const settings = JSON.parse(readFileSync(join(repo, '.claude', 'settings.json'), 'utf8'));
  const serialized = JSON.stringify(settings);
  for (const hookName of ['check-destructive.mjs', 'check-audit-ok.mjs', 'warn-test-edit.mjs']) {
    assert.match(serialized, new RegExp(hookName.replace('.', '\\.')));
  }
  assert.equal(readFileSync(join(repo, '.husky', 'pre-push'), 'utf8').trim(), 'npm run qa:audit');
  const ignore = readFileSync(join(repo, '.gitignore'), 'utf8');
  assert.match(ignore, /!\.claude\/settings\.json/);
});

test('audit writes a JSON sentinel bound to HEAD, tracked worktree, command set, and completion time', () => {
  const root = initFixture();
  const audit = runNode(join(root, 'scripts', 'qa', 'pre-push-audit-lite.mjs'), { cwd: root });
  assert.equal(audit.status, 0, audit.stdout + audit.stderr);
  const sentinel = JSON.parse(readFileSync(join(root, '.audit-ok'), 'utf8'));
  assert.equal(sentinel.head, git(root, ['rev-parse', 'HEAD']));
  assert.match(sentinel.worktreeFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(sentinel.commands, ['lint', 'typecheck', 'test', 'build']);
  assert.ok(Number.isFinite(Date.parse(sentinel.completedAt)));
});

test('audit aborts without a sentinel when a gate changes the audited repository state', () => {
  const root = initFixture();
  const packagePath = join(root, 'package.json');
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
  manifest.scripts.lint = `node -e "require('node:fs').writeFileSync('tracked.txt','mutated\\n')"`;
  writeFileSync(packagePath, JSON.stringify(manifest));

  const audit = runNode(join(root, 'scripts', 'qa', 'pre-push-audit-lite.mjs'), { cwd: root });

  assert.notEqual(audit.status, 0, audit.stdout + audit.stderr);
  assert.match(audit.stdout + audit.stderr, /state|állapot|változ/i);
  assert.equal(spawnSync('git', ['status', '--short', '--', '.audit-ok'], { cwd: root, encoding: 'utf8' }).stdout, '');
});

test('audit sentinel gate accepts only current, fresh, nonfuture state', async (t) => {
  const root = initFixture();
  const auditScript = join(root, 'scripts', 'qa', 'pre-push-audit-lite.mjs');
  const hookScript = join(root, 'scripts', 'qa', 'hooks', 'check-audit-ok.mjs');
  assert.equal(runNode(auditScript, { cwd: root }).status, 0);
  assert.equal(denied(hook(hookScript, 'git push', root)), false, 'fresh matching sentinel should allow');

  await t.test('rejects changed HEAD', () => {
    writeFileSync(join(root, 'next.txt'), 'next\n');
    git(root, ['add', 'next.txt']);
    git(root, ['commit', '-m', 'next']);
    assert.equal(denied(hook(hookScript, 'git push', root)), true);
  });

  await t.test('rejects changed tracked worktree', () => {
    git(root, ['reset', '--hard', 'HEAD~1']);
    assert.equal(runNode(auditScript, { cwd: root }).status, 0);
    writeFileSync(join(root, 'tracked.txt'), 'changed\n');
    assert.equal(denied(hook(hookScript, 'git push', root)), true);
  });

  await t.test('rejects malformed, future, expired, and wrong-command sentinels', () => {
    git(root, ['checkout', '--', 'tracked.txt']);
    assert.equal(runNode(auditScript, { cwd: root }).status, 0);
    const path = join(root, '.audit-ok');
    const valid = JSON.parse(readFileSync(path, 'utf8'));
    const variants = [
      '{broken',
      JSON.stringify({ ...valid, completedAt: new Date(Date.now() + 60_000).toISOString() }),
      JSON.stringify({ ...valid, completedAt: new Date(Date.now() - 11 * 60_000).toISOString() }),
      JSON.stringify({ ...valid, commands: ['lint'] }),
    ];
    for (const value of variants) {
      writeFileSync(path, value);
      assert.equal(denied(hook(hookScript, 'git push', root)), true, value);
    }
  });
});

test('push matcher catches case, git -C, git -c config, quote concatenation, and simple variable invocation', () => {
  const root = initFixture();
  const script = join(root, 'scripts', 'qa', 'hooks', 'check-audit-ok.mjs');
  for (const command of ['Git push', 'git -C . push', 'git -c color.ui=false push', "git pu''sh", 'g=git; $g push']) {
    assert.equal(denied(hook(script, command, root)), true, command);
  }
  assert.equal(
    denied(hook(script, `git -C "${root}" push`, tmpdir())),
    true,
    'git -C must validate the target repository even when payload cwd is elsewhere',
  );
});

test('destructive matcher denies recursive forced root deletion option variants', () => {
  const script = join(qa, 'hooks', 'check-destructive.mjs');
  for (const command of ['rm -r -f /', 'rm --recursive --force /', 'rm -rf -- /']) {
    assert.equal(denied(hook(script, command)), true, command);
  }
});

test('force-push matcher denies protected explicit, refspec, and implicit branch variants', () => {
  const root = initFixture();
  const script = join(qa, 'hooks', 'check-destructive.mjs');
  for (const command of [
    'git push --force origin main',
    'git push origin +HEAD:main',
    'git push --force',
    'git -c color.ui=false push --force',
    'git push origin +main',
    'git push origin +refs/heads/main',
  ]) {
    assert.equal(denied(hook(script, command, root)), true, command);
  }
});

test('test edit hook warns for helper files anywhere under test or tests directories', () => {
  const script = join(qa, 'hooks', 'warn-test-edit.mjs');
  for (const filePath of ['C:/repo/test/helper.js', 'C:/repo/tests/helper.py', '/repo/tests/tool.mjs']) {
    const result = runNode(script, { input: { tool_name: 'Write', tool_input: { file_path: filePath } } });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /systemMessage/, filePath);
  }
});

test('PR-size check rejects invalid limits before doing git work', () => {
  const script = join(qa, 'pr-size-check.mjs');
  for (const args of [['--limit', 'NaN'], ['--limit', '0'], ['--limit', '-1'], ['--limit']]) {
    const result = runNode(script, { args });
    assert.notEqual(result.status, 0, args.join(' '));
    assert.match(result.stdout + result.stderr, /limit/i);
  }
});
