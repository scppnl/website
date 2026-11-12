variable "project_id" {
  description = "Google Cloud project that hosts the service."
  type        = string
}

variable "region" {
  description = "Region of the Cloud Run service and the secret replica."
  type        = string
}

variable "name" {
  description = "Cloud Run service name. Also the prefix of the runtime service account: <name>-runtime."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,40}$", var.name))
    error_message = "name must be lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "image" {
  description = "Image used only when the service is first created. CI owns the image afterwards (see lifecycle.ignore_changes)."
  type        = string
}

variable "secret_id" {
  description = "Secret Manager secret that holds the Turnstile secret key. The value is added by hand and is never managed by Terraform."
  type        = string
}

variable "secret_env_var" {
  description = "Environment variable the API reads the Turnstile secret key from."
  type        = string
}

variable "cors_allowed_origins" {
  description = "Frontend origins allowed by CORS. Rendered as Cors__AllowedOrigins__N."
  type        = list(string)

  validation {
    condition     = length(var.cors_allowed_origins) > 0 && alltrue([for o in var.cors_allowed_origins : can(regex("^https://[^*/]+$", o))])
    error_message = "cors_allowed_origins must be a non-empty list of explicit https:// origins without wildcards or paths."
  }
}

variable "turnstile_allowed_hostnames" {
  description = "Hostnames the Turnstile widget may be served from. Rendered as Turnstile__AllowedHostnames__N."
  type        = list(string)

  validation {
    condition     = length(var.turnstile_allowed_hostnames) > 0 && alltrue([for h in var.turnstile_allowed_hostnames : !strcontains(h, "*") && h != "localhost"])
    error_message = "turnstile_allowed_hostnames must be a non-empty list of exact production hostnames (no wildcards, no localhost)."
  }
}

variable "deployer_service_account_email" {
  description = "Account GitHub Actions deploys with. It may deploy this service and run it as the runtime account."
  type        = string
}

variable "min_instances" {
  description = "Minimum number of instances."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances."
  type        = number
  default     = 3
}

variable "timeout_seconds" {
  description = "Request timeout in seconds."
  type        = number
  default     = 30
}
