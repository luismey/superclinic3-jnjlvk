# Core Infrastructure Variables
project_id = "porfin-staging"
region     = "southamerica-east1"
environment = "staging"

# API Server Specifications
# Implements reduced scaling limits for staging with monitoring thresholds
api_server_specs = {
  min_instances          = 1
  max_instances          = 10
  cpu                   = "2"
  memory                = "4Gi"
  scaling_cpu_threshold = 0.8
  requests_per_instance = 80
  cooldown_period       = 60
}

# WhatsApp Service Specifications
# Configures service instances with connection limits for staging environment
whatsapp_service_specs = {
  min_instances           = 1
  max_instances          = 10
  cpu                    = "1"
  memory                 = "2Gi"
  connections_per_instance = 1000
  cpu_threshold          = 0.75
  cooldown_period        = 120
}

# Network Specifications
# Defines VPC and subnet configuration for staging environment
network_specs = {
  vpc_name              = "porfin-staging-vpc"
  subnet_cidr           = "10.10.0.0/20"
  region                = "southamerica-east1"
  enable_private_access = true
  enable_flow_logs      = true
}

# Redis Cache Specifications
# Configures basic tier Redis instance with security settings
redis_cache_specs = {
  tier                      = "basic"
  memory_size_gb           = 4
  version                  = "redis_6_x"
  auth_enabled             = true
  transit_encryption_mode  = "SERVER_AUTHENTICATION"
}

# Firestore Specifications
# Sets up single-region Firestore instance for staging
firestore_specs = {
  location_id                  = "southamerica-east1"
  database_type               = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
}

# Monitoring Specifications
# Implements comprehensive monitoring and alerting for staging environment
monitoring_specs = {
  notification_channels       = ["email"]
  alert_cpu_threshold        = 0.85
  alert_memory_threshold     = 0.9
  alert_error_rate_threshold = 0.01
  metrics_retention_days     = 30
  enable_dashboard           = true
}