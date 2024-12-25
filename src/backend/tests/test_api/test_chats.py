"""
Comprehensive test suite for WhatsApp chat API endpoints.
Validates chat management operations, performance requirements, and security controls.

pytest version: ^7.0.0
pytest_asyncio version: ^0.21.0
httpx version: ^0.24.0
faker version: ^19.0.0
"""

import uuid
import time
from typing import AsyncGenerator, Dict, List
from datetime import datetime, timedelta

import pytest
from faker import Faker
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chats import Chat, ChatStatus
from app.models.messages import Message, MessageType, MessageStatus

# Configure test constants
CHATS_URL = '/api/v1/chats'
fake = Faker()
RESPONSE_TIME_LIMIT = 0.2  # 200ms performance requirement

class ChatFactory:
    """Factory class for generating test chat data."""
    
    def __init__(self):
        """Initialize chat factory with faker instance."""
        self.fake = fake
        
    async def create_test_chat(
        self, 
        db: AsyncSession,
        organization_id: uuid.UUID,
        status: ChatStatus = ChatStatus.ACTIVE
    ) -> Chat:
        """Create a test chat instance with specified parameters."""
        chat = Chat(
            organization_id=organization_id,
            whatsapp_chat_id=f"whatsapp-{uuid.uuid4()}",
            customer_phone=self.fake.phone_number(),
            customer_name=self.fake.name(),
            status=status,
            ai_enabled=False
        )
        db.add(chat)
        await db.flush()
        return chat
        
    async def create_test_message(
        self,
        db: AsyncSession,
        chat_id: uuid.UUID,
        is_from_customer: bool = True
    ) -> Message:
        """Create a test message for a chat."""
        message = Message(
            chat_id=chat_id,
            message_type=MessageType.TEXT,
            content=self.fake.text(max_nb_chars=100),
            is_from_customer=is_from_customer,
            status=MessageStatus.DELIVERED
        )
        db.add(message)
        await db.flush()
        return message

@pytest.fixture
def chat_factory() -> ChatFactory:
    """Provide chat factory instance for tests."""
    return ChatFactory()

