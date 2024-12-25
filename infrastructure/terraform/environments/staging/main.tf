# Terraform configuration for Porfin staging environment
# hashicorp/google v4.0
# hashicorp/google-beta v4.0

terraform {
  required_version = ">= 1.0.0"
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

  # Staging-specific state configuration
  backend "gcs" {
    bucket = "porfin-staging-tfstate"
    prefix = "terraform/state"
  }
}

# Local variables for staging environment
locals {
  project_name = "porfin"
  environment  = "staging"
  region       = "southamerica-east1"
  common_labels = {
    project     = "porfin"
    environment = "staging"
    managed_by  = "terraform"
  }
}

# Root module configuration for staging environment
module "root" {
  source = "../../"

  project_id  = "porfin-staging"
  region      = "southamerica-east1"
  environment = "staging"

  # API Server specifications for staging
  api_server_specs = {
    min_instances            = 2
    max_instances            = 10
    cpu                     = "2"
    memory                  = "4GB"
    scaling_cpu_threshold   = 70
    scaling_request_threshold = 100
    cooldown_period         = 90
  }

  # WhatsApp service specifications for staging
  whatsapp_service_specs = {
    min_instances           = 1
    max_instances           = 10
    cpu                    = "1"
    memory                 = "2GB"
    connections_per_instance = 1000
    scaling_cpu_threshold  = 75
    cooldown_period        = 120
  }

  # Network specifications for staging VPC
  network_specs = {
    network_name                = "porfin-staging-vpc"
    subnet_cidr                = "10.10.0.0/20"
    region                     = "southamerica-east1"
    enable_private_google_access = true
  }

  # Redis cache specifications for staging
  redis_cache_specs = {
    memory_size_gb = 4
    cluster_mode   = false
    version        = "6.x"
    tier           = "basic"
  }

  # Monitoring specifications for staging environment
  monitoring_specs = {
    metrics_collection_interval = 60
    log_retention_days         = 30
    alert_notification_channel = "email"
    enable_detailed_monitoring = true
  }
}

# Output configurations for staging environment
output "vpc_id" {
  description = "The ID of the VPC created for staging environment"
  value       = module.root.vpc_id
}

output "service_urls" {
  description = "URLs of the deployed Cloud Run services in staging"
  value       = module.root.service_urls
}

output "database_endpoints" {
  description = "Database connection endpoints for staging environment"
  value = {
    firestore_id = module.root.database_endpoints.firestore_id
    redis_host   = module.root.database_endpoints.redis_host
  }
  sensitive = true
}