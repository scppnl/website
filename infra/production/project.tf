# APIs the hosting depends on. They are never disabled on destroy.
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  project            = local.project_id
  service            = each.key
  disable_on_destroy = false
}

# Terraform state. Not enabled above: Cloud Storage is on by default in every project.
resource "google_storage_bucket" "tfstate" {
  project                     = local.project_id
  name                        = local.state_bucket
  location                    = upper(local.region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Keep recent history for recovery without growing forever.
  lifecycle_rule {
    condition {
      num_newer_versions = 20
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
