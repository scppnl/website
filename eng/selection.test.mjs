import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { root } from './process.mjs';
import { affectsImages, changedFiles } from './select-projects.mjs';

// Exercise real Nx selection in ordinary CLI children, outside Node's test protocol.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const both = ['frontpage-association', 'frontpage-foundation'];
const all = ['auth-api', 'booking-api', 'contact-api', ...both];
const authRoot = 'src/foundation/auth-api';
const bookingRoot = 'src/foundation/booking-api';
const contactRoot = 'src/shared/contact-api';
for (const [files, expected] of [
  [['src/apps/frontpage-association/src/app.ts'], [both[0]]],
  [['src/apps/frontpage-association/package-lock.json'], [both[0]]],
  [['src/apps/frontpage-foundation/src/app/app.ts'], [both[1]]],
  [['src/apps/frontpage-foundation/package-lock.json'], [both[1]]],
  [[`${bookingRoot}/src/Scpp.Foundation.Booking.Api/Program.cs`], ['booking-api']],
  [[`${bookingRoot}/src/Scpp.Foundation.Booking.Api/Scpp.Foundation.Booking.Api.csproj`], ['booking-api']],
  [[`${bookingRoot}/tests/Scpp.Foundation.Booking.Api.UnitTests/DummyEndpointTests.cs`], ['booking-api']],
  [[`${bookingRoot}/tests/Scpp.Foundation.Booking.Api.UnitTests/Scpp.Foundation.Booking.Api.UnitTests.csproj`], ['booking-api']],
  [[`${bookingRoot}/project.json`], ['booking-api']],
  [[`${bookingRoot}/Dockerfile`], ['booking-api']],
  [[`${authRoot}/src/Scpp.Foundation.Auth.Api/Program.cs`], ['auth-api']],
  [[`${authRoot}/src/Scpp.Foundation.Auth.Api/Scpp.Foundation.Auth.Api.csproj`], ['auth-api']],
  [[`${authRoot}/src/Scpp.Foundation.Auth.Api/Sessions/CookieProtector.cs`], ['auth-api']],
  [[`${authRoot}/src/Scpp.Foundation.Auth.Contracts/SessionResponseDto.cs`], ['auth-api']],
  [[`${authRoot}/tests/Scpp.Foundation.Auth.Api.UnitTests/Endpoints/RootTests.cs`], ['auth-api']],
  [[`${authRoot}/project.json`], ['auth-api']],
  [[`${authRoot}/Dockerfile`], ['auth-api']],
  [[`${authRoot}/Scpp.Foundation.Auth.Api.slnx`], ['auth-api']],
  [['.dockerignore'], ['auth-api', 'booking-api', 'contact-api']],
  [[`${bookingRoot}/Scpp.Foundation.Booking.Api.slnx`], ['booking-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Api/Program.cs`], ['contact-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Api/Scpp.Shared.Contact.Api.csproj`], ['contact-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Models/Scpp.Shared.Contact.Models.csproj`], ['contact-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Api/Services/ContactSubmissionService.cs`], ['contact-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Domain/Scpp.Shared.Contact.Domain.csproj`], ['contact-api']],
  [[`${contactRoot}/src/Scpp.Shared.Contact.Infrastructure/Scpp.Shared.Contact.Infrastructure.csproj`], ['contact-api']],
  [[`${contactRoot}/tests/Scpp.Shared.Contact.Api.UnitTests/Endpoints/DummyEndpointTests.cs`], ['contact-api']],
  [[`${contactRoot}/tests/Scpp.Shared.Contact.Api.UnitTests/Scpp.Shared.Contact.Api.UnitTests.csproj`], ['contact-api']],
  [[`${contactRoot}/project.json`], ['contact-api']],
  [[`${contactRoot}/Dockerfile`], ['contact-api']],
  [[`${contactRoot}/Scpp.Shared.Contact.slnx`], ['contact-api']],
  [['Scpp.slnx'], ['auth-api', 'booking-api', 'contact-api']],
  [['eng/ci.mjs'], all],
  [['.github/workflows/ci.yml'], all],
  [['.github/workflows/terraform.yml', 'infra/production/apis.tf', 'infra/production/imports.tf', 'infra/README.md', 'infra/ci/plan-summary.py', 'infra/billing-guard/budget.tf', 'infra/billing-guard/function/main.py'], []],
  [['global.json'], all],
  [['package-lock.json'], all],
  [['Directory.Build.props'], all],
  [['.editorconfig'], all],
  [['Directory.Packages.props'], all],
  [['NuGet.Config'], all],
  [['README.md', 'src/apps/frontpage-association/README.md', 'src/apps/frontpage-foundation/README.md', `${authRoot}/README.md`, `${bookingRoot}/README.md`, `${contactRoot}/README.md`], []],
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

const apis = ['auth-api', 'booking-api', 'contact-api'];
// Images are only republished for changes that can alter their contents. CI-only
// changes still build and test every project (see the table above) but never select an image.
for (const [files, expected] of [
  [['eng/ci.mjs'], []],
  [['eng/publish-containers.mjs', '.github/workflows/ci.yml'], []],
  [['.github/actions/setup/action.yml'], []],
  [['package.json'], []],
  [['package-lock.json'], []],
  [['nx.json'], []],
  [['.nvmrc'], []],
  [['.npmrc'], []],
  [['README.md', 'infra/production/apis.tf'], []],
  [['.dockerignore'], apis],
  [['global.json'], apis],
  [['Directory.Build.props'], apis],
  [['Directory.Packages.props'], apis],
  [['NuGet.Config'], apis],
  [['.editorconfig'], apis],
  [['Scpp.slnx'], apis],
  [[`${bookingRoot}/Dockerfile`], ['booking-api']],
  [['eng/frontend.mjs', `${contactRoot}/src/Scpp.Shared.Contact.Api/Program.cs`], ['contact-api']],
  [['.github/workflows/ci.yml', `${authRoot}/project.json`, `${bookingRoot}/project.json`], ['auth-api', 'booking-api']],
  [['src/apps/frontpage-foundation/src/app/app.ts'], []],
]) {
  test(`affected images: ${files.join(', ')}`, () => {
    const result = spawnSync(process.execPath,
      ['eng/select-projects.mjs', ...files.map((file) => `--files=${file}`)],
      { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).imageProjects.filter((name) => apis.includes(name)), expected);
  });
}

test('only CI orchestration paths are exempt from image selection', () => {
  for (const file of ['eng/ci.mjs', 'eng/nested/tool.mjs', '.github/workflows/ci.yml', '.github/actions/x/action.yml',
    'package.json', 'package-lock.json', 'nx.json', '.nvmrc', '.npmrc']) assert.equal(affectsImages(file), false, file);
  for (const file of ['global.json', '.editorconfig', '.dockerignore', 'Scpp.slnx', 'Directory.Build.props',
    'engine/other.cs', '.githubx/file', 'src/apps/frontpage-foundation/package.json', 'src/apps/frontpage-foundation/package-lock.json',
    `${bookingRoot}/Dockerfile`]) assert.equal(affectsImages(file), true, file);
});

test('changed files come from a NUL-delimited diff that lists both sides of renames', () => {
  const calls = [];
  const files = changedFiles({ base: 'a'.repeat(40), head: 'b'.repeat(40) }, (command, args) => {
    calls.push([command, ...args]);
    return 'old name.cs\0new/name.cs\0';
  });
  assert.deepEqual(files, ['old name.cs', 'new/name.cs']);
  assert.deepEqual(calls, [['git', 'diff', '--name-only', '--no-renames', '-z', 'a'.repeat(40), 'b'.repeat(40)]]);
  assert.deepEqual(changedFiles({ files: ['x'] }, () => assert.fail('explicit files need no diff')), ['x']);
});
