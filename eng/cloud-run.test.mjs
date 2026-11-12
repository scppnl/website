import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { deploy, smoke, targetFor } from './cloud-run.mjs';
import { root } from './process.mjs';

const digest = `sha256:${'b'.repeat(64)}`;
const env = { GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_SHA: 'c'.repeat(40) };
const ok = stdout => ({ status: 0, stdout, stderr: '' });

test('only registered services and complete lowercase sha256 digests become deployment targets', () => {
  for (const service of ['contact-api', 'booking-api']) {
    const target = targetFor(service, digest);
    assert.equal(target.image, `europe-west4-docker.pkg.dev/websites-514515/dockerhub/scppnl/${service}@${digest}`);
    assert.equal(target.url, `https://${service}-979979719406.europe-west4.run.app`);
    assert.equal(target.expected, service === 'contact-api' ? 'Contact API' : 'Booking API');
  }
  for (const service of ['', 'other-api', '--help', 'contact-api\n', 'contact-api;echo bad', null]) {
    assert.throws(() => targetFor(service, digest), /registered API/);
  }
  for (const invalid of [undefined, null, 123, '', digest.toUpperCase(), `${digest}\n`, `${digest};echo bad`, digest.slice(1)]) {
    assert.throws(() => targetFor('contact-api', invalid), /sha256/);
  }
});

test('deployment checks existence and changes only the image, returning the ready revision', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cloud-run-'));
  try {
    for (const service of ['contact-api', 'booking-api']) {
      const calls = [];
      const revision = `${service}-00004-abc`;
      const output = join(directory, service);
      assert.equal(deploy(service, digest, { ...env, GITHUB_OUTPUT: output }, (command, args) => {
        calls.push([command, ...args]);
        return ok(args.includes('describe') ? service : revision);
      }), revision);
      assert.deepEqual(calls, [
        ['gcloud', 'run', 'services', 'describe', service, '--region=europe-west4', '--project=websites-514515',
          '--format=value(metadata.name)'],
        ['gcloud', 'run', 'deploy', service,
          `--image=europe-west4-docker.pkg.dev/websites-514515/dockerhub/scppnl/${service}@${digest}`,
          '--region=europe-west4', '--project=websites-514515', '--quiet', '--format=value(status.latestReadyRevisionName)'],
      ]);
      assert.equal(readFileSync(output, 'utf8'), `revision=${revision}\n`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('invalid inputs and ineligible events fail before any Cloud Run command', () => {
  let calls = 0;
  const exec = () => { calls++; return ok(''); };
  for (const invalid of [
    { GITHUB_REF: 'refs/heads/topic' }, { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_EVENT_NAME: 'schedule' }, { GITHUB_SHA: '' }, { GITHUB_SHA: `${env.GITHUB_SHA}\n` },
  ]) assert.throws(() => deploy('contact-api', digest, { ...env, ...invalid }, exec));
  assert.throws(() => deploy('other-api', digest, env, exec));
  assert.throws(() => deploy('contact-api', 'invalid', env, exec));
  assert.equal(calls, 0);
  assert.equal(deploy('contact-api', digest, { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' },
    (_command, args) => ok(args.includes('describe') ? 'contact-api' : 'contact-api-00004-abc')), 'contact-api-00004-abc');
});

test('missing services, command failures and invalid revision responses fail deployment', () => {
  for (const result of [
    { status: 1, stderr: 'permission denied' }, { status: null, signal: 'SIGTERM' },
    { error: new Error('timed out') }, ok(''), ok('wrong-service'),
  ]) {
    let calls = 0;
    assert.throws(() => deploy('contact-api', digest, env, () => { calls++; return result; }));
    assert.equal(calls, 1, 'No deploy after a failed existence check');
  }
  for (const result of [
    { status: 1, stderr: 'deployment failed' }, { error: new Error('timed out') },
    ok(''), ok('booking-api-00004-abc'), ok('contact-api-bad/value'), ok(`contact-api-${'a'.repeat(64)}`),
  ]) {
    assert.throws(() => deploy('contact-api', digest, env,
      (_command, args) => args.includes('describe') ? ok('contact-api') : result));
  }
});

test('smoke checks exact identity and status at the service root with bounded retries', async () => {
  for (const service of ['contact-api', 'booking-api']) {
    const pauses = [];
    let calls = 0;
    await smoke(service, digest, {
      pause: async delay => pauses.push(delay),
      fetchImpl: async (url, options) => {
        assert.equal(url, `https://${service}-979979719406.europe-west4.run.app/`);
        assert.equal(options.redirect, 'manual');
        assert.equal(options.cache, 'no-store');
        assert(options.signal instanceof AbortSignal);
        if (++calls === 1) throw new Error('not ready');
        return new Response(targetFor(service, digest).expected);
      },
    });
    assert.equal(calls, 2);
    assert.deepEqual(pauses, [5_000]);
  }
  for (const [status, body] of [[302, 'Contact API'], [503, 'Contact API'], [200, 'wrong'], [200, 'Contact API\n']]) {
    let calls = 0;
    await assert.rejects(smoke('contact-api', digest, {
      pause: async () => {}, fetchImpl: async () => { calls++; return new Response(body, { status }); },
    }));
    assert.equal(calls, 6);
  }
  await assert.rejects(smoke('contact-api', digest, {
    attempts: 1, fetchImpl: async () => { throw new Error('timeout'); },
  }), /timeout/);
});

test('API workflow deploys only verified main results, including partial publication failures', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  const apiJob = workflow.split('\n  deploy-api:\n')[1].split('\n  deploy:\n')[0];
  assert.match(workflow, /published: \$\{\{ steps.publish.outputs.published \}\}/);
  assert.match(apiJob, /needs: \[check, docker\]/);
  assert.match(apiJob, /!cancelled\(\) && needs.check.result == 'success'/);
  assert.match(apiJob, /needs.docker.result == 'success' \|\| needs.docker.result == 'failure'/);
  assert.match(apiJob, /github.ref == 'refs\/heads\/main'/);
  assert.match(apiJob, /github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'/);
  assert.match(apiJob, /needs.docker.outputs.published != '' && needs.docker.outputs.published != '\[\]'/);
  assert.match(apiJob, /include: \$\{\{ fromJSON\(needs.docker.outputs.published \|\| '\[\]'\) \}\}/);
  assert.match(apiJob, /fail-fast: false/);
  assert.match(apiJob, /environment:\n      name: production/);
  assert.match(apiJob, /permissions:\n      contents: read\n      id-token: write/);
  assert.match(apiJob, /workload_identity_provider: \$\{\{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER \}\}/);
  assert.match(apiJob, /service_account: \$\{\{ vars.GCP_SERVICE_ACCOUNT \}\}/);
  assert.match(apiJob, /Summarize API deployment\n        if: always\(\)/);
  for (const field of ['Service:', 'Revision:', 'Image digest:', 'Commit:', 'Outcome:']) assert(apiJob.includes(field));
  assert(!apiJob.includes('secrets.'));
});
