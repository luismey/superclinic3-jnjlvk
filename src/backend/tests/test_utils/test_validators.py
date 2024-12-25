"""
Test suite for validator utility functions in the Porfin WhatsApp automation platform.
Tests validation of messages, campaigns, and data structures with focus on Brazilian requirements.

Version: 1.0.0
"""

import pytest
import responses
from datetime import datetime, timedelta, timezone
from freezegun import freeze_time
from pydantic import ValidationError

from app.utils.validators import (
    validate_phone_number,
    validate_message_content,
    validate_campaign_schedule,
    validate_media_url
)
from app.utils.constants import (
    MessageType,
    CAMPAIGN_MIN_INTERVAL,
    CAMPAIGN_MAX_INTERVAL,
    WHATSAPP_DAILY_MESSAGE_LIMIT
)

# Test cases for phone number validation
PHONE_NUMBER_TEST_CASES = [
    # Valid cases
    ('5511999999999', True),  # Standard format with country code
    ('11999999999', True),    # Without country code
    ('5511988887777', True),  # Alternative valid mobile
    ('+5511999999999', True), # International format
    
    # Invalid cases
    ('1199999999', False),    # Too short
    ('5500999999999', False), # Invalid area code
    ('5511899999999', False), # Invalid mobile prefix (8)
    ('abc11999999999', False),# Invalid characters
    ('55119999', False),      # Incomplete number
    ('5511999999', False),    # Wrong length
    ('551199999999a', False), # Mixed invalid characters
]

# Test cases for message content validation
MESSAGE_CONTENT_TEST_CASES = [
    # Text messages
    ('Hello World', MessageType.TEXT, True),
    ('A' * 4096, MessageType.TEXT, True),  # Max length
    ('A' * 4097, MessageType.TEXT, False), # Exceeds max length
    ('<script>alert("xss")</script>', MessageType.TEXT, False), # Security risk
    ('javascript:alert(1)', MessageType.TEXT, False), # Security risk
    ('data:text/html,<script>', MessageType.TEXT, False), # Security risk
    
    # Image URLs
    ('https://whatsapp-cdn.com/image.jpg', MessageType.IMAGE, True),
    ('https://whatsapp-cdn.com/image.png', MessageType.IMAGE, True),
    ('http://unsecure-cdn.com/image.jpg', MessageType.IMAGE, False), # HTTP
    ('https://malicious.com/image.exe', MessageType.IMAGE, False), # Bad extension
    
    # Document URLs
    ('https://whatsapp-cdn.com/doc.pdf', MessageType.DOCUMENT, True),
    ('https://whatsapp-cdn.com/doc.docx', MessageType.DOCUMENT, True),
    ('https://whatsapp-cdn.com/script.js', MessageType.DOCUMENT, False), # Bad type
    ('https://whatsapp-cdn.com/malware.exe', MessageType.DOCUMENT, False), # Bad type
]

# Test cases for media URL validation
MEDIA_URL_TEST_CASES = [
    ('https://whatsapp-cdn.com/valid.jpg', True),
    ('https://storage.googleapis.com/porfin/image.png', True),
    ('http://unsecure.com/image.jpg', False),  # Not HTTPS
    ('https://malicious.com/file.exe', False), # Bad domain
    ('data:image/jpeg;base64,/9j...', False),  # Data URL
    ('file:///etc/passwd', False),             # Local file
    ('ftp://server/file.jpg', False),          # Wrong protocol
    ('not-a-url', False),                      # Invalid format
]

@pytest.mark.parametrize('phone_number,expected', PHONE_NUMBER_TEST_CASES)
def test_validate_phone_number(phone_number: str, expected: bool):
    """Tests Brazilian phone number validation with various formats."""
    result = validate_phone_number(phone_number)
    assert result.is_valid == expected, f"Failed for number: {phone_number}"

@pytest.mark.parametrize('content,message_type,expected', MESSAGE_CONTENT_TEST_CASES)
@pytest.mark.asyncio
async def test_validate_message_content(content: str, message_type: MessageType, expected: bool):
    """Tests message content validation with security considerations."""
    result = validate_message_content(content, message_type)
    assert result.is_valid == expected, f"Failed for content: {content}, type: {message_type}"

@pytest.mark.asyncio
@freeze_time("2024-01-15 12:00:00")
async def test_validate_campaign_schedule():
    """Tests campaign schedule validation with Brazilian timezone rules."""
    br_tz = timezone(timedelta(hours=-3))
    
    # Test valid business hours (8am-8pm BRT)
    valid_schedule = {
        'start_time': datetime.now(br_tz).replace(hour=10).isoformat(),
        'end_time': datetime.now(br_tz).replace(hour=15).isoformat(),
        'interval_seconds': 90
    }
    result = validate_campaign_schedule(valid_schedule)
    assert result.is_valid, "Valid schedule within business hours failed"
    
    # Test outside business hours
    invalid_schedule = {
        'start_time': datetime.now(br_tz).replace(hour=7).isoformat(),  # Too early
        'end_time': datetime.now(br_tz).replace(hour=15).isoformat(),
        'interval_seconds': 90
    }
    result = validate_campaign_schedule(invalid_schedule)
    assert not result.is_valid, "Schedule outside business hours should fail"
    
    # Test interval limits
    invalid_interval = {
        'start_time': datetime.now(br_tz).replace(hour=10).isoformat(),
        'end_time': datetime.now(br_tz).replace(hour=15).isoformat(),
        'interval_seconds': CAMPAIGN_MIN_INTERVAL - 1  # Too short
    }
    result = validate_campaign_schedule(invalid_interval)
    assert not result.is_valid, "Schedule with invalid interval should fail"
    
    # Test daily message limit
    too_many_messages = {
        'start_time': datetime.now(br_tz).replace(hour=8).isoformat(),
        'end_time': datetime.now(br_tz).replace(hour=20).isoformat(),
        'interval_seconds': 60  # Will exceed daily limit
    }
    result = validate_campaign_schedule(too_many_messages)
    assert not result.is_valid, "Schedule exceeding daily message limit should fail"

@pytest.mark.parametrize('url,expected', MEDIA_URL_TEST_CASES)
@pytest.mark.asyncio
@responses.activate
async def test_validate_media_url(url: str, expected: bool):
    """Tests media URL validation with security and accessibility checks."""
    # Mock successful responses for valid URLs
    if expected:
        responses.add(
            responses.HEAD,
            url,
            status=200,
            headers={
                'Content-Type': 'image/jpeg',
                'Content-Length': '1048576'  # 1MB
            }
        )
    
    result = validate_media_url(url)
    assert result.is_valid == expected, f"Failed for URL: {url}"
    
    # Test specific security cases
    malicious_urls = [
        'https://whatsapp-cdn.com/../../etc/passwd',  # Path traversal
        'https://whatsapp-cdn.com/%2e%2e%2f',        # Encoded traversal
        'https://whatsapp-cdn.com/file.php?cmd=ls',   # Command injection
        'https://169.254.169.254/metadata',           # SSRF attempt
    ]
    
    for url in malicious_urls:
        result = validate_media_url(url)
        assert not result.is_valid, f"Security check failed for malicious URL: {url}"