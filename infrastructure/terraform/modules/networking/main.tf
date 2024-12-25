# Terraform configuration for GCP networking infrastructure
# Provider versions: google ~> 4.0, google-beta ~> 4.0

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

# Custom VPC Network
resource "google_compute_network" "vpc_network" {
  name                            = var.network_name
  project                         = var.project_id
  auto_create_subnetworks        = false
  routing_mode                   = "REGIONAL"
  delete_default_routes_on_create = true

  depends_on = [
    google_project_service.compute_api
  ]
}

# Private Subnet
resource "google_compute_subnetwork" "subnet_private" {
  name          = "${var.network_name}-private-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc_network.id
  ip_cidr_range = var.subnet_cidr
  
  private_ip_google_access = true
  
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata            = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT Gateway
resource "google_compute_router" "cloud_router" {
  name    = "${var.network_name}-router"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc_network.id

  bgp {
    asn = 64514
  }
}

# Cloud NAT Configuration
resource "google_compute_router_nat" "cloud_nat" {
  name                               = "${var.network_name}-nat"
  project                            = var.project_id
  router                             = google_compute_router.cloud_router.name
  region                             = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Global Load Balancer
resource "google_compute_global_address" "lb_ip" {
  name    = "${var.network_name}-lb-ip"
  project = var.project_id
}

resource "google_compute_global_forwarding_rule" "lb_https" {
  name                  = "${var.network_name}-lb-https"
  project               = var.project_id
  ip_protocol          = "TCP"
  port_range           = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target               = google_compute_target_https_proxy.lb_https_proxy.id
  ip_address           = google_compute_global_address.lb_ip.id
}

# SSL Certificate (Managed by Google)
resource "google_compute_managed_ssl_certificate" "lb_cert" {
  provider = google-beta
  project  = var.project_id
  name     = "${var.network_name}-cert"

  managed {
    domains = ["api.porfin.com.br"] # Domain should be configured based on environment
  }
}

# HTTPS Proxy Configuration
resource "google_compute_target_https_proxy" "lb_https_proxy" {
  name             = "${var.network_name}-https-proxy"
  project          = var.project_id
  url_map          = google_compute_url_map.lb_url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.lb_cert.id]
  ssl_policy       = google_compute_ssl_policy.lb_ssl_policy.id
}

# SSL Policy (Strong Security)
resource "google_compute_ssl_policy" "lb_ssl_policy" {
  name            = "${var.network_name}-ssl-policy"
  project         = var.project_id
  profile         = "RESTRICTED"
  min_tls_version = "TLS_1_2"
}

# URL Map Configuration
resource "google_compute_url_map" "lb_url_map" {
  name            = "${var.network_name}-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.lb_backend.id
}

# Backend Service Configuration
resource "google_compute_backend_service" "lb_backend" {
  name                  = "${var.network_name}-backend"
  project               = var.project_id
  protocol              = "HTTPS"
  port_name             = "https"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  enable_cdn            = var.enable_cdn
  health_checks         = [google_compute_health_check.lb_health_check.id]
  
  security_policy = var.enable_cloud_armor ? google_compute_security_policy.cloud_armor[0].id : null

  custom_request_headers = [
    "X-Client-Geo-Location: {client_region}"
  ]

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# Health Check Configuration
resource "google_compute_health_check" "lb_health_check" {
  name               = "${var.network_name}-health-check"
  project            = var.project_id
  check_interval_sec = 5
  timeout_sec        = 5

  https_health_check {
    port         = "443"
    request_path = "/health"
  }
}

# Cloud Armor WAF Policy
resource "google_compute_security_policy" "cloud_armor" {
  count   = var.enable_cloud_armor ? 1 : 0
  name    = "${var.network_name}-cloud-armor"
  project = var.project_id

  # Default rule (deny all)
  rule {
    action   = "deny(403)"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default deny rule"
  }

  # Allow Brazil IPs
  rule {
    action   = "allow"
    priority = "1000"
    match {
      expr {
        expression = "origin.region_code == 'BR'"
      }
    }
    description = "Allow traffic from Brazil"
  }

  # Rate limiting rule
  rule {
    action   = "rate_based_ban"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      conform_action   = "allow"
      exceed_action   = "deny(429)"
      enforce_on_key  = "IP"
      ban_duration_sec = 300
    }
    description = "Rate limiting rule"
  }

  # XSS Protection
  rule {
    action   = "deny(403)"
    priority = "3000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-stable')"
      }
    }
    description = "XSS protection"
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.network_name}-allow-internal"
  project = var.project_id
  network = google_compute_network.vpc_network.id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr]
  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_firewall" "allow_lb_health_check" {
  name    = "${var.network_name}-allow-lb-health-check"
  project = var.project_id
  network = google_compute_network.vpc_network.id

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["lb-backend"]
  
  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Enable required APIs
resource "google_project_service" "compute_api" {
  project = var.project_id
  service = "compute.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "networking_api" {
  project = var.project_id
  service = "servicenetworking.googleapis.com"

  disable_on_destroy = false
}