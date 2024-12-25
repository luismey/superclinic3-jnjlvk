"""
Enterprise-grade FastAPI backend initialization module implementing secure application setup,
comprehensive middleware stack, and monitoring infrastructure.

Version: 1.0.0
"""

# fastapi v0.100.0
# fastapi-cors v0.100.0
# opentelemetry-instrumentation-fastapi v0.39.0
# prometheus-fastapi-instrumentator v6.1.0

import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import (
    PROJECT_NAME,
    DEBUG,
    ENVIRONMENT,
    API_V1_PREFIX,
    ALLOWED_HOSTS
)
from app.core.logging import setup_logging
from app.core.middleware import setup_middleware
from app.core.exceptions import (
    handle_validation_error,
    handle_api_error,
    BaseAPIException
)

# Initialize logging
logger = logging.getLogger(__name__)

# Create API router
api_router = APIRouter()

def create_application() -> FastAPI:
    """
    Factory function that creates and configures a FastAPI application instance
    with comprehensive security, monitoring, and middleware setup.

    Returns:
        FastAPI: Fully configured FastAPI application instance
    """
    # Initialize structured JSON logging
    setup_logging()
    logger.info(
        f"Initializing {PROJECT_NAME} application",
        extra={"environment": ENVIRONMENT}
    )

    # Create FastAPI instance with security-focused configuration
    app = FastAPI(
        title=PROJECT_NAME,
        debug=DEBUG,
        docs_url=None if ENVIRONMENT == "production" else "/docs",
        redoc_url=None if ENVIRONMENT == "production" else "/redoc",
        openapi_url=None if ENVIRONMENT == "production" else "/openapi.json",
        swagger_ui_oauth2_redirect_url=None,
        swagger_ui_parameters={"persistAuthorization": True},
    )

    # Configure exception handlers
    app.add_exception_handler(BaseAPIException, handle_api_error)
    app.add_exception_handler(Exception, handle_validation_error)

    # Configure security headers and middleware stack
    setup_middleware(app, {
        "logging": {
            "log_request_body": not DEBUG,
            "log_response_body": False
        },
        "rate_limit": {
            "max_requests": 100,
            "period": 60
        },
        "auth": {
            "public_paths": ["/health", "/metrics"]
        }
    })

    # Configure CORS with strict security settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_HOSTS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=3600,
        expose_headers=["X-Request-ID", "X-RateLimit-*"]
    )

    # Mount API router with version prefix
    app.include_router(api_router, prefix=API_V1_PREFIX)

    # Add health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy", "environment": ENVIRONMENT}

    # Configure OpenTelemetry instrumentation
    if not DEBUG:
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="health,metrics",
            trace_id_source="request"
        )

    # Configure Prometheus metrics
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

    # Startup event handler
    @app.on_event("startup")
    async def startup_event():
        logger.info(
            f"{PROJECT_NAME} startup complete",
            extra={
                "environment": ENVIRONMENT,
                "debug_mode": DEBUG
            }
        )

    # Shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info(
            f"{PROJECT_NAME} shutdown initiated",
            extra={"environment": ENVIRONMENT}
        )

    # Request event handlers for additional security and monitoring
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        })
        return response

    return app