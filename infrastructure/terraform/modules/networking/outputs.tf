# VPC Network outputs
output "network_id" {
  description = "The ID of the VPC network for service deployment and resource association"
  value       = google_compute_network.vpc_network.id
}

output "network_name" {
  description = "The name of the VPC network for reference in other resources"
  value       = google_compute_network.vpc_network.name
}

# Subnet outputs
output "subnet_name" {
  description = "The name of the private subnet for service deployment"
  value       = google_compute_subnetwork.subnet_private.name
}

output "subnet_cidr" {
  description = "The IP CIDR range of the private subnet for network planning"
  value       = google_compute_subnetwork.subnet_private.ip_cidr_range
}

# Load Balancer outputs
output "load_balancer_ip" {
  description = "The global IP address of the load balancer for DNS configuration"
  value       = google_compute_global_address.lb_ip.address
}

output "load_balancer_name" {
  description = "The name of the load balancer for reference in other resources"
  value       = google_compute_global_forwarding_rule.lb_https.name
}

# Security outputs
output "cloud_armor_policy_id" {
  description = "The ID of the Cloud Armor WAF policy for backend service protection"
  value       = var.enable_cloud_armor ? google_compute_security_policy.cloud_armor[0].id : null
}

output "ssl_policy_name" {
  description = "The name of the SSL policy applied to the load balancer"
  value       = google_compute_ssl_policy.lb_ssl_policy.name
}

# Backend Service outputs
output "backend_service_id" {
  description = "The ID of the backend service for service registration"
  value       = google_compute_backend_service.lb_backend.id
}

output "health_check_id" {
  description = "The ID of the health check used by the load balancer"
  value       = google_compute_health_check.lb_health_check.id
}

# Network connectivity outputs
output "cloud_nat_name" {
  description = "The name of the Cloud NAT gateway for private network egress"
  value       = google_compute_router_nat.cloud_nat.name
}

output "router_name" {
  description = "The name of the Cloud Router for network routing configuration"
  value       = google_compute_router.cloud_router.name
}

# Firewall outputs
output "internal_firewall_rule_name" {
  description = "The name of the firewall rule allowing internal network communication"
  value       = google_compute_firewall.allow_internal.name
}

output "lb_firewall_rule_name" {
  description = "The name of the firewall rule allowing load balancer health checks"
  value       = google_compute_firewall.allow_lb_health_check.name
}

# SSL Certificate outputs
output "ssl_certificate_id" {
  description = "The ID of the managed SSL certificate for HTTPS termination"
  value       = google_compute_managed_ssl_certificate.lb_cert.id
}

output "ssl_certificate_name" {
  description = "The name of the managed SSL certificate"
  value       = google_compute_managed_ssl_certificate.lb_cert.name
}