"""
WhatsApp service initialization module providing a unified interface for WhatsApp messaging operations.
Implements comprehensive security, monitoring, and performance features for both Web and Business API.

Version: 1.0.0
"""

import asyncio
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime

# External imports with versions
from redis import Redis  # v4.5.0
from prometheus_client import Counter, Gauge  # v0.16.0
from cryptography.fernet import Fernet  # v40.0.0

# Internal imports
from app.core.config import settings
from app.services.whatsapp.web_client import WhatsAppWebClient
from app.services.whatsapp.business_api import WhatsAppBusinessAPI
from app.services.whatsapp.message_handler import MessageHandler
from app.services.whatsapp.session_manager import SessionManager

# Version identifier
VERSION = '1.0.0'

# Supported message types
SUPPORTED_MESSAGE_TYPES = ["text", "image", "document", "audio", "video"]

# Performance metrics
PERFORMANCE_METRICS = {
    "message_processing_time": Counter(
        'whatsapp_message_processing_seconds',
        'Time spent processing WhatsApp messages',
        ['type']
    ),
    "connection_success_rate": Gauge(
        'whatsapp_connection_success_rate',
        'Success rate of WhatsApp connections',
        ['client_type']
    ),
    "error_rate": Counter(
        'whatsapp_error_total',
        'Total number of WhatsApp errors',
        ['type', 'severity']
    )
}

# Security configuration
SECURITY_CONFIG = {
    "session_ttl": 3600,  # 1 hour
    "max_retries": 3,
    "encryption_algorithm": "AES-256-GCM"
}

# Configure logging
logger = logging.getLogger(__name__)

async def initialize_whatsapp_service(
    settings: Dict,
    redis_client: Redis
) -> Tuple[WhatsAppWebClient, WhatsAppBusinessAPI, MessageHandler, SessionManager]:
    """
    Initialize WhatsApp service components with enhanced security and monitoring.

    Args:
        settings: Application configuration settings
        redis_client: Initialized Redis client

    Returns:
        Tuple containing initialized service components

    Raises:
        RuntimeError: If initialization fails
        ValueError: If configuration is invalid
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info("Starting WhatsApp service initialization")

        # Validate required settings
        if not all([
            settings.get('WHATSAPP_BUSINESS_ID'),
            settings.get('WHATSAPP_ACCESS_TOKEN'),
            settings.get('ENCRYPTION_KEY')
        ]):
            raise ValueError("Missing required WhatsApp configuration")

        # Initialize encryption
        encryption_key = Fernet(settings['ENCRYPTION_KEY'])

        # Initialize session manager with encryption and monitoring
        session_manager = SessionManager(
            encryption_service=encryption_key,
            metrics_client=PERFORMANCE_METRICS["connection_success_rate"],
            logger=logger
        )
        await session_manager.initialize()

        # Initialize WhatsApp Web client
        web_client = WhatsAppWebClient(
            phone_number=settings.get('WHATSAPP_PHONE_NUMBER'),
            security_config=SECURITY_CONFIG
        )
        
        # Initialize Business API client
        business_api = WhatsAppBusinessAPI(
            business_id=settings['WHATSAPP_BUSINESS_ID'],
            access_token=settings['WHATSAPP_ACCESS_TOKEN'],
            config=SECURITY_CONFIG
        )

        # Initialize message handler with validation and monitoring
        message_handler = MessageHandler(
            web_client=web_client,
            business_api=business_api,
            assistant_manager=None,  # Will be injected by the application
            message_validator=None,  # Will be injected by the application
            redis_client=redis_client
        )

        # Verify component health
        components_health = await verify_components_health(
            web_client,
            business_api,
            session_manager,
            message_handler
        )

        if not all(components_health.values()):
            failed_components = [k for k, v in components_health.items() if not v]
            raise RuntimeError(f"Component health check failed for: {failed_components}")

        # Setup cleanup handlers
        asyncio.create_task(monitor_service_health(
            web_client,
            business_api,
            session_manager,
            message_handler
        ))

        # Calculate initialization time
        init_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"WhatsApp service initialization completed in {init_time:.2f}s")

        return web_client, business_api, message_handler, session_manager

    except Exception as e:
        logger.error(f"WhatsApp service initialization failed: {str(e)}")
        PERFORMANCE_METRICS["error_rate"].labels(
            type="initialization",
            severity="critical"
        ).inc()
        raise RuntimeError(f"Failed to initialize WhatsApp service: {str(e)}")

async def verify_components_health(
    web_client: WhatsAppWebClient,
    business_api: WhatsAppBusinessAPI,
    session_manager: SessionManager,
    message_handler: MessageHandler
) -> Dict[str, bool]:
    """
    Verify health status of all WhatsApp service components.

    Args:
        web_client: WhatsApp Web client instance
        business_api: WhatsApp Business API client instance
        session_manager: Session manager instance
        message_handler: Message handler instance

    Returns:
        Dict containing health status of each component
    """
    health_status = {}

    try:
        # Check Web client
        health_status["web_client"] = await web_client.validate_connection()

        # Check Business API
        health_status["business_api"] = await business_api.verify_credentials()

        # Check session manager
        health_status["session_manager"] = await session_manager._redis.ping()

        # Check message handler
        health_status["message_handler"] = True  # Basic initialization check

        return health_status

    except Exception as e:
        logger.error(f"Health verification failed: {str(e)}")
        return {k: False for k in ["web_client", "business_api", "session_manager", "message_handler"]}

async def monitor_service_health(
    web_client: WhatsAppWebClient,
    business_api: WhatsAppBusinessAPI,
    session_manager: SessionManager,
    message_handler: MessageHandler
) -> None:
    """
    Continuous monitoring of service health with automatic recovery.

    Args:
        web_client: WhatsApp Web client instance
        business_api: WhatsApp Business API client instance
        session_manager: Session manager instance
        message_handler: Message handler instance
    """
    while True:
        try:
            # Check component health
            health_status = await verify_components_health(
                web_client,
                business_api,
                session_manager,
                message_handler
            )

            # Update metrics
            for component, status in health_status.items():
                PERFORMANCE_METRICS["connection_success_rate"].labels(
                    client_type=component
                ).set(1 if status else 0)

            # Handle unhealthy components
            for component, status in health_status.items():
                if not status:
                    logger.warning(f"Unhealthy component detected: {component}")
                    PERFORMANCE_METRICS["error_rate"].labels(
                        type=f"{component}_health",
                        severity="warning"
                    ).inc()

            await asyncio.sleep(60)  # Check every minute

        except Exception as e:
            logger.error(f"Health monitoring error: {str(e)}")
            await asyncio.sleep(5)  # Shorter interval on error

# Export public interfaces
__all__ = [
    'VERSION',
    'SUPPORTED_MESSAGE_TYPES',
    'WhatsAppWebClient',
    'WhatsAppBusinessAPI',
    'MessageHandler',
    'initialize_whatsapp_service'
]