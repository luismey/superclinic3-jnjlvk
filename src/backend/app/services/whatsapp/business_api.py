# httpx v0.24.0
# tenacity v8.2.0
# asyncio v3.11.0

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Optional, Any
from urllib.parse import urljoin

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from app.core.config import settings
from app.core.exceptions import WhatsAppError, ERROR_RESPONSES
from app.core.rate_limiter import TokenBucketLimiter
from app.core.logging import get_logger

# Configure logger with security and performance monitoring
logger = get_logger(__name__, enable_security_logging=True, enable_performance_logging=True)

# Constants
API_BASE_URL = "https://graph.facebook.com/v17.0"
RATE_LIMIT_KEY_PREFIX = "whatsapp:business:rate:"
MAX_RETRIES = 3
RETRY_DELAY = 5
CORRELATION_ID_HEADER = "X-Correlation-ID"

class WhatsAppBusinessAPI:
    """Enterprise-grade WhatsApp Business API client implementation."""

    def __init__(
        self,
        business_id: str = settings.WHATSAPP_BUSINESS_ID,
        access_token: str = settings.WHATSAPP_ACCESS_TOKEN.get_secret_value(),
        config: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize WhatsApp Business API client with enhanced configuration."""
        self.business_id = business_id
        self.access_token = access_token
        self.config = config or {}

        # Initialize HTTP client with connection pooling and timeouts
        self.client = httpx.AsyncClient(
            base_url=API_BASE_URL,
            timeout=httpx.Timeout(30.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        )

        # Initialize rate limiter
        self.rate_limiter = TokenBucketLimiter(
            key_prefix=RATE_LIMIT_KEY_PREFIX,
            max_tokens=1000,  # WhatsApp daily limit per number
            refill_period=86400  # 24 hours
        )

        # Configure retry mechanism
        self.retry_config = {
            "wait": wait_exponential(multiplier=RETRY_DELAY),
            "stop": stop_after_attempt(MAX_RETRIES),
            "retry": retry_if_exception_type((httpx.HTTPError, asyncio.TimeoutError))
        }

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self.client.aclose()

    @retry(
        wait=wait_exponential(multiplier=RETRY_DELAY),
        stop=stop_after_attempt(MAX_RETRIES),
        retry=retry_if_exception_type((httpx.HTTPError, asyncio.TimeoutError))
    )
    async def send_message(
        self,
        phone_number: str,
        message_data: Dict[str, Any],
        bypass_rate_limit: bool = False
    ) -> Dict[str, Any]:
        """Send message through WhatsApp Business API with rate limiting and retries."""
        correlation_id = str(uuid.uuid4())
        start_time = datetime.utcnow()

        try:
            # Check rate limit unless bypassed
            if not bypass_rate_limit:
                rate_limit_result = await self.rate_limiter.check_rate_limit(phone_number)
                if not rate_limit_result["allowed"]:
                    raise WhatsAppError(
                        message="Rate limit exceeded for phone number",
                        details={
                            "phone_number": phone_number,
                            "retry_after": rate_limit_result["retry_after"]
                        }
                    )

            # Prepare request payload
            endpoint = f"/{self.business_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": phone_number,
                **message_data
            }

            # Send request with correlation ID
            response = await self.client.post(
                endpoint,
                json=payload,
                headers={CORRELATION_ID_HEADER: correlation_id}
            )
            response.raise_for_status()

            # Process response
            result = response.json()
            
            # Calculate performance metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Log success with metrics
            logger.info(
                "WhatsApp message sent successfully",
                extra={
                    "correlation_id": correlation_id,
                    "performance_metrics": {
                        "response_time": duration,
                        "message_id": result.get("messages", [{}])[0].get("id")
                    },
                    "security_event": {
                        "event_type": "message_sent",
                        "phone_number": phone_number
                    }
                }
            )

            return {
                "success": True,
                "message_id": result.get("messages", [{}])[0].get("id"),
                "correlation_id": correlation_id,
                "timestamp": datetime.utcnow().isoformat()
            }

        except httpx.HTTPError as e:
            logger.error(
                f"WhatsApp API HTTP error: {str(e)}",
                extra={
                    "correlation_id": correlation_id,
                    "error_details": {
                        "status_code": e.response.status_code if hasattr(e, "response") else None,
                        "response_body": e.response.text if hasattr(e, "response") else None
                    }
                }
            )
            raise WhatsAppError(
                message=ERROR_RESPONSES["WHATSAPP_ERROR"],
                details={"correlation_id": correlation_id}
            )

        except Exception as e:
            logger.error(
                f"WhatsApp message sending error: {str(e)}",
                extra={"correlation_id": correlation_id}
            )
            raise WhatsAppError(
                message=ERROR_RESPONSES["WHATSAPP_ERROR"],
                details={"correlation_id": correlation_id}
            )

    async def get_message_status(
        self,
        message_id: str,
        correlation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check delivery status of sent message with correlation tracking."""
        correlation_id = correlation_id or str(uuid.uuid4())
        start_time = datetime.utcnow()

        try:
            # Request message status
            response = await self.client.get(
                f"/{message_id}",
                headers={CORRELATION_ID_HEADER: correlation_id}
            )
            response.raise_for_status()
            result = response.json()

            # Calculate performance metrics
            duration = (datetime.utcnow() - start_time).total_seconds()

            # Log status check
            logger.info(
                "Message status retrieved",
                extra={
                    "correlation_id": correlation_id,
                    "performance_metrics": {
                        "response_time": duration
                    }
                }
            )

            return {
                "success": True,
                "status": result.get("status"),
                "message_id": message_id,
                "correlation_id": correlation_id,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(
                f"Error retrieving message status: {str(e)}",
                extra={"correlation_id": correlation_id}
            )
            raise WhatsAppError(
                message="Failed to retrieve message status",
                details={"message_id": message_id, "correlation_id": correlation_id}
            )

    async def verify_webhook(self, request_data: Dict[str, Any]) -> bool:
        """Verify WhatsApp webhook signature and payload."""
        try:
            # Verify webhook signature using app secret
            signature = request_data.get("hub.verify_token")
            if signature != settings.WHATSAPP_WEBHOOK_SECRET.get_secret_value():
                logger.warning(
                    "Invalid webhook signature",
                    extra={"security_event": {"event_type": "invalid_webhook_signature"}}
                )
                return False

            # Process webhook challenge
            challenge = request_data.get("hub.challenge")
            if challenge:
                logger.info("Webhook verification successful")
                return True

            return False

        except Exception as e:
            logger.error(f"Webhook verification error: {str(e)}")
            return False

    async def create_message_template(
        self,
        template_data: Dict[str, Any],
        correlation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create message template with validation and error handling."""
        correlation_id = correlation_id or str(uuid.uuid4())

        try:
            # Prepare template request
            endpoint = f"/{self.business_id}/message_templates"
            response = await self.client.post(
                endpoint,
                json=template_data,
                headers={CORRELATION_ID_HEADER: correlation_id}
            )
            response.raise_for_status()
            result = response.json()

            logger.info(
                "Message template created",
                extra={
                    "correlation_id": correlation_id,
                    "template_name": template_data.get("name")
                }
            )

            return {
                "success": True,
                "template_id": result.get("id"),
                "correlation_id": correlation_id,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(
                f"Template creation error: {str(e)}",
                extra={"correlation_id": correlation_id}
            )
            raise WhatsAppError(
                message="Failed to create message template",
                details={"correlation_id": correlation_id}
            )