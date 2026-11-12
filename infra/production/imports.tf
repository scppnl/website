# Adopts the resources created by hand with gcloud so Terraform takes them over
# without recreating anything. The first `terraform plan` must show only imports.
#
# After the first successful `terraform apply` this file has done its job and can
# be deleted (imported resources are then in the state).

locals {
  project = local.project_id
}

# --- Project -------------------------------------------------------------------

import {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  to = google_project_service.apis[each.key]
  id = "${local.project}/${each.key}"
}

import {
  to = google_storage_bucket.tfstate
  id = "${local.project}/${local.state_bucket}"
}

import {
  to = google_artifact_registry_repository.dockerhub
  id = "projects/${local.project}/locations/${local.region}/repositories/${local.registry_id}"
}

# --- GitHub Actions login --------------------------------------------------------

import {
  to = module.github_deployer.google_service_account.deployer
  id = "projects/${local.project}/serviceAccounts/github-deployer@${local.project}.iam.gserviceaccount.com"
}

import {
  to = module.github_deployer.google_iam_workload_identity_pool.github
  id = "projects/${local.project}/locations/global/workloadIdentityPools/github"
}

import {
  to = module.github_deployer.google_iam_workload_identity_pool_provider.github
  id = "projects/${local.project}/locations/global/workloadIdentityPools/github/providers/scppnl-website"
}

import {
  to = module.github_deployer.google_service_account_iam_member.github_impersonates_deployer
  id = "projects/${local.project}/serviceAccounts/github-deployer@${local.project}.iam.gserviceaccount.com roles/iam.workloadIdentityUser principalSet://iam.googleapis.com/projects/${local.project_number}/locations/global/workloadIdentityPools/github/attribute.repository/${local.github_repository}"
}

# --- The APIs (one set per entry in local.apis) ----------------------------------

import {
  for_each = local.apis

  to = module.apis[each.key].google_service_account.runtime
  id = "projects/${local.project}/serviceAccounts/${each.key}-runtime@${local.project}.iam.gserviceaccount.com"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_secret_manager_secret.turnstile
  id = "projects/${local.project}/secrets/${each.value.secret_id}"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_secret_manager_secret_iam_member.runtime_reads
  id = "projects/${local.project}/secrets/${each.value.secret_id} roles/secretmanager.secretAccessor serviceAccount:${each.key}-runtime@${local.project}.iam.gserviceaccount.com"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_cloud_run_v2_service.this
  id = "projects/${local.project}/locations/${local.region}/services/${each.key}"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_cloud_run_v2_service_iam_member.public
  id = "projects/${local.project}/locations/${local.region}/services/${each.key} roles/run.invoker allUsers"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_cloud_run_v2_service_iam_member.deployer
  id = "projects/${local.project}/locations/${local.region}/services/${each.key} roles/run.developer serviceAccount:github-deployer@${local.project}.iam.gserviceaccount.com"
}

import {
  for_each = local.apis

  to = module.apis[each.key].google_service_account_iam_member.deployer_acts_as_runtime
  id = "projects/${local.project}/serviceAccounts/${each.key}-runtime@${local.project}.iam.gserviceaccount.com roles/iam.serviceAccountUser serviceAccount:github-deployer@${local.project}.iam.gserviceaccount.com"
}
