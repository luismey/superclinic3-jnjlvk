# Production environment Terraform configuration for Porfin WhatsApp automation platform
# Provider versions:
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

  # Production state configuration with GCS backend
  backend "gcs" {
    bucket = "porfin-terraform-state-prod"
    prefix = "terraform/state"
  }
}

# Local variables for production environment
locals {
  environment = "production"
  region     = "southamerica-east1"  # São Paulo region for Brazilian market
  project_id = "porfin-prod"
  common_labels = {
    project     = "porfin"
    environment = "production"
    managed_by  = "terraform"
  }
}

# Production networking configuration
module "networking" {
  source = "../../../modules/networking"

  project_id = local.project_id
  region     = local.region
  environment = local.environment
  
  network_specs = {
    vpc_name = "porfin-prod-vpc"
    subnet_cidr = "10.0.0.0/20"
    enable_cloud_nat = true
    enable_private_google_access = true
    enable_ssl_certificates = true
    enable_cloud_armor = true
  }
}

# Production compute resources configuration
module "compute" {
  source = "../../../modules/compute"

  project_id = local.project_id
  region     = local.region
  environment = local.environment

  # API server specifications based on requirements
  api_server_specs = {
    min_instances = 2
    max_instances = 20
    cpu = "2"
    memory = "4Gi"
    concurrency = 80
    timeout = "300s"
    auto_scaling_cpu_target = 0.7        # Scale at 70% CPU utilization
    auto_scaling_request_target = 100    # Scale at 100 requests per instance
  }

  # WhatsApp service specifications
  whatsapp_service_specs = {
    min_instances = 1
    max_instances = 10
    cpu = "1"
    memory = "2Gi"
    max_connections = 1000               # Max connections per instance
    auto_scaling_connection_target = 800 # Scale at 800 connections
  }
}

# Production database infrastructure
module "database" {
  source = "../../../modules/database"

  project_id = local.project_id
  region     = local.region
  environment = local.environment

  # Redis cache configuration for production
  redis_cache_specs = {
    memory_size_gb = 4
    tier = "standard"
    version = "redis_6_x"
    auth_enabled = true
    high_availability = true
    backup_schedule = "0 */4 * * *"  # Backup every 4 hours
  }

  # Firestore configuration for production
  firestore_specs = {
    location_id = "southamerica-east1"
    database_type = "FIRESTORE_NATIVE"
    concurrency_mode = "OPTIMISTIC"
    app_engine_integration_mode = "DISABLED"
  }
}

# Production monitoring and alerting configuration
module "monitoring" {
  source = "../../../modules/monitoring"

  project_id = local.project_id
  region     = local.region
  environment = local.environment

  monitoring_specs = {
    enable_alerting = true
    notification_channels = ["email", "slack"]
    retention_days = 30
    dashboard_enabled = true
    alert_policies = {
      latency_threshold = "200ms"          # API response time threshold
      error_rate_threshold = "1%"          # Maximum error rate
      cpu_utilization_threshold = "0.8"    # CPU utilization threshold
      memory_utilization_threshold = "0.85" # Memory utilization threshold
    }
  }
}

# Output values for production environment
output "vpc_id" {
  description = "Production VPC network identifier"
  value       = module.networking.vpc_id
}

output "service_urls" {
  description = "Production service endpoints"
  value = {
    api_url       = module.compute.api_url
    whatsapp_url  = module.compute.whatsapp_url
  }
}

output "database_endpoints" {
  description = "Production database endpoints"
  value = {
    firestore_id = module.database.firestore_id
    redis_host   = module.database.redis_host
  }
  sensitive = true
}