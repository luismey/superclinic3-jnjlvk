# asyncio v3.11.0
# random v3.11.0
# tenacity v8.0.1

import asyncio
import random
from typing import Dict, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from app.core.rate_limiter import TokenBucketLimiter
from app.core.config import settings
from app.core.logging import get_logger

# Configure logger with performance monitoring
logger = get_logger(__name__, enable_performance_logging=True)

class CampaignRateLimiter:
    """Advanced rate limiter for campaign message sending that enforces WhatsApp API limits 
    with adaptive intervals and success rate tracking."""

    def __init__(
        self,
        campaign_id: str,
        daily_limit: int = 1000,  # WhatsApp default daily limit
        interval_min: int = 60,   # Minimum interval in seconds
        interval_max: int = 120,  # Maximum interval in seconds
        adaptive_mode: bool = True
    ) -> None:
        """Initialize campaign rate limiter with advanced configuration.

        Args:
            campaign_id: Unique identifier for the campaign
            daily_limit: Maximum messages per day (WhatsApp limit)
            interval_min: Minimum interval between messages
            interval_max: Maximum interval between messages
            adaptive_mode: Enable adaptive interval adjustment
        """
        self.campaign_id = campaign_id
        self.daily_limit = daily_limit
        self.interval_min = interval_min
        self.interval_max = interval_max
        self.adaptive_mode = adaptive_mode

        # Initialize token bucket with daily limit
        self._token_bucket = TokenBucketLimiter(
            key_prefix=f"campaign:{campaign_id}",
            max_tokens=daily_limit,
            refill_period=86400  # 24 hours
        )

        # Success rate tracking for adaptive mode
        self._success_rates: Dict[str, float] = {
            "last_hour": 1.0,
            "last_day": 1.0
        }

        logger.info(
            f"Initialized campaign rate limiter",
            extra={
                "performance_metrics": {
                    "campaign_id": campaign_id,
                    "daily_limit": daily_limit,
                    "interval_range": f"{interval_min}-{interval_max}s",
                    "adaptive_mode": adaptive_mode
                }
            }
        )

    async def get_next_interval(self) -> float:
        """Calculate next sending interval using adaptive or fixed strategy.

        Returns:
            float: Next interval in seconds
        """
        if not self.adaptive_mode:
            return random.uniform(self.interval_min, self.interval_max)

        # Calculate adaptive interval based on success rates
        success_factor = min(
            self._success_rates["last_hour"],
            self._success_rates["last_day"]
        )

        # Adjust interval range based on success rate
        adjusted_min = self.interval_min * (2 - success_factor)
        adjusted_max = self.interval_max * (2 - success_factor)

        interval = random.uniform(adjusted_min, adjusted_max)

        logger.debug(
            "Calculated next interval",
            extra={
                "performance_metrics": {
                    "campaign_id": self.campaign_id,
                    "success_factor": success_factor,
                    "interval": interval
                }
            }
        )

        return interval

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def check_rate_limit(self) -> bool:
        """Check if message can be sent under current rate limits.

        Returns:
            bool: True if sending is allowed, False otherwise
        """
        try:
            result = await self._token_bucket.check_rate_limit(self.campaign_id)
            
            # Update success rates based on rate limit result
            if result["allowed"]:
                self._success_rates["last_hour"] = min(
                    1.0,
                    self._success_rates["last_hour"] + 0.1
                )
            else:
                self._success_rates["last_hour"] = max(
                    0.1,
                    self._success_rates["last_hour"] - 0.2
                )

            logger.info(
                "Rate limit check completed",
                extra={
                    "performance_metrics": {
                        "campaign_id": self.campaign_id,
                        "allowed": result["allowed"],
                        "remaining": result["remaining"],
                        "success_rate": self._success_rates["last_hour"]
                    }
                }
            )

            return result["allowed"]

        except Exception as e:
            logger.error(
                f"Rate limit check failed: {str(e)}",
                extra={"campaign_id": self.campaign_id}
            )
            raise

    async def wait_next_slot(self) -> None:
        """Wait for next available sending slot with adaptive timing."""
        interval = await self.get_next_interval()
        
        logger.debug(
            f"Waiting for next slot",
            extra={
                "performance_metrics": {
                    "campaign_id": self.campaign_id,
                    "wait_interval": interval
                }
            }
        )

        await asyncio.sleep(interval)
        
        # Verify rate limit after wait
        if not await self.check_rate_limit():
            # Increase wait time on rate limit hit
            self._success_rates["last_hour"] = max(
                0.1,
                self._success_rates["last_hour"] - 0.1
            )
            await self.wait_next_slot()

    async def cleanup(self) -> None:
        """Clean up expired rate limit tokens."""
        try:
            cleaned = await self._token_bucket.cleanup_expired()
            
            logger.info(
                f"Cleaned up expired tokens",
                extra={
                    "performance_metrics": {
                        "campaign_id": self.campaign_id,
                        "cleaned_count": cleaned
                    }
                }
            )

            # Reset success rates after cleanup
            self._success_rates = {
                "last_hour": 1.0,
                "last_day": 1.0
            }

        except Exception as e:
            logger.error(
                f"Cleanup failed: {str(e)}",
                extra={"campaign_id": self.campaign_id}
            )

async def create_campaign_limiter(
    campaign_id: str,
    daily_limit: int = 1000,
    adaptive_mode: bool = True
) -> CampaignRateLimiter:
    """Factory function to create campaign rate limiter with optimal configuration.

    Args:
        campaign_id: Campaign identifier
        daily_limit: Maximum messages per day
        adaptive_mode: Enable adaptive interval adjustment

    Returns:
        CampaignRateLimiter: Configured campaign rate limiter instance
    """
    # Validate input parameters
    if daily_limit <= 0:
        raise ValueError("Daily limit must be positive")

    # Calculate optimal intervals based on daily limit
    interval_min = max(30, int(86400 / (daily_limit * 1.5)))  # Minimum 30s
    interval_max = min(300, int(86400 / (daily_limit * 0.8)))  # Maximum 5min

    limiter = CampaignRateLimiter(
        campaign_id=campaign_id,
        daily_limit=daily_limit,
        interval_min=interval_min,
        interval_max=interval_max,
        adaptive_mode=adaptive_mode
    )

    logger.info(
        "Created campaign rate limiter",
        extra={
            "performance_metrics": {
                "campaign_id": campaign_id,
                "daily_limit": daily_limit,
                "interval_range": f"{interval_min}-{interval_max}s"
            }
        }
    )

    return limiter