"""
Comprehensive test suite for campaign services including processor, scheduler, 
rate limiter, error handling, monitoring, and staggered sending components.

Version: 1.0.0
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any
import pytest
from unittest.mock import Mock, patch, AsyncMock
import fakeredis.aioredis
from prometheus_client import REGISTRY

from app.services.campaigns.processor import (
    CampaignProcessor,
    BATCH_SIZE,
    MAX_RETRIES,
    MIN_INTERVAL,
    MAX_INTERVAL
)
from app.models.campaigns import Campaign, CampaignStatus, CampaignType
from app.services.whatsapp.business_api import WhatsAppBusinessAPI
from app.core.rate_limiter import TokenBucketLimiter

# Test fixtures
@pytest.fixture
async def redis_client():
    """Fixture providing fake Redis client for testing."""
    client = fakeredis.aioredis.FakeRedis()
    yield client
    await client.close()

@pytest.fixture
def whatsapp_client():
    """Fixture providing mocked WhatsApp client."""
    client = AsyncMock(spec=WhatsAppBusinessAPI)
    client.send_message = AsyncMock(return_value={"success": True, "message_id": str(uuid.uuid4())})
    return client

@pytest.fixture
def campaign():
    """Fixture providing test campaign instance."""
    return Campaign(
        user_id=uuid.uuid4(),
        name="Test Campaign",
        campaign_type=CampaignType.SEQUENTIAL,
        message_template={"type": "text", "content": "Test message"},
        rate_limit=60
    )

@pytest.fixture
async def processor(campaign, whatsapp_client, redis_client):
    """Fixture providing configured campaign processor."""
    processor = CampaignProcessor(
        campaign_id=str(campaign.id),
        campaign=campaign,
        whatsapp_client=whatsapp_client,
        redis_url="redis://fake"
    )
    processor._redis_client = redis_client
    return processor

# Test cases
@pytest.mark.asyncio
async def test_campaign_batch_processing(processor, redis_client):
    """Test processing of campaign message batches with rate limiting."""
    # Prepare test messages
    messages = [
        {
            "id": str(uuid.uuid4()),
            "recipient": f"+5511999999{i:03d}",
            "content": {"type": "text", "body": f"Test message {i}"}
        }
        for i in range(BATCH_SIZE)
    ]
    
    # Queue test messages
    queue_key = f"campaign:{processor.campaign_id}:queue"
    for msg in messages:
        await redis_client.lpush(queue_key, json.dumps(msg))

    # Process batch
    batch_metrics = await processor.process_campaign_batch()

    # Verify metrics
    assert batch_metrics["processed"] == BATCH_SIZE
    assert batch_metrics["successful"] >= 0
    assert batch_metrics["failed"] >= 0
    assert batch_metrics["processing_time"] > 0

@pytest.mark.asyncio
async def test_rate_limiting_compliance(processor, redis_client):
    """Test campaign message rate limiting compliance."""
    # Configure test messages
    message = {
        "id": str(uuid.uuid4()),
        "recipient": "+5511999999999",
        "content": {"type": "text", "body": "Test message"}
    }
    
    # Send multiple messages and track timing
    start_time = datetime.utcnow()
    send_times = []
    
    for _ in range(5):
        await redis_client.lpush(
            f"campaign:{processor.campaign_id}:queue",
            json.dumps(message)
        )
        await processor.process_campaign_batch()
        send_times.append(datetime.utcnow())

    # Verify intervals
    for i in range(1, len(send_times)):
        interval = (send_times[i] - send_times[i-1]).total_seconds()
        assert MIN_INTERVAL <= interval <= MAX_INTERVAL

@pytest.mark.asyncio
async def test_error_handling_and_recovery(processor, redis_client, whatsapp_client):
    """Test campaign service error handling and recovery mechanisms."""
    # Configure test message
    message = {
        "id": str(uuid.uuid4()),
        "recipient": "+5511999999999",
        "content": {"type": "text", "body": "Test message"}
    }
    
    # Simulate network failure
    whatsapp_client.send_message.side_effect = ConnectionError("Network error")
    
    # Queue message and process
    await redis_client.lpush(
        f"campaign:{processor.campaign_id}:queue",
        json.dumps(message)
    )
    await processor.process_campaign_batch()

    # Verify retry queue
    retry_key = f"campaign:{processor.campaign_id}:retry"
    retry_count = await redis_client.hget(retry_key, message["id"])
    assert int(retry_count or 0) == 1

    # Verify error tracking
    assert processor._metrics["retry_count"] > 0
    assert "ConnectionError" in processor._error_counts

@pytest.mark.asyncio
async def test_staggered_sending(processor, redis_client):
    """Test staggered message sending with random intervals."""
    # Prepare test messages
    messages = [
        {
            "id": str(uuid.uuid4()),
            "recipient": f"+5511999999{i:03d}",
            "content": {"type": "text", "body": f"Test message {i}"}
        }
        for i in range(10)
    ]
    
    # Queue messages
    queue_key = f"campaign:{processor.campaign_id}:queue"
    for msg in messages:
        await redis_client.lpush(queue_key, json.dumps(msg))

    # Process messages and track intervals
    send_times = []
    while await redis_client.llen(queue_key) > 0:
        await processor.process_campaign_batch()
        send_times.append(datetime.utcnow())

    # Verify staggered intervals
    intervals = [
        (send_times[i] - send_times[i-1]).total_seconds()
        for i in range(1, len(send_times))
    ]
    
    assert all(MIN_INTERVAL <= interval <= MAX_INTERVAL for interval in intervals)
    assert len(set(intervals)) > 1  # Verify randomization

@pytest.mark.asyncio
async def test_campaign_metrics_collection(processor, redis_client):
    """Test campaign metrics collection and monitoring."""
    # Process some messages successfully
    success_message = {
        "id": str(uuid.uuid4()),
        "recipient": "+5511999999999",
        "content": {"type": "text", "body": "Success message"}
    }
    await redis_client.lpush(
        f"campaign:{processor.campaign_id}:queue",
        json.dumps(success_message)
    )
    await processor.process_campaign_batch()

    # Process some messages with failure
    with patch.object(processor._whatsapp_client, "send_message", 
                     side_effect=Exception("Test error")):
        fail_message = {
            "id": str(uuid.uuid4()),
            "recipient": "+5511999999998",
            "content": {"type": "text", "body": "Fail message"}
        }
        await redis_client.lpush(
            f"campaign:{processor.campaign_id}:queue",
            json.dumps(fail_message)
        )
        await processor.process_campaign_batch()

    # Verify metrics
    assert processor._metrics["processed"] > 0
    assert processor._metrics["successful"] > 0
    assert processor._metrics["failed"] > 0
    assert processor._metrics["average_processing_time"] > 0
    assert len(processor._error_counts) > 0

@pytest.mark.asyncio
async def test_campaign_status_transitions(processor, campaign):
    """Test campaign status transitions and validation."""
    # Start processor
    start_task = asyncio.create_task(processor.start_processor())
    
    # Verify initial status
    assert campaign.status == CampaignStatus.RUNNING

    # Stop processor
    processor._is_running = False
    await start_task

    # Verify final status
    assert campaign.status in [CampaignStatus.COMPLETED, CampaignStatus.FAILED]

@pytest.mark.asyncio
async def test_concurrent_campaign_processing(processor, redis_client):
    """Test concurrent campaign message processing."""
    # Prepare concurrent messages
    messages = [
        {
            "id": str(uuid.uuid4()),
            "recipient": f"+5511999999{i:03d}",
            "content": {"type": "text", "body": f"Concurrent message {i}"}
        }
        for i in range(5)
    ]
    
    # Queue messages
    queue_key = f"campaign:{processor.campaign_id}:queue"
    for msg in messages:
        await redis_client.lpush(queue_key, json.dumps(msg))

    # Process concurrently
    tasks = [
        processor.process_campaign_batch()
        for _ in range(3)
    ]
    results = await asyncio.gather(*tasks)

    # Verify concurrent processing
    total_processed = sum(r["processed"] for r in results)
    assert total_processed <= len(messages)
    assert processor._metrics["processed"] == total_processed