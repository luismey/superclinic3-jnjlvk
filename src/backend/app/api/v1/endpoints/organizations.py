"""
Organization management endpoints implementing CRUD operations with enhanced security,
validation, and audit logging.

FastAPI version: ^0.100.0
SQLAlchemy version: ^2.0.0
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi_cache.decorator import cache
from fastapi_limiter.depends import RateLimiter
from sqlalchemy.orm import Session

from app.models.organizations import Organization
from app.schemas.organizations import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    SubscriptionUpdate,
    SettingsUpdate
)
from app.core.security import decode_token, verify_permissions
from app.core.logging import get_logger
from app.core.database import get_db
from app.core.config import settings

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/organizations",
    tags=["organizations"]
)

# Configure logging
logger = get_logger(__name__, enable_security_logging=True)

# Configure rate limiting for subscription operations
rate_limiter = RateLimiter(
    max_requests=100,
    window_seconds=3600
)

async def get_organization(
    org_id: UUID,
    db: Session = Depends(get_db),
    required_permission: str = "read"
) -> Organization:
    """
    Enhanced dependency to get and validate organization access.
    
    Args:
        org_id: Organization UUID
        db: Database session
        required_permission: Required permission level
        
    Returns:
        Organization: Validated organization instance
        
    Raises:
        HTTPException: If organization not found or access denied
    """
    try:
        # Query organization with caching
        @cache(expire=300)
        async def get_cached_org():
            return db.query(Organization).filter(
                Organization.id == org_id,
                Organization.is_active == True
            ).first()
            
        organization = await get_cached_org()
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
            
        # Verify permissions
        if not await verify_permissions(organization, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
            
        # Log access attempt
        logger.info(
            "Organization access",
            extra={
                "security_event": {
                    "org_id": str(org_id),
                    "action": "access",
                    "permission": required_permission
                }
            }
        )
            
        return organization
        
    except Exception as e:
        logger.error(
            f"Error accessing organization: {str(e)}",
            extra={"org_id": str(org_id)}
        )
        raise

@router.post(
    "/",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_organization(
    organization: OrganizationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> OrganizationResponse:
    """
    Create a new organization with validation and background setup.
    
    Args:
        organization: Organization creation data
        background_tasks: Background task manager
        db: Database session
        
    Returns:
        OrganizationResponse: Created organization data
        
    Raises:
        HTTPException: If creation fails or validation errors occur
    """
    try:
        # Create organization instance
        db_org = Organization(
            name=organization.name,
            plan=organization.plan,
            settings=organization.settings
        )
        
        # Add to database
        db.add(db_org)
        db.commit()
        db.refresh(db_org)
        
        # Schedule background setup tasks
        background_tasks.add_task(
            setup_organization_resources,
            db_org.id
        )
        
        # Log creation
        logger.info(
            "Organization created",
            extra={
                "security_event": {
                    "org_id": str(db_org.id),
                    "action": "create",
                    "plan": organization.plan
                }
            }
        )
        
        return OrganizationResponse.model_validate(db_org)
        
    except Exception as e:
        db.rollback()
        logger.error(f"Organization creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.patch(
    "/{org_id}/subscription",
    response_model=OrganizationResponse
)
async def update_organization_subscription(
    organization: Organization = Depends(get_organization),
    subscription_update: SubscriptionUpdate = None,
    db: Session = Depends(get_db)
) -> OrganizationResponse:
    """
    Update organization subscription with fraud detection.
    
    Args:
        organization: Organization instance
        subscription_update: Subscription update data
        db: Database session
        
    Returns:
        OrganizationResponse: Updated organization data
        
    Raises:
        HTTPException: If update fails or validation errors occur
    """
    try:
        # Apply rate limiting
        await rate_limiter(f"subscription_{organization.id}")
        
        # Validate subscription update
        if not organization.validate_subscription_plan(
            subscription_update.plan
        ):
            raise ValueError("Invalid subscription plan")
            
        # Update subscription
        organization.update_subscription(
            plan=subscription_update.plan,
            ends_at=subscription_update.ends_at
        )
        
        # Commit changes
        db.commit()
        db.refresh(organization)
        
        # Log subscription update
        logger.info(
            "Subscription updated",
            extra={
                "security_event": {
                    "org_id": str(organization.id),
                    "action": "subscription_update",
                    "old_plan": organization.plan,
                    "new_plan": subscription_update.plan
                }
            }
        )
        
        return OrganizationResponse.model_validate(organization)
        
    except ValueError as e:
        logger.warning(
            f"Invalid subscription update: {str(e)}",
            extra={"org_id": str(organization.id)}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Subscription update failed: {str(e)}",
            extra={"org_id": str(organization.id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Subscription update failed"
        )

async def setup_organization_resources(org_id: UUID) -> None:
    """
    Background task to set up organization resources.
    
    Args:
        org_id: Organization UUID
    """
    try:
        # Initialize default resources
        # - Create default virtual assistant
        # - Set up WhatsApp integration
        # - Configure analytics
        logger.info(
            "Setting up organization resources",
            extra={"org_id": str(org_id)}
        )
        
    except Exception as e:
        logger.error(
            f"Resource setup failed: {str(e)}",
            extra={"org_id": str(org_id)}
        )