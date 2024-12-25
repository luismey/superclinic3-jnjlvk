"""
Initialization module for test_api package providing shared test utilities,
constants, and fixtures for testing FastAPI endpoints.

pytest version: ^7.0.0
fastapi version: ^0.100.0
"""

import logging
from typing import Dict

import pytest
from tests.conftest import test_client, test_db, test_user

# Configure logging
logger = logging.getLogger(__name__)

# API version prefix from core config
API_V1_PREFIX = "/api/v1"

# Default test request headers
TEST_HEADERS = {
    "Content-Type": "application/json"
}

def get_auth_headers(token: str) -> Dict[str, str]:
    """
    Generate authentication headers for API tests with proper token format.
    
    Args:
        token: JWT access token string
        
    Returns:
        Dict[str, str]: Headers dictionary with authorization token
        
    Example:
        >>> headers = get_auth_headers("abc123")
        >>> headers
        {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer abc123'
        }
    """
    try:
        # Validate token input
        if not token or not isinstance(token, str):
            raise ValueError("Invalid token format")
            
        # Create headers with auth token
        headers = TEST_HEADERS.copy()
        headers["Authorization"] = f"Bearer {token}"
        
        logger.debug(f"Generated auth headers for token: {token[:8]}...")
        return headers
        
    except Exception as e:
        logger.error(f"Error generating auth headers: {str(e)}")
        raise

# Export test fixtures from conftest
__all__ = [
    "API_V1_PREFIX",
    "TEST_HEADERS",
    "get_auth_headers",
    "test_client",
    "test_db", 
    "test_user"
]