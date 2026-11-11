import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { root, run } from './process.mjs';
import { options } from './select-projects.mjs';

const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;

const directory = mkdtempSync(join(tmpdir(), 'nx-ci-failures-'));
after(() => rmSync(directory, { recursive: true, force: true }));
cpSync(join(root, 'eng'), join(directory, 'eng'), { recursive: true });
mkdirSync(join(directory, 'node_modules/nx/bin'), { recursive: true });
writeFileSync(join(directory, 'node_modules/nx/package.json'), JSON.stringify({bin: {nx: 'bin/nx.js'}}));
mkdirSync(join(directory, 'app'));
writeFileSync(join(directory, 'app/package-lock.json'), '{}');
writeFileSync(join(directory, 'npm.cjs'), 'process.exit(23);');
writeFileSync(join(directory, 'node_modules/nx/bin/nx.js'), `
const args = process.argv.slice(2);
if (args[0] === 'show' && args[1] === 'projects') console.log('["app"]');
else if (args[0] === 'show') console.log(JSON.stringify({root: 'app', metadata: {ci: {npm: process.env.FAIL_INSTALL === 'true'}}}));
else process.exit(29);
`);

test('CI exits unsuccessfully when npm installation or Nx execution fails', () => {
  for (const failInstall of [true, false]) {
    const result = spawnSync(process.execPath, ['eng/ci.mjs', '--all'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv,
        FAIL_INSTALL: String(failInstall), npm_execpath: join(directory, 'npm.cjs') },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, failInstall ? /failed \(23\)/ : /failed \(29\)/);
  }
});

test('subprocess errors and signals cannot report success', () => {
  assert.throws(() => run(process.execPath, ['-e', 'process.exit(17)'], {env: childEnv}), /failed \(17\)/);
  assert.throws(() => run('nonexistent-ci-executable', []), /ENOENT/);
  if (process.platform !== 'win32') {
    assert.throws(() => run(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM")'], {env: childEnv}), /SIGTERM/);
  }
});

test('ambiguous selection arguments fail instead of selecting silently', () => {
  assert.throws(() => options(['--all', '--base=main']), /cannot be combined/);
  assert.throws(() => options(['--files=README.md', '--head=HEAD']), /cannot be combined/);
  assert.throws(() => options(['--unknown']), /Unknown option/);
});

test('.NET helper requires explicit existing project or solution paths', () => {
  for (const args of [[], ['build'], ['restore', 'missing.csproj'], ['test', 'package.json']]) {
    const result = spawnSync(process.execPath, ['eng/dotnet.mjs', ...args], { cwd: root, encoding: 'utf8', env: childEnv });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:|Expected an existing/);
  }
});
