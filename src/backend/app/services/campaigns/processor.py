"""
Campaign message processor service with advanced queue management, adaptive rate limiting,
and comprehensive error handling for WhatsApp marketing campaigns.

Version: 1.0.0
"""

import asyncio
import json
import random
from datetime import datetime
from typing import Dict, Optional, List
import logging
from redis import Redis
from redis.exceptions import RedisError

from app.services.campaigns.rate_limiter import CampaignRateLimiter
from app.services.whatsapp.business_api import WhatsAppBusinessAPI
from app.models.campaigns import Campaign, CampaignStatus

# Configure logger with performance monitoring
logger = logging.getLogger(__name__)

# Constants for processor configuration
BATCH_SIZE = 100  # Maximum messages to process in one batch
MAX_RETRIES = 3   # Maximum retry attempts for failed messages
QUEUE_CHECK_INTERVAL = 5  # Seconds between queue checks
BACKOFF_FACTOR = 2  # Exponential backoff multiplier
MIN_INTERVAL = 60  # Minimum seconds between messages
MAX_INTERVAL = 120  # Maximum seconds between messages

class CampaignProcessor:
    """
    Advanced campaign message processor with distributed queue management,
    adaptive rate limiting, and comprehensive error handling.
    """

    def __init__(
        self,
        campaign_id: str,
        campaign: Campaign,
        whatsapp_client: WhatsAppBusinessAPI,
        redis_url: str
    ) -> None:
        """
        Initialize campaign processor with enhanced monitoring and Redis integration.

        Args:
            campaign_id: Unique campaign identifier
            campaign: Campaign model instance
            whatsapp_client: WhatsApp Business API client
            redis_url: Redis connection URL
        """
        self.campaign_id = campaign_id
        self._campaign = campaign
        self._whatsapp_client = whatsapp_client
        self._rate_limiter = CampaignRateLimiter(
            campaign_id=campaign_id,
            daily_limit=1000,  # WhatsApp daily limit
            interval_min=MIN_INTERVAL,
            interval_max=MAX_INTERVAL,
            adaptive_mode=True
        )

        # Initialize Redis client with connection pooling
        self._redis_client = Redis.from_url(
            redis_url,
            decode_responses=True,
            max_connections=20,
            socket_timeout=5
        )

        # Processing state
        self._is_running = False
        self._metrics = {
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "retry_count": 0,
            "average_processing_time": 0
        }
        self._error_counts: Dict[str, int] = {}

    async def process_campaign_batch(self) -> Dict:
        """
        Process a batch of campaign messages with enhanced error handling and monitoring.

        Returns:
            Dict: Batch processing results and metrics
        """
        batch_start = datetime.utcnow()
        batch_metrics = {
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "processing_time": 0
        }

        try:
            # Get batch of messages from Redis queue
            queue_key = f"campaign:{self.campaign_id}:queue"
            messages = []
            
            for _ in range(BATCH_SIZE):
                message_data = self._redis_client.rpop(queue_key)
                if not message_data:
                    break
                messages.append(json.loads(message_data))

            if not messages:
                return batch_metrics

            # Process messages with rate limiting
            for message in messages:
                message_start = datetime.utcnow()
                
                try:
                    # Check and wait for rate limit
                    await self._rate_limiter.check_rate_limit()
                    await self._rate_limiter.wait_next_slot()

                    # Send message through WhatsApp API
                    result = await self._whatsapp_client.send_message(
                        phone_number=message["recipient"],
                        message_data=message["content"],
                        bypass_rate_limit=True  # Already handled by campaign rate limiter
                    )

                    # Track successful delivery
                    if result["success"]:
                        batch_metrics["successful"] += 1
                        await self._update_message_status(
                            message["id"],
                            result["message_id"],
                            "delivered"
                        )
                    else:
                        raise Exception("Message sending failed")

                except Exception as e:
                    # Handle failed message with retry logic
                    retry_key = f"campaign:{self.campaign_id}:retry"
                    retry_count = int(self._redis_client.hget(retry_key, message["id"]) or 0)

                    if retry_count < MAX_RETRIES:
                        # Add to retry queue with exponential backoff
                        retry_delay = BACKOFF_FACTOR ** retry_count
                        await self._add_to_retry_queue(message, retry_delay)
                        self._metrics["retry_count"] += 1
                    else:
                        # Log permanent failure
                        batch_metrics["failed"] += 1
                        error_type = type(e).__name__
                        self._error_counts[error_type] = self._error_counts.get(error_type, 0) + 1
                        await self._update_message_status(
                            message["id"],
                            None,
                            "failed",
                            str(e)
                        )

                # Update processing metrics
                batch_metrics["processed"] += 1
                processing_time = (datetime.utcnow() - message_start).total_seconds()
                batch_metrics["processing_time"] += processing_time

                # Adjust rate limiting based on success/failure
                await self._rate_limiter.adjust_rate_limit(result["success"])

            # Update campaign metrics
            self._metrics["processed"] += batch_metrics["processed"]
            self._metrics["successful"] += batch_metrics["successful"]
            self._metrics["failed"] += batch_metrics["failed"]
            
            # Calculate average processing time
            batch_duration = (datetime.utcnow() - batch_start).total_seconds()
            self._metrics["average_processing_time"] = (
                (self._metrics["average_processing_time"] * (self._metrics["processed"] - batch_metrics["processed"]) +
                 batch_duration * batch_metrics["processed"]) / self._metrics["processed"]
            )

            return batch_metrics

        except RedisError as e:
            logger.error(f"Redis error in batch processing: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Batch processing error: {str(e)}")
            raise

    async def start_processor(self) -> None:
        """
        Start campaign message processing with enhanced monitoring.
        """
        try:
            self._is_running = True
            start_time = datetime.utcnow()

            # Update campaign status
            self._campaign.update_status(CampaignStatus.RUNNING)

            logger.info(f"Starting campaign processor for campaign {self.campaign_id}")

            while self._is_running:
                try:
                    # Process batch of messages
                    batch_metrics = await self.process_campaign_batch()

                    # Check if campaign is complete
                    queue_size = self._redis_client.llen(f"campaign:{self.campaign_id}:queue")
                    retry_size = self._redis_client.llen(f"campaign:{self.campaign_id}:retry")

                    if queue_size == 0 and retry_size == 0:
                        self._is_running = False
                        final_status = (
                            CampaignStatus.COMPLETED
                            if self._metrics["failed"] == 0
                            else CampaignStatus.FAILED
                        )
                        self._campaign.update_status(final_status)
                        break

                    # Process retry queue if main queue is empty
                    if queue_size == 0:
                        await self._process_retry_queue()

                    # Update campaign metrics
                    self._campaign.update_metrics()

                    # Adaptive sleep between batches
                    await asyncio.sleep(QUEUE_CHECK_INTERVAL)

                except Exception as e:
                    logger.error(f"Processing error: {str(e)}")
                    if not self._handle_processing_error(e):
                        break

            # Calculate final metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            final_metrics = {
                **self._metrics,
                "duration": duration,
                "messages_per_second": self._metrics["processed"] / duration if duration > 0 else 0,
                "error_distribution": self._error_counts
            }

            logger.info(
                f"Campaign {self.campaign_id} processing completed",
                extra={"metrics": final_metrics}
            )

        except Exception as e:
            logger.error(f"Fatal processor error: {str(e)}")
            self._campaign.update_status(CampaignStatus.FAILED)
            raise

    async def _process_retry_queue(self) -> None:
        """Process messages in the retry queue with exponential backoff."""
        retry_key = f"campaign:{self.campaign_id}:retry"
        retry_queue = self._redis_client.lrange(retry_key, 0, -1)

        for message_data in retry_queue:
            message = json.loads(message_data)
            retry_count = int(self._redis_client.hget(retry_key, message["id"]) or 0)

            # Check if retry delay has passed
            if datetime.utcnow().timestamp() >= message.get("next_retry", 0):
                # Remove from retry queue and process
                self._redis_client.lrem(retry_key, 1, message_data)
                await self.process_campaign_batch()

    async def _add_to_retry_queue(self, message: Dict, delay: int) -> None:
        """Add failed message to retry queue with delay."""
        retry_key = f"campaign:{self.campaign_id}:retry"
        message["next_retry"] = datetime.utcnow().timestamp() + delay
        self._redis_client.lpush(retry_key, json.dumps(message))
        self._redis_client.hincrby(retry_key, message["id"], 1)

    async def _update_message_status(
        self,
        message_id: str,
        whatsapp_id: Optional[str],
        status: str,
        error: Optional[str] = None
    ) -> None:
        """Update message status in database and metrics."""
        status_key = f"campaign:{self.campaign_id}:status"
        self._redis_client.hset(
            status_key,
            message_id,
            json.dumps({
                "whatsapp_id": whatsapp_id,
                "status": status,
                "error": error,
                "timestamp": datetime.utcnow().isoformat()
            })
        )

    def _handle_processing_error(self, error: Exception) -> bool:
        """
        Handle processing errors with intelligent recovery.
        Returns True if processing should continue, False if fatal error.
        """
        error_type = type(error).__name__
        if isinstance(error, RedisError):
            # Redis errors might be temporary
            logger.warning(f"Redis error encountered: {str(error)}")
            return True
        elif isinstance(error, (asyncio.TimeoutError, ConnectionError)):
            # Network errors might be temporary
            logger.warning(f"Network error encountered: {str(error)}")
            return True
        else:
            # Unknown errors are considered fatal
            logger.error(f"Fatal error encountered: {str(error)}")
            self._campaign.update_status(CampaignStatus.FAILED)
            return False