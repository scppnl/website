# Infrastructure (Terraform)

Terraform for the Google Cloud hosting of the contact and booking APIs: Cloud Run
services, their runtime accounts and secrets, the Docker Hub image cache, and the
keyless GitHub Actions login. Frontends stay on Cloudflare and are not described
here. GitHub Actions checks and plans pull requests, then applies changes on `main`
after approval in the `infrastructure` environment.

| | |
| --- | --- |
| Project | `websites-514515` (number `979979719406`) |
| Region | `europe-west4` |
| State | Cloud Storage bucket `websites-514515-tfstate`, prefix `production` |

## Layout

```
infra/
├── ci/                    change detection, tests and plan summaries for GitHub Actions
├── modules/
│   ├── cloud-run-api/     one API: runtime account, secret + access, Cloud Run service,
│   │                      public access, deploy-account grants. Has offline tests.
│   └── github-deployer/   keyless GitHub login: identity pool, provider + condition,
│                          deploy account
├── billing-guard/         separate root module: the monthly budget and the function that
│                          switches billing off. Own state; see its README.md
└── production/            root module for the hosting (owns the state bucket)
    ├── project.tf         enabled APIs, state bucket
    ├── registry.tf        Docker Hub pull-through cache
    ├── github.tf          module "github_deployer"
    ├── apis.tf            the list of APIs (local.apis) and module "apis"
    ├── outputs.tf         API URLs and the two GitHub variable values
    └── locals.tf          project, region, repository IDs
```

A second environment would be a sibling folder of `production/` that reuses the same
modules. `infra/.gitignore` and `infra/.editorconfig` live here on purpose: the root
versions of those files are inputs of every Nx project, so changing them would select
both APIs for a rebuild and republish.

`billing-guard/` is deliberately not part of `production/`. `production/` is
applied by CI; the budget guard needs rights on the billing account, which the CI
deploy account must never get, and a separate state means an apply in one root cannot
touch the other. Apply it from a workstation only. Its state uses prefix `billing-guard`
in the same bucket.

## What Terraform owns

| Terraform manages | Terraform does **not** manage |
| --- | --- |
| Enabled Google APIs | Secret **values**, including Turnstile keys and Gmail OAuth credentials: add them with `gcloud secrets versions add` so they stay outside Terraform state. |
| Docker Hub cache repository, and read access to it for the deploy account | The running **image**: CI deploys it. Terraform ignores `image`, so applying never rolls an API back. |
| Runtime and deploy service accounts | The GitHub environment variables: copy them from the outputs. |
| Secret containers and who may read them | Frontends, Cloudflare, Docker Hub |
| Cloud Run services: environment variables, secret reference, runtime account, scaling, timeout, public access | Cloud Run revisions and traffic: CI creates them; roll back with `gcloud run services update-traffic`. |
| Identity pool, GitHub provider and its condition | |
| The state bucket | |

All IAM is additive (`*_iam_member`), so Terraform never removes access it does not
know about.

## GitHub Actions flow

[The Terraform workflow](../.github/workflows/terraform.yml) runs when a pull request
into `main` or a push to `main` changes `infra/**` or the workflow itself. It can also
be started manually. CI pins Terraform to **1.17.2**.

1. Every matching run checks formatting, validates production with the backend
   disabled, and runs the module's mock-provider tests without cloud credentials.
2. For production-related changes, same-repository pull requests authenticate as
   `terraform-plan` and run a read-only plan against production. Find the plan in the job's run summary; long output is
   truncated there, with the full output in the step log. Fork pull requests still
   run all offline checks and receive a notice that the cloud plan is skipped.
3. After merging production-related changes, the apply job waits for the required
   reviewer in the **`infrastructure`** environment. **Check the PR's plan before approving**, including the commit being
   released. Approval allows the job to create a fresh production plan and apply it;
   there is no second approval between that plan and apply.
4. The approved job authenticates as `terraform-apply`, initializes the backend, and
   saves a fresh plan. If it reports no changes, the job says so and skips apply.
   Otherwise it summarizes the plan and applies that exact saved plan. A failed plan
   fails the job and never reaches apply.

Cloud jobs run only when the change touches `infra/production/**`, `infra/modules/**`,
`infra/ci/**`, or `.github/workflows/terraform.yml`. Matching workflow runs with changes
only outside these paths, including billing-only changes, run the existing offline
checks and display a skip notice; they do not request
cloud credentials or infrastructure approval. Mixed changes still plan and apply only
`infra/production`. PR comparison uses the merge base, and push comparison includes the
entire pushed commit range, including deletions and renames. If history cannot be
compared, checks fail rather than guessing. A manual run on `main` explicitly requests
the production flow even without a file diff; a manual run elsewhere skips cloud jobs.

Applies run only for pushes or manual runs on `main`. They share the
`terraform-production` concurrency group with cancellation disabled. Apply retains
normal state locking. PR plans use `-lock=false` because the read-only identity cannot
write a lock; they are previews and may become stale before merge. No PR plan files
are uploaded or reused for apply.

Authentication uses Workload Identity Federation, with no GitHub secrets:

