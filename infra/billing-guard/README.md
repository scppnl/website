# Billing guard (Terraform)

A monthly budget for project `websites-514515` and a function that **switches billing off**
when the cost reaches it. Google Cloud budgets only send notifications; this is what turns
one into a cap.

```
budget (EUR, monthly, this project)
  -> Pub/Sub topic budget-alerts
    -> Cloud Function stop-billing (Python, runs as budget-killer)
       cost < budget: logs "nothing to do"
       cost >= budget: unlinks the project from its billing account
```

| | |
| --- | --- |
| Project | `websites-514515` (number `979979719406`) |
| Region | `europe-west4` |
| State | Cloud Storage bucket `websites-514515-tfstate`, prefix `billing-guard` |
| Budget | `monthly_budget_eur`, default **20** (euros, whole numbers) |

This is a separate root module from `infra/production` on purpose: that one is meant to be
applied by CI, and this one needs rights on the billing account, which CI must never get.
Apply it from a workstation only.

## Limits you should know about

- **The cap is not exact.** Cost data reaches the budget hours late, sometimes up to a day.
  Spending can pass the budget before the function runs.
- **Unlinking billing stops every paid service in the project**, Cloud Run included. Some
  resources (VMs, storage) can be deleted if billing stays off for long.
- **Never publish a test message with `costAmount` at or above `budgetAmount`** to the
  topic: the function then really switches billing off.

## Layout

```
infra/billing-guard/
├── budget.tf                Pub/Sub topic, budget, publish right for the budget service
├── function.tf              budget-killer account + roles, source bucket, the function
├── project.tf               enabled APIs
├── variables.tf             billing_account, monthly_budget_eur
├── imports.tf               adopts the resources created by hand; delete after first apply
├── function/                main.py and requirements.txt (what runs in the cloud)
├── tests/                   offline tests (mock provider)
└── Enable-ProjectBilling.ps1  links billing again after the guard fired
```

`function.tf` must never contain `google_project` or anything else that links the project to a
billing account: the next apply would switch billing on again after the guard switched it off.

## What Terraform owns

| Terraform manages | Terraform does **not** manage |
| --- | --- |
| The budget, including its amount | The link between the project and its billing account. `Enable-ProjectBilling.ps1` does that. |
| The `budget-alerts` topic and the budget service's right to publish on it | The Cloud Run services (`infra/production`; `run` and `artifactregistry` APIs are enabled there) |
| The `budget-killer` account and its four project roles | The state bucket (`infra/production`) |
| The function and its source bucket | |
| The APIs listed in `project.tf` | |

## Rights you need

- **Owner** on the project, and
- **Billing Account Administrator** or **Billing Account Costs Manager** on the billing account
  (to create and change the budget).

## First-time setup (adopting what already exists)

Nothing is recreated. Run from the repository root in PowerShell.

Sign in for Terraform (application default credentials, separate from `gcloud auth login`):

```powershell
gcloud auth application-default login
```

```powershell
gcloud auth application-default set-quota-project websites-514515
```

The billing account ID is not committed because the repository is public. Find yours and set it
for this PowerShell window:

```powershell
gcloud billing accounts list
```

```powershell
$env:TF_VAR_billing_account = "012345-6789AB-CDEF01"
```

`imports.tf` also needs the ID of the budget that was created by hand:

```powershell
$env:TF_VAR_existing_budget_id = (gcloud billing budgets list --billing-account=$env:TF_VAR_billing_account --filter="displayName=websites-514515-20eur-monthly" --format="value(name)").Split('/')[-1]
```

Initialise and preview:

```powershell
terraform -chdir=infra/billing-guard init
```

```powershell
terraform -chdir=infra/billing-guard plan
```

**Do not apply until the plan looks like this:**

- **8 to import**: the topic, the budget, the `budget-killer` account, its 4 role bindings, the function.
- **To add**: the 8 APIs (enabling an enabled API changes nothing), the publish right on the topic,
  the source bucket and the zip in it.
- **In-place changes** are fine on the function (the source now comes from the Terraform
  bucket, `max_instance_count` is set to 1) and may show on the budget. Read them.
- **0 to destroy.** Anything that says `must be replaced` or `destroy` means the code and the live
  setup differ. Do not apply; compare the plan with `budget.tf` and `function.tf`.

Apply:

```powershell
terraform -chdir=infra/billing-guard apply
```

Then:

1. Run `plan` again and confirm `No changes`.
2. Delete `infra/billing-guard/imports.tf` and commit that.
3. Check the function is active and billing is still on:

```powershell
gcloud functions describe stop-billing --region=europe-west4 --gen2 --format="value(state)"
```

```powershell
gcloud billing projects describe websites-514515 --format="value(billingEnabled)"
```

   These should print `ACTIVE` and `True`.

## Everyday use

**Raise the budget for one month** (the next plain apply puts it back to 20):

```powershell
terraform -chdir=infra/billing-guard apply -var=monthly_budget_eur=40
```

**Change the normal budget:** edit the default of `monthly_budget_eur` in `variables.tf`.

**The guard fired and billing is off.** If this month's spend is still at or above the budget,
the guard switches billing off again within hours of linking it. So either wait for the 1st of
the month, or raise the budget first (the command above), and then link billing again:

```powershell
.\infra\billing-guard\Enable-ProjectBilling.ps1
```

The script reads the billing account from `$env:TF_VAR_billing_account` (or `-BillingAccount`).
Cloud Run services come back on their own within minutes. Anything that was shut down, such as
a VM, stays off until you start it.

**Change the function:** edit `function/main.py` and apply. The zip is named after its hash, so a
change uploads a new object and deploys it.

**Safe end-to-end test.** This message is below the budget, so nothing is switched off:

```powershell
gcloud pubsub topics publish budget-alerts --message='{\"costAmount\": 1, \"budgetAmount\": 20, \"currencyCode\": \"EUR\"}'
```

(The `\"` escapes are for Windows PowerShell 5.1. In PowerShell 7.3 and later, remove the backslashes.)
After about a minute:

```powershell
gcloud functions logs read stop-billing --region=europe-west4 --gen2 --limit=20
```

Look for `Cost 1 < budget 20; nothing to do.` Google also publishes real budget updates several
times a day, so this line appears by itself.

## Checks

Formatting and offline checks need no Google Cloud access:

```powershell
terraform fmt -check -recursive infra
```

```powershell
terraform -chdir=infra/billing-guard init -backend=false
```

```powershell
terraform -chdir=infra/billing-guard validate
```

```powershell
terraform -chdir=infra/billing-guard test
```

The tests (mock provider) check the amount and currency, that the budget is limited to this
project, that the budget and the function use the same topic, the function's settings and the
four roles, and that bad values for the variables are rejected. They cannot check that the
function really works in the cloud; use the end-to-end test above for that.

`.terraform.lock.hcl` pins the providers. The Google provider has checksums for Windows, Linux and
macOS (arm64). The archive provider was locked on Linux only; on your workstation run this once and
commit the result:

```powershell
terraform -chdir=infra/billing-guard providers lock -platform=windows_amd64 -platform=linux_amd64 -platform=darwin_arm64
```

## Safety

- Never commit `*.tfstate` or `*.tfvars`; `infra/.gitignore` excludes them. The billing account ID
  belongs in `TF_VAR_billing_account`, not in a file.
- `monthly_budget_eur` accepts whole euros from 1 to 10000, so a typo such as `0` or `20000` is rejected.
- Apply from a workstation, never from CI and never on pull requests: this repository is public.
