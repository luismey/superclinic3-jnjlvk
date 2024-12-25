# Project and Region Configuration
project_id = "porfin-production"
region     = "southamerica-east1"
environment = "production"

# API Server Specifications
# Configured for high availability and performance requirements
api_server_specs = {
  min_instances = 2
  max_instances = 20
  cpu          = "2"
  memory       = "4Gi"
  concurrency  = 100
  timeout      = "60s"
  scaling_metrics = {
    cpu_utilization     = 0.7
    request_concurrency = 80
  }
}

# WhatsApp Service Specifications
# Optimized for message handling and WebSocket connections
whatsapp_service_specs = {
  min_instances = 1
  max_instances = 10
  cpu          = "1"
  memory       = "2Gi"
  concurrency  = 1000
  timeout      = "120s"
  scaling_metrics = {
    cpu_utilization  = 0.75
    connection_count = 1000
  }
}

# Network Configuration
# Production VPC and subnet configuration
network_specs = {
  vpc_name              = "porfin-prod-vpc"
  subnet_cidr           = "10.0.0.0/20"
  region               = "southamerica-east1"
  enable_private_access = true
  enable_flow_logs     = true
}

# Redis Cache Specifications
# Production cache layer configuration
redis_cache_specs = {
  tier                = "standard"
  memory_size_gb      = 4
  version            = "6.x"
  high_availability  = true
  authorized_network = "porfin-prod-vpc"
}

# Firestore Specifications
# Production database configuration
firestore_specs = {
  location_id                  = "southamerica-east1"
  database_type               = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
}

# Monitoring Configuration
# Production monitoring and alerting setup
monitoring_specs = {
  notification_channels = ["email", "slack"]
  alert_policies = {
    error_rate = {
      threshold = 1.0
      duration  = "5m"
    }
    latency = {
      threshold = 200
      duration  = "5m"
    }
    cpu_utilization = {
      threshold = 0.85
      duration  = "15m"
    }
  }
  dashboard_configs = {
    system_metrics      = true
    application_metrics = true
    business_metrics    = true
  }
}