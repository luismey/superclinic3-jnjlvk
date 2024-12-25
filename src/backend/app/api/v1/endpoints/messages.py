"""
FastAPI router endpoints for WhatsApp message operations with comprehensive security,
rate limiting, and performance monitoring. Implements both WhatsApp Web and Business API
integrations with LGPD compliance and Brazilian market optimizations.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

# FastAPI imports - version: ^0.100.0
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

# OpenTelemetry imports - version: ^1.0.0
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

# Internal imports
from app.schemas.messages import MessageCreate
from app.services.whatsapp.message_handler import MessageHandler
from app.core.rate_limiter import TokenBucketLimiter
from app.core.security import WebhookVerifier
from app.core.exceptions import BaseAPIException
from app.core.logging import get_logger
from app.db.session import get_db
from app.utils.constants import (
    MessageType,
    MessageStatus,
    WHATSAPP_DAILY_MESSAGE_LIMIT,
    MESSAGE_RETRY_MAX_ATTEMPTS
)

# Initialize router
router = APIRouter(prefix="/api/v1/messages", tags=["messages"])

# Initialize tracer and logger
tracer = trace.get_tracer(__name__)
logger = get_logger(__name__, enable_performance_logging=True)

# Initialize rate limiter
rate_limiter = TokenBucketLimiter("messages", WHATSAPP_DAILY_MESSAGE_LIMIT)

async def get_message_handler(db: AsyncSession = Depends(get_db)) -> MessageHandler:
    """Dependency for message handler initialization."""
    # Message handler would be initialized with required dependencies
    return MessageHandler(web_client=None, business_api=None, assistant_manager=None, 
                        message_validator=None, redis_client=None)

@router.get("/")
async def get_messages(
    chat_id: UUID,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
) -> Dict:
    """
    Retrieve paginated list of messages for a chat with performance monitoring.

    Args:
        chat_id: UUID of the chat
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session

    Returns:
        Dict containing paginated messages and metadata
    """
    with tracer.start_as_current_span("get_messages") as span:
        try:
            # Start performance monitoring
            start_time = datetime.utcnow()
            
            # Check rate limit
            rate_limit_result = await rate_limiter.check_rate_limit(str(chat_id))
            if not rate_limit_result["allowed"]:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )

            # Query messages with pagination
            async with db.begin():
                query = """
                    SELECT m.* FROM messages m
                    WHERE m.chat_id = :chat_id
                    ORDER BY m.created_at DESC
                    LIMIT :limit OFFSET :skip
                """
                result = await db.execute(
                    query,
                    {"chat_id": chat_id, "limit": limit, "skip": skip}
                )
                messages = result.fetchall()

                # Get total count
                count_query = "SELECT COUNT(*) FROM messages WHERE chat_id = :chat_id"
                total = await db.scalar(count_query, {"chat_id": chat_id})

            # Calculate performance metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Update span attributes
            span.set_attribute("chat_id", str(chat_id))
            span.set_attribute("message_count", len(messages))
            span.set_attribute("duration_seconds", duration)
            
            return {
                "messages": messages,
                "pagination": {
                    "total": total,
                    "skip": skip,
                    "limit": limit
                },
                "metrics": {
                    "duration_seconds": duration,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }

        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(f"Error retrieving messages: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error retrieving messages"
            )

@router.post("/")
async def create_message(
    message: MessageCreate,
    db: AsyncSession = Depends(get_db),
    message_handler: MessageHandler = Depends(get_message_handler)
) -> Dict:
    """
    Create and send a new WhatsApp message with validation and monitoring.

    Args:
        message: Message creation schema
        db: Database session
        message_handler: WhatsApp message handler instance

    Returns:
        Dict containing created message details and status
    """
    with tracer.start_as_current_span("create_message") as span:
        try:
            # Validate Brazilian phone number format
            if not message.validate_brazilian_phone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Brazilian phone number format"
                )

            # Check rate limit
            rate_limit_result = await rate_limiter.check_rate_limit(str(message.chat_id))
            if not rate_limit_result["allowed"]:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )

            # Start database transaction
            async with db.begin():
                # Create message record
                query = """
                    INSERT INTO messages (
                        chat_id, sender_id, message_type, content, metadata,
                        status, created_at, updated_at
                    ) VALUES (
                        :chat_id, :sender_id, :message_type, :content, :metadata,
                        :status, :created_at, :updated_at
                    ) RETURNING *
                """
                result = await db.execute(
                    query,
                    {
                        "chat_id": message.chat_id,
                        "sender_id": message.sender_id,
                        "message_type": message.message_type,
                        "content": message.content,
                        "metadata": message.metadata,
                        "status": MessageStatus.PENDING,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                db_message = result.fetchone()

                # Send message via WhatsApp handler
                whatsapp_result = await message_handler.process_message_with_monitoring({
                    "id": db_message.id,
                    "type": message.message_type,
                    "content": message.content,
                    "metadata": message.metadata
                })

                # Update message status
                if whatsapp_result["status"] == "success":
                    await db.execute(
                        "UPDATE messages SET status = :status WHERE id = :id",
                        {"status": MessageStatus.SENT, "id": db_message.id}
                    )

            # Update span attributes
            span.set_attribute("message_id", str(db_message.id))
            span.set_attribute("message_type", message.message_type)
            span.set_attribute("status", whatsapp_result["status"])

            return {
                "message": db_message,
                "whatsapp_status": whatsapp_result["status"],
                "metrics": whatsapp_result.get("metrics", {})
            }

        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(f"Error creating message: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating message"
            )

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    message_handler: MessageHandler = Depends(get_message_handler)
) -> Dict:
    """
    Handle WhatsApp webhook notifications with security verification.

    Args:
        request: FastAPI request object
        db: Database session
        message_handler: WhatsApp message handler instance

    Returns:
        Dict containing webhook processing status
    """
    with tracer.start_as_current_span("handle_webhook") as span:
        try:
            # Verify webhook signature
            webhook_data = await request.json()
            if not WebhookVerifier.verify_signature(request):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid webhook signature"
                )

            # Process webhook event
            event_type = webhook_data.get("type")
            if event_type == "message":
                result = await message_handler.process_message_with_monitoring(webhook_data)
            elif event_type == "status":
                # Update message status
                await db.execute(
                    "UPDATE messages SET status = :status WHERE whatsapp_message_id = :msg_id",
                    {
                        "status": webhook_data.get("status"),
                        "msg_id": webhook_data.get("message_id")
                    }
                )
                result = {"status": "success", "type": "status_update"}
            else:
                result = {"status": "ignored", "type": event_type}

            # Update span attributes
            span.set_attribute("webhook_type", event_type)
            span.set_attribute("processing_status", result["status"])

            return {
                "status": "success",
                "webhook_type": event_type,
                "processing_result": result,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(f"Webhook processing error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook processing error"
            )