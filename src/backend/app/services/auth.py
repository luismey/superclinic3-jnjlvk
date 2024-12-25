"""
Authentication service for the Porfin platform implementing secure user authentication,
token management, and session handling with comprehensive security features.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
- redis: ^4.5.0
- fastapi-limiter: ^0.1.5
- sqlalchemy: ^2.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from redis import Redis
from fastapi_limiter.depends import RateLimiter

from app.models.users import User, UserRole
from app.schemas.users import UserLogin, UserResponse
from app.core.security import verify_password, create_access_token, decode_token
from app.core.logging import get_logger
from app.core.config import settings

# Configure enhanced security logging
logger = get_logger(__name__, enable_security_logging=True)

# Configure Redis for token management
redis_client = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_timeout=1
)

# Constants for token management
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
TOKEN_BLACKLIST_PREFIX = "blacklist:"
REFRESH_TOKEN_PREFIX = "refresh:"
SESSION_PREFIX = "session:"

class AuthenticationError(HTTPException):
    """Custom exception for authentication-related errors with security logging."""
    def __init__(self, detail: str, status_code: int = status.HTTP_401_UNAUTHORIZED):
        super().__init__(status_code=status_code, detail=detail)
        logger.warning(
            "Authentication error",
            extra={
                "security_event": {
                    "type": "auth_error",
                    "detail": detail,
                    "status_code": status_code
                }
            }
        )

async def authenticate_user(
    db: Session,
    email: str,
    password: str,
    ip_address: str
) -> User:
    """
    Authenticate user with comprehensive security measures and rate limiting.

    Args:
        db: Database session
        email: User email
        password: User password
        ip_address: Client IP address for rate limiting and security tracking

    Returns:
        User: Authenticated user object

    Raises:
        AuthenticationError: If authentication fails
    """
    try:
        # Check rate limiting for IP address
        rate_key = f"login_attempts:{ip_address}"
        attempts = redis_client.incr(rate_key)
        if attempts == 1:
            redis_client.expire(rate_key, 300)  # 5 minutes window
        if attempts > 5:
            raise AuthenticationError(
                detail="Too many login attempts. Please try again later.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Query user and validate credentials
        user = db.query(User).filter(User.email == email.lower()).first()
        if not user:
            logger.warning(
                "Login attempt with non-existent email",
                extra={
                    "security_event": {
                        "type": "failed_login",
                        "email": email,
                        "ip_address": ip_address,
                        "reason": "user_not_found"
                    }
                }
            )
            raise AuthenticationError(detail="Invalid credentials")

        # Check account lockout status
        if user.account_locked_until and user.account_locked_until > datetime.utcnow():
            logger.warning(
                "Login attempt on locked account",
                extra={
                    "security_event": {
                        "type": "locked_account_attempt",
                        "user_id": str(user.id),
                        "ip_address": ip_address
                    }
                }
            )
            raise AuthenticationError(
                detail="Account is temporarily locked. Please try again later.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Verify password
        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.account_locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                logger.warning(
                    "Account locked due to multiple failed attempts",
                    extra={
                        "security_event": {
                            "type": "account_locked",
                            "user_id": str(user.id),
                            "ip_address": ip_address
                        }
                    }
                )
            db.commit()
            raise AuthenticationError(detail="Invalid credentials")

        # Reset security counters on successful login
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.last_login = datetime.utcnow()
        db.commit()

        logger.info(
            "Successful login",
            extra={
                "security_event": {
                    "type": "successful_login",
                    "user_id": str(user.id),
                    "ip_address": ip_address
                }
            }
        )
        return user

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(
            f"Authentication error: {str(e)}",
            extra={
                "security_event": {
                    "type": "auth_error",
                    "error": str(e),
                    "ip_address": ip_address
                }
            }
        )
        raise AuthenticationError(detail="Authentication failed")

async def create_user_session(
    user: User,
    session_metadata: Dict
) -> Dict:
    """
    Create new user session with secure token management.

    Args:
        user: Authenticated user object
        session_metadata: Additional session context data

    Returns:
        Dict containing session tokens and user data
    """
    try:
        # Generate access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "user_id": str(user.id),
                "role": user.role.value,
                "org_id": str(user.organization_id)
            },
            expires_delta=access_token_expires
        )

        # Generate refresh token
        refresh_token = create_access_token(
            data={
                "user_id": str(user.id),
                "token_type": "refresh",
                "session_id": session_metadata.get("session_id")
            },
            expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        )

        # Store refresh token in Redis
        refresh_key = f"{REFRESH_TOKEN_PREFIX}{user.id}"
        redis_client.setex(
            refresh_key,
            timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            refresh_token
        )

        # Store session metadata
        session_key = f"{SESSION_PREFIX}{user.id}"
        redis_client.hset(
            session_key,
            mapping={
                "session_id": session_metadata.get("session_id"),
                "ip_address": session_metadata.get("ip_address"),
                "user_agent": session_metadata.get("user_agent"),
                "created_at": datetime.utcnow().isoformat()
            }
        )

        logger.info(
            "Session created",
            extra={
                "security_event": {
                    "type": "session_created",
                    "user_id": str(user.id),
                    "session_id": session_metadata.get("session_id")
                }
            }
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": UserResponse.model_validate(user)
        }

    except Exception as e:
        logger.error(
            f"Session creation error: {str(e)}",
            extra={
                "security_event": {
                    "type": "session_creation_error",
                    "user_id": str(user.id),
                    "error": str(e)
                }
            }
        )
        raise AuthenticationError(detail="Failed to create session")

async def validate_token(token: str) -> Dict:
    """
    Validate and decode access token with comprehensive security checks.

    Args:
        token: JWT token to validate

    Returns:
        Dict containing decoded token payload

    Raises:
        AuthenticationError: If token is invalid or blacklisted
    """
    try:
        # Check token blacklist
        if redis_client.exists(f"{TOKEN_BLACKLIST_PREFIX}{token}"):
            raise AuthenticationError(detail="Token has been revoked")

        # Decode and validate token
        payload = decode_token(token)

        # Additional security checks
        if payload.get("token_type") == "refresh":
            raise AuthenticationError(detail="Invalid token type")

        return payload

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(
            f"Token validation error: {str(e)}",
            extra={
                "security_event": {
                    "type": "token_validation_error",
                    "error": str(e)
                }
            }
        )
        raise AuthenticationError(detail="Invalid token")

async def refresh_access_token(refresh_token: str) -> Dict:
    """
    Generate new access token using refresh token with secure rotation.

    Args:
        refresh_token: Valid refresh token

    Returns:
        Dict containing new access token and expiry

    Raises:
        AuthenticationError: If refresh token is invalid or expired
    """
    try:
        # Decode refresh token
        payload = decode_token(refresh_token)
        if payload.get("token_type") != "refresh":
            raise AuthenticationError(detail="Invalid token type")

        user_id = payload.get("user_id")
        stored_token = redis_client.get(f"{REFRESH_TOKEN_PREFIX}{user_id}")

        # Validate stored token
        if not stored_token or stored_token != refresh_token:
            raise AuthenticationError(detail="Invalid refresh token")

        # Generate new access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={
                "user_id": user_id,
                "role": payload.get("role"),
                "org_id": payload.get("org_id")
            },
            expires_delta=access_token_expires
        )

        logger.info(
            "Access token refreshed",
            extra={
                "security_event": {
                    "type": "token_refreshed",
                    "user_id": user_id
                }
            }
        )

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(
            f"Token refresh error: {str(e)}",
            extra={
                "security_event": {
                    "type": "token_refresh_error",
                    "error": str(e)
                }
            }
        )
        raise AuthenticationError(detail="Failed to refresh token")

async def logout_user(refresh_token: str) -> bool:
    """
    Invalidate user session and tokens securely.

    Args:
        refresh_token: Refresh token to invalidate

    Returns:
        bool: True if logout successful
    """
    try:
        # Decode refresh token
        payload = decode_token(refresh_token)
        user_id = payload.get("user_id")

        # Add access token to blacklist
        blacklist_key = f"{TOKEN_BLACKLIST_PREFIX}{refresh_token}"
        redis_client.setex(
            blacklist_key,
            timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "1"
        )

        # Remove refresh token and session data
        redis_client.delete(f"{REFRESH_TOKEN_PREFIX}{user_id}")
        redis_client.delete(f"{SESSION_PREFIX}{user_id}")

        logger.info(
            "User logged out",
            extra={
                "security_event": {
                    "type": "logout",
                    "user_id": user_id
                }
            }
        )

        return True

    except Exception as e:
        logger.error(
            f"Logout error: {str(e)}",
            extra={
                "security_event": {
                    "type": "logout_error",
                    "error": str(e)
                }
            }
        )
        return False