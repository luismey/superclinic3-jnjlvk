# Core variables inherited from root module
variable "project_id" {
  description = "The Google Cloud Platform project ID"
  type        = string
}

variable "region" {
  description = "The GCP region where resources will be created"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging/production)"
  type        = string
  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either 'staging' or 'production'"
  }
}

# Monitoring workspace configuration
variable "monitoring_workspace_name" {
  description = "Name of the monitoring workspace in Google Cloud"
  type        = string
  default     = "porfin-monitoring-workspace"
}

# Performance and operational metric thresholds
variable "metric_thresholds" {
  description = "Threshold values for monitoring metrics"
  type        = map(number)
  default = {
    # API and Service Performance
    api_response_time_ms        = 200  # Technical spec requirement: <200ms
    message_processing_time_ms  = 500  # Technical spec requirement: <500ms
    database_query_time_ms      = 100  # Technical spec requirement: <100ms
    cache_hit_rate_percent      = 80   # Technical spec requirement: >80%
    
    # System Health
    error_rate_percent         = 0.1   # Technical spec requirement: <0.1%
    cpu_usage_percent         = 70    # Alert at 70% before scaling
    memory_usage_percent      = 80    # Alert at 80% utilization
    disk_usage_percent        = 75    # Alert at 75% capacity
    
    # Security and Access
    auth_failure_rate_percent = 5     # Alert on authentication issues
    api_error_rate_percent    = 2     # Alert on API errors
    
    # Capacity and Performance
    concurrent_users          = 1000  # Technical spec requirement: 1000
    network_latency_ms       = 100   # Network performance threshold
    request_rate_per_second  = 100   # Request handling capacity
    queue_depth              = 1000  # Message queue capacity
  }
}

# Alert notification configuration
variable "alert_notification_channels" {
  description = "Configuration for alert notification channels"
  type = list(object({
    name    = string
    type    = string
    labels  = map(string)
  }))
  default = [
    {
      name = "engineering-email"
      type = "email"
      labels = {
        email_address = "engineering@porfin.com"
      }
    },
    {
      name = "ops-slack"
      type = "slack"
      labels = {
        channel_name = "ops-alerts"
      }
    }
  ]
}

# Metrics retention configuration
variable "metrics_retention_days" {
  description = "Retention period in days for different metric types"
  type        = map(number)
  default = {
    performance_metrics = 90   # 3 months retention for performance data
    security_metrics   = 365  # 1 year retention for security metrics
    business_metrics   = 730  # 2 years retention for business metrics
    audit_logs        = 365  # 1 year retention for audit logs
  }
}

# Dashboard configuration
variable "dashboard_refresh_interval" {
  description = "Dashboard refresh interval in seconds"
  type        = number
  default     = 300  # 5 minutes refresh interval
  validation {
    condition     = var.dashboard_refresh_interval >= 60 && var.dashboard_refresh_interval <= 3600
    error_message = "Dashboard refresh interval must be between 60 and 3600 seconds"
  }
}

# Monitoring scope configuration
variable "monitoring_scope" {
  description = "Components to be monitored with their specific configurations"
  type = map(object({
    enabled = bool
    custom_metrics = list(string)
    alert_enabled = bool
  }))
  default = {
    api_gateway = {
      enabled = true
      custom_metrics = ["request_count", "error_count", "latency"]
      alert_enabled = true
    }
    whatsapp_service = {
      enabled = true
      custom_metrics = ["message_count", "delivery_rate", "processing_time"]
      alert_enabled = true
    }
    database = {
      enabled = true
      custom_metrics = ["query_performance", "connection_count", "error_rate"]
      alert_enabled = true
    }
    cache = {
      enabled = true
      custom_metrics = ["hit_rate", "memory_usage", "eviction_count"]
      alert_enabled = true
    }
  }
}

# Log configuration
variable "log_config" {
  description = "Configuration for log collection and analysis"
  type = object({
    enable_audit_logs = bool
    enable_data_access_logs = bool
    excluded_log_names = list(string)
  })
  default = {
    enable_audit_logs = true
    enable_data_access_logs = true
    excluded_log_names = ["health-check-logs", "load-balancer-logs"]
  }
}