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
and Actions token permissions are read-only; superseded runs on the same PR or
branch are cancelled. No deployment or artifact publication runs here.

`eng/select-projects.mjs` delegates project selection to Nx. Each app's lockfile
is part of its own inputs. `nx.json` declares shared workflow, `eng`, root tooling,
and SDK inputs so their changes affect every project. `.nxignore` excludes Markdown
from affected selection and task hashing. Markdown-only changes
(including app READMEs) select no projects and finish successfully without
installing or running apps. When adding another shared configuration file, add
it to `sharedGlobals` so affected selection and task hashes both include it.

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

## Booking API and .NET components

`Scpp.slnx` is the root .NET solution. The component solution is
`src/foundation/booking-api/Scpp.Foundation.Booking.Api.slnx`; both contain the API
under the component's `src/` directory and its MSTest unit tests under `tests/`.
`global.json` selects .NET 10 starting at 10.0.404, allows stable feature-band
updates within .NET 10 (`latestFeature`), and disallows prereleases.

The API uses the slim minimal API host with Native AOT enabled. `GET /` returns
HTTP 200 with plain text `Booking API`. To run it locally:

```sh
dotnet run --project src/foundation/booking-api/src/Scpp.Foundation.Booking.Api -- --urls http://localhost:5080
curl http://localhost:5080/
```

CI registers the entire component as the Nx project `booking-api`. An affected
run restores, builds Release, and runs MSTest without rebuilding or restoring.
Native publishing and executable smoke tests are deferred. API sources, tests,
project configuration, and either solution affect only `booking-api`;
frontend-only changes select only the corresponding frontend. Shared SDK,
build/package configuration, and CI tooling changes affect every project.
Markdown-only changes select no projects.

```sh
npm run nx -- run booking-api:test
npm run ci -- --files=src/foundation/booking-api/src/Scpp.Foundation.Booking.Api/Program.cs
npm run dotnet -- restore Scpp.slnx
npm run dotnet -- build Scpp.slnx
npm run dotnet -- test Scpp.slnx
```

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
