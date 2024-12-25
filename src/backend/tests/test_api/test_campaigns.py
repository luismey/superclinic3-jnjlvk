"""
Comprehensive test suite for campaign management API endpoints.
Tests CRUD operations, campaign processing, rate limiting, message delivery, 
metrics tracking, and error handling scenarios.

pytest version: ^7.0.0
pytest_asyncio version: ^0.20.0
pytest_mock version: ^3.10.0
"""

import json
import uuid
from datetime import datetime, timedelta
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.models.campaigns import Campaign, CampaignStatus, CampaignType
from app.services.campaigns.processor import CampaignProcessor
from app.core.config import settings

# Test fixtures
@pytest.fixture
def test_campaign_data():
    """Fixture providing valid campaign test data."""
    return {
        "name": "Test Campaign",
        "type": CampaignType.SEQUENTIAL,
        "message_template": {
            "type": "text",
            "content": "Test message {{customer_name}}",
            "variables": ["customer_name"]
        },
        "target_filters": {
            "segment": "active_customers",
            "tags": ["retail"]
        },
        "schedule_config": {
            "start_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "end_time": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "timezone": "America/Sao_Paulo"
        },
        "rate_limit": 60
    }

@pytest.fixture
async def redis_mock(mocker):
    """Mock Redis client for testing rate limiting."""
    mock_redis = mocker.AsyncMock(spec=Redis)
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = True
    return mock_redis

@pytest.fixture
async def whatsapp_mock(mocker):
    """Mock WhatsApp client for testing message delivery."""
    mock_client = mocker.AsyncMock()
    mock_client.send_message.return_value = {
        "success": True,
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat()
    }
    return mock_client

# Test cases
@pytest.mark.asyncio
async def test_create_campaign(client: TestClient, db_session, test_campaign_data):
    """Test campaign creation with validation."""
    response = await client.post(
        "/api/v1/campaigns/",
        json=test_campaign_data
    )

    assert response.status_code == 201
    data = response.json()
    
    # Verify response schema
    assert "id" in data
    assert data["name"] == test_campaign_data["name"]
    assert data["type"] == test_campaign_data["type"]
    assert data["status"] == CampaignStatus.DRAFT.value
    
    # Verify database record
    campaign = await db_session.get(Campaign, data["id"])
    assert campaign is not None
    assert campaign.rate_limit == test_campaign_data["rate_limit"]
    assert campaign.message_template == test_campaign_data["message_template"]

@pytest.mark.asyncio
async def test_campaign_validation(client: TestClient, test_campaign_data):
    """Test campaign data validation rules."""
    # Test invalid rate limit
    invalid_data = test_campaign_data.copy()
    invalid_data["rate_limit"] = 30  # Below minimum 60s
    
    response = await client.post(
        "/api/v1/campaigns/",
        json=invalid_data
    )
    assert response.status_code == 422
    
    # Test invalid schedule
    invalid_data = test_campaign_data.copy()
    invalid_data["schedule_config"]["start_time"] = "invalid_date"
    
    response = await client.post(
        "/api/v1/campaigns/",
        json=invalid_data
    )
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_campaign_rate_limiting(
    client: TestClient,
    db_session,
    redis_mock,
    whatsapp_mock,
    test_campaign_data
):
    """Test campaign message rate limiting compliance."""
    # Create test campaign
    campaign = Campaign(
        user_id=uuid.uuid4(),
        name=test_campaign_data["name"],
        campaign_type=test_campaign_data["type"],
        message_template=test_campaign_data["message_template"],
        rate_limit=60
    )
    db_session.add(campaign)
    await db_session.commit()
    
    # Initialize processor
    processor = CampaignProcessor(
        campaign_id=str(campaign.id),
        campaign=campaign,
        whatsapp_client=whatsapp_mock,
        redis_url=settings.REDIS_URL
    )
    
    # Test message sending with rate limiting
    messages = [
        {
            "recipient": f"+5511999999{i:03d}",
            "content": {"text": f"Test message {i}"}
        }
        for i in range(5)
    ]
    
    send_times = []
    for message in messages:
        start_time = datetime.utcnow()
        result = await processor.process_message(message)
        send_times.append(datetime.utcnow())
        
        assert result["success"] is True
        
        if len(send_times) > 1:
            # Verify rate limiting interval
            time_diff = (send_times[-1] - send_times[-2]).total_seconds()
            assert 60 <= time_diff <= 120

