"""
Enhanced WhatsApp Web client implementation with security, performance optimization,
and robust session management for handling WhatsApp Web connections.

Version: 1.0.0
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional
from uuid import UUID

import websockets  # v10.0
import aioredis   # v2.0
from cryptography.fernet import Fernet  # v37.0.0
from prometheus_client import Counter, Histogram  # v0.14.0

from app.core.config import Settings
from app.schemas.messages import MessageCreate
from app.core.security import SecurityAudit

# Configure logging
logger = logging.getLogger(__name__)

# Constants
CONNECTION_TIMEOUT = 30  # seconds
RECONNECT_DELAY = 5     # seconds
MAX_RECONNECT_ATTEMPTS = 3
SESSION_TTL = 86400     # 24 hours
MESSAGE_RETRY_ATTEMPTS = 3
RATE_LIMIT_MESSAGES = 100
RATE_LIMIT_WINDOW = 60  # seconds
ENCRYPTION_ALGORITHM = "AES-256-GCM"

# Metrics
MESSAGES_SENT = Counter(
    'whatsapp_messages_sent_total',
    'Total number of WhatsApp messages sent',
    ['status']
)
MESSAGE_LATENCY = Histogram(
    'whatsapp_message_latency_seconds',
    'Message sending latency in seconds'
)
CONNECTION_STATUS = Counter(
    'whatsapp_connection_status_total',
    'WhatsApp connection status changes',
    ['status']
)

class RateLimiter:
    """Rate limiting implementation for message sending."""
    
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self.window = RATE_LIMIT_WINDOW
        self.limit = RATE_LIMIT_MESSAGES

    async def check_limit(self, phone_number: str) -> bool:
        """Check if rate limit is exceeded for phone number."""
        key = f"rate_limit:{phone_number}"
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, self.window)
        return current <= self.limit

class CircuitBreaker:
    """Circuit breaker for handling connection failures."""
    
    def __init__(self):
        self.failures = 0
        self.last_failure = None
        self.state = "closed"  # closed, open, half-open

    def record_failure(self):
        """Record a failure and potentially open the circuit."""
        self.failures += 1
        self.last_failure = datetime.utcnow()
        if self.failures >= MAX_RECONNECT_ATTEMPTS:
            self.state = "open"

    def record_success(self):
        """Record a success and reset the circuit."""
        self.failures = 0
        self.last_failure = None
        self.state = "closed"

    def can_execute(self) -> bool:
        """Check if operation can be executed based on circuit state."""
        if self.state == "open":
            # Check if enough time has passed to try again
            if self.last_failure and datetime.utcnow() - self.last_failure > timedelta(seconds=30):
                self.state = "half-open"
                return True
            return False
        return True

class WhatsAppWebClient:
    """Enhanced WhatsApp Web client with security, performance, and monitoring features."""

    def __init__(self, phone_number: str, security_config: Optional[Dict] = None):
        """Initialize WhatsApp Web client instance with security features."""
        self.phone_number = phone_number
        self._ws_connection = None
        self._redis = None
        self.session_data = {}
        self.is_connected = False
        
        # Initialize components
        self._encryption_key = Fernet(Settings.ENCRYPTION_KEY)
        self._rate_limiter = None
        self._circuit_breaker = CircuitBreaker()
        self._security_audit = SecurityAudit()
        
        # Configure security settings
        self._security_config = security_config or {
            "max_message_size": 1024 * 1024,  # 1MB
            "allowed_message_types": ["text", "image", "document"],
            "require_encryption": True
        }

    async def _initialize_redis(self):
        """Initialize Redis connection with error handling."""
        try:
            self._redis = await aioredis.from_url(
                Settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            self._rate_limiter = RateLimiter(self._redis)
        except Exception as e:
            logger.error(f"Redis initialization failed: {str(e)}")
            raise

    async def connect(self) -> bool:
        """Establish secure WebSocket connection with retry and monitoring."""
        if not self._redis:
            await self._initialize_redis()

        try:
            # Check circuit breaker
            if not self._circuit_breaker.can_execute():
                logger.warning("Circuit breaker is open, connection attempt blocked")
                return False

            # Attempt to restore session
            session_key = f"whatsapp_session:{self.phone_number}"
            encrypted_session = await self._redis.get(session_key)
            if encrypted_session:
                self.session_data = json.loads(
                    self._encryption_key.decrypt(encrypted_session.encode()).decode()
                )

            # Establish WebSocket connection
            self._ws_connection = await websockets.connect(
                f"ws://{Settings.WHATSAPP_WEB_HOST}:{Settings.WHATSAPP_WEB_PORT}",
                extra_headers={"X-Client-ID": str(UUID(self.phone_number))},
                timeout=CONNECTION_TIMEOUT
            )

            # Initialize connection
            await self._ws_connection.send(json.dumps({
                "action": "init",
                "phone": self.phone_number,
                "session": self.session_data
            }))

            response = await self._ws_connection.recv()
            init_status = json.loads(response)

            if init_status.get("success"):
                self.is_connected = True
                self._circuit_breaker.record_success()
                CONNECTION_STATUS.labels(status="connected").inc()
                await self._security_audit.log_security_event(
                    "whatsapp_connection",
                    {"phone_number": self.phone_number, "status": "connected"}
                )
                return True

            raise ConnectionError("Connection initialization failed")

        except Exception as e:
            logger.error(f"Connection failed: {str(e)}")
            self._circuit_breaker.record_failure()
            CONNECTION_STATUS.labels(status="failed").inc()
            await self._security_audit.log_security_event(
                "whatsapp_connection_failed",
                {"phone_number": self.phone_number, "error": str(e)}
            )
            return False

    async def store_session(self, session_data: Dict) -> bool:
        """Securely store encrypted session data in Redis."""
        try:
            # Validate session data
            if not isinstance(session_data, dict):
                raise ValueError("Invalid session data format")

            # Encrypt session data
            encrypted_data = self._encryption_key.encrypt(
                json.dumps(session_data).encode()
            )

            # Store in Redis with TTL
            session_key = f"whatsapp_session:{self.phone_number}"
            await self._redis.setex(
                session_key,
                SESSION_TTL,
                encrypted_data.decode()
            )

            await self._security_audit.log_security_event(
                "session_stored",
                {"phone_number": self.phone_number}
            )
            return True

        except Exception as e:
            logger.error(f"Session storage failed: {str(e)}")
            return False

    async def send_message(self, recipient: str, message: MessageCreate) -> Dict:
        """Send message with retry and rate limiting."""
        if not self.is_connected:
            raise ConnectionError("Client not connected")

        try:
            # Check rate limit
            if not await self._rate_limiter.check_limit(self.phone_number):
                raise ValueError("Rate limit exceeded")

            # Validate message content
            message.validate_content()

            # Prepare message payload
            payload = {
                "action": "send_message",
                "recipient": recipient,
                "message": message.dict(),
                "timestamp": datetime.utcnow().isoformat()
            }

            # Send with retry logic
            for attempt in range(MESSAGE_RETRY_ATTEMPTS):
                try:
                    with MESSAGE_LATENCY.time():
                        await self._ws_connection.send(json.dumps(payload))
                        response = await self._ws_connection.recv()
                        result = json.loads(response)

                        if result.get("success"):
                            MESSAGES_SENT.labels(status="success").inc()
                            return result

                except Exception as e:
                    logger.warning(f"Send attempt {attempt + 1} failed: {str(e)}")
                    await asyncio.sleep(RECONNECT_DELAY)

            # All retries failed
            MESSAGES_SENT.labels(status="failed").inc()
            raise RuntimeError("Message sending failed after retries")

        except Exception as e:
            logger.error(f"Message sending error: {str(e)}")
            MESSAGES_SENT.labels(status="error").inc()
            raise

    async def close(self):
        """Gracefully close connection and cleanup resources."""
        try:
            if self._ws_connection:
                await self._ws_connection.close()
            if self._redis:
                await self._redis.close()
            self.is_connected = False
            CONNECTION_STATUS.labels(status="disconnected").inc()
        except Exception as e:
            logger.error(f"Connection closure error: {str(e)}")