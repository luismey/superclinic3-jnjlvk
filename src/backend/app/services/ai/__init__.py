"""
AI services initialization module providing centralized access to OpenAI client,
prompt templates, and assistant management functionality with thread-safe patterns
and comprehensive monitoring.

Version: 1.0.0
"""

import asyncio
import logging
import time
from typing import Dict, Optional

from app.services.ai.openai_client import OpenAIClient
from app.services.ai.prompt_templates import PromptTemplate
from app.services.ai.assistant_manager import AssistantManager
from app.core.logging import get_logger

# Configure logger with performance monitoring
logger = get_logger(__name__, enable_performance_logging=True)

# Global instance management
_openai_client_instance: Optional[OpenAIClient] = None
_assistant_manager_instances: Dict[str, AssistantManager] = {}
_instance_lock = asyncio.Lock()

# Configuration constants
MAX_POOL_SIZE = 100  # Maximum number of assistant manager instances
INSTANCE_TIMEOUT = 3600  # Instance timeout in seconds (1 hour)

async def get_openai_client() -> OpenAIClient:
    """
    Get or create thread-safe singleton OpenAI client instance with monitoring.

    Returns:
        OpenAIClient: Singleton OpenAI client instance

    Raises:
        Exception: If client initialization fails
    """
    global _openai_client_instance

    try:
        async with _instance_lock:
            if not _openai_client_instance:
                start_time = time.time()
                logger.info("Initializing OpenAI client instance")

                # Create new client instance with default prompt template
                _openai_client_instance = OpenAIClient(
                    prompt_template=PromptTemplate(assistant_type='customer_service')
                )

                # Log initialization metrics
                logger.info(
                    "OpenAI client initialized successfully",
                    extra={
                        "performance_metrics": {
                            "initialization_time": time.time() - start_time
                        }
                    }
                )

            return _openai_client_instance

    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {str(e)}")
        raise

async def get_assistant_manager(assistant, config: Optional[Dict] = None) -> AssistantManager:
    """
    Get or create AssistantManager instance with resource pooling and monitoring.

    Args:
        assistant: Assistant instance to manage
        config: Optional configuration dictionary

    Returns:
        AssistantManager: Assistant manager instance from pool

    Raises:
        ValueError: If pool size limit is reached or assistant is invalid
        Exception: If manager initialization fails
    """
    try:
        async with _instance_lock:
            # Clean up stale instances first
            await cleanup_stale_instances()

            # Check pool size limit
            if len(_assistant_manager_instances) >= MAX_POOL_SIZE:
                raise ValueError(f"Assistant manager pool size limit ({MAX_POOL_SIZE}) reached")

            # Generate instance key
            instance_key = str(assistant.id)

            # Get existing instance or create new one
            if instance_key in _assistant_manager_instances:
                manager = _assistant_manager_instances[instance_key]
                logger.debug(f"Retrieved existing assistant manager for {instance_key}")
            else:
                start_time = time.time()
                manager = AssistantManager(assistant)
                _assistant_manager_instances[instance_key] = manager

                # Log initialization metrics
                logger.info(
                    f"Created new assistant manager for {instance_key}",
                    extra={
                        "performance_metrics": {
                            "initialization_time": time.time() - start_time,
                            "pool_size": len(_assistant_manager_instances)
                        }
                    }
                )

            # Update instance metadata
            manager._last_accessed = time.time()
            
            # Apply new configuration if provided
            if config:
                await manager.update_knowledge(config)

            return manager

    except Exception as e:
        logger.error(f"Failed to get assistant manager: {str(e)}")
        raise

async def cleanup_stale_instances() -> None:
    """
    Cleanup stale assistant manager instances to prevent memory leaks.
    Removes instances that haven't been accessed within the timeout period.
    """
    try:
        async with _instance_lock:
            current_time = time.time()
            stale_keys = []

            # Identify stale instances
            for key, manager in _assistant_manager_instances.items():
                if current_time - manager._last_accessed > INSTANCE_TIMEOUT:
                    stale_keys.append(key)

            # Remove stale instances
            for key in stale_keys:
                del _assistant_manager_instances[key]

            if stale_keys:
                logger.info(
                    f"Cleaned up {len(stale_keys)} stale assistant manager instances",
                    extra={
                        "performance_metrics": {
                            "cleaned_instances": len(stale_keys),
                            "remaining_pool_size": len(_assistant_manager_instances)
                        }
                    }
                )

    except Exception as e:
        logger.error(f"Failed to cleanup stale instances: {str(e)}")
        raise

# Export public interface
__all__ = [
    "OpenAIClient",
    "PromptTemplate",
    "AssistantManager",
    "get_openai_client",
    "get_assistant_manager",
    "cleanup_stale_instances"
]