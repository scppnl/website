# NEVER add google_project, google_billing_project_info or anything else that links the
# project to a billing account to this root: the next apply would quietly switch billing
# on again after the guard has switched it off. Re-link with Enable-ProjectBilling.ps1.

resource "google_service_account" "budget_killer" {
  project      = local.project_id
  account_id   = local.service_account_id
  display_name = "Disables billing when budget is exceeded"
}

resource "google_project_iam_member" "budget_killer" {
  for_each = local.killer_roles

  project = local.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.budget_killer.email}"
}

# Where the zipped function code is uploaded for the build.
resource "google_storage_bucket" "source" {
  project                     = local.project_id
  name                        = local.source_bucket
  location                    = upper(local.region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true
}

data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/function"
  output_path = "${path.module}/.terraform/stop-billing.zip"
}

# Named after the hash of the zip, so changing the code uploads a new object and redeploys.
resource "google_storage_bucket_object" "source" {
  name   = "stop-billing-${data.archive_file.source.output_md5}.zip"
  bucket = google_storage_bucket.source.name
  source = data.archive_file.source.output_path
}

resource "google_cloudfunctions2_function" "stop_billing" {
  project  = local.project_id
  name     = local.function_name
  location = local.region

  build_config {
    runtime     = "python312"
    entry_point = "stop_billing"

    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source.name
      }
    }
  }

  service_config {
    available_memory      = "256M"
    timeout_seconds       = 60
    max_instance_count    = 1
    service_account_email = google_service_account.budget_killer.email

    environment_variables = {
      PROJECT_ID = local.project_id
    }
  }

  event_trigger {
    trigger_region        = local.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.budget_alerts.id
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
    service_account_email = google_service_account.budget_killer.email
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.budget_killer,
  ]
}
