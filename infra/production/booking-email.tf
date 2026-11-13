# Create the container before attaching it to Cloud Run. Its first secret version
# is uploaded by an operator; credentials must never enter Terraform state.
resource "google_secret_manager_secret" "booking_gmail_oauth" {
  project   = local.project_id
  secret_id = "booking-gmail-oauth"

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
