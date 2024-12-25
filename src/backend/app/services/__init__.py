"""
Main entry point for the Porfin platform's service layer.
Exposes core service components with comprehensive monitoring and security controls.

Version: 1.0.0
Dependencies:
- opentelemetry-api: ^1.20.0
- prometheus_client: ^0.17.1
"""

from typing import Dict, Any
import time
import logging

from opentelemetry import trace
from prometheus_client import Counter, Histogram

# Internal imports
from .auth import authenticate_user, create_user_tokens, refresh_access_token
from .ai.assistant_manager import AssistantManager, create_assistant_manager
from .whatsapp.message_handler import MessageHandler

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Version tracking
VERSION = "1.0.0"

# Performance thresholds (milliseconds)
PERFORMANCE_THRESHOLDS = {
    "api_response_ms": 200,
    "message_processing_ms": 500,
    "database_query_ms": 100
}

# Prometheus metrics
service_calls = Counter(
    "service_calls_total",
    "Total number of service calls",
    ["service", "method", "status"]
)

response_time = Histogram(
    "service_response_time_seconds",
    "Service response time in seconds",
    ["service", "method"],
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
)

# Configure logger with performance monitoring
logger = logging.getLogger(__name__)

def monitor_performance(service: str, method: str):
    """
    Decorator for monitoring service performance and logging metrics.
    
    Args:
        service: Service name for metric tracking
        method: Method name for metric tracking
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            with tracer.start_as_current_span(f"{service}.{method}") as span:
                try:
                    # Execute service call
                    result = await func(*args, **kwargs)
                    
                    # Calculate response time
                    response_time_ms = (time.time() - start_time) * 1000
                    
                    # Update metrics
                    service_calls.labels(
                        service=service,
                        method=method,
                        status="success"
                    ).inc()
                    
                    response_time.labels(
                        service=service,
                        method=method
                    ).observe(response_time_ms / 1000)  # Convert to seconds
                    
                    # Check performance thresholds
                    threshold = PERFORMANCE_THRESHOLDS.get(f"{service}_ms", 200)
                    if response_time_ms > threshold:
                        logger.warning(
                            f"Performance threshold exceeded",
                            extra={
                                "service": service,
                                "method": method,
                                "response_time_ms": response_time_ms,
                                "threshold_ms": threshold
                            }
                        )
                    
                    # Add tracing data
                    span.set_attribute("service.name", service)
                    span.set_attribute("service.method", method)
                    span.set_attribute("response_time_ms", response_time_ms)
                    
                    return result
                    
                except Exception as e:
                    # Track error metrics
                    service_calls.labels(
                        service=service,
                        method=method,
                        status="error"
                    ).inc()
                    
                    # Add error context to span
                    span.set_attribute("error", True)
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    
                    logger.error(
                        f"Service error in {service}.{method}",
                        extra={
                            "error": str(e),
                            "service": service,
                            "method": method
                        },
                        exc_info=True
                    )
                    raise
                    
        return wrapper
    return decorator

# Enhanced authentication service exports
@monitor_performance("auth", "authenticate")
async def enhanced_authenticate_user(*args, **kwargs) -> Dict[str, Any]:
    """Enhanced user authentication with performance monitoring."""
    return await authenticate_user(*args, **kwargs)

@monitor_performance("auth", "create_tokens")
async def enhanced_create_user_tokens(*args, **kwargs) -> Dict[str, Any]:
    """Enhanced token creation with performance monitoring."""
    return await create_user_tokens(*args, **kwargs)

@monitor_performance("auth", "refresh_token")
async def enhanced_refresh_access_token(*args, **kwargs) -> Dict[str, Any]:
    """Enhanced token refresh with performance monitoring."""
    return await refresh_access_token(*args, **kwargs)

# Enhanced AI assistant service exports
@monitor_performance("assistant", "create")
async def enhanced_create_assistant_manager(*args, **kwargs) -> AssistantManager:
    """Enhanced assistant manager creation with performance monitoring."""
    return await create_assistant_manager(*args, **kwargs)

# Export monitored service components
__all__ = [
    # Version info
    "VERSION",
    
    # Authentication services
    "enhanced_authenticate_user",
    "enhanced_create_user_tokens",
    "enhanced_refresh_access_token",
    
    # AI assistant services
    "AssistantManager",
    "enhanced_create_assistant_manager",
    
    # WhatsApp services
    "MessageHandler",
    
    # Performance monitoring
    "monitor_performance",
    "PERFORMANCE_THRESHOLDS"
]