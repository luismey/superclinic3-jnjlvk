"""
Test suite for organization management API endpoints.
Implements comprehensive testing of CRUD operations, subscription management,
authorization checks, and settings updates with validation and error cases.

pytest version: ^7.0.0
"""

import pytest
from datetime import datetime, timedelta
from uuid import UUID
from fastapi import HTTPException, status
from app.models.organizations import Organization, VALID_PLANS
from app.schemas.organizations import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationInDB
)

class TestOrganizationFixtures:
    """Test fixtures for organization-related tests."""
    
    @pytest.fixture
    def default_settings(self):
        """Default organization settings for testing."""
        return {
            'notification_email': 'test@example.com',
            'language': 'pt-BR',
            'timezone': 'America/Sao_Paulo',
            'whatsapp_session_timeout': 3600,
            'max_campaigns_per_month': 10
        }
    
    @pytest.fixture
    def default_subscription(self):
        """Default subscription data for testing."""
        return {
            'plan': 'professional',
            'ends_at': datetime.utcnow() + timedelta(days=30)
        }
    
    @pytest.fixture
    async def test_organization(self, test_db):
        """Create a test organization instance."""
        org = Organization(
            name="Test Organization",
            plan="professional",
            settings=self.default_settings()
        )
        test_db.add(org)
        await test_db.commit()
        await test_db.refresh(org)
        return org
    
    @pytest.fixture
    async def test_users(self, test_db):
        """Create test users with different roles."""
        # Implementation would create test users with different roles
        # Actual user creation logic would depend on User model implementation
        return {
            'admin': {'id': UUID('12345678-1234-5678-1234-567812345678'), 'role': 'admin'},
            'manager': {'id': UUID('87654321-8765-4321-8765-432187654321'), 'role': 'manager'},
            'operator': {'id': UUID('11111111-2222-3333-4444-555555555555'), 'role': 'operator'}
        }

@pytest.mark.asyncio
async def test_create_organization(client, test_db):
    """Test organization creation with validation."""
    
    # Test successful creation
    org_data = {
        'name': 'New Test Organization',
        'plan': 'professional',
        'settings': {
            'notification_email': 'new@example.com',
            'language': 'pt-BR',
            'timezone': 'America/Sao_Paulo'
        }
    }
    
    response = await client.post('/api/v1/organizations/', json=org_data)
    assert response.status_code == status.HTTP_201_CREATED
    
    created_org = response.json()
    assert created_org['name'] == org_data['name']
    assert created_org['plan'] == org_data['plan']
    assert UUID(created_org['id'])  # Verify valid UUID
    
    # Test duplicate name error
    duplicate_response = await client.post('/api/v1/organizations/', json=org_data)
    assert duplicate_response.status_code == status.HTTP_400_BAD_REQUEST
    
    # Test invalid plan error
    invalid_plan_data = org_data.copy()
    invalid_plan_data['plan'] = 'invalid_plan'
    invalid_plan_response = await client.post('/api/v1/organizations/', json=invalid_plan_data)
    assert invalid_plan_response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
