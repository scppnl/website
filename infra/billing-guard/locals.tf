locals {
  project_id     = "websites-514515"
  project_number = "979979719406" # budgets store the project NUMBER in their filter
  region         = "europe-west4"

  topic_name         = "budget-alerts"
  function_name      = "stop-billing"
  service_account_id = "budget-killer"
  source_bucket      = "${local.project_id}-billing-guard-src"

  # Created by hand with the "20eur" name; kept so the import is not followed by a rename.
  # The amount is var.monthly_budget_eur, whatever this label says.
  budget_display_name = "${local.project_id}-20eur-monthly"

  # Roles of the account that runs the function. billing.projectManager is what lets it
  # unlink the project from its billing account.
  killer_roles = toset([
    "roles/billing.projectManager",
    "roles/run.invoker",
    "roles/eventarc.eventReceiver",
    "roles/serviceusage.serviceUsageConsumer",
  ])
}
