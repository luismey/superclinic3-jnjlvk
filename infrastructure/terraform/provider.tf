# Provider configuration for Porfin WhatsApp Automation Platform
# Version: 1.0.0
# Last Updated: 2024

terraform {
  # Terraform version constraint
  required_version = ">= 1.0.0"

  # Required providers with version constraints
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Main Google Cloud provider configuration
provider "google" {
  # Project and regional configuration
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"

  # Enhanced reliability settings
  request_timeout      = "60s"
  request_retries     = 3
  user_project_override = true

  # Default application credentials will be used for authentication
  # This supports both local development and CI/CD environments
}

# Google Beta provider for advanced features
provider "google-beta" {
  # Project and regional configuration
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"

  # Enhanced reliability settings - matching main provider
  request_timeout      = "60s"
  request_retries     = 3
  user_project_override = true

  # Used for beta features like Cloud Run and other preview features
  # Shares authentication configuration with main provider
}

# Provider configuration notes:
# - Uses São Paulo region (southamerica-east1) by default for Brazilian market focus
# - Implements retry mechanism for improved reliability (RTO 4 hours requirement)
# - Enables user_project_override for proper resource hierarchy management
# - Supports both production and staging environments through var.project_id
# - Configured for high availability with proper timeout settings