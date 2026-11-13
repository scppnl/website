# Offline checks of what the guard renders (no Google Cloud access needed):
#   terraform -chdir=infra/billing-guard init -backend=false
#   terraform -chdir=infra/billing-guard test

mock_provider "google" {}

# imports.tf adopts these (until it is deleted) and mock providers cannot import, so the
# imported resources are overridden. Harmless once imports.tf is gone.
override_resource {
  target = google_pubsub_topic.budget_alerts
}

override_resource {
  target = google_billing_budget.monthly
}

override_resource {
  target = google_service_account.budget_killer
}

override_resource {
  target = google_cloudfunctions2_function.stop_billing
}

override_resource {
  target = google_project_iam_member.budget_killer
}

variables {
  billing_account    = "AAAAAA-BBBBBB-CCCCCC"
  existing_budget_id = "00000000-0000-0000-0000-000000000000"
}

run "budget_is_20_euro_on_this_project" {
  command = plan

  assert {
    condition     = google_billing_budget.monthly.amount[0].specified_amount[0].units == "20"
    error_message = "The default budget must be 20."
  }

  assert {
    condition     = google_billing_budget.monthly.amount[0].specified_amount[0].currency_code == "EUR"
    error_message = "The budget must be in euros."
  }

  assert {
    condition     = google_billing_budget.monthly.budget_filter[0].projects == toset(["projects/979979719406"])
    error_message = "The budget must be limited to this project, by project number."
  }

  assert {
    condition     = google_billing_budget.monthly.budget_filter[0].calendar_period == "MONTH"
    error_message = "The budget must reset monthly."
  }

  assert {
    condition     = toset([for r in google_billing_budget.monthly.threshold_rules : r.threshold_percent]) == toset([0.5, 0.9, 1])
    error_message = "Expected notifications at 50%, 90% and 100%."
  }
}

run "budget_follows_the_variable" {
  command = plan

  variables {
    monthly_budget_eur = 40
  }

  assert {
    condition     = google_billing_budget.monthly.amount[0].specified_amount[0].units == "40"
    error_message = "monthly_budget_eur must set the budget."
  }
}

run "budget_notifies_the_topic_the_function_listens_to" {
  command = apply

  assert {
    condition     = google_billing_budget.monthly.all_updates_rule[0].pubsub_topic == google_pubsub_topic.budget_alerts.id
    error_message = "The budget must publish to the budget-alerts topic."
  }

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.event_trigger[0].pubsub_topic == google_pubsub_topic.budget_alerts.id
    error_message = "The function must listen to the budget-alerts topic."
  }

  assert {
    condition     = google_pubsub_topic.budget_alerts.name == "budget-alerts"
    error_message = "The topic name must stay budget-alerts."
  }
}

run "function_runs_as_the_budget_killer" {
  command = apply

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.service_config[0].service_account_email == google_service_account.budget_killer.email
    error_message = "The function must run as budget-killer."
  }

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.event_trigger[0].service_account_email == google_service_account.budget_killer.email
    error_message = "The trigger must run as budget-killer."
  }

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.service_config[0].environment_variables["PROJECT_ID"] == "websites-514515"
    error_message = "The function reads the project to unlink from PROJECT_ID."
  }

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.build_config[0].entry_point == "stop_billing"
    error_message = "The entry point must match main.py."
  }

  assert {
    condition     = google_cloudfunctions2_function.stop_billing.event_trigger[0].retry_policy == "RETRY_POLICY_DO_NOT_RETRY"
    error_message = "The function must not be retried."
  }

  assert {
    condition = toset([for m in google_project_iam_member.budget_killer : m.role]) == toset([
      "roles/billing.projectManager",
      "roles/run.invoker",
      "roles/eventarc.eventReceiver",
      "roles/serviceusage.serviceUsageConsumer",
    ])
    error_message = "budget-killer must have exactly these four project roles."
  }
}

run "budget_must_be_whole_euros" {
  command = plan

  variables {
    monthly_budget_eur = 12.5
  }

  expect_failures = [var.monthly_budget_eur]
}

run "budget_must_be_positive" {
  command = plan

  variables {
    monthly_budget_eur = 0
  }

  expect_failures = [var.monthly_budget_eur]
}

run "billing_account_must_look_like_one" {
  command = plan

  variables {
    billing_account = "not-an-account"
  }

  expect_failures = [var.billing_account]
}
