"""
WhatsApp session manager service implementing secure session lifecycle management,
encryption, monitoring, and high availability support.

Version: 1.0.0
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from uuid import uuid4

import aioredis  # v2.0
import prometheus_client  # v0.16
import structlog  # v23.1

from app.core.config import settings
from app.core.security import SessionEncryption
from app.services.whatsapp.web_client import WhatsAppWebClient

# Configure structured logging
logger = structlog.get_logger(__name__)

# Constants for session management
SESSION_KEY_PREFIX = "whatsapp:session:"
SESSION_TTL = 86400  # 24 hours
CLEANUP_INTERVAL = 3600  # 1 hour
MAX_RETRY_ATTEMPTS = 3
BATCH_SIZE = 100
LOCK_TIMEOUT = 30  # seconds

class SessionManager:
    """
    Manages WhatsApp session lifecycle and persistence with encryption,
    monitoring, and high availability support.
    """

    def __init__(
        self,
        encryption_service: SessionEncryption,
        metrics_client: prometheus_client.Counter,
        logger: structlog.BoundLogger
    ) -> None:
        """
        Initialize session manager with Redis connection and supporting services.

        Args:
            encryption_service: Service for session data encryption
            metrics_client: Prometheus metrics client
            logger: Structured logger instance
        """
        self._redis: Optional[aioredis.Redis] = None
        self._active_sessions: Dict[str, Dict] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._encryption = encryption_service
        self._session_metrics = metrics_client
        self._logger = logger

        # Initialize session metrics
        self._session_metrics.labels(
            type="created",
            status="success"
        ).inc(0)  # Initialize counter

        # Start background cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_expired_sessions())

    async def initialize(self) -> None:
        """Initialize Redis connection with retry logic."""
        retry_count = 0
        while retry_count < MAX_RETRY_ATTEMPTS:
            try:
                self._redis = await aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self._redis.ping()
                self._logger.info("Redis connection established")
                break
            except Exception as e:
                retry_count += 1
                self._logger.error(
                    "Redis connection failed",
                    error=str(e),
                    attempt=retry_count
                )
                if retry_count == MAX_RETRY_ATTEMPTS:
                    raise
                await asyncio.sleep(1)

    async def create_session(
        self,
        phone_number: str,
        session_type: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Create new encrypted WhatsApp session with validation.

        Args:
            phone_number: WhatsApp phone number
            session_type: Session type (web/business)
            metadata: Optional session metadata

        Returns:
            Dict: Encrypted session details and status

        Raises:
            ValueError: If session parameters are invalid
            RuntimeError: If session creation fails
        """
        try:
            # Validate input parameters
            if not phone_number or not session_type:
                raise ValueError("Invalid session parameters")

            # Generate session key and ID
            session_id = str(uuid4())
            session_key = f"{SESSION_KEY_PREFIX}{phone_number}"

            # Initialize session data
            session_data = {
                "id": session_id,
                "phone_number": phone_number,
                "type": session_type,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "status": "active"
            }

            # Encrypt sensitive session data
            encrypted_data = await self._encryption.encrypt_data(
                json.dumps(session_data)
            )

            # Store in Redis with TTL
            await self._redis.setex(
                session_key,
                SESSION_TTL,
                encrypted_data
            )

            # Add to active sessions cache
            self._active_sessions[phone_number] = session_data

            # Update metrics
            self._session_metrics.labels(
                type="created",
                status="success"
            ).inc()

            self._logger.info(
                "Session created",
                phone_number=phone_number,
                session_id=session_id
            )

            return session_data

        except Exception as e:
            self._session_metrics.labels(
                type="created",
                status="error"
            ).inc()
            self._logger.error(
                "Session creation failed",
                error=str(e),
                phone_number=phone_number
            )
            raise

    async def get_session(
        self,
        phone_number: str,
        validate: bool = True
    ) -> Optional[Dict]:
        """
        Retrieve and decrypt existing session with validation.

        Args:
            phone_number: WhatsApp phone number
            validate: Whether to validate session status

        Returns:
            Optional[Dict]: Decrypted session data if exists
        """
        try:
            # Check active sessions cache first
            if phone_number in self._active_sessions:
                session_data = self._active_sessions[phone_number]
                if not validate or await self._validate_session(session_data):
                    return session_data

            # Retrieve from Redis
            session_key = f"{SESSION_KEY_PREFIX}{phone_number}"
            encrypted_data = await self._redis.get(session_key)

            if not encrypted_data:
                return None

            # Decrypt session data
            session_data = json.loads(
                await self._encryption.decrypt_data(encrypted_data)
            )

            # Validate if requested
            if validate and not await self._validate_session(session_data):
                await self.delete_session(phone_number)
                return None

            # Update cache
            self._active_sessions[phone_number] = session_data

            # Update metrics
            self._session_metrics.labels(
                type="retrieved",
                status="success"
            ).inc()

            return session_data

        except Exception as e:
            self._logger.error(
                "Session retrieval failed",
                error=str(e),
                phone_number=phone_number
            )
            self._session_metrics.labels(
                type="retrieved",
                status="error"
            ).inc()
            return None

    async def update_session(
        self,
        phone_number: str,
        updates: Dict
    ) -> Optional[Dict]:
        """
        Update existing session with new data.

        Args:
            phone_number: WhatsApp phone number
            updates: Dictionary of updates to apply

        Returns:
            Optional[Dict]: Updated session data if successful
        """
        try:
            session_data = await self.get_session(phone_number, validate=False)
            if not session_data:
                return None

            # Apply updates
            session_data.update(updates)
            session_data["updated_at"] = datetime.utcnow().isoformat()

            # Encrypt and store updated session
            session_key = f"{SESSION_KEY_PREFIX}{phone_number}"
            encrypted_data = await self._encryption.encrypt_data(
                json.dumps(session_data)
            )

            await self._redis.setex(
                session_key,
                SESSION_TTL,
                encrypted_data
            )

            # Update cache
            self._active_sessions[phone_number] = session_data

            self._logger.info(
                "Session updated",
                phone_number=phone_number,
                session_id=session_data["id"]
            )

            return session_data

        except Exception as e:
            self._logger.error(
                "Session update failed",
                error=str(e),
                phone_number=phone_number
            )
            return None

    async def delete_session(self, phone_number: str) -> bool:
        """
        Delete session and clean up resources.

        Args:
            phone_number: WhatsApp phone number

        Returns:
            bool: True if session was deleted
        """
        try:
            session_key = f"{SESSION_KEY_PREFIX}{phone_number}"
            
            # Remove from Redis
            await self._redis.delete(session_key)
            
            # Remove from cache
            self._active_sessions.pop(phone_number, None)

            self._logger.info(
                "Session deleted",
                phone_number=phone_number
            )

            return True

        except Exception as e:
            self._logger.error(
                "Session deletion failed",
                error=str(e),
                phone_number=phone_number
            )
            return False

    async def _validate_session(self, session_data: Dict) -> bool:
        """
        Validate session data and status.

        Args:
            session_data: Session data to validate

        Returns:
            bool: True if session is valid
        """
        try:
            # Check required fields
            required_fields = ["id", "phone_number", "type", "created_at"]
            if not all(field in session_data for field in required_fields):
                return False

            # Check session age
            created_at = datetime.fromisoformat(session_data["created_at"])
            if datetime.utcnow() - created_at > timedelta(days=1):
                return False

            # Validate with WhatsApp client
            client = WhatsAppWebClient(session_data["phone_number"])
            return await client.validate_session(session_data)

        except Exception as e:
            self._logger.error(
                "Session validation failed",
                error=str(e),
                session_id=session_data.get("id")
            )
            return False

    async def _cleanup_expired_sessions(self) -> None:
        """Background task to clean up expired sessions."""
        while True:
            try:
                # Get lock for cleanup
                lock = await self._redis.set(
                    "session_cleanup_lock",
                    "1",
                    nx=True,
                    ex=LOCK_TIMEOUT
                )

                if lock:
                    # Scan for expired sessions
                    cursor = 0
                    while True:
                        cursor, keys = await self._redis.scan(
                            cursor,
                            match=f"{SESSION_KEY_PREFIX}*",
                            count=BATCH_SIZE
                        )

                        # Process batch
                        for key in keys:
                            phone_number = key.replace(SESSION_KEY_PREFIX, "")
                            session_data = await self.get_session(
                                phone_number,
                                validate=True
                            )
                            if not session_data:
                                await self.delete_session(phone_number)

                        if cursor == 0:
                            break

                    # Release lock
                    await self._redis.delete("session_cleanup_lock")

            except Exception as e:
                self._logger.error(
                    "Session cleanup failed",
                    error=str(e)
                )

            await asyncio.sleep(CLEANUP_INTERVAL)

    async def close(self) -> None:
        """Clean up resources on shutdown."""
        try:
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass

            if self._redis:
                await self._redis.close()

            self._logger.info("Session manager shutdown complete")

        except Exception as e:
            self._logger.error(
                "Error during shutdown",
                error=str(e)
            )