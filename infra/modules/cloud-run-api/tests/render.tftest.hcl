# Offline check of what the module renders (no Google Cloud access needed):
#   terraform -chdir=infra/modules/cloud-run-api init -backend=false
#   terraform -chdir=infra/modules/cloud-run-api test

mock_provider "google" {}

variables {
  project_id                     = "test-project"
  region                         = "europe-west4"
  name                           = "contact-api"
  image                          = "europe-west4-docker.pkg.dev/test-project/dockerhub/scppnl/contact-api:0.0.3"
  secret_id                      = "contact-turnstile-secret-key"
  secret_env_var                 = "CONTACT_TURNSTILE_SECRET_KEY"
  cors_allowed_origins           = ["https://scpp.nl", "https://blokhutdewildert.nl"]
  turnstile_allowed_hostnames    = ["scpp.nl", "blokhutdewildert.nl"]
  deployer_service_account_email = "github-deployer@test-project.iam.gserviceaccount.com"
}

run "renders_environment_and_identity" {
  command = plan

  # `env` is an unordered set in the provider, so compare names as a set.
  assert {
    condition = toset([for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.name]) == toset([
      "CONTACT_TURNSTILE_SECRET_KEY",
      "Cors__AllowedOrigins__0",
      "Cors__AllowedOrigins__1",
      "Turnstile__AllowedHostnames__0",
      "Turnstile__AllowedHostnames__1",
    ])
    error_message = "Expected the secret reference plus numbered Cors__* and Turnstile__* variables."
  }

  assert {
    condition = alltrue([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env :
      e.value == lookup({
        Cors__AllowedOrigins__0        = "https://scpp.nl"
        Cors__AllowedOrigins__1        = "https://blokhutdewildert.nl"
        Turnstile__AllowedHostnames__0 = "scpp.nl"
        Turnstile__AllowedHostnames__1 = "blokhutdewildert.nl"
      }, e.name, e.value)
    ])
    error_message = "List entries must keep their order when numbered."
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value_source[0].secret_key_ref[0].secret
      if e.name == "CONTACT_TURNSTILE_SECRET_KEY"
    ]) == "contact-turnstile-secret-key"
    error_message = "The secret variable must reference the Secret Manager secret."
  }

  assert {
    condition     = google_service_account.runtime.account_id == "contact-api-runtime"
    error_message = "Runtime account must be <name>-runtime."
  }

  assert {
    condition     = google_service_account.runtime.display_name == "Contact API (Cloud Run runtime)"
    error_message = "Display name must match the account created with gcloud."
  }

  assert {
    condition     = google_cloud_run_v2_service.this.template[0].timeout == "30s" && google_cloud_run_v2_service.this.deletion_protection
    error_message = "Timeout is 30s and deletion protection is on."
  }
}

run "rejects_wildcard_origins" {
  command = plan

  variables {
    cors_allowed_origins = ["*"]
  }

  expect_failures = [var.cors_allowed_origins]
}

run "rejects_localhost_hostnames" {
  command = plan

  variables {
    turnstile_allowed_hostnames = ["localhost"]
  }

  expect_failures = [var.turnstile_allowed_hostnames]
}
