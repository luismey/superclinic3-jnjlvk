"""
Comprehensive test suite for WhatsApp service components.
Validates Web client, Business API, and message handler implementations
with focus on reliability, performance, security and compliance requirements.

Version: 1.0.0
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import AsyncMock, patch

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture
from pytest_benchmark.fixture import BenchmarkFixture

from app.services.whatsapp.web_client import WhatsAppWebClient
from app.services.whatsapp.business_api import WhatsAppBusinessAPI
from app.services.whatsapp.message_handler import MessageHandler
from app.models.messages import MessageType, MessageStatus
from app.core.exceptions import WhatsAppError
from app.utils.validators import MessageValidator

# Test Constants
TEST_PHONE = "+5511999999999"
TEST_MESSAGE = {
    "content": "Test message",
    "type": MessageType.TEXT,
    "metadata": {"campaign_id": str(uuid.uuid4())}
}
TEST_TEMPLATE = {
    "name": "test_template",
    "language": "pt_BR",
    "components": [{"type": "BODY", "text": "Test template"}]
}

@pytest.fixture
def web_client() -> WhatsAppWebClient:
    """Fixture for WhatsApp Web client with mocked dependencies."""
    security_config = {
        "max_message_size": 1024 * 1024,
        "allowed_message_types": ["text", "image", "document"],
        "require_encryption": True
    }
    return WhatsAppWebClient(TEST_PHONE, security_config)

@pytest.fixture
def business_api() -> WhatsAppBusinessAPI:
    """Fixture for WhatsApp Business API client with mocked dependencies."""
    return WhatsAppBusinessAPI(
        business_id="test_business",
        access_token="test_token",
        config={"rate_limit": 1000}
    )

@pytest.fixture
def message_handler(web_client, business_api) -> MessageHandler:
    """Fixture for MessageHandler with mocked dependencies."""
    return MessageHandler(
        web_client=web_client,
        business_api=business_api,
        assistant_manager=AsyncMock(),
        message_validator=MessageValidator(),
        redis_client=AsyncMock()
    )

@pytest.mark.asyncio
class TestWhatsAppWebClient:
    """Test suite for WhatsApp Web client functionality."""

    async def test_secure_connection(self, web_client: WhatsAppWebClient, mocker: MockerFixture):
        """Test secure WebSocket connection establishment with security validations."""
        mock_ws = AsyncMock()
        mocker.patch("websockets.connect", return_value=mock_ws)
        mock_redis = AsyncMock()
        mocker.patch("aioredis.from_url", return_value=mock_redis)

        # Test connection with security checks
        result = await web_client.connect()
        assert result is True
        assert web_client.is_connected

        # Verify security configurations
        mock_ws.send.assert_called_once()
        sent_data = json.loads(mock_ws.send.call_args[0][0])
        assert "action" in sent_data
        assert sent_data["phone"] == TEST_PHONE

        # Test session encryption
        mock_redis.get.assert_called_once()
        assert web_client._encryption_key is not None

    async def test_message_rate_limiting(self, web_client: WhatsAppWebClient, mocker: MockerFixture):
        """Test message rate limiting enforcement."""
        mocker.patch("websockets.connect", return_value=AsyncMock())
        mock_redis = AsyncMock()
        mocker.patch("aioredis.from_url", return_value=mock_redis)
        await web_client.connect()

        # Test within rate limit
        mock_redis.incr.return_value = 50
        result = await web_client.send_message(TEST_PHONE, TEST_MESSAGE)
        assert result["success"] is True

        # Test exceeding rate limit
        mock_redis.incr.return_value = 1001
        with pytest.raises(ValueError, match="Rate limit exceeded"):
            await web_client.send_message(TEST_PHONE, TEST_MESSAGE)

    async def test_message_validation(self, web_client: WhatsAppWebClient, mocker: MockerFixture):
        """Test message content validation and security checks."""
        mocker.patch("websockets.connect", return_value=AsyncMock())
        await web_client.connect()

        # Test valid message
        result = await web_client.send_message(TEST_PHONE, TEST_MESSAGE)
        assert result["success"] is True

        # Test message size limit
        large_message = TEST_MESSAGE.copy()
        large_message["content"] = "x" * (1024 * 1024 + 1)
        with pytest.raises(ValueError, match="Message size exceeds limit"):
            await web_client.send_message(TEST_PHONE, large_message)

        # Test invalid message type
        invalid_type_message = TEST_MESSAGE.copy()
        invalid_type_message["type"] = "invalid_type"
        with pytest.raises(ValueError, match="Invalid message type"):
            await web_client.send_message(TEST_PHONE, invalid_type_message)

@pytest.mark.asyncio
class TestWhatsAppBusinessAPI:
    """Test suite for WhatsApp Business API functionality."""

    async def test_rate_limit_enforcement(self, business_api: WhatsAppBusinessAPI, mocker: MockerFixture):
        """Test Business API rate limiting compliance."""
        mock_client = AsyncMock()
        mocker.patch.object(business_api, "client", mock_client)

        # Test successful message within rate limit
        mock_client.post.return_value.json.return_value = {
            "messages": [{"id": "test_id"}]
        }
        result = await business_api.send_message(TEST_PHONE, TEST_MESSAGE)
        assert result["success"] is True
        assert "message_id" in result

        # Test rate limit exceeded
        mock_client.post.side_effect = WhatsAppError(
            message="Rate limit exceeded",
            details={"retry_after": 3600}
        )
        with pytest.raises(WhatsAppError, match="Rate limit exceeded"):
            await business_api.send_message(TEST_PHONE, TEST_MESSAGE)

    async def test_template_management(self, business_api: WhatsAppBusinessAPI, mocker: MockerFixture):
        """Test template creation and validation."""
        mock_client = AsyncMock()
        mocker.patch.object(business_api, "client", mock_client)

        # Test template creation
        mock_client.post.return_value.json.return_value = {"id": "template_id"}
        result = await business_api.create_message_template(TEST_TEMPLATE)
        assert result["success"] is True
        assert "template_id" in result

        # Verify template validation
        invalid_template = TEST_TEMPLATE.copy()
        invalid_template["language"] = "invalid"
        with pytest.raises(WhatsAppError, match="Invalid template"):
            await business_api.create_message_template(invalid_template)

@pytest.mark.asyncio
class TestMessageHandler:
    """Test suite for message handling functionality."""

    @pytest.mark.benchmark
    async def test_message_processing_performance(
        self,
        message_handler: MessageHandler,
        benchmark: BenchmarkFixture
    ):
        """Benchmark message processing performance."""
        test_message = {
            "id": str(uuid.uuid4()),
            "content": "Test message",
            "type": MessageType.TEXT,
            "is_business_api": False
        }

        def run_benchmark():
            return asyncio.run(message_handler.process_message_with_monitoring(test_message))

        result = benchmark(run_benchmark)
        assert result["status"] == "success"
        assert "metrics" in result
        assert float(result["metrics"]["processing_time"]) < 0.5  # 500ms requirement

    async def test_error_handling(self, message_handler: MessageHandler):
        """Test comprehensive error handling and recovery."""
        test_message = {
            "id": str(uuid.uuid4()),
            "content": "Test message",
            "type": MessageType.TEXT,
            "is_business_api": False
        }

        # Test network error recovery
        with patch.object(message_handler._web_client, "send_message") as mock_send:
            mock_send.side_effect = [
                ConnectionError("Network error"),
                {"success": True}
            ]
            result = await message_handler.process_message_with_monitoring(test_message)
            assert result["status"] == "success"
            assert mock_send.call_count == 2  # Verify retry

        # Test circuit breaker
        with patch.object(message_handler._web_client, "send_message") as mock_send:
            mock_send.side_effect = ConnectionError("Network error")
            for _ in range(6):  # Exceed threshold
                result = await message_handler.process_message_with_monitoring(test_message)
            assert result["status"] == "circuit_breaker_triggered"

    async def test_ai_integration(self, message_handler: MessageHandler, mocker: MockerFixture):
        """Test AI assistant integration in message handling."""
        mock_assistant = AsyncMock()
        mocker.patch.object(message_handler, "_assistant_manager", mock_assistant)

        test_message = {
            "id": str(uuid.uuid4()),
            "content": "Test message",
            "type": MessageType.TEXT,
            "is_from_customer": True
        }

        # Test AI response generation
        mock_assistant.generate_response.return_value = "AI response"
        result = await message_handler.process_message_with_monitoring(test_message)
        assert result["status"] == "success"
        mock_assistant.generate_response.assert_called_once()

        # Test AI fallback handling
        mock_assistant.generate_response.side_effect = Exception("AI error")
        result = await message_handler.process_message_with_monitoring(test_message)
        assert result["status"] == "success"  # Should succeed with fallback