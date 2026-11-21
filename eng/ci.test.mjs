import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
if (process.env.TEST_RUN_LOG && args[0] === 'run-many') require('node:fs').appendFileSync(process.env.TEST_RUN_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'show' && args[1] === 'projects') {
  // The image query is the --files query without CI-only paths.
  const files = args.find((arg) => arg.startsWith('--files='));
  const imageQuery = files && !files.slice(8).split(',').some((file) => file.startsWith('eng/') || file.startsWith('.github/'));
  console.log((imageQuery && process.env.TEST_IMAGE_PROJECTS) || process.env.TEST_PROJECTS || '["app"]');
}
else if (args[0] === 'show') console.log(JSON.stringify({root: 'app', metadata: {ci: {npm: process.env.FAIL_INSTALL === 'true'}},
  targets: ['booking-api', 'contact-api', 'another-api'].includes(args[2]) ? {docker: {}} : {}}));
else process.exit(Number(process.env.TEST_NX_EXIT ?? 29));
`);

test('CI exits unsuccessfully when npm installation or Nx execution fails', () => {
  for (const failInstall of [true, false]) {
    const output = join(directory, `output-${failInstall}`);
    const result = spawnSync(process.execPath, ['eng/ci.mjs', '--all'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv,
        FAIL_INSTALL: String(failInstall), npm_execpath: join(directory, 'npm.cjs'), GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, failInstall ? /failed \(23\)/ : /failed \(29\)/);
    assert.equal(existsSync(output), false, 'Failed checks must not export sites or containers');
  }
});

test('successful CI exports checked websites and projects with a Docker target', () => {
  const cases = [
    {projects: [], sites: [], containers: []},
    {projects: ['frontpage-association'], sites: ['frontpage-association'], containers: []},
    {projects: ['frontpage-foundation'], sites: ['frontpage-foundation'], containers: []},
    {projects: ['future-api'], sites: [], containers: []},
    {projects: ['booking-api'], sites: [], containers: ['booking-api']},
    {projects: ['contact-api'], sites: [], containers: ['contact-api']},
    {projects: ['booking-api', 'contact-api'], sites: [], containers: ['booking-api', 'contact-api']},
    {projects: ['another-api', 'booking-api', 'frontpage-association'],
      sites: ['frontpage-association'], containers: ['another-api', 'booking-api']},
  ];
  for (const [index, {projects, sites, containers}] of cases.entries()) {
    const output = join(directory, `selection-${index}`);
    const result = spawnSync(process.execPath, ['eng/ci.mjs', '--all'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv,
        FAIL_INSTALL: 'false', TEST_PROJECTS: JSON.stringify(projects), TEST_NX_EXIT: '0', GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'),
      `containers=${JSON.stringify(containers)}\nsites=${JSON.stringify(sites)}\n`);
  }
});

test('container runner skips an empty selection and propagates Docker target failures', () => {
  for (const [selection, status] of [
    ['[]', 0], ['["booking-api"]', 1], ['["contact-api"]', 1], ['null', 1], ['["--all"]', 1],
  ]) {
    const result = spawnSync(process.execPath, ['eng/containers.mjs'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv, CONTAINERS: selection, TEST_NX_EXIT: '31' },
    });
    assert.equal(result.status, status, result.stderr);
    if (selection.includes('booking-api')) assert.match(result.stderr, /--target=docker.*--projects=booking-api.*failed \(31\)/);
    if (selection.includes('contact-api')) assert.match(result.stderr, /--target=docker.*--projects=contact-api.*failed \(31\)/);
  }
});

test('websites-only manual runs build and export websites without selecting API images', () => {
  const projects = ['booking-api', 'contact-api', 'frontpage-association', 'frontpage-foundation'];
  for (const [index, event] of ['workflow_dispatch', 'push', 'pull_request'].entries()) {
    const output = join(directory, `sites-only-output-${index}`);
    const runLog = join(directory, `sites-only-run-${index}`);
    const result = spawnSync(process.execPath, ['eng/ci.mjs', '--all'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv,
        FAIL_INSTALL: 'false', TEST_PROJECTS: JSON.stringify(projects), TEST_NX_EXIT: '0',
        GITHUB_OUTPUT: output, TEST_RUN_LOG: runLog, GITHUB_EVENT_NAME: event, CI_SITES_ONLY: 'true' },
    });
    assert.equal(result.status, 0, result.stderr);
    const sitesOnly = event === 'workflow_dispatch';
    const selected = sitesOnly ? ['frontpage-association', 'frontpage-foundation'] : projects;
    const args = JSON.parse(readFileSync(runLog, 'utf8').trim());
    assert.ok(args.includes(`--projects=${selected.join(',')}`));
    assert.equal(readFileSync(output, 'utf8'),
      `containers=${JSON.stringify(sitesOnly ? [] : ['booking-api', 'contact-api'])}\nsites=["frontpage-association","frontpage-foundation"]\n`);
  }
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+sites_only:/);
  assert.match(workflow, /CI_SITES_ONLY:.*github.event_name == 'workflow_dispatch'.*inputs.sites_only/);
});

test('CI-only changes build and test every project but publish no images', () => {
  const projects = ['booking-api', 'contact-api', 'frontpage-association'];
  const cases = [
    { files: ['eng/ci.mjs', '.github/workflows/ci.yml'], images: '[]', containers: [], event: 'push' },
    { files: ['eng/ci.mjs', 'src/shared/contact-api/Program.cs'], images: '["contact-api"]', containers: ['contact-api'], event: 'push' },
    { files: ['eng/ci.mjs', 'global.json'], images: '["booking-api","contact-api"]', containers: ['booking-api', 'contact-api'], event: 'pull_request' },
    { files: ['eng/ci.mjs', 'global.json'], images: '["booking-api","contact-api"]', containers: [], event: 'workflow_dispatch', sitesOnly: 'true' },
  ];
  for (const [index, { files, images, containers, event, sitesOnly }] of cases.entries()) {
    const output = join(directory, `image-selection-${index}`);
    const runLog = join(directory, `image-selection-run-${index}`);
    const result = spawnSync(process.execPath, ['eng/ci.mjs', ...files.map((file) => `--files=${file}`)], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv,
        FAIL_INSTALL: 'false', TEST_PROJECTS: JSON.stringify(projects), TEST_IMAGE_PROJECTS: images, TEST_NX_EXIT: '0',
        GITHUB_OUTPUT: output, TEST_RUN_LOG: runLog, GITHUB_EVENT_NAME: event, CI_SITES_ONLY: sitesOnly ?? 'false' },
    });
    assert.equal(result.status, 0, result.stderr);
    const built = JSON.parse(readFileSync(runLog, 'utf8').trim());
    assert.ok(built.includes(`--projects=${(sitesOnly ? ['frontpage-association'] : projects).join(',')}`));
    assert.equal(readFileSync(output, 'utf8'),
      `containers=${JSON.stringify(containers)}\nsites=["frontpage-association"]\n`);
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

test('.NET helper restores, builds and tests with consistent Release settings', { skip: process.platform === 'win32' }, () => {
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const executable = join(bin, 'dotnet');
  const log = join(directory, 'dotnet-arguments');
  writeFileSync(executable, `#!/usr/bin/env node
require('node:fs').appendFileSync(process.env.TEST_DOTNET_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
`);
  chmodSync(executable, 0o755);
  writeFileSync(join(directory, 'test.slnx'), '<Solution />');
  for (const action of ['restore', 'build', 'test']) {
    const result = spawnSync(process.execPath, ['eng/dotnet.mjs', action, 'test.slnx'], {
      cwd: directory, encoding: 'utf8', env: { ...childEnv, PATH: `${bin}:${childEnv.PATH}`, TEST_DOTNET_LOG: log },
    });
    assert.equal(result.status, 0, result.stderr);
  }
  const commands = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(commands, [
    ['restore', join(directory, 'test.slnx'), '-p:Configuration=Release'],
    ['build', join(directory, 'test.slnx'), '--configuration', 'Release', '--no-restore'],
    ['test', join(directory, 'test.slnx'), '--configuration', 'Release', '--no-restore', '--no-build'],
  ]);
});
