"""
FastAPI endpoint module for handling WhatsApp webhook events.
Implements secure webhook verification, message processing, and monitoring.

Version: 1.0.0
"""

import asyncio
import logging
import pytz
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from opentelemetry import trace
from prometheus_client import Counter, Histogram

from app.schemas.webhooks import WebhookVerification, WebhookPayload
from app.services.whatsapp.message_handler import MessageHandler
from app.core.security import decode_token

# Initialize router with prefix and tags
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Configure logging
logger = logging.getLogger(__name__)

# Configure Brazil timezone
BRAZIL_TZ = pytz.timezone('America/Sao_Paulo')

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Prometheus metrics
webhook_requests = Counter(
    'webhook_requests_total',
    'Total webhook requests',
    ['type', 'status']
)

webhook_processing_time = Histogram(
    'webhook_processing_seconds',
    'Webhook processing time',
    buckets=[0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
)

async def verify_webhook_token(request: Request) -> bool:
    """
    Dependency function to verify webhook authentication token.
    
    Args:
        request: FastAPI request object
        
    Returns:
        bool: True if token is valid
        
    Raises:
        HTTPException: If token is invalid or missing
    """
    with tracer.start_as_current_span('verify_webhook_token') as span:
        try:
            # Extract token from headers
            token = request.headers.get('X-Hub-Signature-256')
            if not token:
                raise HTTPException(
                    status_code=401,
                    detail="Missing webhook signature"
                )
            
            # Verify token
            decode_token(token)
            
            # Log successful verification with LGPD compliance
            logger.info(
                "Webhook token verified",
                extra={
                    "request_id": request.state.request_id,
                    "ip_anonymized": request.client.host.split('.')[0] + '.xxx.xxx.xxx'
                }
            )
            
            webhook_requests.labels(
                type='verification',
                status='success'
            ).inc()
            
            return True
            
        except Exception as e:
            # Log failed verification attempt
            logger.warning(
                f"Webhook token verification failed: {str(e)}",
                extra={"request_id": request.state.request_id}
            )
            
            webhook_requests.labels(
                type='verification',
                status='failed'
            ).inc()
            
            raise HTTPException(
                status_code=401,
                detail="Invalid webhook signature"
            )

@router.get("/verify")
@asyncio.coroutine
@tracer.start_as_current_span('handle_verification')
@webhook_processing_time.time()
async def handle_verification(verification: WebhookVerification) -> Dict:
    """
    Handle WhatsApp webhook verification challenge.
    
    Args:
        verification: WebhookVerification model containing challenge
        
    Returns:
        Dict: Challenge response
        
    Raises:
        HTTPException: If verification fails
    """
    try:
        # Log verification request
        logger.info(
            "Processing webhook verification challenge",
            extra={"mode": verification.mode}
        )
        
        # Validate verification mode
        if verification.mode != "subscribe":
            raise HTTPException(
                status_code=400,
                detail="Invalid verification mode"
            )
        
        webhook_requests.labels(
            type='challenge',
            status='success'
        ).inc()
        
        # Return challenge response
        return {"hub.challenge": verification.challenge}
        
    except Exception as e:
        logger.error(f"Verification failed: {str(e)}")
        webhook_requests.labels(
            type='challenge',
            status='failed'
        ).inc()
        raise HTTPException(
            status_code=400,
            detail=f"Verification failed: {str(e)}"
        )

@router.post("/")
@asyncio.coroutine
@Depends(verify_webhook_token)
@tracer.start_as_current_span('handle_webhook')
@webhook_processing_time.time()
async def handle_webhook(
    payload: WebhookPayload,
    token_valid: bool
) -> Dict:
    """
    Process incoming WhatsApp webhook events.
    
    Args:
        payload: WebhookPayload model containing event data
        token_valid: Token verification result from dependency
        
    Returns:
        Dict: Processing status
        
    Raises:
        HTTPException: If processing fails
    """
    with tracer.start_as_current_span('process_webhook') as span:
        try:
            # Log incoming webhook with LGPD compliance
            logger.info(
                "Processing incoming webhook",
                extra={
                    "webhook_type": payload.object,
                    "entries": len(payload.entry)
                }
            )
            
            # Parse webhook entries
            entries = payload.parse_entries()
            
            # Process message status updates
            for status in entries.get('statuses', []):
                await MessageHandler.handle_status_update(
                    status,
                    timezone=BRAZIL_TZ
                )
            
            # Process incoming messages
            for message in entries.get('messages', []):
                await MessageHandler.process_incoming_message(
                    message,
                    timezone=BRAZIL_TZ
                )
            
            # Record metrics
            webhook_requests.labels(
                type='event',
                status='success'
            ).inc()
            
            # Return processing status
            return {
                "success": True,
                "processed": {
                    "messages": len(entries.get('messages', [])),
                    "statuses": len(entries.get('statuses', []))
                }
            }
            
        except Exception as e:
            logger.error(
                f"Webhook processing failed: {str(e)}",
                exc_info=True
            )
            
            webhook_requests.labels(
                type='event',
                status='failed'
            ).inc()
            
            raise HTTPException(
                status_code=500,
                detail=f"Webhook processing failed: {str(e)}"
            )