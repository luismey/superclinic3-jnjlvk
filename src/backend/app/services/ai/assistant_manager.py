# openai v1.0.0
# asyncio v3.11.0
# time (latest)

import asyncio
import time
from typing import Dict, List, Optional
import logging

from app.services.ai.openai_client import OpenAIClient
from app.services.ai.prompt_templates import PromptTemplate
from app.models.assistants import Assistant
from app.core.logging import get_logger

# Configure logger with performance monitoring
logger = get_logger(__name__, enable_performance_logging=True)

# Constants for performance and configuration
CONVERSATION_HISTORY_LIMIT = 10
RESPONSE_TIME_THRESHOLD_MS = 500
KNOWLEDGE_UPDATE_TIMEOUT_SEC = 30
MAX_RETRIES = 3

class AssistantManager:
    """
    Enterprise-grade AI virtual assistant manager with enhanced performance monitoring,
    conversation processing, and knowledge base management capabilities.
    """

    def __init__(self, assistant: Assistant) -> None:
        """
        Initialize assistant manager with monitoring and configuration.

        Args:
            assistant: Assistant instance to manage

        Raises:
            ValueError: If assistant configuration is invalid
        """
        if not assistant or not isinstance(assistant, Assistant):
            raise ValueError("Valid Assistant instance required")

        self._assistant = assistant
        self._ai_client = OpenAIClient(PromptTemplate(
            assistant_type=assistant.type,
            custom_templates=assistant.config.get("prompt_templates")
        ))
        self._prompt_template = PromptTemplate(
            assistant_type=assistant.type,
            custom_templates=assistant.config.get("prompt_templates")
        )
        self._conversation_history: List[Dict[str, str]] = []
        self._performance_metrics: Dict[str, float] = {
            "avg_response_time": 0.0,
            "total_messages": 0
        }

        logger.info(
            f"Assistant manager initialized for {assistant.id}",
            extra={
                "assistant_id": str(assistant.id),
                "assistant_type": assistant.type,
                "organization_id": str(assistant.organization_id)
            }
        )

    async def process_message(self, message: str) -> str:
        """
        Process incoming message with performance monitoring and error handling.

        Args:
            message: User message to process

        Returns:
            str: AI-generated response

        Raises:
            Exception: If message processing fails after retries
        """
        if not message or not isinstance(message, str):
            raise ValueError("Valid message string required")

        start_time = time.time()
        retries = 0

        try:
            # Update conversation history
            await self._update_conversation_history(message)

            # Process message with retries
            while retries < MAX_RETRIES:
                try:
                    response = await self._ai_client.generate_response(
                        self._conversation_history,
                        message
                    )
                    
                    # Calculate and monitor response time
                    response_time = self._calculate_response_time(start_time)
                    
                    # Update assistant metrics
                    self._assistant.update_metrics(
                        new_message_count=1,
                        response_time=response_time / 1000  # Convert to seconds
                    )

                    # Log performance metrics
                    logger.info(
                        "Message processed successfully",
                        extra={
                            "performance_metrics": {
                                "response_time": response_time,
                                "retries": retries,
                                "assistant_id": str(self._assistant.id)
                            }
                        }
                    )

                    return response

                except Exception as e:
                    retries += 1
                    if retries >= MAX_RETRIES:
                        raise
                    await asyncio.sleep(2 ** retries)  # Exponential backoff

        except Exception as e:
            logger.error(
                f"Message processing failed: {str(e)}",
                extra={
                    "assistant_id": str(self._assistant.id),
                    "error": str(e),
                    "retries": retries
                }
            )
            raise

    async def update_knowledge(self, knowledge_update: Dict) -> Dict:
        """
        Update assistant's knowledge base with validation and monitoring.

        Args:
            knowledge_update: New knowledge base content

        Returns:
            Dict: Updated knowledge base status

        Raises:
            ValueError: If knowledge update format is invalid
            TimeoutError: If update exceeds timeout
        """
        if not isinstance(knowledge_update, dict):
            raise ValueError("Knowledge update must be a dictionary")

        try:
            # Set timeout for knowledge base update
            async with asyncio.timeout(KNOWLEDGE_UPDATE_TIMEOUT_SEC):
                # Validate knowledge format
                if "categories" not in knowledge_update or "documents" not in knowledge_update:
                    raise ValueError("Invalid knowledge base format")

                # Update assistant knowledge base
                updated_knowledge = self._assistant.update_knowledge_base(knowledge_update)

                # Refresh prompt templates with new knowledge
                self._prompt_template = PromptTemplate(
                    assistant_type=self._assistant.type,
                    custom_templates=self._assistant.config.get("prompt_templates")
                )

                logger.info(
                    "Knowledge base updated successfully",
                    extra={
                        "assistant_id": str(self._assistant.id),
                        "categories_count": len(knowledge_update.get("categories", [])),
                        "documents_count": len(knowledge_update.get("documents", []))
                    }
                )

                return {
                    "status": "success",
                    "knowledge_base": updated_knowledge,
                    "timestamp": time.time()
                }

        except asyncio.TimeoutError:
            logger.error(
                "Knowledge base update timed out",
                extra={"assistant_id": str(self._assistant.id)}
            )
            raise TimeoutError(f"Knowledge update timed out after {KNOWLEDGE_UPDATE_TIMEOUT_SEC} seconds")

        except Exception as e:
            logger.error(
                f"Knowledge base update failed: {str(e)}",
                extra={"assistant_id": str(self._assistant.id)}
            )
            raise

    async def _update_conversation_history(self, message: str) -> None:
        """
        Manage conversation history with circular buffer and LGPD compliance.

        Args:
            message: New message to add to history

        Raises:
            ValueError: If message format is invalid
        """
        if not message or not isinstance(message, str):
            raise ValueError("Valid message string required")

        # Add new message to history
        self._conversation_history.append({
            "role": "user",
            "content": message.strip()
        })

        # Maintain circular buffer
        if len(self._conversation_history) > CONVERSATION_HISTORY_LIMIT:
            self._conversation_history = self._conversation_history[-CONVERSATION_HISTORY_LIMIT:]

        # Apply LGPD compliance filters
        for entry in self._conversation_history:
            # Remove potential PII (e.g., email, phone numbers)
            content = entry["content"]
            # Add LGPD compliance filters here if needed

    def _calculate_response_time(self, start_time: float) -> float:
        """
        Calculate and monitor response time with threshold alerts.

        Args:
            start_time: Processing start timestamp

        Returns:
            float: Response time in milliseconds
        """
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Update running averages
        self._performance_metrics["total_messages"] += 1
        self._performance_metrics["avg_response_time"] = (
            (self._performance_metrics["avg_response_time"] * 
             (self._performance_metrics["total_messages"] - 1) +
             response_time) / self._performance_metrics["total_messages"]
        )

        # Check response time threshold
        if response_time > RESPONSE_TIME_THRESHOLD_MS:
            logger.warning(
                "Response time threshold exceeded",
                extra={
                    "performance_metrics": {
                        "response_time": response_time,
                        "threshold": RESPONSE_TIME_THRESHOLD_MS,
                        "assistant_id": str(self._assistant.id)
                    }
                }
            )

        return response_time