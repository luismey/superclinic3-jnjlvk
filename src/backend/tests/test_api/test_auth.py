"""
Comprehensive test suite for authentication API endpoints.
Tests authentication flows, token management, and security controls.

pytest version: ^7.0.0
pytest-asyncio version: ^0.21.0
fastapi version: ^0.100.0
python-jose version: ^3.3.0
"""

import asyncio
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, Optional

import pytest
from fastapi import HTTPException, status
from jose import jwt

from app.models.users import User, UserRole
from app.core.security import (
    create_access_token,
    verify_password,
    decode_token,
    ALGORITHM
)
from app.core.config import settings

# Configure test logger
logger = logging.getLogger(__name__)

# Test constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword123"
TEST_NEW_USER_EMAIL = "newuser@example.com"
TEST_NEW_USER_PASSWORD = "newpassword123"
MAX_LOGIN_ATTEMPTS = 5
TOKEN_EXPIRY_MINUTES = 60
REFRESH_TOKEN_EXPIRY_DAYS = 7

@pytest.mark.asyncio
async def test_login_success(test_client, test_user: User):
    """
    Test successful user login with comprehensive token and security validation.
    
    Args:
        test_client: FastAPI test client fixture
        test_user: Test user fixture
    """
    try:
        # Prepare login credentials
        credentials = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }

        # Send login request
        response = await test_client.post(
            "/api/v1/auth/login",
            json=credentials
        )

        # Assert successful response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Validate response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert "user" in data

        # Validate access token
        access_token = data["access_token"]
        token_payload = decode_token(access_token)
        assert token_payload["sub"] == "access"
        assert token_payload["email"] == TEST_USER_EMAIL
        
        # Verify token expiration
        exp = datetime.fromtimestamp(token_payload["exp"])
        expected_exp = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
        assert abs((exp - expected_exp).total_seconds()) < 5

        # Validate refresh token
        refresh_token = data["refresh_token"]
        refresh_payload = decode_token(refresh_token)
        assert refresh_payload["sub"] == "refresh"
        assert refresh_payload["email"] == TEST_USER_EMAIL

        # Verify user data
        user_data = data["user"]
        assert user_data["email"] == TEST_USER_EMAIL
        assert user_data["role"] == UserRole.ADMIN.value
        assert "id" in user_data
        assert "full_name" in user_data

        logger.info(f"Successful login test for user: {TEST_USER_EMAIL}")

    except Exception as e:
        logger.error(f"Login test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_login_invalid_credentials(test_client):
    """
    Test login failure scenarios and security controls.
    
    Args:
        test_client: FastAPI test client fixture
    """
    try:
        # Test invalid password
        for attempt in range(MAX_LOGIN_ATTEMPTS + 1):
            credentials = {
                "email": TEST_USER_EMAIL,
                "password": "wrongpassword"
            }

            response = await test_client.post(
                "/api/v1/auth/login",
                json=credentials
            )

            if attempt < MAX_LOGIN_ATTEMPTS:
                assert response.status_code == status.HTTP_401_UNAUTHORIZED
                data = response.json()
                assert "detail" in data
                assert "Invalid credentials" in data["detail"]
            else:
                # Account should be locked after max attempts
                assert response.status_code == status.HTTP_403_FORBIDDEN
                data = response.json()
                assert "Account locked" in data["detail"]

        # Test invalid email
        credentials = {
            "email": "nonexistent@example.com",
            "password": TEST_USER_PASSWORD
        }

        response = await test_client.post(
            "/api/v1/auth/login",
            json=credentials
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "User not found" in data["detail"]

        logger.info("Successfully tested invalid login scenarios")

    except Exception as e:
        logger.error(f"Invalid credentials test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_register_success(test_client, test_db):
    """
    Test successful user registration with security validation.
    
    Args:
        test_client: FastAPI test client fixture
        test_db: Test database session fixture
    """
    try:
        # Prepare registration data
        user_data = {
            "email": TEST_NEW_USER_EMAIL,
            "password": TEST_NEW_USER_PASSWORD,
            "full_name": "New Test User",
            "organization_name": "Test Organization"
        }

        # Send registration request
        response = await test_client.post(
            "/api/v1/auth/register",
            json=user_data
        )

        # Assert successful response
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Validate response data
        assert "user" in data
        assert "access_token" in data
        user = data["user"]
        assert user["email"] == TEST_NEW_USER_EMAIL
        assert user["full_name"] == "New Test User"
        assert user["role"] == UserRole.ADMIN.value

        # Verify user in database
        db_user = await test_db.query(User).filter(
            User.email == TEST_NEW_USER_EMAIL
        ).first()
        assert db_user is not None
        assert db_user.email == TEST_NEW_USER_EMAIL
        assert verify_password(TEST_NEW_USER_PASSWORD, db_user.hashed_password)

        logger.info(f"Successfully registered new user: {TEST_NEW_USER_EMAIL}")

    except Exception as e:
        logger.error(f"Registration test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_refresh_token_success(test_client, test_user: User):
    """
    Test access token refresh with security validation.
    
    Args:
        test_client: FastAPI test client fixture
        test_user: Test user fixture
    """
    try:
        # First login to get tokens
        credentials = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }

        login_response = await test_client.post(
            "/api/v1/auth/login",
            json=credentials
        )
        tokens = login_response.json()
        refresh_token = tokens["refresh_token"]

        # Wait briefly to ensure different token timestamps
        await asyncio.sleep(1)

        # Attempt token refresh
        refresh_response = await test_client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"}
        )

        # Validate refresh response
        assert refresh_response.status_code == status.HTTP_200_OK
        new_tokens = refresh_response.json()

        # Verify new tokens
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["access_token"] != tokens["access_token"]
        assert new_tokens["refresh_token"] != tokens["refresh_token"]

        # Validate new access token
        new_token_payload = decode_token(new_tokens["access_token"])
        assert new_token_payload["email"] == TEST_USER_EMAIL
        assert new_token_payload["sub"] == "access"

        logger.info(f"Successfully refreshed tokens for user: {TEST_USER_EMAIL}")

    except Exception as e:
        logger.error(f"Token refresh test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_logout_success(test_client, test_user: User):
    """
    Test user logout with token invalidation.
    
    Args:
        test_client: FastAPI test client fixture
        test_user: Test user fixture
    """
    try:
        # First login to get tokens
        credentials = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }

        login_response = await test_client.post(
            "/api/v1/auth/login",
            json=credentials
        )
        tokens = login_response.json()
        access_token = tokens["access_token"]

        # Perform logout
        logout_response = await test_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        # Verify logout success
        assert logout_response.status_code == status.HTTP_200_OK

        # Verify token is invalidated by attempting to use it
        protected_response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert protected_response.status_code == status.HTTP_401_UNAUTHORIZED

        logger.info(f"Successfully logged out user: {TEST_USER_EMAIL}")

    except Exception as e:
        logger.error(f"Logout test failed: {str(e)}")
        raise

@pytest.mark.asyncio
async def test_password_reset_flow(test_client, test_user: User):
    """
    Test complete password reset flow with security validation.
    
    Args:
        test_client: FastAPI test client fixture
        test_user: Test user fixture
    """
    try:
        # Request password reset
        reset_request = {
            "email": TEST_USER_EMAIL
        }

        request_response = await test_client.post(
            "/api/v1/auth/password-reset/request",
            json=reset_request
        )
        assert request_response.status_code == status.HTTP_200_OK

        # Simulate reset token (in real app would be sent via email)
        reset_token = create_access_token(
            {"email": TEST_USER_EMAIL, "purpose": "password_reset"},
            timedelta(minutes=30)
        )

        # Reset password
        new_password = "NewSecurePass123!@#"
        reset_data = {
            "token": reset_token,
            "new_password": new_password
        }

        reset_response = await test_client.post(
            "/api/v1/auth/password-reset/confirm",
            json=reset_data
        )
        assert reset_response.status_code == status.HTTP_200_OK

        # Verify new password works
        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": new_password
            }
        )
        assert login_response.status_code == status.HTTP_200_OK

        logger.info(f"Successfully tested password reset for user: {TEST_USER_EMAIL}")

    except Exception as e:
        logger.error(f"Password reset test failed: {str(e)}")
        raise