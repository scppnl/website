output "budget_name" {
  description = "Full name of the budget."
  value       = google_billing_budget.monthly.name
}

output "topic_id" {
  description = "Topic the budget publishes to."
  value       = google_pubsub_topic.budget_alerts.id
}

output "function_name" {
  description = "Function that unlinks billing."
  value       = google_cloudfunctions2_function.stop_billing.name
}
