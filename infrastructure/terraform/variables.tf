# Core Project Variables
variable "project_id" {
  description = "The Google Cloud Platform project ID"
  type        = string
}

variable "region" {
  description = "The GCP region where resources will be created"
  type        = string
  default     = "southamerica-east1" # São Paulo region for Brazilian market focus
}

variable "environment" {
  description = "Deployment environment (staging/production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

# API Server Specifications
variable "api_server_specs" {
  description = "Specifications for API server instances"
  type = object({
    machine_type = string
    cpu         = number
    memory_gb   = number
    min_instances = number
    max_instances = number
    scaling_cpu_threshold = number
    scaling_request_threshold = number
    cooldown_period = number
  })
  default = {
    machine_type = "e2-standard-2"  # 2 vCPU, 8GB RAM
    cpu          = 2
    memory_gb    = 4
    min_instances = 2
    max_instances = 20
    scaling_cpu_threshold = 70
    scaling_request_threshold = 100
    cooldown_period = 90
  }
}

# WhatsApp Service Specifications
variable "whatsapp_service_specs" {
  description = "Specifications for WhatsApp service instances"
  type = object({
    machine_type = string
    cpu         = number
    memory_gb   = number
    min_instances = number
    max_instances = number
    connections_per_instance = number
    scaling_cpu_threshold = number
    cooldown_period = number
  })
  default = {
    machine_type = "e2-standard-2"
    cpu          = 2
    memory_gb    = 4
    min_instances = 1
    max_instances = 10
    connections_per_instance = 1000
    scaling_cpu_threshold = 75
    cooldown_period = 120
  }
}

# Network Specifications
variable "network_specs" {
  description = "Network configuration specifications"
  type = object({
    network_name = string
    subnet_cidr = string
    private_ip_google_access = bool
    enable_flow_logs = bool
  })
  default = {
    network_name = "porfin-network"
    subnet_cidr = "10.0.0.0/20"
    private_ip_google_access = true
    enable_flow_logs = true
  }
}

# Redis Cache Specifications
variable "redis_cache_specs" {
  description = "Redis cache specifications"
  type = object({
    tier = string
    memory_size_gb = number
    version = string
    auth_enabled = bool
    transit_encryption_mode = string
  })
  default = {
    tier = "STANDARD_HA"
    memory_size_gb = 4
    version = "REDIS_6_X"
    auth_enabled = true
    transit_encryption_mode = "SERVER_AUTHENTICATION"
  }
}

# Firestore Specifications
variable "firestore_specs" {
  description = "Firestore database specifications"
  type = object({
    location_id = string
    database_type = string
    app_engine_integration_mode = string
  })
  default = {
    location_id = "southamerica-east1"
    database_type = "FIRESTORE_NATIVE"
    app_engine_integration_mode = "DISABLED"
  }
}

# Monitoring Specifications
variable "monitoring_specs" {
  description = "Monitoring and alerting configuration"
  type = object({
    notification_channels = list(string)
    alert_thresholds = object({
      cpu_utilization = number
      memory_utilization = number
      error_rate = number
      latency_threshold = number
    })
    metrics_retention_days = number
  })
  default = {
    notification_channels = []
    alert_thresholds = {
      cpu_utilization = 85
      memory_utilization = 90
      error_rate = 1
      latency_threshold = 500
    }
    metrics_retention_days = 30
  }
}

# Load Balancer Specifications
variable "load_balancer_specs" {
  description = "Load balancer configuration specifications"
  type = object({
    type = string
    ssl_policy = string
    enable_cdn = bool
    session_affinity = string
    connection_draining_timeout = number
  })
  default = {
    type = "EXTERNAL_MANAGED"
    ssl_policy = "MODERN"
    enable_cdn = true
    session_affinity = "GENERATED_COOKIE"
    connection_draining_timeout = 300
  }
}

# Service Account Specifications
variable "service_account_specs" {
  description = "Service account configuration for various components"
  type = object({
    create_new = bool
    roles = list(string)
  })
  default = {
    create_new = true
    roles = [
      "roles/cloudsql.client",
      "roles/redis.viewer",
      "roles/datastore.user",
      "roles/monitoring.metricWriter",
      "roles/logging.logWriter"
    ]
  }
}