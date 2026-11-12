# Keyless login for GitHub Actions (Workload Identity Federation) and the
# narrowly scoped account it deploys with. No keys or GitHub secrets exist.
module "github_deployer" {
  source = "../modules/github-deployer"

  project_id                 = local.project_id
  github_repository          = local.github_repository
  github_repository_id       = local.github_repository_id
  github_repository_owner_id = local.github_repository_owner_id

  depends_on = [google_project_service.apis]
}
