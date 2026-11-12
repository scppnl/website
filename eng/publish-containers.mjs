import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isMain, main, root, taskEnv } from './process.mjs';

const projects = new Map([
  ['booking-api', 'src/foundation/booking-api/src/Scpp.Foundation.Booking.Api/Scpp.Foundation.Booking.Api.csproj'],
  ['contact-api', 'src/shared/contact-api/src/Scpp.Shared.Contact.Api/Scpp.Shared.Contact.Api.csproj'],
]);
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function execute(command, args) {
  return spawnSync(command, args, { cwd: root, env: taskEnv, encoding: 'utf8', timeout: 300_000 });
}

function checked(command, args, exec) {
  const result = exec(command, args);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.signal ?? result.status}): ${result.stderr?.trim() ?? ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function canPublish(env) {
  return env.GITHUB_REF === 'refs/heads/main'
    && ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME);
}

function requireMissing(reference, exec) {
  const result = exec('docker', ['manifest', 'inspect', reference]);
  if (result.error) throw result.error;
  if (result.status === 0) {
    throw new Error(`${reference} already exists. Bump this API's csproj Version before publishing again.`);
  }
  // Docker CLI's explicit manifest-not-found response only. Do not treat authentication,
  // rate limiting, timeouts, signals, or other registry errors as an available tag.
  const error = result.stderr?.trim();
  if (result.status !== 1 || ![
    `no such manifest: ${reference}`,
    `no such manifest: docker.io/${reference}`,
  ].includes(error)) {
    throw new Error(`Cannot establish whether ${reference} exists (${result.signal ?? result.status}): ${error ?? ''}`);
  }
}

export function publishContainers(env = process.env, exec = execute) {
  if (!canPublish(env)) throw new Error('API images may only be published by push or workflow_dispatch on main');
  const selected = JSON.parse(env.CONTAINERS ?? 'null');
  if (!Array.isArray(selected) || selected.some(name => typeof name !== 'string' || !projects.has(name))) {
    throw new Error('Expected CONTAINERS to contain only registered APIs: booking-api, contact-api');
  }
  if (!selected.length) return [];
  if (env.DOCKER_HUB_USER !== 'scppnl') throw new Error('Set repository variable DOCKER_HUB_USER to scppnl');
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')) throw new Error('Expected the checked-out GitHub commit SHA');

  const images = [...new Set(selected)].map(project => {
    const version = checked('dotnet', ['msbuild', projects.get(project), '-nologo',
      '-property:Configuration=Release', '-getProperty:Version'], exec);
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(version)) {
      throw new Error(`Invalid Docker tag from ${project} csproj Version: ${JSON.stringify(version)}`);
    }
    const local = `${project}:ci`;
    const configDigest = checked('docker', ['image', 'inspect', '--format', '{{.Id}}', local], exec);
    if (!digestPattern.test(configDigest)) throw new Error(`Invalid local image digest for ${local}`);
    return { local, reference: `scppnl/${project}:${version}`, configDigest };
  });

  // Check the entire batch before any tag/push so a version collision cannot
  // publish one API while failing another. Main workflow runs are serialized.
  for (const image of images) requireMissing(image.reference, exec);

  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## API images\n\nCommit: \`${env.GITHUB_SHA}\`\n\n`);
  const published = [];
  for (const image of images) {
    checked('docker', ['tag', image.local, image.reference], exec);
    checked('docker', ['push', '--platform', 'linux/amd64', image.reference], exec);
    // Verbose inspection includes the registry manifest digest and image config.
    // Comparing configs proves the version tag points to the image CI built.
    const manifest = JSON.parse(checked('docker', ['manifest', 'inspect', '--verbose', image.reference], exec));
    const digest = manifest.Descriptor?.digest;
    const config = manifest.SchemaV2Manifest?.config ?? manifest.OCIManifest?.config;
    if (!digestPattern.test(digest ?? '') || config?.digest !== image.configDigest) {
      throw new Error(`Published manifest does not match the built image: ${image.reference}`);
    }
    const result = { reference: image.reference, digest };
    published.push(result);
    console.log(`Published ${image.reference}@${digest}`);
    // Write each verified result immediately so partial publication remains visible.
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `- \`${image.reference}\` — \`${digest}\`\n`);
  }
  return published;
}

if (isMain(import.meta.url)) main(() => publishContainers());
