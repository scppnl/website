# Adopts the resources created by hand with gcloud so Terraform takes them over without
# recreating anything. The first `terraform plan` must show only these imports plus the
# new resources listed in README.md.
#
# After the first successful `terraform apply` this file has done its job and can be
# deleted (imported resources are then in the state). The variable below goes with it.
#
# Not imported on purpose: the APIs (enabling an enabled API changes nothing), the
# publisher binding on the topic, the source bucket and the zip (all new).

locals {
  project = local.project_id
  sa      = "${local.service_account_id}@${local.project_id}.iam.gserviceaccount.com"
}

variable "existing_budget_id" {
  description = "ID (last part of the name) of the budget created by hand. See README.md for the command that prints it."
  type        = string
}

import {
  to = google_pubsub_topic.budget_alerts
  id = "projects/${local.project}/topics/${local.topic_name}"
}

import {
  to = google_billing_budget.monthly
  id = "billingAccounts/${var.billing_account}/budgets/${var.existing_budget_id}"
}

import {
  to = google_service_account.budget_killer
  id = "projects/${local.project}/serviceAccounts/${local.sa}"
}

import {
  for_each = local.killer_roles

  to = google_project_iam_member.budget_killer[each.key]
  id = "${local.project} ${each.key} serviceAccount:${local.sa}"
}

import {
  to = google_cloudfunctions2_function.stop_billing
  id = "projects/${local.project}/locations/${local.region}/functions/${local.function_name}"
}
