# Provider configuration with enhanced security and compliance settings
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

  backend "gcs" {
    bucket          = var.state_bucket
    prefix          = "terraform/state"
    encryption_key  = var.state_encryption_key
  }
}

# Local variables for common resource configurations
locals {
  project_name = "porfin"
  common_labels = {
    project             = "porfin"
    environment         = var.environment
    managed_by         = "terraform"
    compliance_level   = "high"
    data_classification = "sensitive"
  }
}

# Networking module for VPC, subnets, and security configurations
module "networking" {
  source = "./modules/networking"

  project_id      = var.project_id
  region          = var.region
  environment     = var.environment
  network_specs   = var.network_specs

  # Enhanced security configurations
  security_policy = {
    enabled             = true
    ddos_protection    = true
    web_application_firewall = true
    ssl_policy         = "MODERN"
    security_rules     = var.security_policy
  }

  # Load balancer configurations
  load_balancer = {
    type                       = var.load_balancer_specs.type
    ssl_policy                = var.load_balancer_specs.ssl_policy
    enable_cdn                = var.load_balancer_specs.enable_cdn
    session_affinity         = var.load_balancer_specs.session_affinity
    connection_draining_timeout = var.load_balancer_specs.connection_draining_timeout
  }
}

# Compute module for Cloud Run services
module "compute" {
  source = "./modules/compute"
  depends_on = [module.networking]

  project_id    = var.project_id
  region        = var.region
  environment   = var.environment

  # API server configurations
  api_server = {
    specs           = var.api_server_specs
    vpc_connector   = module.networking.vpc_connector_id
    service_account = module.iam.service_accounts.api_server
  }

  # WhatsApp service configurations
  whatsapp_service = {
    specs           = var.whatsapp_service_specs
    vpc_connector   = module.networking.vpc_connector_id
    service_account = module.iam.service_accounts.whatsapp_service
  }

  # Enhanced security and scaling policies
  security_policy = {
    binary_authorization = true
    container_scanning  = true
    runtime_security    = true
  }

  scaling_policy = {
    cpu_utilization     = var.api_server_specs.scaling_cpu_threshold
    request_utilization = var.api_server_specs.scaling_request_threshold
    min_instances      = var.api_server_specs.min_instances
    max_instances      = var.api_server_specs.max_instances
    cooldown_period    = var.api_server_specs.cooldown_period
  }
}

# Database module for Firestore and Redis Cache
module "database" {
  source = "./modules/database"
  depends_on = [module.networking]

  project_id = var.project_id
  region     = var.region
  environment = var.environment

  # Redis cache configurations
  redis_cache = {
    specs              = var.redis_cache_specs
    vpc_network       = module.networking.vpc_id
    auth_enabled      = true
    transit_encryption = "SERVER_AUTHENTICATION"
  }

  # Firestore configurations
  firestore = {
    specs            = var.firestore_specs
    location_id     = var.region
    backup_schedule = "0 */6 * * *"  # Every 6 hours
  }

  # Enhanced security configurations
  security = {
    encryption_key    = var.encryption_config
    backup_retention = "30d"
    audit_logging    = true
  }
}

# Monitoring module for observability and compliance
module "monitoring" {
  source = "./modules/monitoring"

  project_id = var.project_id
  region     = var.region
  environment = var.environment

  # Monitoring configurations
  monitoring = {
    specs                = var.monitoring_specs
    workspace_name      = "${local.project_name}-${var.environment}"
    retention_period    = "30d"
    notification_channels = var.monitoring_specs.notification_channels
  }

  # Alert policies
  alerts = {
    cpu_utilization    = var.monitoring_specs.alert_thresholds.cpu_utilization
    memory_utilization = var.monitoring_specs.alert_thresholds.memory_utilization
    error_rate         = var.monitoring_specs.alert_thresholds.error_rate
    latency_threshold  = var.monitoring_specs.alert_thresholds.latency_threshold
  }

  # Logging and audit configurations
  logging = {
    retention_period = "30d"
    export_enabled  = true
    audit_logs      = true
  }
}

# Output configuration for infrastructure state
output "infrastructure_state" {
  description = "Infrastructure deployment state and endpoints"
  value = {
    vpc_id = module.networking.vpc_id
    service_urls = {
      api_server       = module.compute.api_server_url
      whatsapp_service = module.compute.whatsapp_service_url
    }
    database_endpoints = {
      redis_host     = module.database.redis_host
      firestore_name = module.database.firestore_name
    }
    monitoring_workspace = module.monitoring.workspace_name
    security_status = {
      ssl_policy     = module.networking.ssl_policy
      waf_status     = module.networking.waf_status
      audit_enabled  = module.monitoring.audit_enabled
    }
  }
  sensitive = true
}