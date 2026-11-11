import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { baseline, lastSuccessfulPush } from './baseline.mjs';

const directory = mkdtempSync(join(tmpdir(), 'nx-baseline-'));
after(() => rmSync(directory, { recursive: true, force: true }));
const git = (args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
git(['init', '-b', 'main']);
git(['config', 'user.name', 'CI test']);
git(['config', 'user.email', 'ci@example.invalid']);
git(['config', 'commit.gpgsign', 'false']);
function commitFile(name) {
  writeFileSync(join(directory, name), name);
  git(['add', name]);
  git(['commit', '-m', name]);
  return git(['rev-parse', 'HEAD']);
}
const successful = commitFile('successful');
const failed = commitFile('failed');
const head = commitFile('current');
git(['branch', 'feature', failed]);
const target = commitFile('target-only');
git(['switch', 'feature']);
const prHead = commitFile('feature-only');
git(['remote', 'add', 'origin', directory]);
const services = {
  git,
  commit: (ref) => git(['rev-parse', '--verify', `${ref}^{commit}`]),
  ensureCommit: (ref) => git(['rev-parse', '--verify', `${ref}^{commit}`]),
};
const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push',
  GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'scppnl/website',
  GITHUB_RUN_ID: '4', GITHUB_TOKEN: 'test-placeholder' };

function history(runs) {
  return async (url) => {
    assert.equal(url.pathname, '/repos/scppnl/website/actions/workflows/ci.yml/runs');
    assert.equal(url.searchParams.get('event'), 'push');
    assert.equal(url.searchParams.get('status'), 'success');
    assert.equal(url.searchParams.get('branch'), 'main');
    return { ok: true, json: async () => ({ workflow_runs: runs }) };
  };
}
const run = (id, sha, conclusion = 'success', event = 'push') => ({
  id, head_sha: sha, head_branch: 'main', conclusion, event,
});

test('main compares with the last successful push, retaining changes from a failed run', async () => {
  const selected = await baseline({ head }, env, {
    ...services,
    lastSuccessfulPush: (settings) => lastSuccessfulPush(settings, history([
      run(4, head), run(3, failed, 'failure'), run(2, failed, 'success', 'workflow_dispatch'), run(1, successful),
    ])),
  });
  assert.equal(selected.base, successful);
  assert.equal(selected.head, head);
  assert.equal(selected.all, false);
  assert.match(git(['diff', '--name-only', selected.base, selected.head]), /failed/);
});

test('missing, unreadable, or non-ancestor main baselines run all projects', async () => {
  for (const getBaseline of [
    async () => undefined,
    async () => 'missing',
    async () => target,
    async () => { throw new Error('HTTP 403'); },
  ]) {
    const selected = await baseline({ head }, env, { ...services, lastSuccessfulPush: getBaseline });
    assert.equal(selected.all, true, selected.reason);
  }
});

test('PR selection uses the checked-out head and merge base, excluding target-only commits', async () => {
  const eventPath = join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { head: { sha: prHead }, base: { ref: 'main', sha: target } } }));
  const prEnv = { ...env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath };
  const selected = await baseline({ head: prHead }, prEnv, services);
  assert.equal(selected.all, false, selected.reason);
  assert.equal(selected.base, failed);
  assert.equal(git(['diff', '--name-only', selected.base, selected.head]), 'feature-only');
  assert.equal((await baseline({ head }, prEnv, services)).all, true);
});

test('manual and explicit full checks run all projects', async () => {
  assert.equal((await baseline({}, { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, services)).all, true);
  assert.equal((await baseline({ all: true }, env, services)).all, true);
});

test('API failures are reported to the conservative full-run fallback', async () => {
  await assert.rejects(lastSuccessfulPush(env, async () => ({ ok: false, status: 403 })), /HTTP 403/);
});
