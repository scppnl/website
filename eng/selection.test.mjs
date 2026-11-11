import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { root } from './process.mjs';

// Exercise real Nx selection in ordinary CLI children, outside Node's test protocol.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const both = ['frontpage-association', 'frontpage-foundation'];
for (const [files, expected] of [
  [['src/apps/frontpage-association/src/app.ts'], [both[0]]],
  [['src/apps/frontpage-association/package-lock.json'], [both[0]]],
  [['src/apps/frontpage-foundation/src/app/app.ts'], [both[1]]],
  [['src/apps/frontpage-foundation/package-lock.json'], [both[1]]],
  [['eng/ci.mjs'], both],
  [['.github/workflows/ci.yml'], both],
  [['global.json'], both],
  [['package-lock.json'], both],
  [['README.md', 'src/apps/frontpage-association/README.md', 'src/apps/frontpage-foundation/README.md'], []],
]) {
  test(`affected selection: ${files.join(', ')}`, () => {
    const result = spawnSync(process.execPath,
      ['eng/select-projects.mjs', ...files.map((file) => `--files=${file}`)],
      { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).projects, expected);
  });
}

test('documentation-only CI succeeds without installing or running apps', () => {
  const result = spawnSync(process.execPath,
    ['eng/ci.mjs', '--files=README.md', '--files=src/apps/frontpage-association/README.md'],
    { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No affected projects/);
  assert.doesNotMatch(result.stdout, /Installing locked dependencies|nx run/);
});
