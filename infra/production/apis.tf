locals {
  # One entry per API. To host another API, add an entry (and an import block
  # only if it already exists in Google Cloud).
  #
  # `image` is used only when a service is first created. CI deploys every later
  # image and Terraform ignores it (see modules/cloud-run-api).
  apis = {
    "contact-api" = {
      image          = "${local.registry_host}/scppnl/contact-api:0.0.3"
      secret_id      = "contact-turnstile-secret-key"
      secret_env_var = "CONTACT_TURNSTILE_SECRET_KEY"
      cors_allowed_origins = [
        "https://scpp-association.de-wildert-penp.workers.dev",
        "https://scpp-foundation.de-wildert-penp.workers.dev",
        "https://scpp.nl",
        "https://blokhutdewildert.nl",
      ]
      turnstile_allowed_hostnames = [
        "scpp-association.de-wildert-penp.workers.dev",
        "scpp-foundation.de-wildert-penp.workers.dev",
        "scpp.nl",
        "blokhutdewildert.nl",
      ]
    }
    "booking-api" = {
      additional_env = {
        BookingEmail__From = "noreply@scpp.nl"
        BookingEmail__To   = "verhuur@scpp.nl"
      }
      additional_secrets = {
        BOOKING_GMAIL_OAUTH_JSON = google_secret_manager_secret.booking_gmail_oauth.secret_id
      }
      image          = "${local.registry_host}/scppnl/booking-api:0.0.3"
      secret_id      = "booking-turnstile-secret-key"
      secret_env_var = "BOOKING_TURNSTILE_SECRET_KEY"
      cors_allowed_origins = [
        "https://scpp-foundation.de-wildert-penp.workers.dev",
        "https://blokhutdewildert.nl",
      ]
      turnstile_allowed_hostnames = [
        "scpp-foundation.de-wildert-penp.workers.dev",
        "blokhutdewildert.nl",
      ]
    }
  }
}

module "apis" {
  source   = "../modules/cloud-run-api"
  for_each = local.apis

  project_id                     = local.project_id
  region                         = local.region
  name                           = each.key
  image                          = each.value.image
  secret_id                      = each.value.secret_id
  secret_env_var                 = each.value.secret_env_var
  cors_allowed_origins           = each.value.cors_allowed_origins
  turnstile_allowed_hostnames    = each.value.turnstile_allowed_hostnames
  deployer_service_account_email = module.github_deployer.service_account_email
  additional_env                 = try(each.value.additional_env, {})
  additional_secrets             = try(each.value.additional_secrets, {})

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.dockerhub,
  ]
}
