# Networking Configuration Outputs
output "networking_config" {
  description = "Core networking infrastructure configuration and endpoints"
  value = {
    load_balancer_ip = google_compute_global_address.default.address
    cdn_endpoints    = {
      static_assets = google_compute_backend_bucket.cdn_backend.self_link
      media_content = google_compute_backend_bucket.media_backend.self_link
    }
    dns_records     = {
      api     = google_dns_record_set.api.name
      app     = google_dns_record_set.app.name
      cdn     = google_dns_record_set.cdn.name
      metrics = google_dns_record_set.metrics.name
    }
  }
  sensitive = false
}

# Compute Resources Configuration Outputs
output "compute_config" {
  description = "Compute resources configuration and service endpoints"
  value = {
    api_server_urls = [
      for service in google_cloud_run_service.api : service.status[0].url
    ]
    whatsapp_service_endpoints = {
      for service in google_cloud_run_service.whatsapp : service.name => service.status[0].url
    }
    cloud_run_services = {
      frontend = {
        url     = google_cloud_run_service.frontend.status[0].url
        version = google_cloud_run_service.frontend.template[0].metadata[0].annotations["client.knative.dev/user-image"]
      }
      backend = {
        url     = google_cloud_run_service.backend.status[0].url
        version = google_cloud_run_service.backend.template[0].metadata[0].annotations["client.knative.dev/user-image"]
      }
      campaign = {
        url     = google_cloud_run_service.campaign.status[0].url
        version = google_cloud_run_service.campaign.template[0].metadata[0].annotations["client.knative.dev/user-image"]
      }
    }
  }
  sensitive = false
}

# Database Configuration Outputs
output "database_config" {
  description = "Database and storage systems configuration"
  value = {
    firestore_project = google_app_engine_application.firestore.project
    redis_host        = google_redis_instance.cache.host
    analytics_connection = {
      host     = google_bigquery_dataset.analytics.location
      dataset  = google_bigquery_dataset.analytics.dataset_id
      project  = google_bigquery_dataset.analytics.project
    }
  }
  sensitive = true
}

# Monitoring Configuration Outputs
output "monitoring_config" {
  description = "Monitoring infrastructure and observability endpoints"
  value = {
    workspace_id        = google_monitoring_workspace.default.name
    prometheus_service  = google_monitoring_service.prometheus.name
    grafana_service    = google_monitoring_service.grafana.name
    metrics_endpoints   = {
      prometheus = google_monitoring_service.prometheus.telemetry[0].resource_name
      grafana   = google_monitoring_service.grafana.telemetry[0].resource_name
    }
    alert_configs      = {
      for policy in google_monitoring_alert_policy.alerts : policy.display_name => {
        name        = policy.name
        conditions = policy.conditions
        notification_channels = policy.notification_channels
      }
    }
  }
  sensitive = false
}

# Security Configuration Outputs
output "security_config" {
  description = "Security infrastructure configuration"
  value = {
    waf_config = {
      policy_name = google_compute_security_policy.waf.name
      rules      = google_compute_security_policy.waf.rule
    }
    ddos_protection = {
      policy_name = google_compute_security_policy.ddos.name
      threshold   = google_compute_security_policy.ddos.adaptive_protection_config[0].layer_7_ddos_defense_config[0].threshold
    }
    ssl_certificates = {
      for cert in google_compute_managed_ssl_certificate.default : cert.name => {
        domains = cert.managed.domains
        status  = cert.certificate_id
      }
    }
  }
  sensitive = true
}

# Deployment Configuration Outputs
output "deployment_config" {
  description = "Deployment environment configuration and metadata"
  value = {
    environment = var.environment
    region      = var.region
    service_accounts = {
      for sa in google_service_account.service_accounts : sa.display_name => sa.email
    }
  }
  sensitive = false
}