@pytest.mark.asyncio
async def test_get_chats(
    test_db: AsyncSession,
    test_client: AsyncClient,
    test_user: Dict,
    chat_factory: ChatFactory
) -> None:
    """Test retrieving paginated list of chats with filters and performance validation."""
    
    # Create test chats with different statuses
    test_chats = []
    for status in ChatStatus:
        for _ in range(5):
            chat = await chat_factory.create_test_chat(
                test_db,
                test_user["organization_id"],
                status
            )
            test_chats.append(chat)
    await test_db.commit()

    # Test default pagination (10 items)
    start_time = time.time()
    response = await test_client.get(
        CHATS_URL,
        headers={"Authorization": f"Bearer {test_user['access_token']}"}
    )
    response_time = time.time() - start_time
    
    assert response.status_code == 200
    assert response_time <= RESPONSE_TIME_LIMIT
    data = response.json()
    assert len(data["items"]) == 10
    assert data["total"] == 20
    
    # Test status filter
    response = await test_client.get(
        f"{CHATS_URL}?status={ChatStatus.ACTIVE.value}",
        headers={"Authorization": f"Bearer {test_user['access_token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert all(chat["status"] == ChatStatus.ACTIVE.value for chat in data["items"])
    
    # Test unauthorized access
    response = await test_client.get(CHATS_URL)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_chat(
    test_db: AsyncSession,
    test_client: AsyncClient,
    test_user: Dict,
    chat_factory: ChatFactory
) -> None:
    """Test retrieving single chat with messages and performance validation."""
    
    # Create test chat with messages
    chat = await chat_factory.create_test_chat(
        test_db,
        test_user["organization_id"]
    )
    messages = []
    for _ in range(5):
        message = await chat_factory.create_test_message(test_db, chat.id)
        messages.append(message)
    await test_db.commit()
    
    # Test successful retrieval
    start_time = time.time()
    response = await test_client.get(
        f"{CHATS_URL}/{chat.id}",
        headers={"Authorization": f"Bearer {test_user['access_token']}"}
    )
    response_time = time.time() - start_time
    
    assert response.status_code == 200
    assert response_time <= RESPONSE_TIME_LIMIT
    data = response.json()
    assert data["id"] == str(chat.id)
    assert len(data["messages"]) == 5
    
    # Test invalid chat ID
    response = await test_client.get(
        f"{CHATS_URL}/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {test_user['access_token']}"}
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_create_chat(
    test_db: AsyncSession,
    test_client: AsyncClient,
    test_user: Dict
) -> None:
    """Test chat creation with validation and performance checks."""
    
    chat_data = {
        "customer_phone": fake.phone_number(),
        "customer_name": fake.name(),
        "ai_enabled": True,
        "ai_config": {
            "model": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 150
        }
    }
    
    # Test successful creation
    start_time = time.time()
    response = await test_client.post(
        CHATS_URL,
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=chat_data
    )
    response_time = time.time() - start_time
    
    assert response.status_code == 201
    assert response_time <= RESPONSE_TIME_LIMIT
    data = response.json()
    assert data["customer_phone"] == chat_data["customer_phone"]
    assert data["status"] == ChatStatus.ACTIVE.value
    
    # Test duplicate phone number
    response = await test_client.post(
        CHATS_URL,
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=chat_data
    )
    assert response.status_code == 409

@pytest.mark.asyncio
async def test_update_chat(
    test_db: AsyncSession,
    test_client: AsyncClient,
    test_user: Dict,
    chat_factory: ChatFactory
) -> None:
    """Test chat updates with status transitions and performance validation."""
    
    # Create test chat
    chat = await chat_factory.create_test_chat(
        test_db,
        test_user["organization_id"]
    )
    await test_db.commit()
    
    update_data = {
        "status": ChatStatus.RESOLVED.value,
        "ai_enabled": True,
        "ai_config": {
            "model": "gpt-4",
            "temperature": 0.5,
            "max_tokens": 200
        }
    }
    
    # Test successful update
    start_time = time.time()
    response = await test_client.put(
        f"{CHATS_URL}/{chat.id}",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=update_data
    )
    response_time = time.time() - start_time
    
    assert response.status_code == 200
    assert response_time <= RESPONSE_TIME_LIMIT
    data = response.json()
    assert data["status"] == ChatStatus.RESOLVED.value
    assert data["ai_enabled"] == True
    
    # Test invalid status transition
    update_data["status"] = ChatStatus.PENDING.value
    response = await test_client.put(
        f"{CHATS_URL}/{chat.id}",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=update_data
    )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_process_message(
    test_db: AsyncSession,
    test_client: AsyncClient,
    test_user: Dict,
    chat_factory: ChatFactory
) -> None:
    """Test message processing with validation and performance checks."""
    
    # Create test chat
    chat = await chat_factory.create_test_chat(
        test_db,
        test_user["organization_id"]
    )
    await test_db.commit()
    
    message_data = {
        "content": fake.text(max_nb_chars=100),
        "message_type": MessageType.TEXT.value,
        "is_from_customer": True
    }
    
    # Test successful message processing
    start_time = time.time()
    response = await test_client.post(
        f"{CHATS_URL}/{chat.id}/messages",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=message_data
    )
    response_time = time.time() - start_time
    
    assert response.status_code == 201
    assert response_time <= RESPONSE_TIME_LIMIT
    data = response.json()
    assert data["content"] == message_data["content"]
    assert data["status"] == MessageStatus.PENDING.value
    
    # Test invalid message format
    invalid_message = {
        "content": "x" * 5000,  # Exceeds max length
        "message_type": MessageType.TEXT.value
    }
    response = await test_client.post(
        f"{CHATS_URL}/{chat.id}/messages",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        json=invalid_message
    )
    assert response.status_code == 400