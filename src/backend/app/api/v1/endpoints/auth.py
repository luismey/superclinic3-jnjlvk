"""
Authentication endpoints for the Porfin platform implementing secure authentication flows,
token management, and comprehensive security controls.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
- sqlalchemy: ^2.0.0
"""

from datetime import datetime
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.security import SecurityScopes
from sqlalchemy.orm import Session

from app.services.auth import (
    authenticate_user,
    create_user_session,
    validate_token,
    refresh_access_token,
    logout_user,
    blacklist_token
)
from app.schemas.users import (
    UserLogin,
    UserCreate,
    UserResponse,
    TokenResponse,
    ErrorResponse
)
from app.core.security import RateLimiter
from app.core.logging import get_logger

# Initialize router with prefix and tags
router = APIRouter(prefix="/auth", tags=["auth"])

# Configure rate limiting
rate_limiter = RateLimiter(requests_per_minute=100)

# Configure enhanced security logging
audit_logger = get_logger(
    __name__,
    enable_security_logging=True
)

@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse}
    }
)
@rate_limiter.limit("login")
async def login(
    request: Request,
    credentials: UserLogin,
    db: Session
) -> Dict:
    """
    Authenticate user and create secure session with comprehensive security controls.

    Args:
        request: FastAPI request object for client metadata
        credentials: User login credentials
        db: Database session

    Returns:
        Dict containing access token, refresh token and user data

    Raises:
        HTTPException: For invalid credentials or rate limit exceeded
    """
    try:
        # Log login attempt with security context
        audit_logger.info(
            "Login attempt",
            extra={
                "security_event": {
                    "type": "login_attempt",
                    "email": credentials.email,
                    "ip_address": request.client.host,
                    "user_agent": request.headers.get("user-agent")
                }
            }
        )

        # Authenticate user
        user = await authenticate_user(
            db=db,
            email=credentials.email,
            password=credentials.password.get_secret_value(),
            ip_address=request.client.host
        )

        # Create secure session with client metadata
        session_data = await create_user_session(
            user=user,
            session_metadata={
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "session_id": str(UUID.uuid4())
            }
        )

        # Log successful login
        audit_logger.info(
            "Login successful",
            extra={
                "security_event": {
                    "type": "login_success",
                    "user_id": str(user.id),
                    "ip_address": request.client.host
                }
            }
        )

        return session_data

    except Exception as e:
        # Log failed login attempt
        audit_logger.warning(
            f"Login failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "login_failure",
                    "email": credentials.email,
                    "ip_address": request.client.host,
                    "reason": str(e)
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@router.post(
    "/register",
    response_model=UserResponse,
    responses={
        400: {"model": ErrorResponse},
        429: {"model": ErrorResponse}
    }
)
@rate_limiter.limit("register")
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session
) -> UserResponse:
    """
    Register new user with comprehensive validation and security controls.

    Args:
        request: FastAPI request object for client metadata
        user_data: New user registration data
        db: Database session

    Returns:
        UserResponse: Created user data

    Raises:
        HTTPException: For validation errors or rate limit exceeded
    """
    try:
        # Log registration attempt
        audit_logger.info(
            "Registration attempt",
            extra={
                "security_event": {
                    "type": "registration_attempt",
                    "email": user_data.email,
                    "ip_address": request.client.host
                }
            }
        )

        # Create user with secure password hashing
        user = await create_user(
            db=db,
            user_data=user_data,
            client_ip=request.client.host
        )

        # Log successful registration
        audit_logger.info(
            "Registration successful",
            extra={
                "security_event": {
                    "type": "registration_success",
                    "user_id": str(user.id),
                    "ip_address": request.client.host
                }
            }
        )

        return UserResponse.model_validate(user)

    except Exception as e:
        # Log registration failure
        audit_logger.warning(
            f"Registration failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "registration_failure",
                    "email": user_data.email,
                    "ip_address": request.client.host,
                    "reason": str(e)
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse}
    }
)
@rate_limiter.limit("refresh")
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: str
) -> Dict:
    """
    Refresh access token with comprehensive security validation.

    Args:
        request: FastAPI request object for client metadata
        response: FastAPI response object for cookie management
        refresh_token: Valid refresh token

    Returns:
        Dict containing new access token and expiry

    Raises:
        HTTPException: For invalid or expired tokens
    """
    try:
        # Log token refresh attempt
        audit_logger.info(
            "Token refresh attempt",
            extra={
                "security_event": {
                    "type": "token_refresh_attempt",
                    "ip_address": request.client.host
                }
            }
        )

        # Refresh access token with security validation
        new_token_data = await refresh_access_token(refresh_token)

        # Log successful refresh
        audit_logger.info(
            "Token refresh successful",
            extra={
                "security_event": {
                    "type": "token_refresh_success",
                    "ip_address": request.client.host
                }
            }
        )

        return new_token_data

    except Exception as e:
        # Log refresh failure
        audit_logger.warning(
            f"Token refresh failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "token_refresh_failure",
                    "ip_address": request.client.host,
                    "reason": str(e)
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.post(
    "/logout",
    responses={
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse}
    }
)
@rate_limiter.limit("logout")
async def logout(
    request: Request,
    response: Response,
    refresh_token: str
) -> Dict:
    """
    Handle user logout with secure token invalidation.

    Args:
        request: FastAPI request object for client metadata
        response: FastAPI response object for cookie management
        refresh_token: Active refresh token to invalidate

    Returns:
        Dict: Logout success message

    Raises:
        HTTPException: For invalid tokens or rate limit exceeded
    """
    try:
        # Log logout attempt
        audit_logger.info(
            "Logout attempt",
            extra={
                "security_event": {
                    "type": "logout_attempt",
                    "ip_address": request.client.host
                }
            }
        )

        # Validate and decode token
        token_data = await validate_token(refresh_token)
        user_id = token_data.get("user_id")

        # Invalidate session and tokens
        await logout_user(refresh_token)

        # Clear secure cookies
        response.delete_cookie(
            key="refresh_token",
            httponly=True,
            secure=True,
            samesite="lax"
        )

        # Log successful logout
        audit_logger.info(
            "Logout successful",
            extra={
                "security_event": {
                    "type": "logout_success",
                    "user_id": user_id,
                    "ip_address": request.client.host
                }
            }
        )

        return {"message": "Successfully logged out"}

    except Exception as e:
        # Log logout failure
        audit_logger.warning(
            f"Logout failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "logout_failure",
                    "ip_address": request.client.host,
                    "reason": str(e)
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )