output "service_account_email" {
  description = "Deploy account. Value of the GitHub variable GCP_SERVICE_ACCOUNT."
  value       = google_service_account.deployer.email
}

output "workload_identity_provider" {
  description = "Full provider name. Value of the GitHub variable GCP_WORKLOAD_IDENTITY_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}
