# Infrastructure (Terraform)

Terraform for the Google Cloud hosting of the contact and booking APIs: Cloud Run
services, their runtime accounts and secrets, the Docker Hub image cache, and the
keyless GitHub Actions login. Frontends stay on Cloudflare and are not described
here. CI does not run Terraform: apply from a workstation.

| | |
| --- | --- |
| Project | `websites-514515` (number `979979719406`) |
| Region | `europe-west4` |
| State | Cloud Storage bucket `websites-514515-tfstate`, prefix `production` |

## Layout

```
infra/
├── modules/
│   ├── cloud-run-api/     one API: runtime account, secret + access, Cloud Run service,
│   │                      public access, deploy-account grants. Has offline tests.
│   └── github-deployer/   keyless GitHub login: identity pool, provider + condition,
│                          deploy account
└── production/            the only root module (owns the state)
    ├── project.tf         enabled APIs, state bucket
    ├── registry.tf        Docker Hub pull-through cache
    ├── github.tf          module "github_deployer"
    ├── apis.tf            the list of APIs (local.apis) and module "apis"
    ├── imports.tf         adopts the resources created by hand; delete after first apply
    ├── outputs.tf         API URLs and the two GitHub variable values
    └── locals.tf          project, region, repository IDs
```

A second environment would be a sibling folder of `production/` that reuses the same
modules. `infra/.gitignore` and `infra/.editorconfig` live here on purpose: the root
versions of those files are inputs of every Nx project, so changing them would select
both APIs for a rebuild and republish.

## What Terraform owns

| Terraform manages | Terraform does **not** manage |
| --- | --- |
| Enabled Google APIs | The Turnstile secret **values**: they would end up in plain text in the state file. Add them with `gcloud secrets versions add`. |
| Docker Hub cache repository | The running **image**: CI deploys it. Terraform ignores `image`, so applying never rolls an API back. |
| Runtime and deploy service accounts | The GitHub environment variables: copy them from the outputs. |
| Secret containers and who may read them | Frontends, Cloudflare, Docker Hub |
| Cloud Run services: environment variables, secret reference, runtime account, scaling, timeout, public access | Cloud Run revisions and traffic: CI creates them; roll back with `gcloud run services update-traffic`. |
| Identity pool, GitHub provider and its condition | |
| The state bucket | |

All IAM is additive (`*_iam_member`), so Terraform never removes access it does not
know about.

## First-time setup (adopting what already exists)

Nothing is recreated: `imports.tf` adopts the 26 resources created by hand, and the
APIs keep serving. Run from the repository root in PowerShell.

Install Terraform (1.7 or later):

```powershell
winget install Hashicorp.Terraform
```

Sign in for Terraform. It uses application default credentials, which are separate from
`gcloud auth login`:

```powershell
gcloud auth application-default login
```

```powershell
gcloud auth application-default set-quota-project websites-514515
```

Create the state bucket. This is the one thing Terraform cannot create for itself:

```powershell
gcloud storage buckets create gs://websites-514515-tfstate --project=websites-514515 --location=europe-west4 --uniform-bucket-level-access --public-access-prevention
```

Initialise:

```powershell
terraform -chdir=infra/production init
```

Preview:

```powershell
terraform -chdir=infra/production plan
```

**Do not apply until the plan is clean.** Expected: `26 to import, 0 to add, 0 to destroy`.
Only these in-place changes are fine:

- State bucket: versioning and a lifecycle rule are switched on.
- Cloud Run services: `deletion_protection` is set (a Terraform-only setting).

Anything that says `must be replaced`, `destroy`, or changes the environment variables,
secret reference, runtime account or provider condition means the code and the live
setup differ. Do not apply; compare the plan with `infra/production/apis.tf`
and `infra/modules/`, and fix the code (or, if the live setup is wrong, apply to fix it).

Apply:

```powershell
terraform -chdir=infra/production apply
```

Then:

1. Run the second `plan` and confirm `No changes`.
2. Delete `infra/production/imports.tf` and commit that.
3. Check both APIs still answer: `curl.exe -fsS https://contact-api-979979719406.europe-west4.run.app/`
   prints `Contact API`, and the same for `booking-api` prints `Booking API`.

The provider condition in `modules/github-deployer/main.tf` is the tightened version
(repository and owner IDs, `main`, the `production` environment, push or manual runs
only). If the live provider still has the original condition, the first plan shows
exactly that one change; applying it is the intended hardening.

## Everyday changes

Edit the code, then preview and apply:

```powershell
terraform -chdir=infra/production plan
```

```powershell
terraform -chdir=infra/production apply
```

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
- Terraform needs a person with Owner or equivalent rights on the project. The GitHub
  deploy account deliberately cannot change any of this.
