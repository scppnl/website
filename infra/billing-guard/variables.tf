variable "billing_account" {
  description = "ID of the billing account the project is linked to. Not committed (public repository): set TF_VAR_billing_account."
  type        = string

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account))
    error_message = "The billing account ID looks like 012345-6789AB-CDEF01 (three groups of six, upper case)."
  }
}

variable "monthly_budget_eur" {
  description = "Monthly budget in whole euros. Billing is switched off when the cost reaches it."
  type        = number
  default     = 20

  validation {
    condition     = var.monthly_budget_eur >= 1 && var.monthly_budget_eur <= 10000 && var.monthly_budget_eur == floor(var.monthly_budget_eur)
    error_message = "The monthly budget must be a whole number of euros between 1 and 10000."
  }
}
