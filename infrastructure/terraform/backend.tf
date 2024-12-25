# Backend configuration for Porfin WhatsApp automation platform
# Version: 1.0.0
# Purpose: Configures secure, centralized state management using Google Cloud Storage

terraform {
  backend "gcs" {
    # GCS bucket name follows project naming convention
    bucket = "${var.project_id}-terraform-state"
    
    # Environment-specific state file organization
    prefix = "${var.environment}"
    
    # Customer-managed encryption key for state file encryption
    encryption_key = "${var.kms_key_id}"
    
    # Standard storage class for frequent access and high availability
    storage_class = "STANDARD"
    
    # Enable versioning for state file history and recovery
    versioning = true
    
    # State locking timeout to prevent concurrent modifications
    state_lock_timeout = "10m"
    
    # Additional backend-specific settings
    enable_bucket_lifecycle_rules = true
    enable_bucket_force_destroy = false
    enable_bucket_public_access_prevention = true
    enable_bucket_uniform_bucket_level_access = true
    
    # LGPD compliance settings
    labels = {
      environment = "${var.environment}"
      data_classification = "sensitive"
      compliance = "lgpd"
    }
  }
}

# Backend configuration validation
check "backend_config" {
  assert {
    condition     = var.project_id != ""
    error_message = "Project ID must be provided for backend configuration."
  }

  assert {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }

  assert {
    condition     = var.kms_key_id != ""
    error_message = "KMS key ID must be provided for state encryption."
  }
}

# Required provider configuration for backend
required_providers {
  google = {
    source  = "hashicorp/google"
    version = "~> 4.0"  # Use latest 4.x version for stability
  }
}

# Backend-specific IAM configuration
data "google_storage_bucket_iam_policy" "state_bucket" {
  bucket = "${var.project_id}-terraform-state"
}

# Ensure minimum required permissions are set
resource "google_storage_bucket_iam_binding" "state_bucket_access" {
  bucket = "${var.project_id}-terraform-state"
  role   = "roles/storage.objectViewer"
  
  members = [
    "serviceAccount:${var.project_id}@appspot.gserviceaccount.com",
  ]

  depends_on = [
    data.google_storage_bucket_iam_policy.state_bucket
  ]
}

# Configure audit logging for state access
resource "google_storage_bucket_iam_audit_config" "state_bucket_audit" {
  bucket = "${var.project_id}-terraform-state"
  
  audit_log_config {
    log_type = "DATA_READ"
  }
  
  audit_log_config {
    log_type = "DATA_WRITE"
  }
  
  audit_log_config {
    log_type = "ADMIN_READ"
  }
}