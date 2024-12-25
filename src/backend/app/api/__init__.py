"""
Main API initialization module implementing versioned routing, error handling,
and security controls for the Porfin platform.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
"""

import logging
from typing import Dict
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.api.v1 import api_router
from app.core.config import settings
from app.core.logging import get_logger

# Configure enhanced logging
logger = get_logger(__name__, enable_security_logging=True)

# Initialize root API router with base configuration
root_router = APIRouter(
    prefix="/api",
    tags=["api"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

@root_router.exception_handler(HTTPException)
async def handle_api_error(request: Request, exc: HTTPException) -> Dict:
    """
    Global error handler for API exceptions with enhanced logging and tracking.

    Args:
        request: FastAPI request object
        exc: Raised HTTP exception

    Returns:
        Dict: Formatted error response with tracking information
    """
    # Generate request ID for tracking if not present
    request_id = getattr(request.state, "request_id", str(uuid4()))

    # Log error with security context
    logger.error(
        f"API error: {exc.detail}",
        extra={
            "security_event": {
                "type": "api_error",
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
                "request_id": request_id,
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent")
            }
        }
    )

    # Format error response
    error_response = {
        "status_code": exc.status_code,
        "message": exc.detail,
        "request_id": request_id
    }

    # Add debug information in development
    if settings.DEBUG:
        error_response["path"] = request.url.path
        error_response["method"] = request.method

    return error_response

def setup_api_router() -> APIRouter:
    """
    Configure and initialize the main API router with versioning support.

    Returns:
        APIRouter: Configured root API router
    """
    try:
        # Include versioned routers
        root_router.include_router(
            api_router,
            prefix=settings.API_V1_PREFIX
        )

        logger.info(
            "API router configured successfully",
            extra={
                "security_event": {
                    "type": "router_setup",
                    "versions": ["v1"]
                }
            }
        )

        return root_router

    except Exception as e:
        logger.error(
            f"API router setup failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "router_setup_error",
                    "error": str(e)
                }
            }
        )
        raise

# Initialize API router on module import
api_router = setup_api_router()

# Export configured router
__all__ = ["api_router"]