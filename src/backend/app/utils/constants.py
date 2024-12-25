"""
Central constants module for the Porfin WhatsApp automation platform.
Defines system-wide constants, limits, and enumerations used throughout the backend.

Version: 1.0.0
"""

from enum import Enum

# API and Project Configuration
API_V1_PREFIX = "/api/v1"
PROJECT_NAME = "Porfin"
VERSION = "1.0.0"

# WhatsApp Rate Limiting and Queue Configuration
WHATSAPP_DAILY_MESSAGE_LIMIT = 1000  # Maximum messages per day per number
WHATSAPP_QUEUE_PREFIX = "whatsapp:queue:"  # Redis queue prefix for WhatsApp messages
WHATSAPP_RATE_LIMIT_PREFIX = "whatsapp:rate:"  # Redis rate limit key prefix

# Campaign Configuration
CAMPAIGN_MIN_INTERVAL = 60  # Minimum interval between campaign messages in seconds
CAMPAIGN_MAX_INTERVAL = 120  # Maximum interval between campaign messages in seconds
CAMPAIGN_WINDOW_SECONDS = 86400  # Campaign execution window (24 hours)

# Message Processing Configuration
MESSAGE_RETRY_MAX_ATTEMPTS = 3  # Maximum retry attempts for failed messages
MESSAGE_RETRY_DELAY_SECONDS = 5  # Delay between retry attempts in seconds

# Pagination Configuration
DEFAULT_PAGE_SIZE = 20  # Default number of items per page
MAX_PAGE_SIZE = 100  # Maximum allowed items per page

# Cache and Token Configuration
CACHE_TTL_SECONDS = 300  # Default cache TTL (5 minutes)
TOKEN_EXPIRE_MINUTES = 60  # JWT token expiration time (1 hour)

class MessageType(str, Enum):
    """
    Enumeration of supported WhatsApp message types.
    Used for message validation and processing.
    """
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    LOCATION = "location"

class MessageStatus(str, Enum):
    """
    Enumeration of possible message delivery status states.
    Used for tracking message delivery and reporting.
    """
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"

class CampaignStatus(str, Enum):
    """
    Enumeration of possible campaign execution status states.
    Used for campaign lifecycle management.
    """
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    PAUSED = "paused"
    FAILED = "failed"

class ErrorCodes(str, Enum):
    """
    Enumeration of application-wide error codes.
    Used for consistent error handling and monitoring across the platform.
    """
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_MESSAGE_TYPE = "invalid_message_type"
    WHATSAPP_ERROR = "whatsapp_error"
    CAMPAIGN_ERROR = "campaign_error"
    AUTHENTICATION_ERROR = "authentication_error"
    VALIDATION_ERROR = "validation_error"

# Export all enums for use in other modules
__all__ = [
    "MessageType",
    "MessageStatus",
    "CampaignStatus",
    "ErrorCodes"
]