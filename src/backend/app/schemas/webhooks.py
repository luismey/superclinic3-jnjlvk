"""
Pydantic schemas for WhatsApp webhook payload validation and processing.
Implements comprehensive validation, security checks, and processing logic for incoming webhooks.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, Dict, List, Any
import hmac
import hashlib
import logging
from redis import Redis

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException

from ..models.messages import MessageStatus

# Configure logging
logger = logging.getLogger(__name__)

# Redis client for rate limiting
redis_client = Redis.from_url("redis://localhost:6379/0")

class WebhookVerification(BaseModel):
    """
    Schema for WhatsApp webhook verification challenge.
    Implements the verification protocol required by WhatsApp Business API.
    """
    mode: str = Field(..., description="Verification mode from WhatsApp")
    challenge: str = Field(..., description="Challenge string to echo back")
    verify_token: str = Field(..., description="Token to verify webhook source")

    @validator("mode")
    def validate_mode(cls, v: str) -> str:
        """Validate the verification mode."""
        if v != "subscribe":
            raise ValueError("Invalid verification mode")
        return v

    def validate_token(self, config_token: str) -> bool:
        """
        Validates the webhook verification token against configured value.

        Args:
            config_token: Configured verification token to check against

        Returns:
            bool: True if token is valid
        """
        try:
            return hmac.compare_digest(self.verify_token, config_token)
        except Exception as e:
            logger.error(f"Token validation failed: {str(e)}")
            return False

class WebhookSecurity(BaseModel):
    """
    Security handler for webhook requests with signature verification and rate limiting.
    Implements enterprise-grade security measures for webhook processing.
    """
    signature: str = Field(..., description="X-Hub-Signature-256 header value")
    timestamp: str = Field(..., description="Request timestamp")
    headers: Dict[str, Any] = Field(default_factory=dict, description="Request headers")

    def verify_signature(self, payload: str, secret: str) -> bool:
        """
        Verifies webhook signature using HMAC SHA-256.

        Args:
            payload: Raw request payload
            secret: Webhook secret for verification

        Returns:
            bool: True if signature is valid

        Raises:
            HTTPException: If signature verification fails
        """
        try:
            # Generate expected signature
            expected_sig = hmac.new(
                secret.encode(),
                msg=payload.encode(),
                digestmod=hashlib.sha256
            ).hexdigest()

            # Verify using constant-time comparison
            if not hmac.compare_digest(f"sha256={expected_sig}", self.signature):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid webhook signature"
                )

            return True

        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Signature verification failed"
            )

    def check_rate_limit(self, endpoint: str) -> bool:
        """
        Implements rate limiting per endpoint using Redis.

        Args:
            endpoint: API endpoint being accessed

        Returns:
            bool: True if within rate limits

        Raises:
            HTTPException: If rate limit exceeded
        """
        try:
            # Rate limit key format: webhook:{endpoint}:{hour}
            hour = datetime.utcnow().strftime("%Y-%m-%d-%H")
            key = f"webhook:{endpoint}:{hour}"

            # Increment counter
            current = redis_client.incr(key)

            # Set expiry if new key
            if current == 1:
                redis_client.expire(key, 3600)  # 1 hour

            # Check against limit
            if current > 1000:  # 1000 requests per hour per endpoint
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded"
                )

            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Rate limit check failed: {str(e)}")
            return False

class MessageUpdate(BaseModel):
    """
    Schema for message status update events.
    """
    message_id: str = Field(..., description="WhatsApp message ID")
    status: MessageStatus = Field(..., description="New message status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WebhookPayload(BaseModel):
    """
    Root schema for all incoming webhooks with enhanced validation.
    Implements comprehensive payload processing and security checks.
    """
    object: str = Field(..., description="Webhook object type")
    entry: List[Dict[str, Any]] = Field(..., description="Webhook entries")
    security: WebhookSecurity = Field(..., description="Security context")

    @validator("object")
    def validate_object(cls, v: str) -> str:
        """Validate webhook object type."""
        if v != "whatsapp_business_account":
            raise ValueError("Invalid webhook object type")
        return v

    def parse_entries(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Parse and validate webhook entries with security checks.

        Returns:
            Dict[str, List]: Validated entries by type

        Raises:
            HTTPException: If validation or processing fails
        """
        try:
            # Initialize result containers
            result = {
                "messages": [],
                "statuses": [],
                "errors": []
            }

            # Process each entry
            for entry in self.entry:
                changes = entry.get("changes", [])
                
                for change in changes:
                    value = change.get("value", {})
                    
                    # Process messages
                    if "messages" in value:
                        result["messages"].extend(value["messages"])
                        
                    # Process status updates
                    if "statuses" in value:
                        result["statuses"].extend(value["statuses"])

            logger.info(
                f"Processed webhook entries: {len(result['messages'])} messages, "
                f"{len(result['statuses'])} status updates"
            )
            
            return result

        except Exception as e:
            logger.error(f"Webhook entry parsing failed: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail="Failed to parse webhook entries"
            )

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }