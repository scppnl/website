import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { root } from './process.mjs';

// Exercise real Nx selection in ordinary CLI children, outside Node's test protocol.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const both = ['frontpage-association', 'frontpage-foundation'];
const all = ['booking-api', 'contact-api', ...both];
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
  [['.dockerignore'], ['booking-api', 'contact-api']],
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
  [['Scpp.slnx'], ['booking-api', 'contact-api']],
  [['eng/ci.mjs'], all],
  [['.github/workflows/ci.yml'], all],
  [['.github/workflows/terraform.yml', 'infra/production/apis.tf', 'infra/production/imports.tf', 'infra/README.md', 'infra/ci/plan-summary.py', 'infra/billing-guard/budget.tf', 'infra/billing-guard/function/main.py'], []],
  [['global.json'], all],
  [['package-lock.json'], all],
  [['Directory.Build.props'], all],
  [['Directory.Packages.props'], all],
  [['NuGet.Config'], all],
  [['README.md', 'src/apps/frontpage-association/README.md', 'src/apps/frontpage-foundation/README.md', `${bookingRoot}/README.md`, `${contactRoot}/README.md`], []],
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
