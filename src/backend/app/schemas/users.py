"""
Pydantic schemas for user data validation, serialization and deserialization.
Implements comprehensive user data structures with enhanced security and LGPD compliance.

Version: 2.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, SecretStr, validator, constr, Json

# Internal imports
from ..models.users import UserRole
from ..core.security import get_password_hash

class UserBase(BaseModel):
    """Base Pydantic model with common user attributes and enhanced validation."""
    
    email: EmailStr = Field(..., description="User's email address")
    full_name: constr(min_length=2, max_length=100, strip_whitespace=True) = Field(
        ..., description="User's full name"
    )
    role: UserRole = Field(..., description="User's role in the organization")
    organization_id: UUID = Field(..., description="Associated organization ID")
    preferences: Json = Field(default={}, description="User preferences and settings")
    consent_flags: Dict[str, bool] = Field(
        default={
            "terms_accepted": False,
            "marketing_consent": False,
            "data_processing_consent": False
        },
        description="LGPD consent tracking flags"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "full_name": "John Doe",
                "role": "OPERATOR",
                "organization_id": "123e4567-e89b-12d3-a456-426614174000",
                "preferences": {"theme": "dark", "language": "pt-BR"},
                "consent_flags": {
                    "terms_accepted": True,
                    "marketing_consent": True,
                    "data_processing_consent": True
                }
            }
        }

class UserCreate(UserBase):
    """Schema for user creation with enhanced password validation and LGPD consent."""
    
    password: SecretStr = Field(
        ..., 
        description="User password meeting security requirements"
    )
    lgpd_consent: bool = Field(
        ..., 
        description="Explicit LGPD data processing consent"
    )
    security_metadata: Dict[str, str] = Field(
        default={},
        description="Additional security information"
    )

    @validator("password")
    def validate_password(cls, v: SecretStr) -> SecretStr:
        """Validate password against security requirements."""
        password = v.get_secret_value()
        
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        if not any(c.isupper() for c in password):
            raise ValueError("Password must contain at least one uppercase letter")
            
        if not any(c.islower() for c in password):
            raise ValueError("Password must contain at least one lowercase letter")
            
        if not any(c.isdigit() for c in password):
            raise ValueError("Password must contain at least one number")
            
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            raise ValueError("Password must contain at least one special character")
            
        return v

    @validator("lgpd_consent")
    def validate_lgpd_consent(cls, v: bool) -> bool:
        """Ensure explicit LGPD consent is provided."""
        if not v:
            raise ValueError("LGPD consent must be explicitly granted")
        return v

class UserConsent(BaseModel):
    """Schema for LGPD consent tracking."""
    
    user_id: UUID
    consent_flags: Dict[str, bool]
    consent_date: datetime
    consent_version: str = Field(default="1.0")
    consent_history: List[Dict] = Field(default_factory=list)

class UserUpdate(BaseModel):
    """Schema for user updates with optional fields and validation."""
    
    email: Optional[EmailStr] = None
    full_name: Optional[constr(min_length=2, max_length=100)] = None
    role: Optional[UserRole] = None
    preferences: Optional[Json] = None
    password: Optional[SecretStr] = None
    consent_flags: Optional[Dict[str, bool]] = None

    @validator("password")
    def validate_optional_password(cls, v: Optional[SecretStr]) -> Optional[SecretStr]:
        """Validate optional password update."""
        if v is not None:
            return UserCreate.validate_password(cls, v)
        return v

class UserInDB(UserBase):
    """Enhanced schema for user data as stored in database with security tracking."""
    
    id: UUID
    hashed_password: str
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    password_history: List[str] = Field(default_factory=list)
    security_events: Dict[str, datetime] = Field(default_factory=dict)
    consent_history: Dict[str, bool] = Field(default_factory=dict)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class UserResponse(UserBase):
    """Schema for user data in API responses with security considerations."""
    
    id: UUID
    last_login: Optional[datetime]
    created_at: datetime
    is_active: bool
    consent_status: Dict[str, bool]

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class UserLogin(BaseModel):
    """Schema for user login credentials with enhanced security."""
    
    email: EmailStr = Field(..., description="User's email address")
    password: SecretStr = Field(..., description="User's password")
    security_metadata: Optional[Dict] = Field(
        default={},
        description="Additional security context for login"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecureP@ssw0rd",
                "security_metadata": {
                    "device_id": "device_123",
                    "ip_address": "192.168.1.1"
                }
            }
        }