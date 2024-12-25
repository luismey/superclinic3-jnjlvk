# Provider configuration
terraform {
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

# Local variables for resource naming and tagging
locals {
  resource_prefix = "${var.environment}-${var.project_id}"
  common_labels = {
    environment   = var.environment
    managed_by    = "terraform"
    project       = "porfin"
    cost_center   = "database"
    compliance    = "lgpd"
  }
}

# Firestore database instance
resource "google_firestore_database" "main" {
  provider = google-beta
  project  = var.project_id
  name     = "${local.resource_prefix}-db"
  
  # Location configuration for data residency compliance
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
  
  # Enhanced security and data protection features
  concurrency_mode                    = "OPTIMISTIC"
  app_engine_integration_mode         = "DISABLED"
  delete_protection_state             = "DELETE_PROTECTION_ENABLED"
  point_in_time_recovery_enablement   = "POINT_IN_TIME_RECOVERY_ENABLED"
  
  # Resource labels for management and cost tracking
  labels = local.common_labels

  lifecycle {
    prevent_destroy = true # Prevent accidental database deletion
  }
}

# Redis cache instance
resource "google_redis_instance" "cache" {
  provider        = google-beta
  project         = var.project_id
  name            = "${local.resource_prefix}-cache"
  tier            = var.redis_tier
  memory_size_gb  = var.redis_memory_size_gb
  region          = var.region
  redis_version   = var.redis_version
  display_name    = "Porfin Cache Layer"
  
  # Enhanced security configuration
  auth_enabled              = true
  transit_encryption_mode   = "SERVER_AUTHENTICATION"
  
  # Maintenance window configuration
  maintenance_policy {
    weekly_maintenance_window {
      day = var.redis_maintenance_window.day
      start_time {
        hours   = var.redis_maintenance_window.hour
        minutes = 0
      }
    }
  }
  
  # Redis configuration for optimal caching behavior
  redis_configs = {
    maxmemory-policy        = "allkeys-lru"     # Least Recently Used eviction
    notify-keyspace-events  = "Ex"              # Expired events notification
    timeout                 = "3600"            # Connection timeout in seconds
    maxmemory-samples      = "5"               # LRU algorithm precision
    activedefrag           = "yes"             # Enable active defragmentation
    lazyfree-lazy-eviction = "yes"             # Asynchronous evictions
  }
  
  # Resource labels
  labels = local.common_labels

  # Location configuration
  location_id = "${var.region}-a"
  
  # Alternative location for HA if configured
  dynamic "alternative_location_id" {
    for_each = var.redis_tier == "STANDARD_HA" ? [1] : []
    content {
      location_id = "${var.region}-b"
    }
  }
}

# IAM policy for Firestore
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${var.project_id}@appspot.gserviceaccount.com"
}

# Cloud Monitoring metric descriptors for database monitoring
resource "google_monitoring_metric_descriptor" "database_latency" {
  project      = var.project_id
  description  = "Database operation latency metrics"
  display_name = "Database Latency"
  type         = "custom.googleapis.com/database/latency"
  metric_kind  = "GAUGE"
  value_type   = "DOUBLE"
  unit         = "ms"
  
  labels {
    key         = "operation_type"
    value_type  = "STRING"
    description = "Type of database operation"
  }
  
  labels {
    key         = "database_type"
    value_type  = "STRING"
    description = "Type of database (firestore/redis)"
  }
}

# Backup configuration for Firestore (if supported in region)
resource "google_firestore_backup_schedule" "daily" {
  count    = var.environment == "production" ? 1 : 0
  provider = google-beta
  project  = var.project_id
  
  retention_days = var.firestore_retention_days
  schedule {
    cron = "0 2 * * *" # Daily at 2 AM
  }
  
  backup_location = var.firestore_location
}

# Redis connection monitoring
resource "google_monitoring_alert_policy" "redis_connection" {
  project      = var.project_id
  display_name = "Redis Connection Alert"
  combiner     = "OR"
  
  conditions {
    display_name = "Redis Connection Count"
    condition_threshold {
      filter          = "metric.type=\"redis.googleapis.com/stats/connected_clients\" resource.type=\"redis_instance\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 950  # Alert at 95% of 1000 connection limit
      
      trigger {
        count = 1
      }
    }
  }
  
  notification_channels = [] # Add notification channels as needed
}