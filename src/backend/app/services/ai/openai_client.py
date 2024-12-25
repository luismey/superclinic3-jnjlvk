# openai v1.0.0
# tenacity v8.0.0
# tiktoken v0.5.0
# cachetools v5.0.0

import asyncio
import time
from typing import List, Dict, Optional
from cachetools import TTLCache
import openai
import tiktoken
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    after_log
)

from app.core.config import settings
from app.core.rate_limiter import TokenBucketLimiter
from app.core.logging import get_logger

# Configure logger with performance monitoring
logger = get_logger(__name__, enable_performance_logging=True)

# Constants for OpenAI client configuration
OPENAI_TIMEOUT = 10  # API call timeout in seconds
MAX_RETRIES = 3  # Maximum number of retry attempts
RATE_LIMIT_KEY_PREFIX = 'openai_rate_limit'
MAX_TOKENS = 4096  # Maximum tokens per request
CACHE_KEY_PREFIX = 'openai_response'
METRICS_NAMESPACE = 'ai_service'

class OpenAIClient:
    """
    Enterprise-grade OpenAI client with rate limiting, caching, and performance monitoring.
    Handles model interactions for AI-powered virtual assistants.
    """

    def __init__(self, prompt_template: 'PromptTemplate'):
        """
        Initialize OpenAI client with configuration and dependencies.

        Args:
            prompt_template: Template for generating system and user prompts
        """
        self._prompt_template = prompt_template
        
        # Initialize rate limiter with 3 requests per second
        self._rate_limiter = TokenBucketLimiter(
            key_prefix=RATE_LIMIT_KEY_PREFIX,
            max_tokens=3,
            refill_period=1
        )

        # Initialize cache with 15-minute TTL
        self._cache = TTLCache(
            maxsize=1000,
            ttl=settings.CACHE_TTL if hasattr(settings, 'CACHE_TTL') else 900
        )

        # Configure OpenAI client
        openai.api_key = settings.OPENAI_API_KEY.get_secret_value()
        self._client = openai.AsyncClient()

        # Initialize tokenizer for the specified model
        self._tokenizer = tiktoken.encoding_for_model(settings.OPENAI_MODEL)

        logger.info(
            "OpenAI client initialized",
            extra={
                "performance_metrics": {
                    "model": settings.OPENAI_MODEL,
                    "max_tokens": MAX_TOKENS,
                    "cache_size": self._cache.maxsize
                }
            }
        )

    async def generate_response(
        self,
        conversation_history: List[Dict[str, str]],
        current_message: str
    ) -> str:
        """
        Generate AI response for given conversation with caching and rate limiting.

        Args:
            conversation_history: List of previous messages in the conversation
            current_message: Current user message to respond to

        Returns:
            str: AI-generated response

        Raises:
            Exception: If API call fails or rate limit is exceeded
        """
        start_time = time.time()

        try:
            # Generate cache key from conversation context
            cache_key = f"{CACHE_KEY_PREFIX}:{hash(str(conversation_history) + current_message)}"

            # Check cache first
            if cache_key in self._cache:
                logger.info(
                    "Cache hit for response generation",
                    extra={
                        "performance_metrics": {
                            "cache_hit": True,
                            "response_time": time.time() - start_time
                        }
                    }
                )
                return self._cache[cache_key]

            # Check rate limit before making API call
            rate_limit_result = await self._rate_limiter.check_rate_limit("openai_api")
            if not rate_limit_result["allowed"]:
                raise Exception(f"Rate limit exceeded. Retry after {rate_limit_result['retry_after']} seconds")

            # Generate prompts
            system_prompt = self._prompt_template.generate_system_prompt()
            conversation_prompt = self._prompt_template.generate_conversation_prompt(
                conversation_history,
                current_message
            )

            # Count tokens to ensure we don't exceed limits
            total_tokens = len(self._tokenizer.encode(system_prompt + conversation_prompt))
            if total_tokens > MAX_TOKENS:
                raise ValueError(f"Input exceeds maximum token limit of {MAX_TOKENS}")

            # Make API call with retry mechanism
            response = await self._make_api_call(system_prompt, conversation_prompt)

            # Cache successful response
            self._cache[cache_key] = response

            # Log performance metrics
            logger.info(
                "Response generated successfully",
                extra={
                    "performance_metrics": {
                        "response_time": time.time() - start_time,
                        "token_count": total_tokens,
                        "cache_hit": False
                    }
                }
            )

            return response

        except Exception as e:
            logger.error(
                f"Error generating response: {str(e)}",
                extra={
                    "performance_metrics": {
                        "error": True,
                        "response_time": time.time() - start_time
                    }
                }
            )
            raise

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception),
        after=after_log(logger, logging.WARNING)
    )
    async def _make_api_call(self, system_prompt: str, conversation_prompt: str) -> str:
        """
        Make rate-limited API call to OpenAI with retry mechanism.

        Args:
            system_prompt: System context prompt
            conversation_prompt: User conversation prompt

        Returns:
            str: Model response text

        Raises:
            Exception: If API call fails after retries
        """
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": conversation_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=MAX_TOKENS,
                    top_p=1.0,
                    frequency_penalty=0.0,
                    presence_penalty=0.0
                ),
                timeout=OPENAI_TIMEOUT
            )

            if not response.choices or not response.choices[0].message.content:
                raise ValueError("Invalid response format from OpenAI API")

            return response.choices[0].message.content.strip()

        except asyncio.TimeoutError:
            raise Exception(f"OpenAI API call timed out after {OPENAI_TIMEOUT} seconds")
        except Exception as e:
            raise Exception(f"OpenAI API call failed: {str(e)}")