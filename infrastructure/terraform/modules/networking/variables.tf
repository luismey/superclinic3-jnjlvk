# Terraform variable definitions for GCP networking infrastructure
# Version: ~> 1.0

variable "project_id" {
  type        = string
  description = "The GCP project ID where resources will be created. Must be a valid project ID."
  
  validation {
    condition     = length(var.project_id) > 0 && can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  type        = string
  description = "The GCP region where resources will be created. Defaults to South America (São Paulo) region for optimal latency."
  default     = "southamerica-east1"
  
  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "Region must be a valid GCP region name."
  }
}

variable "environment" {
  type        = string
  description = "The deployment environment (staging/production) that determines security and scaling configurations."
  
  validation {
    condition     = contains(["staging", "production"], lower(var.environment))
    error_message = "Environment must be either 'staging' or 'production' (case-insensitive)."
  }
}

variable "network_name" {
  type        = string
  description = "Name of the VPC network to be created. Must follow GCP naming conventions."
  
  validation {
    condition     = can(regex("^[a-z][-a-z0-9]*[a-z0-9]$", var.network_name)) && length(var.network_name) <= 63
    error_message = "Network name must start with a letter, contain only lowercase letters, numbers, and hyphens, and be at most 63 characters."
  }
}

variable "subnet_cidr" {
  type        = string
  description = "CIDR range for the private subnet. Must be a valid IPv4 CIDR block."
  default     = "10.0.0.0/20"
  
  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "Subnet CIDR must be a valid IPv4 CIDR block."
  }
}

variable "enable_cdn" {
  type        = bool
  description = "Whether to enable Cloud CDN for the load balancer. Recommended for production environments."
  default     = true
}

variable "enable_cloud_armor" {
  type        = bool
  description = "Whether to enable Cloud Armor WAF protection. Strongly recommended for production environments."
  default     = true
}

variable "allowed_ip_ranges" {
  type        = list(string)
  description = "List of IP CIDR ranges to allow in firewall rules. Empty list means no restrictions."
  default     = []
  
  validation {
    condition     = alltrue([for cidr in var.allowed_ip_ranges : can(cidrhost(cidr, 0))])
    error_message = "All IP ranges must be valid IPv4 CIDR blocks."
  }
}