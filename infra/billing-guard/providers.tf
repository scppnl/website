# The Billing Budgets API rejects user credentials (application default login) that have
# no quota project. user_project_override sends this project as the quota project.
provider "google" {
  project               = local.project_id
  region                = local.region
  user_project_override = true
  billing_project       = local.project_id
}
