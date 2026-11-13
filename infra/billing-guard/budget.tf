resource "google_pubsub_topic" "budget_alerts" {
  project = local.project_id
  name    = local.topic_name

  depends_on = [google_project_service.apis]
}

# Lets the budget service publish its notifications on the topic. Additive, and harmless
# when Google already granted it.
resource "google_pubsub_topic_iam_member" "budget_publishes" {
  project = local.project_id
  topic   = google_pubsub_topic.budget_alerts.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:billing-budget-alert@system.gserviceaccount.com"
}

# Budgets only notify; the function behind the topic is what stops the spending.
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = local.budget_display_name

  budget_filter {
    projects        = ["projects/${local.project_number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "EUR"
      units         = tostring(var.monthly_budget_eur)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    pubsub_topic   = google_pubsub_topic.budget_alerts.id
    schema_version = "1.0"
  }

  depends_on = [google_project_service.apis]
}
