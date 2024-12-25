# GCP Project Configuration
variable "project_id" {
  description = "The Google Cloud Platform project ID where resources will be deployed"
  type        = string
}

variable "region" {
  description = "The GCP region where database resources will be deployed"
  type        = string
  default     = "southamerica-east1" # São Paulo region for Brazil compliance
}

variable "environment" {
  description = "The deployment environment (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

# Firestore Configuration
variable "firestore_location" {
  description = "The location for the Firestore database deployment"
  type        = string
  default     = "nam5" # Default location for Brazil region compliance
}

variable "firestore_retention_days" {
  description = "Number of days to retain Firestore data before archival"
  type        = number
  default     = 90
  validation {
    condition     = var.firestore_retention_days >= 90
    error_message = "Firestore retention period must be at least 90 days for compliance requirements."
  }
}

# Redis Cache Configuration
variable "redis_memory_size_gb" {
  description = "Memory size in GB for the Redis cache instance"
  type        = number
  default     = 4
  validation {
    condition     = var.redis_memory_size_gb >= 4
    error_message = "Redis memory size must be at least 4GB as per infrastructure requirements."
  }
}

variable "redis_tier" {
  description = "Service tier for the Redis instance (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be either BASIC or STANDARD_HA."
  }
}

variable "redis_version" {
  description = "Redis version to be deployed"
  type        = string
  default     = "6.x"
  validation {
    condition     = can(regex("^[0-9]+\\.[x0-9]+$", var.redis_version))
    error_message = "Redis version must be in the format 'X.x' or 'X.Y' where X and Y are numbers."
  }
}

variable "redis_auth_enabled" {
  description = "Enable authentication for Redis instance"
  type        = bool
  default     = true
}

variable "redis_maintenance_window" {
  description = "Maintenance window configuration for Redis instance"
  type = object({
    day          = string
    hour         = number
    update_track = string
  })
  default = {
    day          = "SUNDAY"
    hour         = 2 # 2 AM
    update_track = "stable"
  }
  validation {
    condition     = contains(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"], var.redis_maintenance_window.day)
    error_message = "Maintenance window day must be a valid day of the week in uppercase."
  }
  validation {
    condition     = var.redis_maintenance_window.hour >= 0 && var.redis_maintenance_window.hour <= 23
    error_message = "Maintenance window hour must be between 0 and 23."
  }
  validation {
    condition     = contains(["stable", "preview"], var.redis_maintenance_window.update_track)
    error_message = "Update track must be either 'stable' or 'preview'."
  }
}

# Cache Configuration
variable "redis_cache_policies" {
  description = "Cache policies configuration for different data types"
  type = object({
    session_ttl_minutes    = number
    api_cache_ttl_minutes  = number
    query_cache_ttl_minutes = number
  })
  default = {
    session_ttl_minutes    = 60
    api_cache_ttl_minutes  = 5
    query_cache_ttl_minutes = 15
  }
  validation {
    condition     = var.redis_cache_policies.session_ttl_minutes > 0 && 
                    var.redis_cache_policies.api_cache_ttl_minutes > 0 && 
                    var.redis_cache_policies.query_cache_ttl_minutes > 0
    error_message = "All cache TTL values must be greater than 0 minutes."
  }
}

# Firestore Collection Configuration
variable "firestore_collections" {
  description = "Configuration for Firestore collections and indexes"
  type = object({
    messages_collection_name = string
    chats_collection_name    = string
    users_collection_name    = string
  })
  default = {
    messages_collection_name = "messages"
    chats_collection_name    = "chats"
    users_collection_name    = "users"
  }
}