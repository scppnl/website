# APIs the guard needs. run.googleapis.com and artifactregistry.googleapis.com are also
# needed (by the function) but are owned by infra/production: two states must never own
# the same resource. They are never disabled on destroy.
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "eventarc.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = local.project_id
  service            = each.key
  disable_on_destroy = false
}
