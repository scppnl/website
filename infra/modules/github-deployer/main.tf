resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = var.account_id
  display_name = "GitHub Actions deployer (${var.github_repository})"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = var.pool_id
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = var.github_repository

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Google only accepts a GitHub token when ALL of these hold:
  #  - it comes from this exact repository and owner (by permanent ID),
  #  - the workflow runs on the deploy branch,
  #  - the job declares the protected GitHub environment,
  #  - the run was started by a push or a manual dispatch (never pull_request_target).
  attribute_condition = join(" && ", [
    "assertion.repository_id=='${var.github_repository_id}'",
    "assertion.repository_owner_id=='${var.github_repository_owner_id}'",
    "assertion.ref=='refs/heads/${var.github_branch}'",
    "assertion.environment=='${var.github_environment}'",
    "assertion.event_name in ['push', 'workflow_dispatch']",
  ])

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Workflows of the repository may act as the deploy account.
resource "google_service_account_iam_member" "github_impersonates_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
