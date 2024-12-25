# Terraform configuration for GCP compute resources
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

# Local variables for resource naming and tagging
locals {
  service_name_prefix = "porfin-${var.environment}"
  common_labels = {
    environment = var.environment
    managed_by  = "terraform"
    project     = "porfin"
  }
  
  # Environment-specific scaling configurations
  backend_scaling = {
    production = {
      min_instances = 2
      max_instances = 10
      cpu          = "2000m"
      memory       = "4Gi"
    }
    staging = {
      min_instances = 1
      max_instances = 5
      cpu          = "1000m"
      memory       = "2Gi"
    }
  }
}

# Service Account for Cloud Run services
resource "google_service_account" "cloud_run_sa" {
  project      = var.project_id
  account_id   = "${local.service_name_prefix}-run-sa"
  display_name = "Service Account for ${title(var.environment)} Cloud Run Services"
  description  = "Manages authentication and authorization for Cloud Run services in ${var.environment}"
}

# IAM roles for the service account
resource "google_project_iam_member" "cloud_run_roles" {
  for_each = toset([
    "roles/cloudtrace.agent",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor"
  ])
  
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Backend API Service
resource "google_cloud_run_service" "backend_api" {
  name     = "${local.service_name_prefix}-backend"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.cloud_run_sa.email
      containers {
        image = "gcr.io/${var.project_id}/backend:latest"
        
        resources {
          limits = {
            cpu    = local.backend_scaling[var.environment].cpu
            memory = local.backend_scaling[var.environment].memory
          }
        }

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        
        ports {
          name           = "http1"
          container_port = 8000
        }

        startup_probe {
          initial_delay_seconds = 5
          timeout_seconds      = 3
          period_seconds      = 5
          failure_threshold   = 3
          http_get {
            path = "/health"
          }
        }

        liveness_probe {
          http_get {
            path = "/health"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"        = local.backend_scaling[var.environment].min_instances
        "autoscaling.knative.dev/maxScale"        = local.backend_scaling[var.environment].max_instances
        "run.googleapis.com/cpu-throttling"       = "false"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.name
      }
      labels = local.common_labels
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  autogenerate_revision_name = true

  depends_on = [
    google_project_iam_member.cloud_run_roles
  ]
}

# WhatsApp Service
resource "google_cloud_run_service" "whatsapp_service" {
  name     = "${local.service_name_prefix}-whatsapp"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = google_service_account.cloud_run_sa.email
      containers {
        image = "gcr.io/${var.project_id}/whatsapp:latest"
        
        resources {
          limits = {
            cpu    = "2000m"
            memory = "4Gi"
          }
        }

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }

        ports {
          name           = "http1"
          container_port = 3000
        }

        startup_probe {
          initial_delay_seconds = 10
          timeout_seconds      = 5
          period_seconds      = 10
          failure_threshold   = 3
          http_get {
            path = "/health"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"        = "1"
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.name
      }
      labels = local.common_labels
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  autogenerate_revision_name = true
}

# VPC Access Connector
resource "google_vpc_access_connector" "connector" {
  provider = google-beta
  project  = var.project_id
  name     = "${local.service_name_prefix}-connector"
  region   = var.region
  subnet {
    name = var.subnet_name
  }

  machine_type = "e2-micro"
  min_instances = 2
  max_instances = 3
}

# Load Balancer NEG for Backend Service
resource "google_compute_region_network_endpoint_group" "backend_neg" {
  provider              = google-beta
  project              = var.project_id
  name                 = "${local.service_name_prefix}-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region               = var.region
  
  cloud_run {
    service = google_cloud_run_service.backend_api.name
  }
}

# Load Balancer NEG for WhatsApp Service
resource "google_compute_region_network_endpoint_group" "whatsapp_neg" {
  provider              = google-beta
  project              = var.project_id
  name                 = "${local.service_name_prefix}-whatsapp-neg"
  network_endpoint_type = "SERVERLESS"
  region               = var.region
  
  cloud_run {
    service = google_cloud_run_service.whatsapp_service.name
  }
}

# IAM policy for public access to Cloud Run services
data "google_iam_policy" "noauth" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allUsers",
    ]
  }
}

# Allow public access to backend service
resource "google_cloud_run_service_iam_policy" "backend_noauth" {
  location = google_cloud_run_service.backend_api.location
  project  = google_cloud_run_service.backend_api.project
  service  = google_cloud_run_service.backend_api.name
  policy_data = data.google_iam_policy.noauth.policy_data
}

# Allow public access to WhatsApp service
resource "google_cloud_run_service_iam_policy" "whatsapp_noauth" {
  location = google_cloud_run_service.whatsapp_service.location
  project  = google_cloud_run_service.whatsapp_service.project
  service  = google_cloud_run_service.whatsapp_service.name
  policy_data = data.google_iam_policy.noauth.policy_data
}