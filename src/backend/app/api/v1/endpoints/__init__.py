"""
FastAPI router initialization and configuration for v1 API endpoints.
Implements comprehensive request handling, validation, and security controls.

Version: 1.0.0
"""

from fastapi import APIRouter, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

# Import individual endpoint routers
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.organizations import router as organizations_router
from app.api.v1.endpoints.assistants import router as assistants_router
from app.api.v1.endpoints.campaigns import router as campaigns_router
from app.api.v1.endpoints.chats import router as chats_router
from app.api.v1.endpoints.messages import router as messages_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.webhooks import router as webhooks_router

# Import core utilities
from app.core.logging import get_logger
from app.core.exceptions import handle_validation_error, handle_api_error
from app.core.config import settings

# Configure logger with security and performance monitoring
logger = get_logger(__name__, enable_security_logging=True, enable_performance_logging=True)

# Initialize main API router with prefix and default responses
api_router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

def configure_router(router: APIRouter) -> APIRouter:
    """
    Configure the main API router with middleware, error handlers, and security controls.

    Args:
        router: FastAPI router instance to configure

    Returns:
        APIRouter: Configured router with all endpoints and middleware
    """
    try:
        # Configure CORS middleware with secure defaults
        router.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"]
        )

        # Add request validation error handler
        router.add_exception_handler(
            RequestValidationError,
            handle_validation_error
        )

        # Add API error handler
        router.add_exception_handler(
            Exception,
            handle_api_error
        )

        # Include all endpoint routers with appropriate prefixes
        router.include_router(auth_router, prefix="/auth", tags=["authentication"])
        router.include_router(users_router, prefix="/users", tags=["users"])
        router.include_router(organizations_router, prefix="/organizations", tags=["organizations"])
        router.include_router(assistants_router, prefix="/assistants", tags=["assistants"])
        router.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
        router.include_router(chats_router, prefix="/chats", tags=["chats"])
        router.include_router(messages_router, prefix="/messages", tags=["messages"])
        router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
        router.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])

        # Add request ID middleware
        @router.middleware("http")
        async def add_request_id(request: Request, call_next):
            request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
            request.state.request_id = request_id
            
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            
            return response

        # Add response validation
        @router.middleware("http")
        async def validate_responses(request: Request, call_next):
            response = await call_next(request)
            
            # Add security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            
            return response

        # Enable OpenAPI documentation in non-production environments
        if settings.ENVIRONMENT != "production":
            router.openapi_url = "/openapi.json"
            router.docs_url = "/docs"
            router.redoc_url = "/redoc"
        else:
            router.openapi_url = None
            router.docs_url = None
            router.redoc_url = None

        logger.info("API router configured successfully")
        return router

    except Exception as e:
        logger.error(f"Error configuring API router: {str(e)}")
        raise

# Configure and export the API router
api_router = configure_router(api_router)

# Export configured routers
__all__ = [
    "api_router",
    "auth_router",
    "users_router", 
    "organizations_router",
    "assistants_router",
    "campaigns_router",
    "chats_router",
    "messages_router",
    "analytics_router",
    "webhooks_router"
]