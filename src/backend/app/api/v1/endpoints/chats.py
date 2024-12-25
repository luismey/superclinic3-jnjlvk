"""
FastAPI router endpoints for WhatsApp chat management with comprehensive features.
Implements CRUD operations, real-time processing, and optimized queries.

Version: 1.0.0
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

# FastAPI imports - version: ^0.100.0
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse

# SQLAlchemy imports - version: ^2.0.0
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

# Internal imports
from app.models.chats import Chat, ChatStatus
from app.schemas.chats import ChatCreate, ChatUpdate, ChatResponse
from app.services.whatsapp.message_handler import MessageHandler
from app.core.security import get_current_user
from app.core.dependencies import (
    get_db,
    get_message_handler,
    get_redis_client,
    RateLimiter,
    MetricsCollector
)

# Initialize router with prefix and tags
router = APIRouter(prefix="/chats", tags=["chats"])

# Initialize rate limiter and metrics
rate_limiter = RateLimiter(limit=100, window=60)  # 100 requests per minute
metrics = MetricsCollector(subsystem="chats")

@router.get("/", response_model=List[ChatResponse])
async def get_chats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    status: Optional[ChatStatus] = None,
    assigned_user_id: Optional[UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> List[ChatResponse]:
    """
    Retrieve paginated list of chats with filtering and search capabilities.
    
    Args:
        db: Database session
        current_user: Authenticated user
        status: Optional chat status filter
        assigned_user_id: Optional assigned user filter
        search: Optional search term for customer name/phone
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List[ChatResponse]: Paginated and filtered chat list
    """
    try:
        # Build base query with joins
        query = (
            select(Chat)
            .where(Chat.organization_id == current_user.organization_id)
            .order_by(Chat.updated_at.desc())
        )

        # Apply filters
        if status:
            query = query.where(Chat.status == status)
        if assigned_user_id:
            query = query.where(Chat.assigned_user_id == assigned_user_id)
        if search:
            search_filter = or_(
                Chat.customer_name.ilike(f"%{search}%"),
                Chat.customer_phone.ilike(f"%{search}%")
            )
            query = query.where(search_filter)

        # Execute query with pagination
        result = await db.execute(
            query.offset(skip).limit(limit)
        )
        chats = result.scalars().all()

        # Track metrics
        metrics.observe_query_time("get_chats")
        metrics.increment_counter("chat_queries")

        return [ChatResponse.from_orm(chat) for chat in chats]

    except Exception as e:
        metrics.increment_counter("chat_errors")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chats: {str(e)}"
        )

@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> ChatResponse:
    """
    Retrieve single chat by ID with message history.
    
    Args:
        chat_id: UUID of chat to retrieve
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ChatResponse: Chat details with messages
    """
    try:
        # Query chat with message history
        query = (
            select(Chat)
            .where(
                and_(
                    Chat.id == chat_id,
                    Chat.organization_id == current_user.organization_id
                )
            )
        )
        result = await db.execute(query)
        chat = result.scalar_one_or_none()

        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found"
            )

        metrics.increment_counter("chat_retrievals")
        return ChatResponse.from_orm(chat)

    except HTTPException:
        raise
    except Exception as e:
        metrics.increment_counter("chat_errors")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chat: {str(e)}"
        )

@router.post("/", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
@rate_limiter.limit()
async def create_chat(
    chat_data: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    message_handler: MessageHandler = Depends(get_message_handler),
) -> ChatResponse:
    """
    Create new chat with Brazilian phone number validation.
    
    Args:
        chat_data: Chat creation data
        db: Database session
        current_user: Authenticated user
        message_handler: WhatsApp message handler
        
    Returns:
        ChatResponse: Created chat details
    """
    try:
        # Create new chat instance
        chat = Chat(
            organization_id=current_user.organization_id,
            customer_phone=chat_data.customer_phone,
            customer_name=chat_data.customer_name,
            customer_metadata=chat_data.customer_metadata,
            assigned_user_id=chat_data.assigned_user_id,
            status=ChatStatus.ACTIVE,
            ai_enabled=chat_data.ai_enabled
        )

        # Initialize WhatsApp session
        whatsapp_session = await message_handler.initialize_chat(chat)
        chat.whatsapp_chat_id = whatsapp_session["chat_id"]

        # Save to database
        db.add(chat)
        await db.commit()
        await db.refresh(chat)

        metrics.increment_counter("chats_created")
        return ChatResponse.from_orm(chat)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        metrics.increment_counter("chat_errors")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create chat: {str(e)}"
        )

@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: UUID,
    chat_data: ChatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> ChatResponse:
    """
    Update existing chat with status management.
    
    Args:
        chat_id: UUID of chat to update
        chat_data: Chat update data
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ChatResponse: Updated chat details
    """
    try:
        # Query existing chat
        query = (
            select(Chat)
            .where(
                and_(
                    Chat.id == chat_id,
                    Chat.organization_id == current_user.organization_id
                )
            )
        )
        result = await db.execute(query)
        chat = result.scalar_one_or_none()

        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found"
            )

        # Update fields
        if chat_data.status is not None:
            chat.update_status(chat_data.status)
        if chat_data.assigned_user_id is not None:
            chat.assign_user(chat_data.assigned_user_id)
        if chat_data.customer_metadata is not None:
            chat.update_customer_metadata(chat_data.customer_metadata)
        if chat_data.ai_enabled is not None:
            chat.ai_enabled = chat_data.ai_enabled

        chat.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(chat)

        metrics.increment_counter("chats_updated")
        return ChatResponse.from_orm(chat)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        metrics.increment_counter("chat_errors")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update chat: {str(e)}"
        )

@router.post("/{chat_id}/messages")
@rate_limiter.limit()
async def process_message(
    chat_id: UUID,
    message_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    message_handler: MessageHandler = Depends(get_message_handler),
) -> JSONResponse:
    """
    Process incoming WhatsApp message with rate limiting.
    
    Args:
        chat_id: UUID of associated chat
        message_data: Message content and metadata
        db: Database session
        current_user: Authenticated user
        message_handler: WhatsApp message handler
        
    Returns:
        JSONResponse: Message processing status
    """
    try:
        # Query chat
        query = (
            select(Chat)
            .where(
                and_(
                    Chat.id == chat_id,
                    Chat.organization_id == current_user.organization_id
                )
            )
        )
        result = await db.execute(query)
        chat = result.scalar_one_or_none()

        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found"
            )

        # Process message
        processing_result = await message_handler.process_message_with_monitoring({
            "chat_id": str(chat_id),
            "whatsapp_chat_id": chat.whatsapp_chat_id,
            **message_data
        })

        metrics.increment_counter("messages_processed")
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=processing_result
        )

    except Exception as e:
        metrics.increment_counter("message_errors")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(e)}"
        )