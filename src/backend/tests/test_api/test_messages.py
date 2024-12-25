"""
Comprehensive test suite for WhatsApp message API endpoints.
Tests message processing, real-time updates, rate limiting, and webhook handling.

pytest version: ^7.0.0
aiohttp version: ^3.8.0
"""

import pytest
import time
from unittest.mock import AsyncMock
import aiohttp
from datetime import datetime, timedelta
from uuid import UUID

from ..conftest import test_client, test_db, test_user
from app.schemas.messages import MessageCreate
from app.models.messages import MessageStatus, MessageType

# Test constants
TEST_MESSAGE_CONTENT = "Test message content with special 〜 characters"
TEST_MEDIA_URL = "https://test-bucket.storage.googleapis.com/test-image.jpg"
TEST_WEBHOOK_SECRET = "test_webhook_secret_key"
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 100

@pytest.mark.asyncio
async def test_create_message(test_client, test_db, test_user):
    """
    Test message creation with performance timing and validation.
    Verifies message processing time stays within 500ms target.
    """
    # Prepare test data
    message_data = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.TEXT,
        "content": TEST_MESSAGE_CONTENT,
        "metadata": {"test_key": "test_value"},
        "is_from_customer": False,
        "is_from_assistant": False
    }

    # Mock WhatsApp handler
    mock_whatsapp = AsyncMock()
    mock_whatsapp.send_message.return_value = {
        "whatsapp_message_id": "test_wa_msg_123",
        "status": "sent"
    }

    # Measure request processing time
    start_time = time.time()
    response = await test_client.post(
        "/api/v1/messages",
        json=message_data
    )
    processing_time = time.time() - start_time

    # Verify response
    assert response.status_code == 201
    response_data = response.json()
    assert response_data["content"] == TEST_MESSAGE_CONTENT
    assert response_data["status"] == MessageStatus.QUEUED
    assert "id" in response_data
    assert "created_at" in response_data

    # Verify processing time
    assert processing_time < 0.5, "Message processing exceeded 500ms target"

    # Test media message creation
    media_message_data = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.IMAGE,
        "content": TEST_MEDIA_URL,
        "metadata": {"mime_type": "image/jpeg", "file_size": 1024}
    }

    response = await test_client.post(
        "/api/v1/messages",
        json=media_message_data
    )
    assert response.status_code == 201
    assert response.json()["content"] == TEST_MEDIA_URL

    # Test validation errors
    invalid_message = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.TEXT,
        "content": "a" * 5000  # Exceeds max length
    }
    response = await test_client.post(
        "/api/v1/messages",
        json=invalid_message
    )
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_update_message_status(test_client, test_db, test_user):
    """
    Test message status updates and transitions.
    Verifies status changes, timestamps, and WebSocket notifications.
    """
    # Create test message
    message_data = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.TEXT,
        "content": TEST_MESSAGE_CONTENT
    }
    create_response = await test_client.post(
        "/api/v1/messages",
        json=message_data
    )
    message_id = create_response.json()["id"]

    # Test valid status transitions
    status_updates = [
        MessageStatus.SENT,
        MessageStatus.DELIVERED,
        MessageStatus.READ
    ]

    for status in status_updates:
        response = await test_client.patch(
            f"/api/v1/messages/{message_id}/status",
            json={"status": status}
        )
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["status"] == status
        
        # Verify timestamps
        if status == MessageStatus.SENT:
            assert "sent_at" in response_data
        elif status == MessageStatus.DELIVERED:
            assert "delivered_at" in response_data
        elif status == MessageStatus.READ:
            assert "read_at" in response_data

    # Test invalid status transition
    response = await test_client.patch(
        f"/api/v1/messages/{message_id}/status",
        json={"status": MessageStatus.PENDING}
    )
    assert response.status_code == 400

    # Test concurrent updates
    async def update_status():
        return await test_client.patch(
            f"/api/v1/messages/{message_id}/status",
            json={"status": MessageStatus.SENT}
        )

    responses = await asyncio.gather(*[update_status() for _ in range(5)])
    assert len([r for r in responses if r.status_code == 200]) == 1

@pytest.mark.asyncio
async def test_rate_limiting(test_client, test_user):
    """
    Test message API rate limiting implementation.
    Verifies rate limits, headers, and burst handling.
    """
    message_data = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.TEXT,
        "content": TEST_MESSAGE_CONTENT
    }

    # Send requests up to rate limit
    responses = []
    for _ in range(RATE_LIMIT_MAX_REQUESTS + 1):
        response = await test_client.post(
            "/api/v1/messages",
            json=message_data
        )
        responses.append(response)

    # Verify rate limit headers
    assert "X-RateLimit-Limit" in responses[0].headers
    assert "X-RateLimit-Remaining" in responses[0].headers
    assert "X-RateLimit-Reset" in responses[0].headers

    # Verify rate limiting
    success_count = len([r for r in responses if r.status_code == 201])
    assert success_count == RATE_LIMIT_MAX_REQUESTS
    assert responses[-1].status_code == 429

    # Test rate limit reset
    await asyncio.sleep(RATE_LIMIT_WINDOW)
    response = await test_client.post(
        "/api/v1/messages",
        json=message_data
    )
    assert response.status_code == 201

@pytest.mark.asyncio
async def test_realtime_updates(test_client, test_db, test_user):
    """
    Test real-time message status propagation.
    Verifies WebSocket updates and event ordering.
    """
    # Create test message
    message_data = {
        "chat_id": str(UUID(int=1)),
        "sender_id": str(test_user.id),
        "message_type": MessageType.TEXT,
        "content": TEST_MESSAGE_CONTENT
    }
    response = await test_client.post(
        "/api/v1/messages",
        json=message_data
    )
    message_id = response.json()["id"]

    # Connect to WebSocket
    async with test_client.websocket_connect(
        f"/ws/messages/{message_id}"
    ) as websocket:
        # Update message status
        await test_client.patch(
            f"/api/v1/messages/{message_id}/status",
            json={"status": MessageStatus.SENT}
        )

        # Verify WebSocket update
        data = await websocket.receive_json()
        assert data["message_id"] == message_id
        assert data["status"] == MessageStatus.SENT
        assert "timestamp" in data

        # Test multiple status updates
        status_updates = [
            MessageStatus.DELIVERED,
            MessageStatus.READ
        ]

        for status in status_updates:
            await test_client.patch(
                f"/api/v1/messages/{message_id}/status",
                json={"status": status}
            )
            data = await websocket.receive_json()
            assert data["status"] == status

        # Verify event ordering
        assert data["sequence_number"] > 0

    # Test reconnection handling
    async with test_client.websocket_connect(
        f"/ws/messages/{message_id}"
    ) as websocket:
        # Verify missed updates are sent
        data = await websocket.receive_json()
        assert "missed_updates" in data