# Pull-through cache for the public Docker Hub images (scppnl/contact-api,
# scppnl/booking-api). Avoids Docker Hub rate limits and outages during deploys.
resource "google_artifact_registry_repository" "dockerhub" {
  project       = local.project_id
  location      = local.region
  repository_id = local.registry_id
  format        = "DOCKER"
  mode          = "REMOTE_REPOSITORY"
  description   = "Docker Hub pull-through cache for scppnl API images"

  remote_repository_config {
    docker_repository {
      public_repository = "DOCKER_HUB"
    }
  }

  depends_on = [google_project_service.apis]
}
