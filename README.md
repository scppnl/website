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

## Future .NET components

`global.json` selects .NET 10 starting at 10.0.100, allows stable feature-band
updates within .NET 10 (`latestFeature`), and disallows prereleases. CI installs
the SDK even while there are no .NET projects. No sample application is included.

`eng/dotnet.mjs` accepts only explicitly supplied, existing project or solution
paths, resolved from the repository root. It also accepts absolute paths:

```sh
npm run dotnet -- restore src/services/example/Example.csproj
npm run dotnet -- build src/services/example/Example.csproj
npm run dotnet -- test src/services/example/Example.csproj
```

Restore must run first. Build uses Release and `--no-restore`; test uses Release,
`--no-restore`, and `--no-build`, requiring the earlier build. Multiple paths are
supported. SDK selection runs from the repository root, and every child failure
propagates to the caller.

Register real components with explicit Nx targets, for example this future
`src/services/example/project.json` (adjust paths and dependencies to match the
component):

```json
{
  "name": "example",
  "projectType": "application",
  "implicitDependencies": ["example-contracts"],
  "targets": {
    "restore": {
      "executor": "nx:run-commands",
      "cache": false,
      "options": {
        "command": "node eng/dotnet.mjs restore src/services/example/Example.slnx"
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "cache": false,
      "dependsOn": ["restore", "^build"],
      "options": {
        "command": "node eng/dotnet.mjs build src/services/example/Example.slnx"
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "cache": false,
      "dependsOn": ["build"],
      "options": {
        "command": "node eng/dotnet.mjs test src/services/example/Example.slnx"
      }
    }
  }
}
```

The example targets a solution containing both the application and its tests.
For separate test-project targets, restore and build the test project before testing.
`example-contracts` must name a real registered project. Explicitly model every
project reference and shared library dependency; a `dotnet` command alone does
not teach Nx the .NET project graph. Shared `Directory.Build.*`,
`Directory.Packages.props`, NuGet config, and SDK/tool configuration are global
inputs. Add other shared imports as needed. Keep **all .NET targets** at
`cache: false` (overriding root build/test defaults) until real components verify
restore behavior, generated files, runtime/configuration variants, and complete
outputs such as `bin` and `obj`. Then introduce caching deliberately.
