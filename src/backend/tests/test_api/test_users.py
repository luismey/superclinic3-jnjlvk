"""
Comprehensive test suite for user management API endpoints.
Tests CRUD operations, authentication, authorization, and LGPD compliance.

Version: 1.0.0
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Optional
from uuid import UUID, uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.models.users import User, UserRole
from app.schemas.users import UserCreate, UserUpdate, UserResponse, UserConsent
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings

# Test constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPass123!@#"
TEST_USER_FULL_NAME = "Test User"
TEST_CONSENT_DATA = {
    "terms_accepted": True,
    "marketing_consent": False,
    "data_processing_consent": True
}

@pytest.fixture
def test_user_data() -> Dict:
    """Fixture providing valid test user data with LGPD consent."""
    return {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "full_name": TEST_USER_FULL_NAME,
        "role": UserRole.OPERATOR,
        "organization_id": str(uuid4()),
        "lgpd_consent": True,
        "consent_flags": TEST_CONSENT_DATA,
        "preferences": {"theme": "light", "language": "pt-BR"}
    }

@pytest.fixture
async def test_user(test_db: AsyncSession) -> User:
    """Fixture creating a test user in the database."""
    user = User(
        email=TEST_USER_EMAIL,
        full_name=TEST_USER_FULL_NAME,
        role=UserRole.OPERATOR,
        organization_id=uuid4()
    )
    user.hashed_password = get_password_hash(TEST_USER_PASSWORD)
    user.consent_tracking = {
        "consent_history": [],
        **TEST_CONSENT_DATA
    }
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user

class TestUserAPI:
    """Test suite for user management API endpoints."""

    def setup_method(self):
        """Setup method run before each test."""
        self.base_url = f"{settings.API_V1_PREFIX}/users"
        self.headers = {"Content-Type": "application/json"}

    @pytest.mark.asyncio
    async def test_create_user(
        self,
        client: TestClient,
        test_db: AsyncSession,
        test_user_data: Dict
    ):
        """Test user creation with LGPD compliance validation."""
        
        # Test successful user creation
        response = client.post(
            f"{self.base_url}/",
            json=test_user_data,
            headers=self.headers
        )
        assert response.status_code == 201
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["email"] == test_user_data["email"]
        assert data["full_name"] == test_user_data["full_name"]
        assert data["role"] == test_user_data["role"].value
        assert "consent_status" in data
        
        # Verify user in database
        user = await test_db.get(User, UUID(data["id"]))
        assert user is not None
        assert user.email == test_user_data["email"]
        assert user.consent_tracking["terms_accepted"] == TEST_CONSENT_DATA["terms_accepted"]

        # Test duplicate email
        response = client.post(
            f"{self.base_url}/",
            json=test_user_data,
            headers=self.headers
        )
        assert response.status_code == 400

        # Test invalid password
        invalid_data = test_user_data.copy()
        invalid_data["password"] = "weak"
        response = client.post(
            f"{self.base_url}/",
            json=invalid_data,
            headers=self.headers
        )
        assert response.status_code == 422

        # Test missing LGPD consent
        invalid_data = test_user_data.copy()
        invalid_data["lgpd_consent"] = False
        response = client.post(
            f"{self.base_url}/",
            json=invalid_data,
            headers=self.headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_user(
        self,
        client: TestClient,
        test_user: User,
        test_db: AsyncSession
    ):
        """Test user retrieval with proper authorization."""
        
        # Generate access token
        token = create_access_token({"sub": str(test_user.id)})
        auth_headers = {**self.headers, "Authorization": f"Bearer {token}"}

        # Test successful retrieval
        response = client.get(
            f"{self.base_url}/{test_user.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email

        # Test unauthorized access
        response = client.get(
            f"{self.base_url}/{test_user.id}",
            headers=self.headers
        )
        assert response.status_code == 401

        # Test non-existent user
        response = client.get(
            f"{self.base_url}/{uuid4()}",
            headers=auth_headers
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user(
        self,
        client: TestClient,
        test_user: User,
        test_db: AsyncSession
    ):
        """Test user update with security validation."""
        
        token = create_access_token({"sub": str(test_user.id)})
        auth_headers = {**self.headers, "Authorization": f"Bearer {token}"}

        # Test successful update
        update_data = {
            "full_name": "Updated Name",
            "preferences": {"theme": "dark"}
        }
        response = client.put(
            f"{self.base_url}/{test_user.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == update_data["full_name"]

        # Verify in database
        await test_db.refresh(test_user)
        assert test_user.full_name == update_data["full_name"]
        assert test_user.preferences["theme"] == "dark"

        # Test password update
        update_data = {"password": "NewSecurePass123!@#"}
        response = client.put(
            f"{self.base_url}/{test_user.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        # Test invalid password update
        update_data = {"password": "weak"}
        response = client.put(
            f"{self.base_url}/{test_user.id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_user(
        self,
        client: TestClient,
        test_user: User,
        test_db: AsyncSession
    ):
        """Test user deletion with proper authorization."""
        
        # Create admin token
        admin_token = create_access_token({
            "sub": str(uuid4()),
            "role": UserRole.ADMIN.value
        })
        auth_headers = {**self.headers, "Authorization": f"Bearer {admin_token}"}

        # Test successful deletion
        response = client.delete(
            f"{self.base_url}/{test_user.id}",
            headers=auth_headers
        )
        assert response.status_code == 204

        # Verify user is deactivated
        await test_db.refresh(test_user)
        assert not test_user.is_active

        # Test unauthorized deletion
        user_token = create_access_token({
            "sub": str(test_user.id),
            "role": UserRole.OPERATOR.value
        })
        user_headers = {**self.headers, "Authorization": f"Bearer {user_token}"}
        
        response = client.delete(
            f"{self.base_url}/{uuid4()}",
            headers=user_headers
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_consent_management(
        self,
        client: TestClient,
        test_user: User,
        test_db: AsyncSession
    ):
        """Test LGPD consent management functionality."""
        
        token = create_access_token({"sub": str(test_user.id)})
        auth_headers = {**self.headers, "Authorization": f"Bearer {token}"}

        # Test consent update
        consent_data = {
            "marketing_consent": True,
            "data_processing_consent": True
        }
        response = client.post(
            f"{self.base_url}/{test_user.id}/consent",
            json=consent_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["consent_flags"]["marketing_consent"] == True

        # Verify consent history
        await test_db.refresh(test_user)
        assert len(test_user.consent_tracking["consent_history"]) > 0
        assert test_user.consent_tracking["marketing_consent"] == True

        # Test invalid consent type
        invalid_consent = {"invalid_consent": True}
        response = client.post(
            f"{self.base_url}/{test_user.id}/consent",
            json=invalid_consent,
            headers=auth_headers
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_user_authentication(
        self,
        client: TestClient,
        test_user: User
    ):
        """Test user authentication and security measures."""
        
        # Test successful login
        login_data = {
            "email": test_user.email,
            "password": TEST_USER_PASSWORD
        }
        response = client.post(
            f"{self.base_url}/login",
            json=login_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data

        # Test invalid credentials
        invalid_login = {
            "email": test_user.email,
            "password": "wrong_password"
        }
        response = client.post(
            f"{self.base_url}/login",
            json=invalid_login,
            headers=self.headers
        )
        assert response.status_code == 401

        # Test account locking after multiple failures
        for _ in range(5):
            response = client.post(
                f"{self.base_url}/login",
                json=invalid_login,
                headers=self.headers
            )
        
        # Verify account is locked
        response = client.post(
            f"{self.base_url}/login",
            json=login_data,
            headers=self.headers
        )
        assert response.status_code == 403