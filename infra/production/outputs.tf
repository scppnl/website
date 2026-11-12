output "api_urls" {
  description = "run.app URL of each API. Use these (without /contact or /bookings) as the frontend API base URLs."
  value       = { for name, api in module.apis : name => api.uri }
}

output "github_variable_gcp_workload_identity_provider" {
  description = "Value of the GitHub environment variable GCP_WORKLOAD_IDENTITY_PROVIDER (environment: production)."
  value       = module.github_deployer.workload_identity_provider
}

output "github_variable_gcp_service_account" {
  description = "Value of the GitHub environment variable GCP_SERVICE_ACCOUNT (environment: production)."
  value       = module.github_deployer.service_account_email
}

output "turnstile_secrets" {
  description = "Secrets whose values must be added by hand (gcloud secrets versions add ...)."
  value       = { for name, api in module.apis : name => api.secret_id }
}
