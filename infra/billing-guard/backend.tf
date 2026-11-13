# Same state bucket as infra/production (which owns the bucket), separate prefix, so an
# apply here can never touch the hosting resources and the other way round.
terraform {
  backend "gcs" {
    bucket = "websites-514515-tfstate"
    prefix = "billing-guard"
  }
}
