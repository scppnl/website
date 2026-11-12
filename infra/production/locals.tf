locals {
  project_id     = "websites-514515"
  project_number = "979979719406" # a constant, so no extra API is needed to look it up
  region         = "europe-west4"

  # Repository allowed to deploy. The numeric IDs are permanent; the name is not.
  github_repository          = "scppnl/website"
  github_repository_id       = "1448456359"
  github_repository_owner_id = "353418638"

  # Docker Hub pull-through cache; Cloud Run pulls images through it.
  registry_id   = "dockerhub"
  registry_host = "${local.region}-docker.pkg.dev/${local.project_id}/${local.registry_id}"

  state_bucket = "websites-514515-tfstate"
}
