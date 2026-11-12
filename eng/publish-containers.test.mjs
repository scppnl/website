import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canPublish, publishContainers } from './publish-containers.mjs';
import { root } from './process.mjs';

const configDigest = `sha256:${'a'.repeat(64)}`;
const manifestDigest = `sha256:${'b'.repeat(64)}`;
const env = {
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_SHA: 'c'.repeat(40),
  DOCKER_HUB_USER: 'scppnl', CONTAINERS: '["booking-api","contact-api"]',
};
const ok = stdout => ({ status: 0, stdout, stderr: '' });

function fixture(override = () => undefined) {
  const calls = [];
  const exec = (command, args) => {
    calls.push([command, ...args]);
    const result = override(command, args);
    if (result !== undefined) return result;
    if (command === 'dotnet') {
      assert.equal(args[0], 'msbuild');
      assert.ok(args.includes('-property:Configuration=Release'));
      assert.ok(args.includes('-getProperty:Version'));
      return ok(args[1].includes('Booking.Api.csproj') ? '1.2.3' : '2.3.4-rc.1');
    }
    assert.equal(command, 'docker');
    if (args[0] === 'image') return ok(configDigest);
    if (args[0] === 'manifest' && !args.includes('--verbose')) {
      return { status: 1, stderr: `no such manifest: docker.io/${args.at(-1)}\n` };
    }
    if (args[0] === 'manifest') return ok(JSON.stringify({
      Descriptor: { digest: manifestDigest }, SchemaV2Manifest: { config: { digest: configDigest } },
    }));
    assert.ok(['tag', 'push'].includes(args[0]));
    return ok('');
  };
  return { exec, calls };
}

test('publishes independent csproj versions from built images after checking the entire batch', () => {
  const { exec, calls } = fixture();
  assert.deepEqual(publishContainers(env, exec), [
    { reference: 'scppnl/booking-api:1.2.3', digest: manifestDigest },
    { reference: 'scppnl/contact-api:2.3.4-rc.1', digest: manifestDigest },
  ]);
  const checks = calls.filter(call => call[1] === 'manifest' && !call.includes('--verbose'));
  assert.equal(checks.length, 2);
  assert.ok(calls.indexOf(checks.at(-1)) < calls.findIndex(call => call[1] === 'tag'));
  assert.deepEqual(calls.filter(call => call[1] === 'tag'), [
    ['docker', 'tag', 'booking-api:ci', 'scppnl/booking-api:1.2.3'],
    ['docker', 'tag', 'contact-api:ci', 'scppnl/contact-api:2.3.4-rc.1'],
  ]);
  assert.deepEqual(calls.filter(call => call[1] === 'push'), [
    ['docker', 'push', '--platform', 'linux/amd64', 'scppnl/booking-api:1.2.3'],
    ['docker', 'push', '--platform', 'linux/amd64', 'scppnl/contact-api:2.3.4-rc.1'],
  ]);
  assert.ok(!calls.some(call => call.includes('build') || call.includes('latest')));
});

test('an existing tag for either API blocks every push and requests a version bump', () => {
  for (const project of ['booking-api', 'contact-api']) {
    const { exec, calls } = fixture((command, args) => command === 'docker'
      && args[0] === 'manifest' && args.at(-1).includes(project) ? ok('{}') : undefined);
    assert.throws(() => publishContainers(env, exec), /already exists.*Bump/);
    assert.ok(!calls.some(call => ['tag', 'push'].includes(call[1])));
  }
});

test('only an explicit missing manifest allows a push; registry and process failures fail closed', () => {
  for (const result of [
    { status: 1, stderr: 'unauthorized: authentication required' },
    { status: 1, stderr: 'denied: requested access to the resource is denied' },
    { status: 1, stderr: 'toomanyrequests: rate exceeded' },
    { status: 1, stderr: 'registry unavailable' },
    { status: 1, stderr: 'no such manifest: docker.io/scppnl/wrong:1.2.3' },
    { status: null, signal: 'SIGTERM', stderr: '' },
    { error: new Error('timed out') },
  ]) {
    const { exec, calls } = fixture((command, args) => command === 'docker' && args[0] === 'manifest' ? result : undefined);
    assert.throws(() => publishContainers(env, exec), /Cannot establish|timed out/);
    assert.ok(!calls.some(call => ['tag', 'push'].includes(call[1])));
  }
});

