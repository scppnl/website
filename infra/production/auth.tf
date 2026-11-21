# Metadata only. Credential values are uploaded by an operator and never stored in
# Terraform state. Cloud Run needs an enabled version of each secret before the
# auth API service is attached to them (see the auth API README).
resource "google_secret_manager_secret" "auth_google_client_secret" {
  project   = local.project_id
  secret_id = "auth-google-client-secret"

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

resource "google_secret_manager_secret" "auth_session_keys" {
  project   = local.project_id
  secret_id = "auth-session-keys"

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
