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

run "booking_email_configuration" {
  command = plan

  variables {
    name = "booking-api"
    additional_env = {
      BookingEmail__From = "noreply@scpp.nl"
      BookingEmail__To   = "verhuur@scpp.nl"
    }
    additional_secrets = {
      BOOKING_GMAIL_OAUTH_JSON = "booking-gmail-oauth"
    }
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value
      if e.name == "BookingEmail__To"
    ]) == "verhuur@scpp.nl"
    error_message = "Booking notifications must use the configured rental mailbox."
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value_source[0].secret_key_ref[0].secret
      if e.name == "BOOKING_GMAIL_OAUTH_JSON"
    ]) == "booking-gmail-oauth"
    error_message = "OAuth credentials must be a Secret Manager reference."
  }

  assert {
    condition     = google_secret_manager_secret_iam_member.additional_runtime_reads["BOOKING_GMAIL_OAUTH_JSON"].role == "roles/secretmanager.secretAccessor"
    error_message = "The runtime requires secret accessor access to the email credential secret."
  }
}

run "contact_email_configuration" {
  command = plan

  override_resource {
    target          = google_service_account.runtime
    override_during = plan
    values = {
      email = "contact-api-runtime@test-project.iam.gserviceaccount.com"
      name  = "projects/test-project/serviceAccounts/contact-api-runtime@test-project.iam.gserviceaccount.com"
    }
  }

  variables {
    additional_env = {
      ContactEmail__From          = "noreply@scpp.nl"
      ContactEmail__FoundationTo  = "stichting@scpp.nl"
      ContactEmail__AssociationTo = "info@scpp.nl"
    }
    additional_secrets = {
      CONTACT_GMAIL_OAUTH_JSON = "contact-gmail-oauth"
    }
  }

  assert {
    condition = alltrue([
      for name, address in { ContactEmail__FoundationTo = "stichting@scpp.nl", ContactEmail__AssociationTo = "info@scpp.nl" } :
      one([for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value if e.name == name]) == address
    ])
    error_message = "Contact recipients must match the foundation and association mailboxes."
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value
      if e.name == "ContactEmail__From"
    ]) == "noreply@scpp.nl"
    error_message = "Contact email must use the configured sender mailbox."
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value_source[0].secret_key_ref[0].secret
      if e.name == "CONTACT_GMAIL_OAUTH_JSON"
      ]) == "contact-gmail-oauth" && one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value_source[0].secret_key_ref[0].version
      if e.name == "CONTACT_GMAIL_OAUTH_JSON"
    ]) == "latest"
    error_message = "Contact OAuth credentials must reference the latest contact secret version."
  }

  assert {
    condition = (
      length(google_secret_manager_secret_iam_member.additional_runtime_reads) == 1 &&
      google_secret_manager_secret_iam_member.additional_runtime_reads["CONTACT_GMAIL_OAUTH_JSON"].secret_id == "contact-gmail-oauth" &&
      google_secret_manager_secret_iam_member.additional_runtime_reads["CONTACT_GMAIL_OAUTH_JSON"].role == "roles/secretmanager.secretAccessor"
    )
    error_message = "Contact email requires secret accessor access only to its configured credential secret."
  }

  assert {
    condition     = google_secret_manager_secret_iam_member.additional_runtime_reads["CONTACT_GMAIL_OAUTH_JSON"].member == "serviceAccount:contact-api-runtime@test-project.iam.gserviceaccount.com"
    error_message = "The contact runtime account must receive the credential access grant."
  }
}

run "rejects_localhost_hostnames" {
  command = plan

  variables {
    turnstile_allowed_hostnames = ["localhost"]
  }

  expect_failures = [var.turnstile_allowed_hostnames]
}

run "auth_api_without_turnstile" {
  command = plan

  variables {
    name                        = "auth-api"
    image                       = "us-docker.pkg.dev/cloudrun/container/hello"
    secret_id                   = null
    secret_env_var              = null
    cors_allowed_origins        = ["https://blokhutdewildert.nl"]
    turnstile_allowed_hostnames = []
    additional_env = {
      Auth__Google__ClientId = "test-client.apps.googleusercontent.com"
      Auth__ApiOrigin        = "https://auth.blokhutdewildert.nl"
    }
    additional_secrets = {
      AUTH_GOOGLE_CLIENT_SECRET = "auth-google-client-secret"
      AUTH_SESSION_KEYS         = "auth-session-keys"
    }
  }

  assert {
    condition = toset([for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.name]) == toset([
      "AUTH_GOOGLE_CLIENT_SECRET",
      "AUTH_SESSION_KEYS",
      "Auth__Google__ClientId",
      "Auth__ApiOrigin",
      "Cors__AllowedOrigins__0",
    ])
    error_message = "An API without Turnstile renders no Turnstile secret or hostname variables."
  }

  assert {
    condition     = length(google_secret_manager_secret.turnstile) == 0 && length(google_secret_manager_secret_iam_member.runtime_reads) == 0
    error_message = "No Turnstile secret container or grant may be created."
  }

  assert {
    condition = alltrue([
      for key, member in google_secret_manager_secret_iam_member.additional_runtime_reads :
      member.role == "roles/secretmanager.secretAccessor"
    ]) && length(google_secret_manager_secret_iam_member.additional_runtime_reads) == 2
    error_message = "The runtime reads exactly the two auth secrets."
  }

  assert {
    condition = one([
      for e in google_cloud_run_v2_service.this.template[0].containers[0].env : e.value_source[0].secret_key_ref[0].secret
      if e.name == "AUTH_SESSION_KEYS"
    ]) == "auth-session-keys"
    error_message = "The session key ring must be a Secret Manager reference."
  }

  assert {
    condition     = output.secret_id == null
    error_message = "There is no Turnstile secret to report."
  }
}

run "rejects_turnstile_secret_without_hostnames" {
  command = plan

  variables {
    turnstile_allowed_hostnames = []
  }

  expect_failures = [var.turnstile_allowed_hostnames]
}

run "rejects_hostnames_without_turnstile_secret" {
  command = plan

  variables {
    secret_id                   = null
    secret_env_var              = null
    turnstile_allowed_hostnames = ["blokhutdewildert.nl"]
  }

  expect_failures = [var.turnstile_allowed_hostnames]
}

run "rejects_secret_without_environment_variable" {
  command = plan

  variables {
    secret_env_var = null
  }

  expect_failures = [var.secret_env_var]
}
