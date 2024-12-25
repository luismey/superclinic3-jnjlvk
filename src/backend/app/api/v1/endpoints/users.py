"""
FastAPI router implementing user management endpoints with enhanced security,
compliance, and monitoring features.

Version: 1.0.0
Dependencies:
- fastapi: ^0.100.0
- fastapi-limiter: ^0.1.5
- prometheus-client: ^0.16.0
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi_limiter.depends import RateLimiter
from prometheus_client import Counter
from sqlalchemy.orm import Session

from ....models.users import User, UserRole, Organization
from ....schemas.users import UserCreate, UserUpdate, UserResponse
from ....services.auth import (
    authenticate_user,
    create_user_session,
    validate_token,
)
from ....core.logging import get_logger
from ....core.security import get_password_hash

# Initialize router with prefix and tags
router = APIRouter(prefix="/users", tags=["users"])

# Configure enhanced logging
logger = get_logger(__name__, enable_security_logging=True)

# Initialize metrics
user_metrics = Counter(
    "user_operations_total",
    "Total user operations",
    ["operation", "status"]
)

# Rate limiting configurations
RATE_LIMIT_CREATE = "10/minute"
RATE_LIMIT_UPDATE = "20/minute"
RATE_LIMIT_DELETE = "5/minute"

async def get_current_user(
    request: Request,
    db: Session,
    token: str
) -> User:
    """
    Enhanced dependency to get and validate current user with security context.
    
    Args:
        request: FastAPI request object
        db: Database session
        token: JWT token from authorization header
        
    Returns:
        User: Current authenticated user
        
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Validate token and get payload
        payload = await validate_token(token)
        user_id = payload.get("user_id")
        
        # Get user from database with organization data
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
            
        # Update last access timestamp
        user.last_login = datetime.utcnow()
        db.commit()
        
        return user
        
    except Exception as e:
        logger.error(
            f"Authentication error: {str(e)}",
            extra={
                "security_event": {
                    "type": "auth_error",
                    "ip_address": request.client.host,
                    "endpoint": request.url.path
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication"
        )

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=10, minutes=1))]
)
async def create_user(
    request: Request,
    user_data: UserCreate,
    db: Session,
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Create new user with enhanced security and LGPD compliance checks.
    
    Args:
        request: FastAPI request object
        user_data: User creation data
        db: Database session
        current_user: Authenticated user creating the new user
        
    Returns:
        UserResponse: Created user data
        
    Raises:
        HTTPException: If creation fails or validation errors occur
    """
    try:
        # Verify creation permissions
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
            
        # Check organization access
        if user_data.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid organization access"
            )
            
        # Verify email uniqueness
        if db.query(User).filter(User.email == user_data.email.lower()).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
            
        # Validate LGPD consent
        if not user_data.lgpd_consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LGPD consent required"
            )
            
        # Create new user
        new_user = User(
            email=user_data.email.lower(),
            full_name=user_data.full_name,
            role=user_data.role,
            organization_id=user_data.organization_id
        )
        
        # Set secure password
        new_user.hashed_password = get_password_hash(
            user_data.password.get_secret_value()
        )
        
        # Initialize security metadata
        new_user.security_metadata = {
            "created_by": str(current_user.id),
            "created_from_ip": request.client.host,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Save to database
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Update metrics
        user_metrics.labels(
            operation="create",
            status="success"
        ).inc()
        
        # Log successful creation
        logger.info(
            f"User created: {new_user.id}",
            extra={
                "security_event": {
                    "type": "user_created",
                    "user_id": str(new_user.id),
                    "created_by": str(current_user.id),
                    "ip_address": request.client.host
                }
            }
        )
        
        return UserResponse.model_validate(new_user)
        
    except HTTPException:
        raise
    except Exception as e:
        # Update metrics
        user_metrics.labels(
            operation="create",
            status="error"
        ).inc()
        
        logger.error(
            f"User creation failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "user_creation_error",
                    "error": str(e),
                    "ip_address": request.client.host
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User creation failed"
        )

@router.get(
    "/",
    response_model=List[UserResponse],
    dependencies=[Depends(RateLimiter(times=20, minutes=1))]
)
async def get_users(
    request: Request,
    db: Session,
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    role: Optional[UserRole] = None,
    active: Optional[bool] = None
) -> List[UserResponse]:
    """
    Get list of users with filtering and pagination.
    
    Args:
        request: FastAPI request object
        db: Database session
        current_user: Authenticated user
        skip: Number of records to skip
        limit: Maximum number of records to return
        role: Optional role filter
        active: Optional active status filter
        
    Returns:
        List[UserResponse]: List of users matching criteria
    """
    try:
        # Build base query
        query = db.query(User).filter(
            User.organization_id == current_user.organization_id
        )
        
        # Apply filters
        if role:
            query = query.filter(User.role == role)
        if active is not None:
            query = query.filter(User.is_active == active)
            
        # Apply pagination
        users = query.offset(skip).limit(limit).all()
        
        # Update metrics
        user_metrics.labels(
            operation="list",
            status="success"
        ).inc()
        
        return [UserResponse.model_validate(user) for user in users]
        
    except Exception as e:
        user_metrics.labels(
            operation="list",
            status="error"
        ).inc()
        
        logger.error(
            f"User listing failed: {str(e)}",
            extra={
                "security_event": {
                    "type": "user_list_error",
                    "error": str(e),
                    "ip_address": request.client.host
                }
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )

# Additional endpoints would follow similar patterns with:
# - Comprehensive error handling
# - Security logging
# - Metrics tracking
# - Rate limiting
# - Permission checks
# - LGPD compliance