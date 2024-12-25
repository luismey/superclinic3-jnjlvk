# fastapi v0.100.0
# python-json-logger v2.0.0

import time
import uuid
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import DEBUG, ENVIRONMENT
from app.core.logging import get_logger

# Configure logger with security logging enabled
logger = get_logger(__name__, enable_security_logging=True)

# Standard error messages with security-conscious wording
ERROR_RESPONSES = {
    "VALIDATION_ERROR": "Invalid request parameters",
    "AUTHENTICATION_ERROR": "Authentication failed",
    "AUTHORIZATION_ERROR": "Insufficient permissions",
    "RATE_LIMIT_ERROR": "Rate limit exceeded",
    "NOT_FOUND_ERROR": "Resource not found",
    "WHATSAPP_ERROR": "WhatsApp service error",
    "INTERNAL_ERROR": "Internal server error",
    "DATABASE_ERROR": "Database operation failed",
    "INTEGRATION_ERROR": "External service integration failed"
}

# Security headers for all error responses
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block"
}

class BaseAPIException(HTTPException):
    """
    Base exception class for all API errors with enhanced security features.
    
    Attributes:
        message (str): User-safe error message
        status_code (int): HTTP status code
        details (dict): Additional error details (filtered in production)
        correlation_id (str): Unique identifier for error tracking
        response_headers (dict): Security headers for response
    """
    
    def __init__(
        self,
        message: str,
        status_code: int,
        details: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None
    ) -> None:
        """Initialize base API exception with security controls."""
        # Validate status code
        if not 100 <= status_code <= 599:
            raise ValueError("Invalid HTTP status code")
            
        self.message = self._sanitize_message(message)
        self.status_code = status_code
        self.details = self._filter_details(details or {})
        self.correlation_id = correlation_id or str(uuid.uuid4())
        self.response_headers = SECURITY_HEADERS.copy()
        
        # Log error with correlation ID
        log_data = {
            "correlation_id": self.correlation_id,
            "status_code": self.status_code,
            "error_type": self.__class__.__name__
        }
        
        if ENVIRONMENT != "production":
            log_data["details"] = self.details
            
        logger.error(self.message, extra=log_data)
        
        super().__init__(status_code=status_code, detail=self.message)

    def _sanitize_message(self, message: str) -> str:
        """Remove potentially sensitive information from error messages."""
        # Use standard error messages where possible
        for standard_msg in ERROR_RESPONSES.values():
            if message.lower() == standard_msg.lower():
                return standard_msg
                
        # Sanitize custom messages
        sensitive_terms = ["password", "token", "key", "secret", "credential"]
        message_lower = message.lower()
        
        for term in sensitive_terms:
            if term in message_lower:
                return ERROR_RESPONSES["INTERNAL_ERROR"]
                
        return message

    def _filter_details(self, details: Dict[str, Any]) -> Dict[str, Any]:
        """Filter sensitive information from error details."""
        if ENVIRONMENT == "production" and not DEBUG:
            return {}
            
        filtered_details = details.copy()
        sensitive_keys = {"password", "token", "key", "secret", "credential"}
        
        def filter_dict(d: Dict[str, Any]) -> Dict[str, Any]:
            return {
                k: "********" if any(s in k.lower() for s in sensitive_keys)
                else filter_dict(v) if isinstance(v, dict)
                else v
                for k, v in d.items()
            }
            
        return filter_dict(filtered_details)

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary format with security controls."""
        response = {
            "error": {
                "message": self.message,
                "code": self.status_code,
                "correlation_id": self.correlation_id,
                "timestamp": int(time.time())
            }
        }
        
        if DEBUG and ENVIRONMENT != "production":
            response["error"]["details"] = self.details
            
        return response

class AuthenticationError(BaseAPIException):
    """Exception for authentication failures with enhanced security logging."""
    
    def __init__(
        self,
        message: str = ERROR_RESPONSES["AUTHENTICATION_ERROR"],
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize authentication error with security logging."""
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details
        )
        
        # Add WWW-Authenticate header
        self.response_headers["WWW-Authenticate"] = "Bearer"
        
        # Log authentication failure with security context
        logger.warning(
            "Authentication failure",
            extra={
                "security_event": {
                    "event_type": "authentication_failure",
                    "correlation_id": self.correlation_id
                }
            }
        )

async def handle_validation_error(exc: RequestValidationError) -> JSONResponse:
    """
    Handle request validation errors with security filtering.
    
    Args:
        exc: The validation error exception
        
    Returns:
        JSONResponse: Filtered and formatted error response
    """
    correlation_id = str(uuid.uuid4())
    
    # Extract and sanitize validation errors
    error_details = []
    for error in exc.errors():
        # Remove sensitive field information
        error_location = " -> ".join(str(loc) for loc in error["loc"] if loc != "body")
        error_details.append({
            "location": error_location,
            "type": error["type"],
            "message": error["msg"]
        })
    
    response_data = {
        "error": {
            "message": ERROR_RESPONSES["VALIDATION_ERROR"],
            "code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "correlation_id": correlation_id,
            "timestamp": int(time.time())
        }
    }
    
    if DEBUG and ENVIRONMENT != "production":
        response_data["error"]["details"] = error_details
    
    # Log validation error
    logger.warning(
        "Request validation failed",
        extra={
            "correlation_id": correlation_id,
            "error_count": len(error_details)
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_data,
        headers=SECURITY_HEADERS
    )

async def handle_api_error(exc: BaseAPIException) -> JSONResponse:
    """
    Handle custom API exceptions with security controls.
    
    Args:
        exc: The API exception
        
    Returns:
        JSONResponse: Secure formatted error response
    """
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        headers=exc.response_headers
    )