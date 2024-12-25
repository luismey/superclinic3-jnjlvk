# redis v4.0.0
# psutil v5.9.0

import asyncio
import time
from typing import Dict, Optional
import psutil
from redis import Redis

from app.core.config import (
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_PERIOD,
    REDIS_URL,
    RATE_LIMIT_BYPASS_KEYS
)
from app.core.exceptions import BaseAPIException, ERROR_RESPONSES
from app.core.logging import get_logger

# Initialize Redis client with connection pooling
redis_client = Redis.from_url(REDIS_URL, decode_responses=True, max_connections=20)

# Configure logger with performance metrics enabled
logger = get_logger(__name__, enable_performance_logging=True)

class RateLimitError(BaseAPIException):
    """Custom exception for rate limit violations."""
    def __init__(self, message: str = ERROR_RESPONSES["RATE_LIMIT_ERROR"]):
        super().__init__(
            message=message,
            status_code=429,
            details={"retry_after": RATE_LIMIT_PERIOD}
        )

class TokenBucketLimiter:
    """Implements token bucket algorithm for rate limiting with Redis backend."""

    def __init__(
        self,
        key_prefix: str,
        max_tokens: int = RATE_LIMIT_REQUESTS,
        refill_period: int = RATE_LIMIT_PERIOD,
        adaptive_limiting: bool = True
    ):
        """Initialize token bucket limiter with configuration."""
        self.key_prefix = key_prefix
        self.max_tokens = max_tokens
        self.refill_period = refill_period
        self.refill_rate = float(max_tokens) / refill_period
        self.adaptive_limiting = adaptive_limiting
        self.current_load_factor = 1.0

    def get_bucket_key(self, identifier: str) -> str:
        """Generate Redis key for token bucket."""
        return f"{self.key_prefix}:bucket:{identifier}"

    async def update_load_factor(self) -> float:
        """Update load factor based on system metrics."""
        try:
            # Get CPU and memory usage
            cpu_percent = psutil.cpu_percent()
            memory_percent = psutil.virtual_memory().percent

            # Calculate load factor (1.0 = normal, <1.0 = high load)
            cpu_factor = max(0.1, 1.0 - (cpu_percent / 100))
            memory_factor = max(0.1, 1.0 - (memory_percent / 100))
            
            # Combined load factor with CPU weighted more heavily
            self.current_load_factor = (0.7 * cpu_factor) + (0.3 * memory_factor)
            
            # Log performance metrics
            logger.info(
                "Updated load factor",
                extra={
                    "performance_metrics": {
                        "cpu_usage": cpu_percent,
                        "memory_usage": memory_percent,
                        "load_factor": self.current_load_factor
                    }
                }
            )

            return self.current_load_factor

        except Exception as e:
            logger.error(f"Error updating load factor: {e}")
            return 1.0

    async def check_rate_limit(self, identifier: str) -> Dict[str, any]:
        """Check if request is within rate limit."""
        bucket_key = self.get_bucket_key(identifier)

        # Check bypass list
        if identifier in RATE_LIMIT_BYPASS_KEYS:
            return {
                "allowed": True,
                "remaining": self.max_tokens,
                "reset": int(time.time()) + self.refill_period
            }

        try:
            current_time = time.time()

            # Update load factor if adaptive limiting is enabled
            if self.adaptive_limiting:
                await self.update_load_factor()

            # Get current bucket state using Redis MULTI
            pipe = redis_client.pipeline()
            pipe.hmget(bucket_key, ["tokens", "last_update"])
            pipe.pttl(bucket_key)
            results = pipe.execute()
            
            tokens, last_update = results[0]
            ttl = results[1]

            tokens = float(tokens) if tokens else self.max_tokens
            last_update = float(last_update) if last_update else current_time

            # Calculate token refill
            time_passed = current_time - last_update
            token_refill = time_passed * self.refill_rate
            current_tokens = min(self.max_tokens, tokens + token_refill)

            # Apply adaptive rate limiting
            if self.adaptive_limiting:
                current_tokens *= self.current_load_factor

            # Check if request can be allowed
            if current_tokens >= 1:
                new_tokens = current_tokens - 1
                reset_time = int(current_time + (self.max_tokens - new_tokens) / self.refill_rate)

                # Update Redis atomically
                pipe = redis_client.pipeline()
                pipe.hmset(bucket_key, {
                    "tokens": new_tokens,
                    "last_update": current_time
                })
                pipe.expireat(bucket_key, reset_time)
                pipe.execute()

                return {
                    "allowed": True,
                    "remaining": int(new_tokens),
                    "reset": reset_time
                }
            else:
                retry_after = int((1 - current_tokens) / self.refill_rate)
                
                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "security_event": {
                            "event_type": "rate_limit_exceeded",
                            "identifier": identifier,
                            "retry_after": retry_after
                        }
                    }
                )

                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset": int(current_time + retry_after),
                    "retry_after": retry_after
                }

        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Fail open with warning in case of Redis errors
            return {
                "allowed": True,
                "remaining": 1,
                "reset": int(time.time() + self.refill_period)
            }

    async def cleanup_expired(self) -> int:
        """Clean up expired token buckets."""
        try:
            pattern = f"{self.key_prefix}:bucket:*"
            cleaned = 0
            
            for key in redis_client.scan_iter(pattern):
                if not redis_client.exists(key):
                    redis_client.delete(key)
                    cleaned += 1

            logger.info(f"Cleaned up {cleaned} expired buckets")
            return cleaned

        except Exception as e:
            logger.error(f"Error cleaning up expired buckets: {e}")
            return 0

async def rate_limit_middleware(request, call_next):
    """FastAPI middleware for rate limiting requests."""
    # Extract client identifier (IP address or user ID)
    identifier = request.client.host
    if user := getattr(request, "user", None):
        identifier = f"user:{user.id}"

    limiter = TokenBucketLimiter("api")
    result = await limiter.check_rate_limit(identifier)

    # Add rate limit headers
    headers = {
        "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
        "X-RateLimit-Remaining": str(result["remaining"]),
        "X-RateLimit-Reset": str(result["reset"])
    }

    if not result["allowed"]:
        headers["Retry-After"] = str(result["retry_after"])
        raise RateLimitError()

    # Process request and add headers to response
    response = await call_next(request)
    response.headers.update(headers)
    
    return response

async def check_redis_health() -> bool:
    """Check Redis connection health."""
    try:
        return redis_client.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False