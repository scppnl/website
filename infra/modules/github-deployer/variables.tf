variable "project_id" {
  description = "Google Cloud project that hosts the identity pool and the deploy account."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy, as owner/name."
  type        = string
}

variable "github_repository_id" {
  description = "Permanent numeric ID of the repository. Survives renames and prevents a re-registered name from being accepted."
  type        = string
}

variable "github_repository_owner_id" {
  description = "Permanent numeric ID of the repository owner."
  type        = string
}

variable "github_environment" {
  description = "GitHub environment the deploy job must declare. Puts that environment's protection rules in front of every deploy."
  type        = string
  default     = "production"
}

variable "github_branch" {
  description = "Branch whose workflow runs may deploy."
  type        = string
  default     = "main"
}

variable "pool_id" {
  description = "Workload Identity pool ID."
  type        = string
  default     = "github"
}

variable "provider_id" {
  description = "Workload Identity provider ID."
  type        = string
  default     = "scppnl-website"
}

variable "account_id" {
  description = "ID of the service account GitHub Actions deploys with."
  type        = string
  default     = "github-deployer"
}
