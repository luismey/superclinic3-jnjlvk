"""
Comprehensive test suite for AI virtual assistant API endpoints.
Tests CRUD operations, configuration management, knowledge base updates,
performance metrics, and security validation.

pytest version: ^7.0.0
fastapi version: ^0.100.0
"""

import pytest
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
from fastapi import HTTPException

from app.models.assistants import Assistant, AssistantType
from ..conftest import test_client, test_db, test_user

# Test constants
TEST_ASSISTANT_NAME = "Test Assistant"
TEST_ASSISTANT_CONFIG = {
    "greeting": "Hello",
    "language": "pt-BR",
    "max_turns": 10,
    "response_time_sla": 200
}
TEST_KNOWLEDGE_BASE = {
    "documents": [],
    "version": 1,
    "last_updated": "2024-01-01T00:00:00Z"
}

class TestAssistantAPI:
    """Test class for assistant API endpoints with setup and teardown management."""

    @pytest.fixture(autouse=True)
    async def setup_method(self, test_db, test_client, test_user):
        """Setup method run before each test with proper isolation."""
        self.db = test_db
        self.client = test_client
        self.user = test_user
        self.base_url = "/api/v1/assistants"

        # Create test assistant for reuse
        self.test_assistant = Assistant(
            name=TEST_ASSISTANT_NAME,
            type=AssistantType.CUSTOMER_SERVICE,
            organization_id=self.user.organization_id,
            created_by_id=self.user.id,
            config=TEST_ASSISTANT_CONFIG.copy()
        )
        self.db.add(self.test_assistant)
        await self.db.commit()
        await self.db.refresh(self.test_assistant)

    async def teardown_method(self):
        """Cleanup method run after each test ensuring isolation."""
        # Clean up test data
        await self.db.rollback()
        if hasattr(self, 'test_assistant'):
            await self.db.delete(self.test_assistant)
            await self.db.commit()

    @pytest.mark.asyncio
    async def test_create_assistant(self):
        """Test creating a new assistant with validation."""
        # Prepare test data
        assistant_data = {
            "name": "New Assistant",
            "type": AssistantType.SALES.value,
            "config": TEST_ASSISTANT_CONFIG,
            "organization_id": str(self.user.organization_id)
        }

        # Test successful creation
        response = await self.client.post(
            f"{self.base_url}/",
            json=assistant_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == assistant_data["name"]
        assert data["type"] == assistant_data["type"]
        assert "id" in data

        # Test duplicate name validation
        response = await self.client.post(
            f"{self.base_url}/",
            json=assistant_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 400

        # Test invalid type validation
        invalid_data = assistant_data.copy()
        invalid_data["type"] = "INVALID"
        response = await self.client.post(
            f"{self.base_url}/",
            json=invalid_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_assistant(self):
        """Test retrieving assistant details."""
        # Test successful retrieval
        response = await self.client.get(
            f"{self.base_url}/{self.test_assistant.id}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(self.test_assistant.id)
        assert data["name"] == self.test_assistant.name

        # Test non-existent assistant
        response = await self.client.get(
            f"{self.base_url}/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 404

        # Test unauthorized access
        other_user_id = uuid.uuid4()
        response = await self.client.get(
            f"{self.base_url}/{self.test_assistant.id}",
            headers={"Authorization": f"Bearer {other_user_id}"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_assistant_config(self):
        """Test updating assistant configuration."""
        # Prepare update data
        update_data = {
            "config": {
                "greeting": "Updated greeting",
                "max_turns": 15
            }
        }

        # Test successful update
        response = await self.client.patch(
            f"{self.base_url}/{self.test_assistant.id}/config",
            json=update_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["config"]["greeting"] == update_data["config"]["greeting"]
        assert data["config"]["max_turns"] == update_data["config"]["max_turns"]

        # Test invalid config validation
        invalid_data = {"config": {"max_turns": "invalid"}}
        response = await self.client.patch(
            f"{self.base_url}/{self.test_assistant.id}/config",
            json=invalid_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_knowledge_base(self):
        """Test updating assistant knowledge base."""
        # Prepare knowledge base update
        update_data = {
            "knowledge_base": {
                "documents": [{"title": "Test Doc", "content": "Test content"}],
                "version": 2
            }
        }

        # Test successful update
        response = await self.client.put(
            f"{self.base_url}/{self.test_assistant.id}/knowledge",
            json=update_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["knowledge_base"]["documents"]) == 1
        assert data["knowledge_base"]["version"] == 2

        # Test version conflict
        response = await self.client.put(
            f"{self.base_url}/{self.test_assistant.id}/knowledge",
            json=update_data,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_get_assistant_metrics(self):
        """Test retrieving assistant performance metrics."""
        # Generate test metrics
        self.test_assistant.message_count = 100
        self.test_assistant.avg_response_time = 150.5
        await self.db.commit()

        # Test successful metrics retrieval
        response = await self.client.get(
            f"{self.base_url}/{self.test_assistant.id}/metrics",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message_count"] == 100
        assert data["avg_response_time"] == 150.5
        assert "sla_compliance" in data

        # Test metrics with time range
        response = await self.client.get(
            f"{self.base_url}/{self.test_assistant.id}/metrics",
            params={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_assistant(self):
        """Test assistant deletion."""
        # Test successful deletion
        response = await self.client.delete(
            f"{self.base_url}/{self.test_assistant.id}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 204

        # Verify assistant is deleted
        response = await self.client.get(
            f"{self.base_url}/{self.test_assistant.id}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 404

        # Test deleting non-existent assistant
        response = await self.client.delete(
            f"{self.base_url}/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_assistants(self):
        """Test listing assistants with filtering and pagination."""
        # Create additional test assistants
        for i in range(3):
            assistant = Assistant(
                name=f"Test Assistant {i}",
                type=AssistantType.SALES,
                organization_id=self.user.organization_id,
                created_by_id=self.user.id
            )
            self.db.add(assistant)
        await self.db.commit()

        # Test basic listing
        response = await self.client.get(
            self.base_url,
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 4  # 3 new + 1 from setup
        assert data["total"] == 4

        # Test filtering by type
        response = await self.client.get(
            f"{self.base_url}?type={AssistantType.SALES.value}",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3

        # Test pagination
        response = await self.client.get(
            f"{self.base_url}?limit=2&offset=0",
            headers={"Authorization": f"Bearer {self.user.id}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 4