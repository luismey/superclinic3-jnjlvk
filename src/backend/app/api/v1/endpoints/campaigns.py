"""
FastAPI router endpoints for WhatsApp marketing campaign management.
Implements comprehensive campaign lifecycle management with enhanced security,
monitoring, and rate limiting.

Version: 1.0.0
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi_limiter import RateLimiter

from ....schemas.campaigns import (
    CampaignBase, CampaignCreate, CampaignUpdate, CampaignResponse
)
from ....models.campaigns import Campaign, CampaignStatus, CampaignType
from ....services.campaigns.processor import CampaignProcessor
from ....core.logging import get_logger
from ....db.session import get_db
from ....core.exceptions import BaseAPIException, ERROR_RESPONSES

# Configure router with enhanced logging
router = APIRouter(prefix="/campaigns", tags=["campaigns"])
logger = get_logger(__name__, enable_performance_logging=True)

# Initialize scheduler and rate limiter
scheduler = AsyncIOScheduler()
rate_limiter = RateLimiter()

@router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[CampaignResponse]:
    """
    Retrieve list of campaigns with filtering and pagination.

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        status: Filter by campaign status
        type: Filter by campaign type
        start_date: Filter by start date
        end_date: Filter by end date

    Returns:
        List[CampaignResponse]: List of campaign response objects
    """
    try:
        # Start performance tracking
        start_time = datetime.utcnow()

        # Build base query
        query = db.query(Campaign)

        # Apply filters
        if status:
            query = query.filter(Campaign.status == CampaignStatus(status))
        if type:
            query = query.filter(Campaign.type == CampaignType(type))
        if start_date:
            query = query.filter(Campaign.created_at >= start_date)
        if end_date:
            query = query.filter(Campaign.created_at <= end_date)

        # Apply pagination
        total_count = query.count()
        campaigns = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()

        # Calculate performance metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        logger.info(
            "Campaigns retrieved successfully",
            extra={
                "performance_metrics": {
                    "query_time": duration,
                    "total_records": total_count,
                    "returned_records": len(campaigns)
                }
            }
        )

        return [CampaignResponse.from_orm(campaign) for campaign in campaigns]

    except Exception as e:
        logger.error(f"Error retrieving campaigns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_RESPONSES["INTERNAL_ERROR"]
        )

@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
@rate_limiter.limit("campaign_create", max_requests=10, period=3600)  # 10 campaigns per hour
async def create_campaign(
    campaign: CampaignCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> CampaignResponse:
    """
    Create a new WhatsApp marketing campaign with validation and scheduling.

    Args:
        campaign: Campaign creation data
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        CampaignResponse: Created campaign details
    """
    try:
        # Start performance tracking
        start_time = datetime.utcnow()

        # Validate campaign data
        if not campaign.validate_schedule():
            raise ValueError("Invalid campaign schedule configuration")
        if not campaign.validate_rate_limits():
            raise ValueError("Invalid rate limit configuration")

        # Create campaign record
        db_campaign = Campaign(
            user_id=campaign.user_id,
            name=campaign.name,
            type=campaign.type,
            message_template=campaign.message_template,
            target_filters=campaign.target_filters,
            schedule_config=campaign.schedule_config,
            rate_limit=campaign.rate_limit
        )

        db.add(db_campaign)
        await db.commit()
        await db.refresh(db_campaign)

        # Initialize campaign processor
        processor = CampaignProcessor(
            campaign_id=str(db_campaign.id),
            campaign=db_campaign,
            whatsapp_client=None,  # Will be initialized when processing starts
            redis_url=settings.REDIS_URL
        )

        # Schedule campaign if auto-start is enabled
        if campaign.schedule_config.get("auto_start", False):
            background_tasks.add_task(processor.start_processor)
            db_campaign.update_status(CampaignStatus.SCHEDULED)
            await db.commit()

        # Calculate performance metrics
        duration = (datetime.utcnow() - start_time).total_seconds()

        logger.info(
            "Campaign created successfully",
            extra={
                "performance_metrics": {
                    "creation_time": duration,
                    "campaign_id": str(db_campaign.id)
                }
            }
        )

        return CampaignResponse.from_orm(db_campaign)

    except ValueError as e:
        logger.error(f"Validation error creating campaign: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating campaign: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_RESPONSES["INTERNAL_ERROR"]
        )

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: Session = Depends(get_db)
) -> CampaignResponse:
    """
    Retrieve detailed campaign information by ID.

    Args:
        campaign_id: UUID of campaign to retrieve
        db: Database session

    Returns:
        CampaignResponse: Campaign details
    """
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        return CampaignResponse.from_orm(campaign)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving campaign {campaign_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_RESPONSES["INTERNAL_ERROR"]
        )

@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    campaign_update: CampaignUpdate,
    db: Session = Depends(get_db)
) -> CampaignResponse:
    """
    Update campaign details with validation.

    Args:
        campaign_id: UUID of campaign to update
        campaign_update: Updated campaign data
        db: Database session

    Returns:
        CampaignResponse: Updated campaign details
    """
    try:
        # Retrieve existing campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        # Update fields if provided
        update_data = campaign_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(campaign, field, value)

        # Validate status transition if status is being updated
        if "status" in update_data:
            if not campaign.validate_transition(update_data["status"]):
                raise ValueError(f"Invalid status transition to {update_data['status']}")

        campaign.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(campaign)

        logger.info(f"Campaign {campaign_id} updated successfully")
        return CampaignResponse.from_orm(campaign)

    except ValueError as e:
        logger.error(f"Validation error updating campaign {campaign_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating campaign {campaign_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_RESPONSES["INTERNAL_ERROR"]
        )

@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    db: Session = Depends(get_db)
) -> None:
    """
    Delete a campaign and associated resources.

    Args:
        campaign_id: UUID of campaign to delete
        db: Database session
    """
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        # Stop campaign if running
        if campaign.status == CampaignStatus.RUNNING:
            processor = CampaignProcessor(
                campaign_id=str(campaign_id),
                campaign=campaign,
                whatsapp_client=None,
                redis_url=settings.REDIS_URL
            )
            await processor.stop_processor()

        # Delete campaign
        await db.delete(campaign)
        await db.commit()

        logger.info(f"Campaign {campaign_id} deleted successfully")

    except Exception as e:
        logger.error(f"Error deleting campaign {campaign_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_RESPONSES["INTERNAL_ERROR"]
        )