| Job | Variables | Location |
| --- | --- | --- |
| PR plan | `TF_PLAN_WORKLOAD_IDENTITY_PROVIDER`, `TF_PLAN_SERVICE_ACCOUNT` | Repository |
| Apply | `TF_APPLY_WORKLOAD_IDENTITY_PROVIDER`, `TF_APPLY_SERVICE_ACCOUNT` | `infrastructure` environment |

The two Terraform identities have separate pools and are provisioned outside
Terraform. The existing `github` pool, `github-deployer` account, `production`
environment and `GCP_*` variables remain dedicated to API deployment. Do not use them
for Terraform. Only the plan and apply jobs can request OIDC tokens.

The initial local apply adopted the resources created by hand, and a follow-up plan
showed no changes. `production/imports.tf` was removed after that first apply; those
resources are already tracked in state. Do not repeat the adoption or recreate the
state bucket. The first CI plan should likewise show **No changes**.

Terraform-only changes are excluded from Nx application selection, including edits
to this workflow. The workflow is excluded both from `sharedGlobals` in `nx.json`
and from affected-project selection in `.nxignore`. Changing `nx.json` itself still
selects the applications; when changing shared CI inputs, check published API tags
before merging to avoid trying to overwrite an existing Docker Hub version.

## Local recovery

Use this path when CI cannot perform an authorized recovery. Install Terraform
**1.17.2**, check out the intended commit, and use an operator account with the
necessary resource and state-bucket permissions. Coordinate with pending or running
CI applies: GitHub concurrency does not serialize local commands. Keep state locking
enabled and do not use `-target`.

Run from the repository root in PowerShell. Application default credentials are
separate from `gcloud auth login`:

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project websites-514515
terraform -chdir=infra/production init -input=false -lockfile=readonly
terraform -chdir=infra/production plan -input=false -out=recovery.tfplan
terraform -chdir=infra/production show -no-color recovery.tfplan
```

Review the saved plan before applying. Investigate unexpected replacements,
destructions, IAM changes, or service configuration changes against the intended
code and live setup. Then apply that exact plan and confirm the resulting state:

```powershell
terraform -chdir=infra/production apply -input=false recovery.tfplan
terraform -chdir=infra/production plan -input=false
Remove-Item infra/production/recovery.tfplan
```

The follow-up plan should report no changes. Check that both APIs still answer at
`https://contact-api-979979719406.europe-west4.run.app/` (`Contact API`) and
`https://booking-api-979979719406.europe-west4.run.app/` (`Booking API`).

## Everyday changes

Edit the code, run the offline checks below, and open a pull request. Review its plan,
merge, and approve the `infrastructure` job to apply.

- **Add or remove a frontend origin or Turnstile hostname:** edit `cors_allowed_origins`
  and `turnstile_allowed_hostnames` for that API in `production/apis.tf`. Keep the two
  lists in step: a form needs both its origin and its hostname.
  Applying creates a new Cloud Run revision with the same image CI last deployed.
- **Rotate a Turnstile secret key:** add a new secret version (see
  `src/shared/contact-api/README.md`), then deploy or apply again, because `latest` is
  only read when a revision starts. Terraform is not involved.
- **Scaling or timeout:** the module's `min_instances`, `max_instances` and
  `timeout_seconds` inputs.
- **Add an API:** add an entry to `local.apis` in `production/apis.tf`, apply, add the
  secret value, and grant nothing by hand: the module creates the runtime account, the
  secret, public access and the deploy account's rights. Then deploy it from CI.
  Add `Dockerfile`/publish wiring as for the existing APIs.
- **GitHub environment variables:** `terraform -chdir=infra/production output` prints the
  values for `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`.

## Checks

Formatting and offline checks need no Google Cloud access:

```powershell
terraform fmt -check -recursive infra
```

```powershell
terraform -chdir=infra/production init -backend=false
```

```powershell
terraform -chdir=infra/production validate
```

The module has tests that run against a mock provider (environment variable rendering,
runtime account naming, validation of CORS origins and hostnames):

```powershell
terraform -chdir=infra/modules/cloud-run-api init -backend=false
```

```powershell
terraform -chdir=infra/modules/cloud-run-api test
```

`production/.terraform.lock.hcl` pins the Google provider and is committed, with checksums
for Windows, Linux and macOS (arm64). Upgrade it with
`terraform -chdir=infra/production init -upgrade`, then re-run
`terraform -chdir=infra/production providers lock -platform=windows_amd64 -platform=linux_amd64 -platform=darwin_arm64`.

## Safety

- Both Cloud Run services have deletion protection, and the secrets and the state bucket
  have `prevent_destroy`. Removing them takes a deliberate edit of the code.
- The state bucket is private, versioned, and keeps the last 20 noncurrent versions.
  If the state is damaged, restore an earlier version of
  `gs://websites-514515-tfstate/production/default.tfstate`.
- Never commit `*.tfstate` or `*.tfvars`; `infra/.gitignore` excludes them.
- Terraform CI uses its dedicated plan/apply identities with the preconfigured
  permissions. The API deploy account is not a Terraform identity. If a required
  permission is missing, stop and report it; do not widen access from the pipeline.
