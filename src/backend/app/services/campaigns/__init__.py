"""
WhatsApp marketing campaigns service module providing comprehensive campaign management
with rate-limited message delivery, efficient processing, and flexible scheduling.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional

from app.services.campaigns.rate_limiter import CampaignRateLimiter
from app.services.campaigns.processor import CampaignProcessor
from app.services.campaigns.scheduler import CampaignScheduler
from app.core.logging import get_logger

# Configure logger with performance monitoring
logger = get_logger(__name__, enable_performance_logging=True)

# Module version and constants
VERSION = "1.0.0"
CAMPAIGN_MODULE_NAME = "porfin.campaigns"

# Rate limiting configuration
DEFAULT_RATE_LIMIT_INTERVAL = 60  # Base interval between messages
MAX_RATE_LIMIT_INTERVAL = 120    # Maximum interval between messages
MAX_BATCH_SIZE = 100            # Maximum messages per batch
PROCESSING_TIMEOUT = 500        # Maximum processing time in milliseconds

class CampaignService:
    """
    Enterprise-grade campaign service providing comprehensive WhatsApp marketing
    campaign management with rate limiting, efficient processing, and monitoring.
    """

    def __init__(
        self,
        redis_url: str,
        whatsapp_client: Optional[object] = None,
        config: Optional[Dict] = None
    ) -> None:
        """
        Initialize campaign service with required components and configuration.

        Args:
            redis_url: Redis connection URL for distributed state management
            whatsapp_client: Optional WhatsApp client instance
            config: Optional configuration dictionary
        """
        self._config = config or {}
        self._redis_url = redis_url
        self._whatsapp_client = whatsapp_client

        # Initialize core components
        self._rate_limiter = None
        self._processor = None
        self._scheduler = None

        # Service state tracking
        self._is_initialized = False
        self._health_status = {
            "rate_limiter": False,
            "processor": False,
            "scheduler": False
        }

        logger.info(
            "Campaign service initializing",
            extra={
                "version": VERSION,
                "config": self._config
            }
        )

    async def initialize(self) -> bool:
        """
        Initialize campaign service components with health checks.

        Returns:
            bool: Success status of initialization
        """
        try:
            # Initialize rate limiter
            self._rate_limiter = CampaignRateLimiter(
                campaign_id="global",
                daily_limit=1000,  # WhatsApp default daily limit
                interval_min=DEFAULT_RATE_LIMIT_INTERVAL,
                interval_max=MAX_RATE_LIMIT_INTERVAL,
                adaptive_mode=True
            )
            self._health_status["rate_limiter"] = True

            # Initialize scheduler with configuration
            scheduler_config = {
                "redis_url": self._redis_url,
                "whatsapp_client": self._whatsapp_client,
                "rate_limiter": self._rate_limiter,
                "batch_size": MAX_BATCH_SIZE,
                "processing_timeout": PROCESSING_TIMEOUT
            }
            
            self._scheduler = CampaignScheduler(
                redis_url=self._redis_url,
                config=scheduler_config
            )
            await self._scheduler.start_scheduler()
            self._health_status["scheduler"] = True

            # Mark service as initialized
            self._is_initialized = True
            
            logger.info(
                "Campaign service initialized successfully",
                extra={"health_status": self._health_status}
            )
            return True

        except Exception as e:
            logger.error(f"Campaign service initialization failed: {str(e)}")
            return False

    async def create_campaign_processor(
        self,
        campaign_id: str,
        campaign: object
    ) -> CampaignProcessor:
        """
        Create a new campaign processor instance with configuration.

        Args:
            campaign_id: Unique campaign identifier
            campaign: Campaign model instance

        Returns:
            CampaignProcessor: Configured processor instance
        """
        if not self._is_initialized:
            raise RuntimeError("Campaign service not initialized")

        processor = CampaignProcessor(
            campaign_id=campaign_id,
            campaign=campaign,
            whatsapp_client=self._whatsapp_client,
            redis_url=self._redis_url
        )
        
        logger.info(
            f"Created campaign processor for campaign {campaign_id}",
            extra={"campaign_id": campaign_id}
        )
        
        return processor

    async def health_check(self) -> Dict:
        """
        Perform comprehensive health check of all components.

        Returns:
            Dict: Health status of all components
        """
        health_status = {
            "status": "healthy",
            "components": self._health_status.copy(),
            "details": {}
        }

        try:
            # Check rate limiter
            if self._rate_limiter:
                rate_limiter_status = await self._rate_limiter.check_rate_limit()
                health_status["details"]["rate_limiter"] = rate_limiter_status

            # Check scheduler
            if self._scheduler:
                scheduler_status = await self._scheduler.health_check()
                health_status["details"]["scheduler"] = scheduler_status

            # Update overall status
            if not all(health_status["components"].values()):
                health_status["status"] = "degraded"

            return health_status

        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    async def cleanup(self) -> None:
        """
        Cleanup service resources on shutdown.
        """
        try:
            if self._scheduler:
                await self._scheduler.cleanup()

            if self._rate_limiter:
                await self._rate_limiter.cleanup()

            logger.info("Campaign service cleanup completed")

        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            raise

# Export required components
__all__ = [
    "CampaignService",
    "CampaignRateLimiter",
    "CampaignProcessor",
    "CampaignScheduler",
    "VERSION"
]