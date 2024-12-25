# Backend Service outputs
output "backend_service_url" {
  description = "HTTPS endpoint URL for the backend FastAPI service"
  value       = google_cloud_run_service.backend_api.status[0].url
  
  # Ensure URL is HTTPS format
  validation {
    condition     = can(regex("^https://", google_cloud_run_service.backend_api.status[0].url))
    error_message = "Backend service URL must use HTTPS protocol."
  }
}

output "backend_service_name" {
  description = "Name of the deployed backend Cloud Run service for reference and monitoring"
  value       = google_cloud_run_service.backend_api.name
}

# WhatsApp Service outputs
output "whatsapp_service_url" {
  description = "HTTPS endpoint URL for the WhatsApp service"
  value       = google_cloud_run_service.whatsapp_service.status[0].url
  
  # Ensure URL is HTTPS format
  validation {
    condition     = can(regex("^https://", google_cloud_run_service.whatsapp_service.status[0].url))
    error_message = "WhatsApp service URL must use HTTPS protocol."
  }
}

output "whatsapp_service_name" {
  description = "Name of the deployed WhatsApp Cloud Run service for reference and monitoring"
  value       = google_cloud_run_service.whatsapp_service.name
}

# Load Balancer outputs
output "load_balancer_ip" {
  description = "Global load balancer IP address for DNS configuration and external access"
  value       = google_compute_region_network_endpoint_group.backend_neg.id
}

output "load_balancer_name" {
  description = "Name of the load balancer network endpoint group for reference"
  value       = google_compute_region_network_endpoint_group.backend_neg.name
}

# Service Account outputs
output "service_account_email" {
  description = "Service account email for Cloud Run services authentication"
  value       = google_service_account.cloud_run_sa.email
  sensitive   = true # Mark as sensitive since it's a security credential
}

output "service_account_name" {
  description = "Name of the service account used by Cloud Run services"
  value       = google_service_account.cloud_run_sa.name
}

# VPC Access Connector outputs
output "vpc_connector_id" {
  description = "ID of the VPC access connector used by Cloud Run services"
  value       = google_vpc_access_connector.connector.id
}

output "vpc_connector_name" {
  description = "Name of the VPC access connector for reference"
  value       = google_vpc_access_connector.connector.name
}

# Network Endpoint Group outputs
output "backend_neg_id" {
  description = "ID of the backend service network endpoint group"
  value       = google_compute_region_network_endpoint_group.backend_neg.id
}

output "whatsapp_neg_id" {
  description = "ID of the WhatsApp service network endpoint group"
  value       = google_compute_region_network_endpoint_group.whatsapp_neg.id
}

# IAM Policy outputs
output "backend_service_iam" {
  description = "IAM policy data for backend service"
  value       = google_cloud_run_service_iam_policy.backend_noauth.policy_data
  sensitive   = true # Mark as sensitive since it contains IAM policy data
}

output "whatsapp_service_iam" {
  description = "IAM policy data for WhatsApp service"
  value       = google_cloud_run_service_iam_policy.whatsapp_noauth.policy_data
  sensitive   = true # Mark as sensitive since it contains IAM policy data
}