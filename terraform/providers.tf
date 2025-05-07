terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Or latest
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0" # Or latest
    }
  }
  # Optional: Configure Terraform backend (e.g., S3 for remote state)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket-name"
  #   key            = "storied-recipes/terraform.tfstate"
  #   region         = "your-aws-region"
  #   encrypt        = true
  #   dynamodb_table = "your-terraform-state-lock-table" # For state locking
  # }
}

provider "aws" {
  region = var.aws_region
  # Credentials configured via AWS CLI, environment variables, or instance profile
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
  # Or use CLOUDFLARE_API_TOKEN environment variable
}