async def test_get_organization(client, test_db, test_organization):
    """Test organization retrieval with different scenarios."""
    
    # Test successful retrieval
    response = await client.get(f'/api/v1/organizations/{test_organization.id}')
    assert response.status_code == status.HTTP_200_OK
    
    org_data = response.json()
    assert org_data['id'] == str(test_organization.id)
    assert org_data['name'] == test_organization.name
    assert org_data['plan'] == test_organization.plan
    
    # Test non-existent organization
    non_existent_id = UUID('99999999-9999-9999-9999-999999999999')
    not_found_response = await client.get(f'/api/v1/organizations/{non_existent_id}')
    assert not_found_response.status_code == status.HTTP_404_NOT_FOUND
    
    # Test inactive organization
    test_organization.is_active = False
    await test_db.commit()
    inactive_response = await client.get(f'/api/v1/organizations/{test_organization.id}')
    assert inactive_response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_update_organization(client, test_db, test_organization):
    """Test organization update functionality."""
    
    # Test full update
    update_data = {
        'name': 'Updated Organization',
        'plan': 'enterprise',
        'settings': {
            'notification_email': 'updated@example.com',
            'language': 'en-US',
            'timezone': 'UTC'
        }
    }
    
    response = await client.put(
        f'/api/v1/organizations/{test_organization.id}',
        json=update_data
    )
    assert response.status_code == status.HTTP_200_OK
    
    updated_org = response.json()
    assert updated_org['name'] == update_data['name']
    assert updated_org['plan'] == update_data['plan']
    assert updated_org['settings']['language'] == 'en-US'
    
    # Test partial update
    partial_update = {'name': 'Partially Updated Org'}
    partial_response = await client.patch(
        f'/api/v1/organizations/{test_organization.id}',
        json=partial_update
    )
    assert partial_response.status_code == status.HTTP_200_OK
    assert partial_response.json()['name'] == partial_update['name']

@pytest.mark.asyncio
async def test_delete_organization(client, test_db, test_organization):
    """Test organization deletion and related validations."""
    
    response = await client.delete(f'/api/v1/organizations/{test_organization.id}')
    assert response.status_code == status.HTTP_200_OK
    
    # Verify soft deletion
    org = await test_db.get(Organization, test_organization.id)
    assert not org.is_active
    assert org.updated_at > test_organization.updated_at
    
    # Test double deletion
    second_delete = await client.delete(f'/api/v1/organizations/{test_organization.id}')
    assert second_delete.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_update_organization_settings(client, test_db, test_organization):
    """Test organization settings update functionality."""
    
    new_settings = {
        'notification_email': 'new@example.com',
        'language': 'en-US',
        'timezone': 'UTC',
        'whatsapp_session_timeout': 7200,
        'max_campaigns_per_month': 20
    }
    
    response = await client.patch(
        f'/api/v1/organizations/{test_organization.id}/settings',
        json=new_settings
    )
    assert response.status_code == status.HTTP_200_OK
    
    updated_settings = response.json()['settings']
    assert updated_settings['notification_email'] == new_settings['notification_email']
    assert updated_settings['whatsapp_session_timeout'] == 7200
    
    # Test invalid settings
    invalid_settings = {'invalid_key': 'value'}
    invalid_response = await client.patch(
        f'/api/v1/organizations/{test_organization.id}/settings',
        json=invalid_settings
    )
    assert invalid_response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
async def test_update_organization_subscription(client, test_db, test_organization):
    """Test organization subscription management."""
    
    new_subscription = {
        'plan': 'enterprise',
        'ends_at': (datetime.utcnow() + timedelta(days=365)).isoformat()
    }
    
    response = await client.patch(
        f'/api/v1/organizations/{test_organization.id}/subscription',
        json=new_subscription
    )
    assert response.status_code == status.HTTP_200_OK
    
    updated_org = response.json()
    assert updated_org['plan'] == 'enterprise'
    assert updated_org['days_remaining'] > 360
    
    # Test invalid plan
    invalid_plan = {'plan': 'invalid'}
    invalid_response = await client.patch(
        f'/api/v1/organizations/{test_organization.id}/subscription',
        json=invalid_plan
    )
    assert invalid_response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
async def test_organization_authorization(client, test_db, test_organization, test_users):
    """Test organization access authorization."""
    
    # Test unauthorized access
    unauth_response = await client.get(
        f'/api/v1/organizations/{test_organization.id}',
        headers={'Authorization': 'Bearer invalid_token'}
    )
    assert unauth_response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test access with different roles
    for role, user in test_users.items():
        response = await client.get(
            f'/api/v1/organizations/{test_organization.id}',
            headers={'Authorization': f'Bearer {user["id"]}'}
        )
        
        if role in ['admin', 'manager']:
            assert response.status_code == status.HTTP_200_OK
        else:
            assert response.status_code == status.HTTP_403_FORBIDDEN