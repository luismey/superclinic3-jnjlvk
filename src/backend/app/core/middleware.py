"""
Enterprise-grade middleware module implementing secure request processing,
rate limiting, authentication, and monitoring for FastAPI applications.

Version: 1.0.0
"""

import time
import uuid
from typing import Callable, Dict, Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import logging
import contextvars

from app.core.config import DEBUG, ENVIRONMENT, ALLOWED_ORIGINS
from app.core.rate_limiter import TokenBucketRateLimiter
from app.core.security import verify_token
from app.core.exceptions import RateLimitError, AuthenticationError

# Configure logging
logger = logging.getLogger(__name__)

# Define paths that skip certain middleware
SKIP_PATHS = ['/health', '/metrics', '/docs', '/redoc', '/openapi.json']

# Request context for distributed tracing
request_id_var = contextvars.ContextVar('request_id')

class RequestLoggingMiddleware:
    """
    Enhanced request logging middleware with performance tracking and security context.
    """
    
    def __init__(self, app: FastAPI, log_config: Optional[Dict] = None):
        """Initialize logging middleware with configurable options."""
        self.app = app
        self.log_config = log_config or {}
        
        # Configure logging format based on environment
        if ENVIRONMENT == "production":
            self.log_level = logging.INFO
            self.include_headers = False
        else:
            self.log_level = logging.DEBUG
            self.include_headers = True

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Process request with comprehensive logging and timing."""
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request_id_var.set(request_id)
        
        # Record start time with high precision
        start_time = time.perf_counter()
        
        # Log request details
        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host,
            "user_agent": request.headers.get("user-agent")
        }
        
        if self.include_headers:
            # Filter sensitive headers
            safe_headers = {k: v for k, v in request.headers.items() 
                          if k.lower() not in {"authorization", "cookie"}}
            log_data["headers"] = safe_headers
            
        logger.info(f"Request started: {request.method} {request.url.path}", extra=log_data)
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate request duration
            duration = time.perf_counter() - start_time
            
            # Add response context
            log_data.update({
                "status_code": response.status_code,
                "duration": f"{duration:.3f}s",
                "content_length": response.headers.get("content-length")
            })
            
            # Log response
            log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(log_level, f"Request completed: {response.status_code}", extra=log_data)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log error with full context
            duration = time.perf_counter() - start_time
            log_data.update({
                "error": str(e),
                "duration": f"{duration:.3f}s"
            })
            logger.error("Request failed", extra=log_data, exc_info=True)
            raise
        finally:
            # Clean up request context
            request_id_var.set(None)

class RateLimitMiddleware:
    """
    Advanced rate limiting middleware with Redis backend and circuit breaker.
    """
    
    def __init__(self, app: FastAPI, rate_config: Optional[Dict] = None):
        """Initialize rate limiter with configurable limits."""
        self.app = app
        self.rate_config = rate_config or {}
        self.limiter = TokenBucketRateLimiter(
            key_prefix="api",
            max_tokens=self.rate_config.get("max_requests", 100),
            refill_period=self.rate_config.get("period", 60),
            adaptive_limiting=True
        )

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting with comprehensive error handling."""
        # Skip rate limiting for excluded paths
        if request.url.path in SKIP_PATHS:
            return await call_next(request)
            
        # Get client identifier (IP or user ID)
        identifier = request.client.host
        if hasattr(request.state, "user"):
            identifier = f"user:{request.state.user.id}"
            
        try:
            # Check rate limit
            result = await self.limiter.check_rate_limit(identifier)
            
            if not result["allowed"]:
                raise RateLimitError(details={
                    "retry_after": result["retry_after"],
                    "limit": result["limit"],
                    "remaining": 0
                })
                
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers.update({
                "X-RateLimit-Limit": str(result["limit"]),
                "X-RateLimit-Remaining": str(result["remaining"]),
                "X-RateLimit-Reset": str(result["reset"])
            })
            
            return response
            
        except RateLimitError as e:
            # Log rate limit violation
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "client_id": identifier,
                    "path": request.url.path,
                    "retry_after": e.details.get("retry_after")
                }
            )
            raise

class AuthenticationMiddleware:
    """
    Secure authentication middleware with enhanced token validation.
    """
    
    def __init__(self, app: FastAPI, auth_config: Optional[Dict] = None):
        """Initialize authentication middleware with security options."""
        self.app = app
        self.auth_config = auth_config or {}
        self.public_paths = set(SKIP_PATHS)
        if "public_paths" in self.auth_config:
            self.public_paths.update(self.auth_config["public_paths"])

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Validate authentication with comprehensive security checks."""
        # Skip authentication for public paths
        if request.url.path in self.public_paths:
            return await call_next(request)
            
        # Extract token from header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise AuthenticationError("Missing or invalid authorization header")
            
        token = auth_header.split(" ")[1]
        
        try:
            # Verify token and extract payload
            payload = verify_token(token)
            
            # Add user context to request state
            request.state.user = payload
            
            # Process request
            response = await call_next(request)
            
            # Add security headers
            response.headers.update({
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-XSS-Protection": "1; mode=block",
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
            })
            
            return response
            
        except Exception as e:
            logger.error(
                "Authentication failed",
                extra={
                    "path": request.url.path,
                    "error": str(e),
                    "client_ip": request.client.host
                }
            )
            raise AuthenticationError()

def setup_middleware(app: FastAPI, config: Optional[Dict] = None) -> None:
    """
    Configure all middleware with secure defaults and monitoring.
    
    Args:
        app: FastAPI application instance
        config: Optional middleware configuration
    """
    config = config or {}
    
    # Add security headers middleware
    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        })
        return response
    
    # Configure CORS with strict options
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=3600,
        expose_headers=["X-Request-ID", "X-RateLimit-*"]
    )
    
    # Add request logging middleware
    app.add_middleware(
        RequestLoggingMiddleware,
        log_config=config.get("logging", {})
    )
    
    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        rate_config=config.get("rate_limit", {})
    )
    
    # Add authentication middleware
    app.add_middleware(
        AuthenticationMiddleware,
        auth_config=config.get("auth", {})
    )