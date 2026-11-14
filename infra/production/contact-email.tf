# Metadata only. Credential versions are uploaded by an operator and never stored
# in Terraform state.
resource "google_secret_manager_secret" "contact_gmail_oauth" {
  project   = local.project_id
  secret_id = "contact-gmail-oauth"

  replication {
    user_managed {
      replicas {
        location = local.region
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.apis]
}
