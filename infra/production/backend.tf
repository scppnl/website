# State lives in a versioned Cloud Storage bucket. The bucket must exist before
# `terraform init`; create it with the command in infra/README.md. It is then
# imported and managed in project.tf like everything else.
terraform {
  backend "gcs" {
    bucket = "websites-514515-tfstate"
    prefix = "production"
  }
}
