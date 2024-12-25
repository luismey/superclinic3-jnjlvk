"""
Core module initialization file that serves as the public API for the core package.
Exposes essential functionality from configuration, security, and exception handling submodules.

Version: 1.0.0
"""

# Configuration imports
from app.core.config import (
    Settings,
    get_settings,
)

# Security imports
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token,
)

# Exception imports
from app.core.exceptions import (
    BaseAPIException,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    RateLimitError,
)

# Version information
__version__ = "1.0.0"

# Public API exports
__all__ = [
    # Configuration exports
    "Settings",
    "get_settings",
    
    # Security exports
    "verify_password",
    "get_password_hash", 
    "create_access_token",
    "verify_token",
    
    # Exception exports
    "BaseAPIException",
    "AuthenticationError",
    "AuthorizationError", 
    "ValidationError",
    "NotFoundError",
    "RateLimitError",
]

# Module documentation
CORE_MODULE_DESCRIPTION = """
Core functionality module providing:
- Application configuration management
- Security and authentication services  
- Exception handling and error responses
- Logging and monitoring capabilities

This module serves as the central point for core application services while
maintaining strict security practices and clean public interfaces.
"""