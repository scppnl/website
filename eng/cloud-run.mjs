import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { canPublish } from './publish-containers.mjs';
import { isMain, main, root, taskEnv } from './process.mjs';

const services = new Map([
  ['contact-api', 'Contact API'],
  ['booking-api', 'Booking API'],
]);
const location = ['--region=europe-west4', '--project=websites-514515'];

export function targetFor(service, digest) {
  if (!services.has(service)) throw new Error('Expected a registered API: contact-api, booking-api');
  if (typeof digest !== 'string' || digest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error('Expected a verified sha256 image digest');
  }
  return {
    service, digest, expected: services.get(service),
    url: `https://${service}-979979719406.europe-west4.run.app`,
    image: `europe-west4-docker.pkg.dev/websites-514515/dockerhub/scppnl/${service}@${digest}`,
  };
}

function execute(command, args) {
  return spawnSync(command, args, { cwd: root, env: taskEnv, encoding: 'utf8', timeout: 600_000 });
}

function checked(args, exec) {
  const result = exec('gcloud', args);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Cloud Run command failed (${result.signal ?? result.status}): ${result.stderr?.trim() ?? ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function deploy(service, digest, env = process.env, exec = execute) {
  const target = targetFor(service, digest);
  if (!canPublish(env)) throw new Error('API deployment requires push or workflow_dispatch on main');
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || env.GITHUB_SHA.length !== 40) {
    throw new Error('Expected the checked-out GitHub commit SHA');
  }
  // Fail before deploy if the existing service cannot be read. Never create services.
  const existing = checked(['run', 'services', 'describe', target.service, ...location,
    '--format=value(metadata.name)'], exec);
  if (existing !== target.service) throw new Error('Existing Cloud Run service does not match the target');
  const revision = checked(['run', 'deploy', target.service, `--image=${target.image}`, ...location,
    '--quiet', '--format=value(status.latestReadyRevisionName)'], exec);
  if (revision.length > 63 || !revision.startsWith(`${target.service}-`)
    || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(revision)) {
    throw new Error('Cloud Run deployment did not return a valid ready revision');
  }
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `revision=${revision}\n`);
  return revision;
}

export async function smoke(service, digest, { fetchImpl = fetch, attempts = 6, pause = setTimeout } = {}) {
  const target = targetFor(service, digest);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(`${target.url}/`, {
        redirect: 'manual', signal: AbortSignal.timeout(15_000), cache: 'no-store',
      });
      assert.equal(response.status, 200, `${target.service}: GET / HTTP status`);
      assert.equal(await response.text(), target.expected, `${target.service}: GET / identity`);
      console.log(`${target.service}: GET / passed at ${target.url}`);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`${target.service}: smoke attempt ${attempt}/${attempts} failed`);
      await pause(5_000);
    }
  }
}

if (isMain(import.meta.url)) main(() => {
  const [command] = process.argv.slice(2);
  const { SERVICE, DIGEST } = process.env;
  const target = targetFor(SERVICE, DIGEST);
  if (command === 'target') {
    if (!process.env.GITHUB_OUTPUT) throw new Error('Expected GITHUB_OUTPUT');
    appendFileSync(process.env.GITHUB_OUTPUT,
      `service=${target.service}\ndigest=${target.digest}\nimage=${target.image}\nurl=${target.url}\n`);
  } else if (command === 'deploy') {
    return deploy(SERVICE, DIGEST);
  } else if (command === 'smoke') {
    return smoke(SERVICE, DIGEST);
  } else {
    throw new Error('Usage: node eng/cloud-run.mjs target|deploy|smoke');
  }
});
