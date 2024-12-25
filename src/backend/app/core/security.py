"""
Enterprise-grade security module for FastAPI backend implementing secure authentication,
authorization, and token management with comprehensive security features.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import secrets
import logging

from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# JWT configuration
ALGORITHM = "HS256"
JWT_SUBJECT = "access"
JWT_VERSION = "1.0"

# Configure password hashing context with bcrypt
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.SECURITY_BCRYPT_ROUNDS,
    bcrypt__salt_size=16
)

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a secure JWT access token with enhanced security features.
    
    Args:
        data: Dictionary containing claims to encode in the token
        expires_delta: Optional custom expiration time, defaults to settings value
        
    Returns:
        str: Encoded JWT token
        
    Raises:
        ValueError: If data is invalid or token creation fails
    """
    try:
        # Validate input data
        if not isinstance(data, dict):
            raise ValueError("Token data must be a dictionary")

        # Create a copy to prevent mutation of input data
        token_data = data.copy()
        
        # Set token expiration
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        # Add security claims
        token_data.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": JWT_SUBJECT,
            "ver": JWT_VERSION,
            "jti": secrets.token_urlsafe(32)  # Unique token ID
        })

        # Encode token
        encoded_jwt = jwt.encode(
            token_data,
            settings.SECRET_KEY.get_secret_value(),
            algorithm=ALGORITHM
        )

        # Verify token can be decoded before returning
        decode_token(encoded_jwt)
        
        return encoded_jwt

    except Exception as e:
        logger.error(f"Token creation failed: {str(e)}")
        raise ValueError("Failed to create access token") from e

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash using constant-time comparison.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Bcrypt hash to verify against
        
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        # Validate inputs
        if not plain_password or not hashed_password:
            return False

        # Verify using constant-time comparison
        is_valid = pwd_context.verify(plain_password, hashed_password)
        
        # Log failed attempts (without passwords)
        if not is_valid:
            logger.warning("Failed password verification attempt")
            
        return is_valid

    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    """
    Generate a secure password hash using bcrypt with random salt.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        str: Bcrypt hash of the password
        
    Raises:
        ValueError: If password is invalid or hashing fails
    """
    try:
        # Validate password
        if not password or len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        # Generate hash with automatic salt
        hashed = pwd_context.hash(password)
        
        # Verify hash can be validated
        if not pwd_context.identify(hashed):
            raise ValueError("Generated hash validation failed")
            
        return hashed

    except Exception as e:
        logger.error("Password hashing failed")
        raise ValueError("Failed to hash password") from e

def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT token with comprehensive security checks.
    
    Args:
        token: JWT token string to decode and validate
        
    Returns:
        Dict[str, Any]: Decoded token payload
        
    Raises:
        JWTError: If token is invalid or verification fails
        ValueError: If token format or claims are invalid
    """
    try:
        # Validate token format
        if not token or not isinstance(token, str):
            raise ValueError("Invalid token format")

        # Decode and verify token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=[ALGORITHM]
        )

        # Validate required claims
        if not all(k in payload for k in ["sub", "exp", "jti", "ver"]):
            raise ValueError("Missing required token claims")

        # Verify token type and version
        if payload.get("sub") != JWT_SUBJECT:
            raise ValueError("Invalid token subject")
        if payload.get("ver") != JWT_VERSION:
            raise ValueError("Invalid token version")

        # Verify expiration (jose library handles this, but double-check)
        exp = datetime.fromtimestamp(payload.get("exp"))
        if datetime.utcnow() >= exp:
            raise ValueError("Token has expired")

        return payload

    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise
    except ValueError as e:
        logger.error(f"Token validation error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected token decode error: {str(e)}")
        raise ValueError("Token validation failed") from e