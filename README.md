# scppnl/website

The association and foundation Angular apps live in `src/apps/`. Each keeps its
own `package.json`, `package-lock.json`, scripts, and `node_modules`; the root npm
package contains only repository tooling. This is not an npm workspace.

## Local checks

Use Node 24.22.1 (`nvm use`; minimum 24.15) and npm 11.19.1:

```sh
npm install --global npm@11.19.1
npm ci
npm run ci:tooling
npm run ci:all
```

`ci:all` discovers every Nx project, clean-installs the registered npm apps using
their individual lockfiles, and runs build and test targets. Failures stop the
command and return a nonzero exit status. Nx may reuse its local task cache;
to force actual execution, set `NX_SKIP_NX_CACHE=true` when running the command.
Nx Cloud is disabled. GitHub caches npm downloads, not task results or build
artifacts.

For affected checks, fetch `origin/main` first and use:

```sh
git fetch origin main
npm run ci:projects
npm run ci
npm run ci -- --base=<ancestor-sha> --head=HEAD
npm run ci:projects -- --files=src/apps/frontpage-association/src/app.ts
```

Local selection defaults to the merge base of `HEAD` and `origin/main`. Explicit
`--base` and `--head` compare committed changes between those refs; the base must
be an ancestor. These modes do not include uncommitted changes. Supply repeatable
`--files=path` options to examine specific files, or use `--all`/`ci:all`.
Missing or unusable Git baselines select every project conservatively.

To install dependencies without running application targets, or use Nx directly:

```sh
npm run ci:install
npm run ci:install -- frontpage-association
npm run nx -- show projects
npm run nx -- run frontpage-association:test
npm run nx -- run frontpage-foundation:build
```

Direct Nx execution needs the relevant app dependencies installed first. Existing
commands inside either app still work. Both Angular apps prerender static HTML
and deploy to separate Cloudflare Workers Static Assets with matching pinned
Wrangler versions. Each `test` target depends on its build and runs
`check:hosting` for route content, hydration markers, 404 output, hosting settings,
and Free plan asset limits. Foundation unit tests also run once with watch mode
disabled. See the [association hosting guide](src/apps/frontpage-association/README.md)
and [foundation hosting guide](src/apps/frontpage-foundation/README.md) for local
Wrangler preview, dry runs, deployment, custom domains, and existing form stubs.

## GitHub Actions and affected selection

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual
runs. It checks out the actual PR head with full history. `eng/baseline.mjs`
compares that head with its merge base with the target branch's SHA from the PR
event. It never treats GitHub's synthetic PR merge commit as the head.

On `main`, the script queries successful **push** runs of this same `ci.yml`,
excluding the current run. It compares with the latest successful run's commit,
so changes from failed or cancelled intervening runs remain included. A missing
baseline, inaccessible Actions history, missing commit, or non-ancestor after a
force push triggers a full check. Manual runs always check everything. Repository
and Actions token permissions are read-only. Superseded PR runs are cancelled;
production runs on `main` are serialized without interrupting an active deploy.
GitHub keeps at most one pending run per concurrency group, so a newer pending
push may replace an older pending push. The successful baseline still includes
changes from those cancelled runs.

`eng/select-projects.mjs` delegates project selection to Nx. Each app's lockfile
is part of its own inputs. `nx.json` declares shared workflow, `eng`, root tooling,
and SDK inputs so their changes affect every project. `.nxignore` excludes Markdown
from affected selection and task hashing. Markdown-only changes
(including app READMEs) select no projects and finish successfully without
installing or running apps. When adding another shared configuration file, add
it to `sharedGlobals` so affected selection and task hashes both include it.

## Production deployments

After every selected project's checks pass, `ci.yml` publishes affected websites
on pushes to `main`. PRs only validate. A manual **CI → Run workflow** run targeting
`main` checks and publishes both websites; manual runs on other branches only
validate. Markdown-only pushes publish nothing. Shared tooling or workflow
changes affect both sites. The first push containing this deployment workflow
therefore publishes both.

