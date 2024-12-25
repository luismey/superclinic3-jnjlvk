"""
Main FastAPI application entry point implementing comprehensive production-ready features
including monitoring, security, and reliability mechanisms.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
- uvicorn: ^0.23.0
- opentelemetry: ^1.20.0
- prometheus-client: ^0.16.0
- structlog: ^23.1.0
"""

import asyncio
import logging
import signal
from contextlib import asynccontextmanager
from typing import Dict, List

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace, metrics
from prometheus_client import Counter, Histogram
import structlog

from app.core.config import settings, PROJECT_NAME, DEBUG, VERSION
from app.core.middleware import setup_middleware
from app.core.logging import setup_logging
from app.api.v1 import api_router
from app.db.session import init_db

# Configure structured logging
logger = structlog.get_logger(__name__)

# Initialize metrics
request_counter = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

response_time = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"]
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle events including startup and shutdown procedures.
    """
    try:
        # Initialize database
        logger.info("Initializing database connection")
        await init_db()

        # Initialize OpenTelemetry tracing
        tracer_provider = trace.get_tracer_provider()
        tracer = tracer_provider.get_tracer(__name__)

        # Initialize metrics
        metrics_reader = metrics.get_meter_provider().get_meter(__name__)

        # Start background tasks
        logger.info("Starting background tasks")
        yield

    except Exception as e:
        logger.error(f"Startup error: {str(e)}")
        raise
    finally:
        # Cleanup resources
        logger.info("Shutting down application")
        # Ensure all metrics are flushed
        await metrics_reader.shutdown()
        # Close tracer provider
        await tracer_provider.shutdown()

def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application with comprehensive production features.

    Returns:
        FastAPI: Configured application instance
    """
    app = FastAPI(
        title=PROJECT_NAME,
        version=VERSION,
        debug=DEBUG,
        lifespan=lifespan,
        docs_url="/api/docs" if DEBUG else None,
        redoc_url="/api/redoc" if DEBUG else None,
        openapi_url="/api/openapi.json" if DEBUG else None
    )

    # Set up logging
    setup_logging()

    # Configure middleware with security and monitoring
    setup_middleware(app, {
        "logging": {"level": "INFO"},
        "rate_limit": {
            "max_requests": settings.RATE_LIMIT_REQUESTS,
            "period": settings.RATE_LIMIT_PERIOD
        },
        "auth": {
            "public_paths": ["/health", "/metrics"]
        }
    })

    # Add health check endpoint
    @app.get("/health", tags=["monitoring"])
    async def health_check() -> Dict:
        """Comprehensive health check endpoint."""
        return {
            "status": "healthy",
            "version": VERSION,
            "environment": settings.ENVIRONMENT
        }

    # Include API router
    app.include_router(
        api_router,
        prefix=settings.API_V1_PREFIX
    )

    # Add exception handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> Response:
        """Global exception handler with error tracking."""
        logger.error(
            "Unhandled exception",
            exc_info=exc,
            request_id=request.state.request_id,
            path=request.url.path
        )
        return Response(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    return app

def setup_signal_handlers() -> None:
    """Configure graceful shutdown handlers for system signals."""
    def handle_signal(signum: int, frame) -> None:
        logger.info(f"Received signal {signum}")
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

def main() -> None:
    """
    Main entry point for running the application with production configurations.
    """
    # Configure signal handlers
    setup_signal_handlers()

    # Create application
    app = create_application()

    # Configure uvicorn with production settings
    uvicorn_config = {
        "app": "main:app",
        "host": "0.0.0.0",
        "port": 8000,
        "workers": 4,
        "loop": "uvloop",
        "http": "httptools",
        "log_level": "info",
        "proxy_headers": True,
        "forwarded_allow_ips": "*",
        "timeout_keep_alive": 30,
        "ssl_keyfile": settings.SSL_KEYFILE if not DEBUG else None,
        "ssl_certfile": settings.SSL_CERTFILE if not DEBUG else None,
    }

    # Start server
    uvicorn.run(**uvicorn_config)

# Create application instance
app = create_application()

if __name__ == "__main__":
    main()