# Firestore Database Outputs
output "firestore_id" {
  description = "The unique identifier of the Firestore database instance"
  value       = google_firestore_database.main.id
}

output "firestore_name" {
  description = "The resource name of the Firestore database instance"
  value       = google_firestore_database.main.name
}

output "firestore_location" {
  description = "The location where the Firestore database is deployed"
  value       = google_firestore_database.main.location_id
}

# Redis Cache Outputs
output "redis_host" {
  description = "The hostname of the Redis cache instance"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "The port number of the Redis cache instance"
  value       = google_redis_instance.cache.port
}

output "redis_auth_string" {
  description = "The authentication string for Redis cache instance connection"
  value       = google_redis_instance.cache.auth_string
  sensitive   = true # Mark as sensitive to prevent exposure in logs and outputs
}

output "redis_connection_name" {
  description = "The connection name of the Redis instance"
  value       = "${google_redis_instance.cache.name}-${google_redis_instance.cache.location_id}"
}

# Cache Configuration Outputs
output "redis_cache_policies" {
  description = "Cache TTL policies for different data types"
  value = {
    session_ttl    = var.redis_cache_policies.session_ttl_minutes
    api_cache_ttl  = var.redis_cache_policies.api_cache_ttl_minutes
    query_cache_ttl = var.redis_cache_policies.query_cache_ttl_minutes
  }
}

# Database Status Outputs
output "firestore_state" {
  description = "The current state of the Firestore database"
  value       = google_firestore_database.main.concurrency_mode
}

output "redis_state" {
  description = "The current state of the Redis instance"
  value       = google_redis_instance.cache.tier
}

# Security Configuration Outputs
output "redis_auth_enabled" {
  description = "Indicates if Redis authentication is enabled"
  value       = google_redis_instance.cache.auth_enabled
}

output "redis_transit_encryption_mode" {
  description = "The TLS mode used for Redis connections"
  value       = google_redis_instance.cache.transit_encryption_mode
}

# Resource Labels
output "database_labels" {
  description = "Resource labels applied to database instances"
  value       = local.common_labels
}

# Monitoring Configuration
output "monitoring_metric_descriptor" {
  description = "The name of the custom metric descriptor for database monitoring"
  value       = google_monitoring_metric_descriptor.database_latency.type
}