"""
Validation module for the Porfin WhatsApp automation platform.
Provides comprehensive validation functions for WhatsApp messages, campaigns, and data structures.
Implements strict business rules, rate limiting, and security constraints.

Version: 1.0.0
"""

from datetime import datetime, timedelta, timezone
import re
from functools import cache
from pydantic import ValidationError, URLValidator
from typing import Dict, Union, Optional

from ..utils.constants import (
    MessageType,
    CAMPAIGN_MIN_INTERVAL,
    CAMPAIGN_MAX_INTERVAL,
    WHATSAPP_DAILY_MESSAGE_LIMIT
)

# Cached regex patterns for improved performance
@cache
def get_phone_pattern():
    """Returns compiled regex pattern for Brazilian phone numbers."""
    return re.compile(r'^\+?55(\d{2})(9?\d{8})$')

@cache
def get_url_pattern():
    """Returns compiled regex pattern for URL validation."""
    return re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)

# Media configuration
ALLOWED_MIME_TYPES = {
    MessageType.IMAGE: {'image/jpeg', 'image/png', 'image/webp'},
    MessageType.DOCUMENT: {'application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
}

MAX_FILE_SIZES = {
    MessageType.IMAGE: 5 * 1024 * 1024,  # 5MB
    MessageType.DOCUMENT: 10 * 1024 * 1024,  # 10MB
}

class ValidationResult:
    """Structured validation result with context."""
    def __init__(self, is_valid: bool, error_message: Optional[str] = None):
        self.is_valid = is_valid
        self.error_message = error_message

def validate_phone_number(phone_number: str) -> ValidationResult:
    """
    Validates Brazilian phone number format with area code verification.
    
    Args:
        phone_number: String containing the phone number to validate
        
    Returns:
        ValidationResult with validation status and error message if invalid
    """
    # Remove all non-digit characters
    cleaned_number = re.sub(r'\D', '', phone_number)
    
    # Check if number starts with country code (55)
    if not cleaned_number.startswith('55'):
        return ValidationResult(False, "Phone number must start with Brazil country code (55)")
    
    # Match against Brazilian phone pattern
    match = get_phone_pattern().match(cleaned_number)
    if not match:
        return ValidationResult(False, "Invalid phone number format")
    
    # Extract and validate area code
    area_code = int(match.group(1))
    if not (10 <= area_code <= 99):
        return ValidationResult(False, f"Invalid area code: {area_code}")
    
    # Validate mobile prefix (must start with 9)
    if not match.group(2).startswith('9'):
        return ValidationResult(False, "Mobile numbers must start with 9")
    
    return ValidationResult(True)

def validate_message_content(content: str, message_type: MessageType) -> ValidationResult:
    """
    Validates message content with enhanced security and type checking.
    
    Args:
        content: Message content to validate
        message_type: Type of message (TEXT, IMAGE, DOCUMENT, etc.)
        
    Returns:
        ValidationResult with validation status and error message if invalid
    """
    if not content:
        return ValidationResult(False, "Content cannot be empty")
    
    if message_type == MessageType.TEXT:
        # Validate text message
        if len(content) > 4096:
            return ValidationResult(False, "Text message exceeds maximum length of 4096 characters")
        
        # Check for potentially malicious content
        if re.search(r'<script|javascript:|data:', content, re.IGNORECASE):
            return ValidationResult(False, "Content contains potentially malicious code")
            
    elif message_type in (MessageType.IMAGE, MessageType.DOCUMENT):
        # Validate media URL
        url_validation = validate_media_url(content)
        if not url_validation.is_valid:
            return url_validation
            
    return ValidationResult(True)

def validate_campaign_schedule(schedule_config: Dict) -> ValidationResult:
    """
    Validates campaign schedule with business rules and rate limiting.
    
    Args:
        schedule_config: Dictionary containing campaign schedule configuration
        
    Returns:
        ValidationResult with validation status and error message if invalid
    """
    try:
        # Validate required fields
        required_fields = {'start_time', 'end_time', 'interval_seconds'}
        if not all(field in schedule_config for field in required_fields):
            return ValidationResult(False, "Missing required schedule configuration fields")
        
        # Parse times
        start_time = datetime.fromisoformat(schedule_config['start_time'])
        end_time = datetime.fromisoformat(schedule_config['end_time'])
        
        # Validate time range
        if end_time <= start_time:
            return ValidationResult(False, "End time must be after start time")
        
        # Validate business hours (8am-8pm BR time)
        br_tz = timezone(timedelta(hours=-3))  # Brazilian timezone (UTC-3)
        start_br = start_time.astimezone(br_tz)
        if not (8 <= start_br.hour < 20):
            return ValidationResult(False, "Campaigns can only run between 8am and 8pm BRT")
        
        # Validate interval
        interval = schedule_config['interval_seconds']
        if not (CAMPAIGN_MIN_INTERVAL <= interval <= CAMPAIGN_MAX_INTERVAL):
            return ValidationResult(
                False,
                f"Interval must be between {CAMPAIGN_MIN_INTERVAL} and {CAMPAIGN_MAX_INTERVAL} seconds"
            )
        
        # Calculate and validate daily message limit
        campaign_duration = end_time - start_time
        max_messages = int(campaign_duration.total_seconds() / interval)
        if max_messages > WHATSAPP_DAILY_MESSAGE_LIMIT:
            return ValidationResult(False, f"Campaign exceeds daily message limit of {WHATSAPP_DAILY_MESSAGE_LIMIT}")
        
        return ValidationResult(True)
        
    except (ValueError, TypeError) as e:
        return ValidationResult(False, f"Invalid schedule configuration: {str(e)}")

def validate_media_url(url: str) -> ValidationResult:
    """
    Validates media URLs with security and accessibility checks.
    
    Args:
        url: URL string to validate
        
    Returns:
        ValidationResult with validation status and error message if invalid
    """
    # Basic URL format validation
    if not get_url_pattern().match(url):
        return ValidationResult(False, "Invalid URL format")
    
    # Ensure HTTPS
    if not url.startswith('https://'):
        return ValidationResult(False, "Media URLs must use HTTPS")
    
    try:
        # Use Pydantic's URL validator for thorough checking
        URLValidator()(url)
    except ValidationError as e:
        return ValidationResult(False, f"Invalid URL: {str(e)}")
    
    # Additional security checks could be implemented here
    # For example: checking against allowed domains, validating SSL certificates
    
    return ValidationResult(True)

# Export validation functions
__all__ = [
    'validate_phone_number',
    'validate_message_content',
    'validate_campaign_schedule',
    'validate_media_url',
    'ValidationResult'
]