@pytest.mark.asyncio
async def test_campaign_metrics(
    client: TestClient,
    db_session,
    test_campaign_data
):
    """Test campaign metrics tracking and reporting."""
    # Create test campaign
    campaign = Campaign(
        user_id=uuid.uuid4(),
        name=test_campaign_data["name"],
        campaign_type=test_campaign_data["type"],
        message_template=test_campaign_data["message_template"]
    )
    db_session.add(campaign)
    await db_session.commit()
    
    # Simulate message processing
    campaign.total_recipients = 100
    campaign.messages_sent = 75
    campaign.messages_delivered = 70
    campaign.messages_failed = 5
    
    # Update metrics
    metrics = campaign.update_metrics()
    
    # Verify metric calculations
    assert metrics["success_rate"] == 93.33333333333333  # 70/75 * 100
    assert metrics["bounce_rate"] == 6.25  # 5/80 * 100
    assert metrics["completion_percentage"] == 75.0  # 75/100 * 100
    
    # Verify metrics endpoint
    response = await client.get(f"/api/v1/campaigns/{campaign.id}/metrics")
    assert response.status_code == 200
    data = response.json()
    
    assert "delivery_metrics" in data
    assert data["delivery_metrics"]["success_rate"] == metrics["success_rate"]

@pytest.mark.asyncio
async def test_campaign_status_transitions(
    client: TestClient,
    db_session,
    test_campaign_data
):
    """Test campaign status transitions and validation."""
    # Create test campaign
    campaign = Campaign(
        user_id=uuid.uuid4(),
        name=test_campaign_data["name"],
        campaign_type=test_campaign_data["type"],
        message_template=test_campaign_data["message_template"]
    )
    db_session.add(campaign)
    await db_session.commit()
    
    # Test valid transitions
    valid_transitions = [
        (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED),
        (CampaignStatus.SCHEDULED, CampaignStatus.RUNNING),
        (CampaignStatus.RUNNING, CampaignStatus.COMPLETED)
    ]
    
    for current, next_status in valid_transitions:
        campaign.status = current
        assert campaign.update_status(next_status) is True
        assert campaign.status == next_status
    
    # Test invalid transition
    campaign.status = CampaignStatus.COMPLETED
    assert campaign.update_status(CampaignStatus.RUNNING) is False

@pytest.mark.asyncio
async def test_campaign_error_handling(
    client: TestClient,
    db_session,
    whatsapp_mock,
    test_campaign_data
):
    """Test campaign error handling and recovery."""
    # Create test campaign
    campaign = Campaign(
        user_id=uuid.uuid4(),
        name=test_campaign_data["name"],
        campaign_type=test_campaign_data["type"],
        message_template=test_campaign_data["message_template"]
    )
    db_session.add(campaign)
    await db_session.commit()
    
    # Simulate WhatsApp API failure
    whatsapp_mock.send_message.side_effect = Exception("API Error")
    
    processor = CampaignProcessor(
        campaign_id=str(campaign.id),
        campaign=campaign,
        whatsapp_client=whatsapp_mock,
        redis_url=settings.REDIS_URL
    )
    
    # Test message processing with error
    result = await processor.process_message({
        "recipient": "+5511999999999",
        "content": {"text": "Test message"}
    })
    
    assert result["success"] is False
    assert "error" in result
    
    # Verify campaign status update
    assert campaign.status == CampaignStatus.FAILED
    assert len(campaign.error_logs) > 0