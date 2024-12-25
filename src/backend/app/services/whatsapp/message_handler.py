"""
WhatsApp Message Handler Service for Porfin Platform
Handles message processing, monitoring, and error handling for WhatsApp communications.

Version: 1.0.0
"""

import asyncio
from datetime import datetime
from typing import Dict, Optional, Any
import logging
from functools import wraps

# External imports with versions
from opentelemetry import trace  # version: ^1.0.0
from opentelemetry.trace import Status, StatusCode
from prometheus_client import Counter, Histogram, Gauge  # version: ^0.16.0

# Internal imports
from app.utils.validators import MessageValidator
from app.utils.constants import (
    MessageType,
    MessageStatus,
    ErrorCodes,
    WHATSAPP_DAILY_MESSAGE_LIMIT,
    MESSAGE_RETRY_MAX_ATTEMPTS,
    MESSAGE_RETRY_DELAY_SECONDS
)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Global constants
ERROR_CATEGORIES = {
    'NETWORK': 'network_error',
    'API': 'api_error',
    'VALIDATION': 'validation_error',
    'PROCESSING': 'processing_error'
}

CIRCUIT_BREAKER_THRESHOLD = 5
RATE_LIMIT_WINDOW = 60

# Prometheus metrics
message_counter = Counter(
    'whatsapp_messages_total',
    'Total number of WhatsApp messages processed',
    ['status', 'type']
)

processing_time = Histogram(
    'message_processing_seconds',
    'Time spent processing messages',
    buckets=[0.1, 0.25, 0.5, 0.75, 1.0, 2.0, 5.0]
)

error_counter = Counter(
    'whatsapp_errors_total',
    'Total number of errors in WhatsApp processing',
    ['category', 'error_type']
)

active_connections = Gauge(
    'whatsapp_active_connections',
    'Number of active WhatsApp connections'
)

def rate_limiter(func):
    """Decorator for rate limiting message processing"""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        current_time = datetime.utcnow()
        window_key = f"rate_limit:{current_time.minute}"
        
        if self._redis.get(window_key, 0) >= WHATSAPP_DAILY_MESSAGE_LIMIT:
            error_counter.labels(
                category='rate_limit',
                error_type=ErrorCodes.RATE_LIMIT_EXCEEDED.value
            ).inc()
            raise ValueError(f"Rate limit exceeded: {WHATSAPP_DAILY_MESSAGE_LIMIT} messages per minute")
        
        self._redis.incr(window_key)
        self._redis.expire(window_key, RATE_LIMIT_WINDOW)
        
        return await func(self, *args, **kwargs)
    return wrapper

class MessageHandler:
    """
    Enhanced WhatsApp message handler with monitoring, security, and reliability features.
    """
    
    def __init__(
        self,
        web_client,
        business_api,
        assistant_manager,
        message_validator: MessageValidator,
        redis_client
    ):
        """
        Initialize the message handler with required dependencies.
        
        Args:
            web_client: WhatsApp Web client instance
            business_api: WhatsApp Business API client
            assistant_manager: AI assistant manager
            message_validator: Message validation instance
            redis_client: Redis client for rate limiting and caching
        """
        self._web_client = web_client
        self._business_api = business_api
        self._assistant_manager = assistant_manager
        self._message_validator = message_validator
        self._redis = redis_client
        
        self._error_stats = {}
        self._performance_metrics = {}
        self._circuit_breaker_count = 0
        
        # Initialize logger
        self._logger = logging.getLogger(__name__)

    @rate_limiter
    async def process_message_with_monitoring(
        self,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process WhatsApp message with comprehensive monitoring and validation.
        
        Args:
            message: Dictionary containing message details
            
        Returns:
            Dict containing processing result and metrics
        """
        with tracer.start_as_current_span("process_message") as span:
            start_time = datetime.utcnow()
            
            try:
                # Validate message content
                validation_result = self._message_validator.validate_content(
                    message.get('content'),
                    MessageType(message.get('type', 'text'))
                )
                
                if not validation_result.is_valid:
                    raise ValueError(f"Message validation failed: {validation_result.error_message}")
                
                # Process message based on type
                if message.get('is_business_api', False):
                    result = await self._process_business_api_message(message)
                else:
                    result = await self._process_web_message(message)
                
                # Update metrics
                message_counter.labels(
                    status=MessageStatus.DELIVERED.value,
                    type=message.get('type', 'text')
                ).inc()
                
                processing_duration = (datetime.utcnow() - start_time).total_seconds()
                processing_time.observe(processing_duration)
                
                span.set_attribute("message.id", message.get('id'))
                span.set_attribute("processing.duration", processing_duration)
                span.set_status(Status(StatusCode.OK))
                
                return {
                    "status": "success",
                    "result": result,
                    "metrics": {
                        "processing_time": processing_duration,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
                
            except Exception as e:
                return await self.handle_error("PROCESSING", e, {
                    "message_id": message.get('id'),
                    "type": message.get('type'),
                    "timestamp": datetime.utcnow().isoformat()
                })

    async def handle_error(
        self,
        error_type: str,
        error: Exception,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enhanced error handling with categorization and recovery strategies.
        
        Args:
            error_type: Type of error (NETWORK, API, etc.)
            error: Exception instance
            context: Additional error context
            
        Returns:
            Dict containing error handling result
        """
        with tracer.start_as_current_span("handle_error") as span:
            error_category = ERROR_CATEGORIES.get(error_type, 'unknown')
            
            # Update error metrics
            error_counter.labels(
                category=error_category,
                error_type=str(type(error).__name__)
            ).inc()
            
            # Update circuit breaker
            if error_type in ('NETWORK', 'API'):
                self._circuit_breaker_count += 1
                if self._circuit_breaker_count >= CIRCUIT_BREAKER_THRESHOLD:
                    self._logger.critical(
                        "Circuit breaker triggered",
                        extra={"error_count": self._circuit_breaker_count}
                    )
                    return {"status": "circuit_breaker_triggered", "retry_after": 300}
            
            # Implement retry logic for recoverable errors
            if error_type in ('NETWORK', 'API') and context.get('retry_count', 0) < MESSAGE_RETRY_MAX_ATTEMPTS:
                await asyncio.sleep(MESSAGE_RETRY_DELAY_SECONDS)
                context['retry_count'] = context.get('retry_count', 0) + 1
                return await self.process_message_with_monitoring(context)
            
            # Log error details
            self._logger.error(
                f"Message processing error: {str(error)}",
                extra={
                    "error_type": error_type,
                    "error_category": error_category,
                    "context": context
                },
                exc_info=True
            )
            
            span.set_attribute("error.type", error_type)
            span.set_attribute("error.message", str(error))
            span.set_status(Status(StatusCode.ERROR))
            
            return {
                "status": "error",
                "error": {
                    "type": error_type,
                    "message": str(error),
                    "category": error_category,
                    "context": context
                },
                "timestamp": datetime.utcnow().isoformat()
            }

    async def _process_business_api_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Process message using WhatsApp Business API"""
        with tracer.start_as_current_span("process_business_api_message"):
            return await self._business_api.send_message(message)

    async def _process_web_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Process message using WhatsApp Web client"""
        with tracer.start_as_current_span("process_web_message"):
            return await self._web_client.send_message(message)

# Export the MessageHandler class
__all__ = ['MessageHandler']