# Output definitions for the monitoring module
# Exports monitoring component identifiers for metrics collection, log aggregation, and trace system integration

# Monitoring Workspace ID
output "monitoring_workspace_id" {
  description = "The unique identifier of the monitoring workspace used for metrics collection, log aggregation, and trace system integration"
  value       = google_monitoring_workspace.main.id
  sensitive   = false
}

# Performance Alert Policy ID
output "performance_alert_policy_id" {
  description = "The unique identifier of the performance alert policy monitoring API response times, message processing, and system metrics"
  value       = google_monitoring_alert_policy.performance_alerts.name
  sensitive   = false
}

# Security Alert Policy ID 
output "security_alert_policy_id" {
  description = "The unique identifier of the security alert policy monitoring authentication, data access, and suspicious activities"
  value       = google_monitoring_alert_policy.security_alerts.name
  sensitive   = false
}

# System Dashboard ID
output "dashboard_id" {
  description = "The unique identifier of the monitoring dashboard displaying system performance, security metrics, and resource utilization"
  value       = google_monitoring_dashboard.main.name
  sensitive   = false
}

# Workspace Display Name
output "monitoring_workspace_name" {
  description = "The display name of the monitoring workspace for reference in other configurations"
  value       = google_monitoring_workspace.main.display_name
  sensitive   = false
}

# Alert Notification Channel IDs
output "alert_notification_channels" {
  description = "The list of notification channel IDs configured for alert policies"
  value       = var.alert_notification_channels
  sensitive   = false
}

# Feature Settings
output "monitoring_features" {
  description = "The configured feature settings for logging, metrics, and trace collection"
  value = {
    logging_retention_days = google_monitoring_workspace.main.feature_settings[0].logging[0].retention_days
    metrics_retention_days = google_monitoring_workspace.main.feature_settings[0].metrics[0].retention_days
    trace_sampling_rate   = google_monitoring_workspace.main.feature_settings[0].trace[0].sampling_rate
  }
  sensitive = false
}

# Workspace Location
output "monitoring_location" {
  description = "The geographic location where the monitoring workspace is provisioned"
  value       = google_monitoring_workspace.main.location
  sensitive   = false
}

# Resource Labels
output "monitoring_labels" {
  description = "The resource labels applied to the monitoring workspace for organization and billing"
  value       = google_monitoring_workspace.main.labels
  sensitive   = false
}