"""
FastAPI API router initialization module implementing versioned API routing,
security controls, rate limiting, and monitoring across all endpoints.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
- fastapi-limiter: ^0.1.5
- prometheus-client: ^0.16.0
"""

import logging
from typing import Callable
from fastapi import APIRouter, Depends, Request, Response
from prometheus_client import Counter, Histogram

# Internal imports
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.assistants import router as assistants_router
from app.core.security import RateLimiter
from app.core.logging import get_logger

# Configure enhanced logging
logger = get_logger(__name__, enable_security_logging=True)

# Initialize metrics
request_counter = Counter(
    "api_requests_total",
    "Total API requests",
    ["method", "endpoint", "status"]
)

latency_histogram = Histogram(
    "api_request_latency_seconds",
    "API request latency",
    ["method", "endpoint"]
)

# Initialize main API router
api_router = APIRouter(prefix="/api/v1", tags=["v1"])

# Initialize rate limiter
rate_limiter = RateLimiter(rate_limit=100, time_window=60)

async def metrics_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware for tracking request metrics and performance.

    Args:
        request: FastAPI request object
        call_next: Next middleware in chain

    Returns:
        Response: FastAPI response object
    """
    # Start timing
    with latency_histogram.labels(
        method=request.method,
        endpoint=request.url.path
    ).time():
        # Process request
        response = await call_next(request)

        # Update request metrics
        request_counter.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        return response

async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware for enhanced request logging with security context.

    Args:
        request: FastAPI request object
        call_next: Next middleware in chain

    Returns:
        Response: FastAPI response object
    """
    # Log request
    logger.info(
        f"Request: {request.method} {request.url.path}",
        extra={
            "security_event": {
                "type": "api_request",
                "method": request.method,
                "path": request.url.path,
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent")
            }
        }
    )

    # Process request
    response = await call_next(request)

    # Log response
    logger.info(
        f"Response: {response.status_code}",
        extra={
            "security_event": {
                "type": "api_response",
                "status_code": response.status_code,
                "path": request.url.path
            }
        }
    )

    return response

def setup_routers() -> APIRouter:
    """
    Configure and combine all v1 API routers with proper middleware and error handling.

    Returns:
        APIRouter: Configured v1 API router with all endpoints
    """
    try:
        # Add middleware
        api_router.middleware("http")(metrics_middleware)
        api_router.middleware("http")(logging_middleware)

        # Include routers with proper prefixes
        api_router.include_router(
            auth_router,
            prefix="/auth",
            tags=["authentication"]
        )
        api_router.include_router(
            users_router,
            prefix="/users",
            tags=["users"]
        )
        api_router.include_router(
            assistants_router,
            prefix="/assistants",
            tags=["assistants"]
        )

        logger.info("API routers configured successfully")
        return api_router

    except Exception as e:
        logger.error(f"Router setup failed: {str(e)}")
        raise

# Initialize routers on module import
api_router = setup_routers()

# Export configured router
__all__ = ["api_router"]