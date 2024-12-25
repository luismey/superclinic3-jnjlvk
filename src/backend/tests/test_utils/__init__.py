"""
Test utilities initialization module for Porfin WhatsApp automation platform.
Provides test fixtures, helper functions, and shared test data for validating core utility functions.

Version: 1.0.0
"""

# pytest v7.0.0
# freezegun v1.2.0
import pytest
import asyncio
from freezegun import freeze_time
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta

from app.utils.constants import MessageType as WhatsAppMessageType
from app.core.exceptions import ValidationError, RateLimitExceeded

# Test phone numbers for validation scenarios
TEST_PHONE_NUMBERS = [
    '+5511999999999',  # Valid BR format
    '+5521888888888',  # Valid BR format
    '1234567890',      # Invalid format
    'invalid'          # Non-numeric
]

# Test messages covering all supported WhatsApp message types
TEST_MESSAGES = [
    {
        'type': WhatsAppMessageType.TEXT,
        'content': 'Test message'
    },
    {
        'type': WhatsAppMessageType.IMAGE,
        'url': 'https://example.com/image.jpg'
    },
    {
        'type': WhatsAppMessageType.DOCUMENT,
        'url': 'https://example.com/doc.pdf'
    },
    {
        'type': WhatsAppMessageType.AUDIO,
        'url': 'https://example.com/audio.mp3'
    },
    {
        'type': WhatsAppMessageType.VIDEO,
        'url': 'https://example.com/video.mp4'
    },
    {
        'type': WhatsAppMessageType.LOCATION,
        'latitude': -23.550520,
        'longitude': -46.633308
    }
]

# Test HTML content for sanitization testing
TEST_HTML_CONTENT = [
    '<p>Safe HTML</p>',
    '<script>alert("xss")</script>',
    '<iframe src="evil.com"></iframe>',
    '<img src="x" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Click</a>',
    '<style>@import url("evil.css")</style>',
    '<div onmouseover="alert(1)">Hover</div>'
]

# Rate limit configurations for testing
RATE_LIMITS = {
    'messages_per_second': 1,
    'messages_per_minute': 60,
    'messages_per_day': 1000
}

@pytest.mark.asyncio
async def create_test_message(
    message_type: str,
    content: str,
    additional_params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a test message with specified type and content.
    
    Args:
        message_type: WhatsApp message type
        content: Message content or URL
        additional_params: Optional additional message parameters
        
    Returns:
        Dict containing formatted test message
        
    Raises:
        ValidationError: If message type or content is invalid
    """
    # Validate message type
    if message_type not in WhatsAppMessageType.__members__:
        raise ValidationError(f"Invalid message type: {message_type}")
        
    # Create base message
    message = {
        'type': message_type,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Add type-specific content
    if message_type == WhatsAppMessageType.TEXT:
        if not content or len(content) > 4096:
            raise ValidationError("Text content must be between 1 and 4096 characters")
        message['content'] = content
        
    elif message_type in [WhatsAppMessageType.IMAGE, WhatsAppMessageType.DOCUMENT,
                         WhatsAppMessageType.AUDIO, WhatsAppMessageType.VIDEO]:
        if not content.startswith(('http://', 'https://')):
            raise ValidationError("Media URL must be a valid HTTP(S) URL")
        message['url'] = content
        
    elif message_type == WhatsAppMessageType.LOCATION:
        try:
            lat, lon = map(float, content.split(','))
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError
            message.update({'latitude': lat, 'longitude': lon})
        except (ValueError, AttributeError):
            raise ValidationError("Invalid location format. Use 'latitude,longitude'")
            
    # Add additional parameters if provided
    if additional_params:
        message.update(additional_params)
        
    return message

@pytest.mark.asyncio
async def create_test_schedule(
    start_time: datetime,
    batch_size: int,
    interval_seconds: int,
    rate_limits: Dict[str, int]
) -> Dict[str, Any]:
    """
    Create a test campaign schedule with specified parameters.
    
    Args:
        start_time: Schedule start time
        batch_size: Messages per batch
        interval_seconds: Seconds between batches
        rate_limits: Rate limit configurations
        
    Returns:
        Dict containing schedule configuration
        
    Raises:
        ValidationError: If schedule parameters are invalid
    """
    # Validate start time
    if start_time <= datetime.utcnow():
        raise ValidationError("Start time must be in the future")
        
    # Validate batch parameters
    if batch_size < 1:
        raise ValidationError("Batch size must be positive")
    if interval_seconds < 60 or interval_seconds > 120:
        raise ValidationError("Interval must be between 60 and 120 seconds")
        
    # Calculate daily capacity
    seconds_per_day = 24 * 60 * 60
    max_daily_batches = seconds_per_day // interval_seconds
    daily_capacity = batch_size * max_daily_batches
    
    # Validate against rate limits
    if daily_capacity > rate_limits['messages_per_day']:
        raise ValidationError(f"Schedule exceeds daily message limit of {rate_limits['messages_per_day']}")
        
    # Create schedule configuration
    schedule = {
        'start_time': start_time.isoformat(),
        'batch_size': batch_size,
        'interval_seconds': interval_seconds,
        'end_time': (start_time + timedelta(days=1)).isoformat(),
        'estimated_daily_messages': daily_capacity,
        'rate_limits': rate_limits
    }
    
    return schedule

def mock_rate_limiter(limits: Dict[str, int], should_fail: bool = False) -> Callable:
    """
    Create a mock rate limiter for testing rate limit scenarios.
    
    Args:
        limits: Rate limit thresholds
        should_fail: Whether the rate limiter should simulate failure
        
    Returns:
        Mock rate limiter function
    """
    async def rate_limiter(*args, **kwargs) -> bool:
        if should_fail:
            raise RateLimitExceeded("Rate limit exceeded")
            
        # Simulate rate limit check
        return True
        
    rate_limiter.limits = limits
    return rate_limiter

# Export test utilities
__all__ = [
    'create_test_message',
    'create_test_schedule',
    'mock_rate_limiter',
    'TEST_PHONE_NUMBERS',
    'TEST_MESSAGES',
    'TEST_HTML_CONTENT',
    'RATE_LIMITS'
]