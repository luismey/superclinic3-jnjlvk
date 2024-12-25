"""
FastAPI router for managing AI virtual assistants with comprehensive security,
rate limiting, and performance monitoring capabilities.

Version: 1.0.0
"""

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, Request, status
from fastapi.responses import JSONResponse
from fastapi_cache import Cache
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update, delete

from app.schemas.assistants import (
    AssistantCreate, AssistantUpdate, AssistantResponse, AssistantMetrics
)
from app.models.assistants import Assistant, AssistantType
from app.core.security import RateLimiter
from app.db.session import get_db
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/assistants",
    tags=["assistants"]
)

# Initialize rate limiter
rate_limiter = RateLimiter(
    requests=settings.RATE_LIMIT_REQUESTS,
    period=settings.RATE_LIMIT_PERIOD
)

@router.get(
    "/",
    response_model=List[AssistantResponse],
    status_code=status.HTTP_200_OK,
    response_description="List of virtual assistants"
)
@rate_limiter.limit("100/minute")
@cache(expire=300)  # 5 minute cache
async def get_assistants(
    organization_id: UUID,
    skip: int = 0,
    limit: int = 100,
    type_filter: Optional[AssistantType] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    request: Request = None
) -> List[AssistantResponse]:
    """
    Retrieve a paginated list of virtual assistants with optional filtering.
    
    Args:
        organization_id: Organization UUID
        skip: Number of records to skip
        limit: Maximum number of records to return
        type_filter: Optional filter by assistant type
        is_active: Optional filter by active status
        db: Database session
        request: FastAPI request object
        
    Returns:
        List[AssistantResponse]: List of assistant data
        
    Raises:
        HTTPException: For database or validation errors
    """
    try:
        # Build base query
        query = select(Assistant).where(
            Assistant.organization_id == organization_id
        )
        
        # Apply filters
        if type_filter:
            query = query.where(Assistant.type == type_filter)
        if is_active is not None:
            query = query.where(Assistant.is_active == is_active)
            
        # Add pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query with metrics
        start_time = datetime.utcnow()
        result = await db.execute(query)
        assistants = result.scalars().all()
        query_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log performance metrics
        logger.info(
            f"Retrieved {len(assistants)} assistants in {query_time:.3f}s",
            extra={
                "organization_id": str(organization_id),
                "query_time": query_time,
                "result_count": len(assistants)
            }
        )
        
        return assistants

    except Exception as e:
        logger.error(
            f"Error retrieving assistants: {str(e)}",
            extra={"organization_id": str(organization_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assistants"
        )

@router.post(
    "/",
    response_model=AssistantResponse,
    status_code=status.HTTP_201_CREATED,
    response_description="Created virtual assistant"
)
@rate_limiter.limit("20/minute")
async def create_assistant(
    assistant: AssistantCreate,
    db: AsyncSession = Depends(get_db)
) -> AssistantResponse:
    """
    Create a new virtual assistant with validated configuration.
    
    Args:
        assistant: Assistant creation data
        db: Database session
        
    Returns:
        AssistantResponse: Created assistant data
        
    Raises:
        HTTPException: For validation or database errors
    """
    try:
        # Validate assistant configuration
        assistant.validate_config()
        
        # Create new assistant instance
        db_assistant = Assistant(
            name=assistant.name,
            type=assistant.type,
            organization_id=assistant.organization_id,
            config=assistant.config.dict(),
            knowledge_base=assistant.knowledge_base.dict()
        )
        
        # Save to database
        db.add(db_assistant)
        await db.commit()
        await db.refresh(db_assistant)
        
        # Log creation
        logger.info(
            f"Created assistant: {db_assistant.id}",
            extra={
                "assistant_id": str(db_assistant.id),
                "organization_id": str(assistant.organization_id)
            }
        )
        
        return db_assistant

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating assistant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create assistant"
        )

@router.get(
    "/{assistant_id}",
    response_model=AssistantResponse,
    response_description="Virtual assistant details"
)
@rate_limiter.limit("100/minute")
@cache(expire=60)  # 1 minute cache
async def get_assistant(
    assistant_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> AssistantResponse:
    """
    Retrieve a specific virtual assistant by ID.
    
    Args:
        assistant_id: Assistant UUID
        db: Database session
        
    Returns:
        AssistantResponse: Assistant data
        
    Raises:
        HTTPException: If assistant not found or other errors
    """
    try:
        # Query assistant
        result = await db.execute(
            select(Assistant).where(Assistant.id == assistant_id)
        )
        assistant = result.scalar_one_or_none()
        
        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found"
            )
            
        return assistant

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assistant"
        )

@router.put(
    "/{assistant_id}",
    response_model=AssistantResponse,
    response_description="Updated virtual assistant"
)
@rate_limiter.limit("50/minute")
async def update_assistant(
    assistant_id: UUID,
    assistant_update: AssistantUpdate,
    db: AsyncSession = Depends(get_db)
) -> AssistantResponse:
    """
    Update an existing virtual assistant.
    
    Args:
        assistant_id: Assistant UUID
        assistant_update: Update data
        db: Database session
        
    Returns:
        AssistantResponse: Updated assistant data
        
    Raises:
        HTTPException: For validation or database errors
    """
    try:
        # Get existing assistant
        result = await db.execute(
            select(Assistant).where(Assistant.id == assistant_id)
        )
        assistant = result.scalar_one_or_none()
        
        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found"
            )
            
        # Update fields
        update_data = assistant_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(assistant, field, value)
            
        # Validate updated configuration
        if "config" in update_data:
            assistant.validate_config()
            
        # Save changes
        await db.commit()
        await db.refresh(assistant)
        
        # Invalidate cache
        await Cache.invalidate_matching(f"assistant:{assistant_id}")
        
        logger.info(
            f"Updated assistant: {assistant_id}",
            extra={"assistant_id": str(assistant_id)}
        )
        
        return assistant

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update assistant"
        )

@router.delete(
    "/{assistant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Assistant deleted"
)
@rate_limiter.limit("20/minute")
async def delete_assistant(
    assistant_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a virtual assistant.
    
    Args:
        assistant_id: Assistant UUID
        db: Database session
        
    Raises:
        HTTPException: If assistant not found or deletion fails
    """
    try:
        # Delete assistant
        result = await db.execute(
            delete(Assistant).where(Assistant.id == assistant_id)
        )
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found"
            )
            
        await db.commit()
        
        # Invalidate cache
        await Cache.invalidate_matching(f"assistant:{assistant_id}")
        
        logger.info(
            f"Deleted assistant: {assistant_id}",
            extra={"assistant_id": str(assistant_id)}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete assistant"
        )

@router.get(
    "/{assistant_id}/metrics",
    response_model=AssistantMetrics,
    response_description="Assistant performance metrics"
)
@rate_limiter.limit("50/minute")
@cache(expire=300)  # 5 minute cache
async def get_assistant_metrics(
    assistant_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> AssistantMetrics:
    """
    Retrieve performance metrics for a specific assistant.
    
    Args:
        assistant_id: Assistant UUID
        db: Database session
        
    Returns:
        AssistantMetrics: Performance metrics data
        
    Raises:
        HTTPException: If assistant not found or other errors
    """
    try:
        # Query assistant with metrics
        result = await db.execute(
            select(Assistant)
            .where(Assistant.id == assistant_id)
            .options(selectinload(Assistant.metrics))
        )
        assistant = result.scalar_one_or_none()
        
        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found"
            )
            
        return AssistantMetrics(
            message_count=assistant.message_count,
            avg_response_time=assistant.avg_response_time,
            last_active=assistant.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving metrics for assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assistant metrics"
        )