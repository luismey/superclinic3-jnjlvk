# Provider configuration
terraform {
  required_version = "~> 1.0"
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

# Local variables
locals {
  common_labels = {
    managed-by  = "terraform"
    environment = var.environment
    project     = "porfin"
    compliance  = "lgpd"
  }
}

# Monitoring Workspace
resource "google_monitoring_workspace" "main" {
  provider = google-beta
  
  display_name = var.monitoring_workspace_name
  project      = var.project_id
  location     = var.region
  labels       = local.common_labels

  # Configure workspace features
  feature_settings {
    logging {
      logging_service_name = "logging.googleapis.com"
      retention_days      = 90
      enable_audit_logs   = true
    }
    metrics {
      ingestion_rate_limit = 100000
      retention_days      = 90
    }
    trace {
      sampling_rate          = 0.1
      max_traces_per_second = 100
    }
  }
}

# Alert Policies
resource "google_monitoring_alert_policy" "performance_alerts" {
  provider = google-beta

  display_name = "Porfin Performance Monitoring"
  project      = var.project_id
  combiner     = "OR"
  enabled      = true

  notification_channels = var.alert_notification_channels

  # API Response Time Alert
  conditions {
    display_name = "API Response Time"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/api/response_time\" AND resource.type=\"cloud_run_revision\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 200
      trigger {
        count = 3
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  # Message Processing Time Alert
  conditions {
    display_name = "Message Processing Time"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/message/processing_time\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 500
      trigger {
        count = 3
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  # Database Query Time Alert
  conditions {
    display_name = "Database Query Time"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/database/query_time\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 100
      trigger {
        count = 3
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  # Cache Hit Rate Alert
  conditions {
    display_name = "Cache Hit Rate"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/cache/hit_rate\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 80
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
}

# Security Alert Policy
resource "google_monitoring_alert_policy" "security_alerts" {
  provider = google-beta

  display_name = "Porfin Security Monitoring"
  project      = var.project_id
  combiner     = "OR"
  enabled      = true

  notification_channels = var.alert_notification_channels

  # Authentication Failures Alert
  conditions {
    display_name = "Authentication Failures"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/security/auth_failures\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  # Suspicious Data Access Alert
  conditions {
    display_name = "Suspicious Data Access"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/security/suspicious_access\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
}

# Monitoring Dashboard
resource "google_monitoring_dashboard" "main" {
  provider = google-beta

  dashboard_json = jsonencode({
    displayName = "Porfin System Dashboard"
    gridLayout = {
      widgets = [
        {
          title = "Performance Metrics"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"custom.googleapis.com/api/response_time\""
                  }
                  unitOverride = "ms"
                }
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"custom.googleapis.com/message/processing_time\""
                  }
                  unitOverride = "ms"
                }
              }
            ]
          }
        },
        {
          title = "Security Metrics"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"custom.googleapis.com/security/auth_failures\""
                  }
                }
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"custom.googleapis.com/security/suspicious_access\""
                  }
                }
              }
            ]
          }
        },
        {
          title = "Resource Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"compute.googleapis.com/instance/cpu/utilization\""
                  }
                }
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"compute.googleapis.com/instance/memory/utilization\""
                  }
                }
              }
            ]
          }
        }
      ]
    }
  })
}

# Outputs
output "monitoring_workspace_id" {
  description = "The ID of the monitoring workspace"
  value       = google_monitoring_workspace.main.id
}

output "alert_policy_performance_id" {
  description = "The ID of the performance alert policy"
  value       = google_monitoring_alert_policy.performance_alerts.name
}

output "alert_policy_security_id" {
  description = "The ID of the security alert policy"
  value       = google_monitoring_alert_policy.security_alerts.name
}

output "dashboard_id" {
  description = "The ID of the monitoring dashboard"
  value       = google_monitoring_dashboard.main.name
}