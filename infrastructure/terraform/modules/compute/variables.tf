# Terraform variables definition file for compute module
# Version: 1.0
# Provider: hashicorp/terraform ~> 1.0

variable "project_id" {
  type        = string
  description = "The GCP project ID where resources will be deployed"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  type        = string
  description = "The GCP region where resources will be deployed"
  default     = "southamerica-east1" # São Paulo region for Brazilian market focus
  validation {
    condition     = can(regex("^[a-z]+-[a-z]+-[0-9]$", var.region))
    error_message = "Region must be a valid GCP region identifier (e.g., southamerica-east1)."
  }
}

variable "environment" {
  type        = string
  description = "The deployment environment (development, staging, production)"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "instance_count" {
  type        = number
  description = "Initial number of service instances to deploy"
  default     = 2
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 20
    error_message = "Instance count must be between 1 and 20."
  }
}

variable "min_instances" {
  type        = number
  description = "Minimum number of service instances for auto-scaling"
  default     = 1
  validation {
    condition = (
      var.environment == "production" ? var.min_instances >= 2 : var.min_instances >= 1
    )
    error_message = "Production environment requires minimum 2 instances, others require minimum 1 instance."
  }
}

variable "max_instances" {
  type        = number
  description = "Maximum number of service instances for auto-scaling"
  default     = 10
  validation {
    condition = (
      var.environment == "production" ? var.max_instances <= 20 : var.max_instances <= 10
    )
    error_message = "Maximum instances cannot exceed 20 for production and 10 for other environments."
  }
}

variable "cpu_limit" {
  type        = string
  description = "CPU allocation for each service instance (e.g., '2000m' for 2 vCPU)"
  default     = "2000m"
  validation {
    condition     = can(regex("^[0-9]+m$", var.cpu_limit)) && tonumber(replace(var.cpu_limit, "m", "")) >= 1000 && tonumber(replace(var.cpu_limit, "m", "")) <= 4000
    error_message = "CPU limit must be specified in millicores (e.g., '2000m') and be between 1000m and 4000m."
  }
}

variable "memory_limit" {
  type        = string
  description = "Memory allocation for each service instance (e.g., '4Gi' for 4GB)"
  default     = "4Gi"
  validation {
    condition     = can(regex("^[0-9]+Gi$", var.memory_limit)) && tonumber(replace(var.memory_limit, "Gi", "")) >= 2 && tonumber(replace(var.memory_limit, "Gi", "")) <= 8
    error_message = "Memory limit must be specified in Gi (e.g., '4Gi') and be between 2Gi and 8Gi."
  }
}

variable "service_account_name" {
  type        = string
  description = "Name of the service account for Cloud Run services"
  sensitive   = true
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{5,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9].iam.gserviceaccount.com$", var.service_account_name))
    error_message = "Service account name must be a valid GCP service account email address."
  }
}

variable "network_id" {
  type        = string
  description = "VPC network ID for compute resources"
  validation {
    condition     = can(regex("^projects/[a-z0-9-]+/global/networks/[a-z0-9-]+$", var.network_id))
    error_message = "Network ID must be a valid GCP VPC network identifier (e.g., 'projects/project-id/global/networks/network-name')."
  }
}