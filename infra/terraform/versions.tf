terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.60" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Remote state — uncomment and point at an EU bucket before the first real apply.
  # backend "s3" {
  #   bucket         = "mgi-delta-tfstate-eu"
  #   key            = "prod/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "mgi-delta-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project    = var.project
      Env        = var.environment
      ManagedBy  = "terraform"
      DataResidency = "EU"
    }
  }
}

# EU residency (CLAUDE.md §2.7 / §3) is enforced by a validation block on var.aws_region
# in variables.tf — a non-EU region fails at plan time.

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