test('rejects invalid selection, credentials, commit and version before pushing; empty selection is a no-op', () => {
  const { exec, calls } = fixture();
  assert.deepEqual(publishContainers({ ...env, CONTAINERS: '[]' }, exec), []);
  assert.equal(calls.length, 0);
  for (const invalid of [
    { CONTAINERS: 'null' }, { CONTAINERS: '["other-api"]' }, { CONTAINERS: '[1]' },
    { DOCKER_HUB_USER: '' }, { DOCKER_HUB_USER: 'other' }, { GITHUB_SHA: '' },
  ]) assert.throws(() => publishContainers({ ...env, ...invalid }, exec));
  assert.equal(calls.length, 0);
  for (const version of ['', '1.2.3+metadata', 'bad/tag', 'bad\nvalue', '-1.2.3', 'a'.repeat(129)]) {
    const bad = fixture(command => command === 'dotnet' ? ok(version) : undefined);
    assert.throws(() => publishContainers(env, bad.exec), /Invalid Docker tag/);
    assert.ok(!bad.calls.some(call => call[1] === 'push'));
  }
});

test('version evaluation, missing local images, retagging and push failures propagate', () => {
  for (const operation of ['msbuild', 'image', 'tag', 'push']) {
    const { exec, calls } = fixture((command, args) => args[0] === operation
      ? { status: 23, stderr: 'operation failed' } : undefined);
    assert.throws(() => publishContainers(env, exec), /failed \(23\).*operation failed/);
    assert.ok(!calls.some(call => call[1] === 'push' && call.at(-1).includes('contact-api')));
  }
});

test('verifies the pushed manifest against the local image and records partial success', () => {
  const directory = mkdtempSync(join(tmpdir(), 'container-summary-'));
  try {
    const summary = join(directory, 'summary.md');
    const { exec } = fixture((command, args) => args.includes('--verbose') && args.at(-1).includes('contact-api')
      ? ok(JSON.stringify({ Descriptor: { digest: manifestDigest }, SchemaV2Manifest: { config: { digest: 'wrong' } } }))
      : undefined);
    assert.throws(() => publishContainers({ ...env, GITHUB_STEP_SUMMARY: summary }, exec), /does not match/);
    const content = readFileSync(summary, 'utf8');
    assert.ok(content.includes(env.GITHUB_SHA));
    assert.ok(content.includes('scppnl/booking-api:1.2.3'));
    assert.ok(content.includes(manifestDigest));
    assert.ok(!content.includes('contact-api'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
  for (const manifest of [{}, { Descriptor: { digest: 'invalid' } }]) {
    const { exec } = fixture((command, args) => args.includes('--verbose') ? ok(JSON.stringify(manifest)) : undefined);
    assert.throws(() => publishContainers(env, exec), /does not match/);
  }
  const { exec } = fixture((command, args) => args.includes('--verbose') ? ok(JSON.stringify({
    Descriptor: { digest: manifestDigest }, OCIManifest: { config: { digest: configDigest } },
  })) : undefined);
  assert.equal(publishContainers({ ...env, CONTAINERS: '["booking-api","booking-api"]' }, exec).length, 1);
});

test('only main push and manual main events can publish; workflow gates login and push identically', () => {
  for (const ref of ['refs/heads/main', 'refs/heads/feature', 'refs/pull/1/merge']) {
    for (const event of ['push', 'workflow_dispatch', 'pull_request', 'pull_request_target']) {
      const candidate = { ...env, GITHUB_REF: ref, GITHUB_EVENT_NAME: event };
      const eligible = ref === 'refs/heads/main' && ['push', 'workflow_dispatch'].includes(event);
      assert.equal(canPublish(candidate), eligible);
      if (!eligible) {
        const { exec, calls } = fixture();
        assert.throws(() => publishContainers(candidate, exec), /only be published/);
        assert.equal(calls.length, 0);
      }
    }
  }
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  const gate = "if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')";
  for (const name of ['Log in to Docker Hub', 'Publish versioned API images']) {
    assert.ok(workflow.split(`- name: ${name}\n`)[1]?.trimStart().startsWith(gate));
  }
  assert.match(workflow, /username: \$\{\{ vars.DOCKER_HUB_USER \}\}/);
  assert.match(workflow, /password: \$\{\{ secrets.DOCKER_HUB_KEY \}\}/);
});
