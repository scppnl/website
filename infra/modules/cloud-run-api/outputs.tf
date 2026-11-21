output "name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.this.name
}

output "uri" {
  description = "Deterministic run.app URL of the service."
  value       = google_cloud_run_v2_service.this.uri
}

output "runtime_service_account_email" {
  description = "Account the service runs as."
  value       = google_service_account.runtime.email
}

output "secret_id" {
  description = "Secret that must hold the Turnstile secret key (value added by hand). Null for an API without Turnstile."
  value       = one(google_secret_manager_secret.turnstile[*].secret_id)
}