| Project | Existing Worker | Production URL |
| --- | --- | --- |
| `frontpage-association` | `scpp-association` | https://scpp-association.de-wildert-penp.workers.dev |
| `frontpage-foundation` | `scpp-foundation` | https://scpp-foundation.de-wildert-penp.workers.dev |

The explicit deployment allowlist lives in `eng/production.mjs`. Adding an Nx
project only registers it for checks, not production publishing. Both Workers
belong to **De Wildert PenP**, account `92f5552d0543ddca6c17f012ab294a9f`.
These existing Workers do not use Cloudflare Builds or custom domains.

### One-time credential setup

Contact forms also require the `TURNSTILE_SITE_KEY` GitHub repository secret before
production builds. Follow the [Turnstile setup guide](src/shared/contact-api/README.md#turnstile-github-and-cloudflare-deployment-setup)
for the widget, API runtime secret, hostname allowlists, and frontend URL configuration.

A repository administrator must configure the GitHub **production** environment
before merging the workflow. In **Settings → Environments → production**, allow
only the selected **branch** `main` and do not require a reviewer. Add environment
variable `CLOUDFLARE_ACCOUNT_ID` with the account ID above. In Cloudflare, create
an account-owned API token with **Editor** access scoped only to `scpp-association`
and `scpp-foundation`; save it as environment secret `CLOUDFLARE_API_TOKEN`.
See [Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/#wrangler).
No zone or DNS permissions are needed for these existing `workers.dev` targets.
Never commit the token or paste it into a command argument or chat.

For a new environment, an authenticated administrator can use the GitHub CLI:

```sh
gh api --method PUT repos/scppnl/website/environments/production --input - <<'JSON'
{"wait_timer":0,"reviewers":[],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api --method POST repos/scppnl/website/environments/production/deployment-branch-policies \
  -f name=main -f type=branch
gh variable set CLOUDFLARE_ACCOUNT_ID --repo scppnl/website --env production \
  --body 92f5552d0543ddca6c17f012ab294a9f
gh secret set CLOUDFLARE_API_TOKEN --repo scppnl/website --env production
```

The last command securely prompts for the token. Inspect an existing environment
before using these initialization commands so unrelated policies are preserved.
Missing credentials or a different account ID fail deployment explicitly.

### Artifacts, verification and recovery

The check job exports website selection only after all selected builds and tests
pass, then uploads each site's public asset directory as a separate, seven-day
artifact tied to the commit SHA. Deploy jobs install the locked app tooling,
restore and validate those assets, and run the pinned Wrangler without rebuilding.
Only the publish step receives Cloudflare credentials. Each deployment message
records the commit SHA; the Actions summary includes the Worker, URL, commit and
publish/smoke outcomes.

Smoke checks compare the live homepage, an internal route, a JavaScript asset
and the 404 page with the tested artifact bytes, and verify the trailing-slash
redirect. They retry six times with five seconds between attempts and a
15-second timeout per request. Persistent errors fail the workflow.

Publishing the two Workers is independent: one site's successful deployment
remains live if the other fails. A publish or smoke failure fails the whole
workflow, so it does not advance the successful-push baseline. The next push
includes outstanding changes from failed or cancelled runs. After fixing
credentials or a transient failure, retry failed jobs while artifacts are still
available, or dispatch a new CI run on current `main` to rebuild and publish both.
Avoid rerunning old commits, which can replace newer production content.

For rollback, select the affected Worker in Cloudflare's **Deployments** view and
roll back to the intended previously deployed version (identified by its commit
message). With a matching scoped token and account configured locally, run
`npx --no-install wrangler rollback <version-id>` from that app's directory.
Rollback does not change Git: follow it with a revert/fix on `main` before the
next deployment. The first deployment has no earlier version to restore.
For initial acceptance, verify a PR checks without publishing and the first
successful `main` push deploys both sites with passing smoke checks.

## Onboarding a project

Add a `project.json` with a unique name, explicit targets and outputs. Use existing
commands through `nx:run-commands`, set the correct `cwd`, and include source,
configuration, and lockfiles in inputs. The default inputs cover project files
except Markdown and generated directories. Declare dependencies with
`implicitDependencies` (or an appropriate Nx plugin) so Nx includes consumers
when a dependency changes; add `^build`/`^restore` task dependencies where needed.

For a separate npm project, commit its lockfile and set
`"metadata": { "ci": { "npm": true } }`. `eng/install.mjs` discovers that metadata
and runs `npm ci` in the project root. No hard-coded application list needs an
update. Add its lockfile path to the workflow's npm cache paths if it is outside
`src/apps/*`. CI automatically runs any registered `build` and `test` targets.

## APIs and .NET components

`Scpp.slnx` is the root .NET solution. The component solution is
`src/foundation/booking-api/Scpp.Foundation.Booking.Api.slnx`; both contain the API
under the component's `src/` directory and its MSTest unit tests under `tests/`.
`global.json` selects .NET 10 starting at 10.0.404, allows stable feature-band
updates within .NET 10 (`latestFeature`), and disallows prereleases.

The shared contact API follows the same layout in `src/shared/contact-api/`,
with component solution `Scpp.Shared.Contact.slnx` and these projects:

- `src/Scpp.Shared.Contact.Api`: the slim minimal API host with Native AOT enabled.
- `src/Scpp.Shared.Contact.Models`: shared contact request models in a class library
  referenced by the API without depending on ASP.NET Core.
- `tests/Scpp.Shared.Contact.Api.UnitTests`: MSTest tests for the API.

All three projects are also in `Scpp.slnx` and belong to the `contact-api` Nx
component, so changes to the models library also build and test the API.
`GET /` returns HTTP 200 with plain text `Contact API`. `POST /api/contact` validates
and logs requests from both sites. See the [contact API guide](src/shared/contact-api/README.md)
for its contract, local setup and frontend configuration.

```sh
DOTNET_ENVIRONMENT=Development dotnet run --project src/shared/contact-api/src/Scpp.Shared.Contact.Api -- --urls http://localhost:5081
curl http://localhost:5081/
npm run nx -- run contact-api:test
```

The booking API uses the slim minimal API host with Native AOT enabled. `GET /` returns
HTTP 200 with plain text `Booking API`. To run it locally:

```sh
dotnet run --project src/foundation/booking-api/src/Scpp.Foundation.Booking.Api -- --urls http://localhost:5080
curl http://localhost:5080/
```

Both APIs route Microsoft `ILogger<T>` events through Serilog to readable console
output. The default minimum level is Information, with Microsoft.AspNetCore and
System at Warning. Each event includes its timestamp, level, logger category,
message, remaining structured properties, and exception when present. Application
name, environment, and `BeginScope` properties enrich the events.

Serilog records one completion event per HTTP request with method, path, status,
and duration; unhandled exceptions and HTTP 5xx responses use Error. Application
code should inject `ILogger<T>` and use structured message templates, such as
`logger.LogInformation("Completed operation {OperationId}", operationId)`.
Do not add logs of raw request bodies, credentials, or additional contact/booking
payload fields. The contact API retains its established normalized submission
log contract. Sinks and
levels are configured explicitly in each API's `LoggingSetup` to preserve Native
AOT compatibility; the host owns logger disposal and flushing. This logging setup
is required when creating an API, as described in `AGENTS.md`.
Serilog 4.4 disables reflection-based object destructuring in trimmed/native
builds. Use named scalar properties and collections in message templates rather
than relying on `{@Object}` to reflect over arbitrary objects.

CI registers the components as Nx projects `booking-api` and `contact-api`. An affected
run restores, builds Release, and runs MSTest without rebuilding or restoring.
The separate Docker job publishes Native AOT executables and builds images for
affected projects with a `docker` target, after the check job passes. It runs on
Ubuntu 24.04 with `clang` and `zlib1g-dev`, targets Linux amd64, and checks out the
same commit as the check job. Images stay on the ephemeral runner; registry
hosting and publishing are deferred. A Docker failure fails the workflow and
keeps those changes in the next main run's affected selection. Manual runs build
all registered images; Markdown-only and frontend-only changes build none.
Both APIs have `publish` and `docker` targets and participate in these image builds.
API sources, tests, project configuration, and component solutions affect only
their own API; the root solution affects both APIs.
Frontend-only changes select only the corresponding frontend. Shared SDK,
build/package configuration, and CI tooling changes affect every project.
Markdown-only changes select no projects.

```sh
npm run nx -- run booking-api:test
npm run ci -- --files=src/foundation/booking-api/src/Scpp.Foundation.Booking.Api/Program.cs
npm run dotnet -- restore Scpp.slnx
npm run dotnet -- build Scpp.slnx
npm run dotnet -- test Scpp.slnx
```

### Build and run the API images

Use Ubuntu 24.04 amd64, matching CI and the runtime image, with the selected .NET
SDK, Docker, `clang` and `zlib1g-dev` installed. Run from the repository root:

```sh
npm run nx -- run booking-api:docker
docker run --rm -p 8080:8080 booking-api:ci
```

Then `curl http://localhost:8080/` returns `Booking API`. The uncached `docker`
target first runs the uncached `publish` target, publishing the API project in
Release for `linux-x64`, self-contained with Native AOT, into
`artifacts/publish/booking-api/`. Publishing performs its own RID-specific restore
and compilation. To perform those steps separately:

```sh
npm run nx -- run booking-api:publish
docker build --platform linux/amd64 -f src/foundation/booking-api/Dockerfile -t booking-api:ci .
```

For the contact API, use the same prerequisites and run from the repository root:

```sh
npm run nx -- run contact-api:docker
docker run --rm -p 8081:8080 contact-api:ci
```

Then `curl http://localhost:8081/` returns HTTP 200 with plain text `Contact API`.
The host publishes the native executable into `artifacts/publish/contact-api/`
before Docker packages it. To publish and build separately:

```sh
npm run nx -- run contact-api:publish
docker build --platform linux/amd64 -f src/shared/contact-api/Dockerfile -t contact-api:ci .
```

Each Dockerfile only packages its API's published files. Both use the .NET 10 Ubuntu
Noble chiseled runtime-dependencies image with globalization support, run the
native executable as the image's non-root user, and listen on port 8080. The
root `.dockerignore` permits publish artifacts while excluding debug symbols
and local secrets; changing it affects API builds.

To opt another API into image builds, register an uncached Nx `docker` target
depending on its own uncached `publish` target. Use a dedicated publish directory,
Dockerfile and image tag, and include `.dockerignore` in that project's inputs.
CI discovers Docker targets from the checked affected projects and exports them
as the check job's `containers` output. No API allowlist or hosting credentials
are required.

`eng/dotnet.mjs` accepts explicitly supplied, existing project or solution paths,
resolved from the repository root; absolute paths and multiple paths also work.
Restore must run first. Build uses Release and `--no-restore`; test uses Release,
`--no-restore`, and `--no-build`, requiring the earlier build. SDK selection runs
from the repository root, and every child failure propagates to the caller.

For another .NET component, follow the booking API's `project.json`: register
explicit restore, build, and test targets through `eng/dotnet.mjs`, with build
depending on restore and test depending on build. A component solution should
include both its sources and tests. Explicitly model project references and
shared library dependencies in Nx; a `dotnet` command alone does not teach Nx
the .NET project graph. Shared `Directory.Build.*`, `Directory.Packages.props`,
NuGet config, and SDK/tool configuration are global inputs. Add other shared
imports as needed. Keep **all .NET targets** at `cache: false` until restore
behavior, generated files, runtime/configuration variants, and complete outputs
such as `bin` and `obj` have been verified for caching.
