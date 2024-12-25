"""
Enterprise-grade campaign scheduler service with advanced features including rate limiting,
error recovery, monitoring, and scalable batch processing.

Version: 1.0.0
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import random
from redis import Redis
from redis.exceptions import RedisError
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from prometheus_client import Counter, Gauge, Histogram

from app.services.campaigns.processor import CampaignProcessor
from app.models.campaigns import Campaign, CampaignStatus
from app.core.logging import get_logger

# Configure enhanced logging
logger = get_logger(__name__, enable_performance_logging=True)

# Prometheus metrics
campaign_metrics = {
    "scheduled_total": Counter(
        "campaign_scheduled_total",
        "Total number of scheduled campaigns"
    ),
    "active_campaigns": Gauge(
        "campaign_active_total",
        "Currently active campaigns"
    ),
    "processing_time": Histogram(
        "campaign_processing_seconds",
        "Campaign processing duration"
    )
}

# Constants
BATCH_SIZE = 100
SCHEDULER_TIMEZONE = 'America/Sao_Paulo'
MAX_CONCURRENT_CAMPAIGNS = 5
CAMPAIGN_CHECK_INTERVAL = 60
RETRY_MAX_ATTEMPTS = 3
RETRY_BACKOFF_FACTOR = 2
HEALTH_CHECK_INTERVAL = 30
STAGGER_MIN_INTERVAL = 60
STAGGER_MAX_INTERVAL = 120

class CampaignScheduler:
    """Enterprise-grade scheduler for managing WhatsApp marketing campaigns with advanced features."""

    def __init__(self, redis_url: str, config: Dict) -> None:
        """
        Initialize campaign scheduler with enhanced monitoring and health checks.

        Args:
            redis_url: Redis connection URL
            config: Scheduler configuration dictionary
        """
        # Initialize Redis with connection pooling
        self._redis_client = Redis.from_url(
            redis_url,
            decode_responses=True,
            max_connections=20,
            socket_timeout=5
        )

        # Initialize APScheduler with custom error handlers
        self._scheduler = AsyncIOScheduler(
            timezone=SCHEDULER_TIMEZONE,
            job_defaults={
                'coalesce': True,
                'max_instances': 1,
                'misfire_grace_time': 60
            }
        )

        # Initialize state tracking
        self._active_campaigns: Dict[str, CampaignProcessor] = {}
        self._health_status: Dict[str, bool] = {
            'scheduler': False,
            'redis': False,
            'processor': False
        }

        # Store configuration
        self._config = config
        self._processor = None

        logger.info(
            "Campaign scheduler initialized",
            extra={'config': config}
        )

    @retry(
        stop=stop_after_attempt(RETRY_MAX_ATTEMPTS),
        wait=wait_exponential(multiplier=RETRY_BACKOFF_FACTOR),
        retry=retry_if_exception_type((RedisError, ConnectionError))
    )
    async def start_scheduler(self) -> None:
        """Start the campaign scheduler with monitoring."""
        try:
            # Start APScheduler
            self._scheduler.start()
            self._health_status['scheduler'] = True

            # Schedule periodic health checks
            self._scheduler.add_job(
                self.health_check,
                'interval',
                seconds=HEALTH_CHECK_INTERVAL,
                id='health_check'
            )

            # Schedule campaign status check
            self._scheduler.add_job(
                self._check_campaign_status,
                'interval',
                seconds=CAMPAIGN_CHECK_INTERVAL,
                id='campaign_check'
            )

            logger.info("Campaign scheduler started successfully")

        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}")
            self._health_status['scheduler'] = False
            raise

    async def schedule_campaign(self, campaign: Campaign) -> bool:
        """
        Schedule campaign with validation and rate limiting.

        Args:
            campaign: Campaign model instance to schedule

        Returns:
            bool: Success status of scheduling operation
        """
        try:
            # Validate campaign configuration
            if not campaign.validate_campaign():
                raise ValueError("Invalid campaign configuration")

            # Check concurrent campaign limit
            if len(self._active_campaigns) >= MAX_CONCURRENT_CAMPAIGNS:
                raise ValueError("Maximum concurrent campaigns limit reached")

            # Calculate campaign schedule
            schedule_time = self._calculate_schedule_time(campaign)
            
            # Create campaign processor
            processor = CampaignProcessor(
                campaign_id=str(campaign.id),
                campaign=campaign,
                whatsapp_client=self._config['whatsapp_client'],
                redis_url=self._config['redis_url']
            )

            # Schedule campaign execution
            job_id = f"campaign_{campaign.id}"
            if campaign.schedule_config.get('recurring'):
                trigger = CronTrigger.from_crontab(
                    campaign.schedule_config['cron'],
                    timezone=SCHEDULER_TIMEZONE
                )
            else:
                trigger = DateTrigger(
                    run_date=schedule_time,
                    timezone=SCHEDULER_TIMEZONE
                )

            self._scheduler.add_job(
                processor.process_campaign_batch,
                trigger=trigger,
                id=job_id,
                replace_existing=True
            )

            # Update campaign status and tracking
            campaign.update_status(CampaignStatus.SCHEDULED)
            self._active_campaigns[str(campaign.id)] = processor
            
            # Update metrics
            campaign_metrics["scheduled_total"].inc()
            campaign_metrics["active_campaigns"].set(len(self._active_campaigns))

            logger.info(
                f"Campaign {campaign.id} scheduled successfully",
                extra={
                    'campaign_id': str(campaign.id),
                    'schedule_time': schedule_time.isoformat()
                }
            )

            return True

        except Exception as e:
            logger.error(
                f"Failed to schedule campaign {campaign.id}: {str(e)}",
                extra={'campaign_id': str(campaign.id)}
            )
            campaign.update_status(CampaignStatus.FAILED)
            return False

    async def stop_campaign(self, campaign_id: str) -> bool:
        """
        Stop a running campaign with cleanup.

        Args:
            campaign_id: ID of campaign to stop

        Returns:
            bool: Success status of stop operation
        """
        try:
            # Remove from scheduler
            job_id = f"campaign_{campaign_id}"
            self._scheduler.remove_job(job_id)

            # Stop processor if active
            if campaign_id in self._active_campaigns:
                processor = self._active_campaigns[campaign_id]
                await processor.stop_processor()
                del self._active_campaigns[campaign_id]

            # Update metrics
            campaign_metrics["active_campaigns"].dec()

            logger.info(f"Campaign {campaign_id} stopped successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to stop campaign {campaign_id}: {str(e)}")
            return False

    async def health_check(self) -> Dict:
        """
        Comprehensive system health check.

        Returns:
            Dict: Detailed health status
        """
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'components': {
                'scheduler': self._scheduler.running,
                'redis': await self._check_redis_health(),
                'processors': {}
            }
        }

        # Check processor health
        for campaign_id, processor in self._active_campaigns.items():
            processor_health = await processor.health_check()
            health_status['components']['processors'][campaign_id] = processor_health

        # Update overall status
        if not all(health_status['components'].values()):
            health_status['status'] = 'degraded'

        return health_status

    async def _check_campaign_status(self) -> None:
        """Periodic check of campaign status and cleanup."""
        try:
            current_time = datetime.utcnow()
            
            # Check each active campaign
            for campaign_id, processor in list(self._active_campaigns.items()):
                try:
                    # Check processor health
                    if not await processor.health_check():
                        logger.warning(f"Unhealthy processor detected for campaign {campaign_id}")
                        await self.stop_campaign(campaign_id)
                        continue

                    # Check campaign completion
                    campaign = processor._campaign
                    if campaign.status in [CampaignStatus.COMPLETED, CampaignStatus.FAILED]:
                        await self.stop_campaign(campaign_id)

                except Exception as e:
                    logger.error(f"Error checking campaign {campaign_id}: {str(e)}")

        except Exception as e:
            logger.error(f"Campaign status check failed: {str(e)}")

    async def _check_redis_health(self) -> bool:
        """Check Redis connection health."""
        try:
            return bool(self._redis_client.ping())
        except Exception as e:
            logger.error(f"Redis health check failed: {str(e)}")
            return False

    def _calculate_schedule_time(self, campaign: Campaign) -> datetime:
        """Calculate campaign schedule time with staggering."""
        base_time = datetime.utcnow()
        
        if campaign.schedule_config.get('start_time'):
            base_time = datetime.fromisoformat(campaign.schedule_config['start_time'])
        
        # Add random stagger interval
        stagger_seconds = random.uniform(STAGGER_MIN_INTERVAL, STAGGER_MAX_INTERVAL)
        return base_time + timedelta(seconds=stagger_seconds)

    async def cleanup(self) -> None:
        """Cleanup resources on shutdown."""
        try:
            # Stop all active campaigns
            for campaign_id in list(self._active_campaigns.keys()):
                await self.stop_campaign(campaign_id)

            # Shutdown scheduler
            self._scheduler.shutdown()
            
            # Close Redis connection
            self._redis_client.close()

            logger.info("Campaign scheduler cleanup completed")

        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            raise