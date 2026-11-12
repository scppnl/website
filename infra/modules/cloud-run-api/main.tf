locals {
  # The API reads its settings from environment variables; list entries become
  # <Section>__<Key>__<index>, matching the ASP.NET Core configuration binder.
  config_env = merge(
    { for i, origin in var.cors_allowed_origins : "Cors__AllowedOrigins__${i}" => origin },
    { for i, host in var.turnstile_allowed_hostnames : "Turnstile__AllowedHostnames__${i}" => host },
  )

  deployer_member = "serviceAccount:${var.deployer_service_account_email}"
}

# --- Runtime identity ---------------------------------------------------------

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "${var.name}-runtime"
  display_name = "${title(replace(replace(var.name, "-api", ""), "-", " "))} API (Cloud Run runtime)"
}

# --- Turnstile secret (container and access only; the value is added by hand) --

resource "google_secret_manager_secret" "turnstile" {
  project   = var.project_id
  secret_id = var.secret_id

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret_iam_member" "runtime_reads" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.turnstile.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# --- The service ---------------------------------------------------------------

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  name                = var.name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  template {
    service_account = google_service_account.runtime.email
    timeout         = "${var.timeout_seconds}s"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name = var.secret_env_var

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.turnstile.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = local.config_env

        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime_reads]

  lifecycle {
    # CI deploys new images (and may add labels); Terraform owns everything else.
    ignore_changes = [
      template[0].containers[0].image,
      template[0].labels,
      labels,
      client,
      client_version,
    ]
  }
}

# --- Access to the service -------------------------------------------------------

# Browsers call the API directly. Callers are checked by Turnstile and CORS.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# GitHub Actions may deploy new revisions of this service only.
resource "google_cloud_run_v2_service_iam_member" "deployer" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.developer"
  member   = local.deployer_member
}

# ...and may run those revisions as the runtime account.
resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = local.deployer_member
}
