"""
Pydantic schemas for organization data validation and serialization.
Implements comprehensive validation rules and type safety for organization-related operations.

Pydantic version: ^2.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Literal
from uuid import UUID
from pydantic import BaseModel, Field, validator, root_validator, ConfigDict
import re

# Constants for validation
NAME_MIN_LENGTH = 2
NAME_MAX_LENGTH = 100
NAME_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-_\.]+$')
VALID_PLANS = Literal['free', 'basic', 'premium', 'enterprise']
REQUIRED_SETTINGS = {'notification_email', 'language', 'timezone'}

class OrganizationBase(BaseModel):
    """Base Pydantic model with common organization fields and core validation rules."""
    
    name: str = Field(
        ...,  # Required field
        min_length=NAME_MIN_LENGTH,
        max_length=NAME_MAX_LENGTH,
        description="Organization name (2-100 characters)"
    )
    plan: VALID_PLANS = Field(
        default='free',
        description="Subscription plan level"
    )
    settings: Dict[str, Any] = Field(
        default_factory=dict,
        description="Organization-specific settings and configurations"
    )

    @validator('name')
    def validate_name(cls, value: str) -> str:
        """Validate organization name format and constraints."""
        # Strip whitespace
        value = value.strip()
        
        # Check length after stripping
        if not NAME_MIN_LENGTH <= len(value) <= NAME_MAX_LENGTH:
            raise ValueError(
                f"Name must be between {NAME_MIN_LENGTH} and {NAME_MAX_LENGTH} characters"
            )
        
        # Validate character pattern
        if not NAME_PATTERN.match(value):
            raise ValueError(
                "Name can only contain letters, numbers, spaces, hyphens, underscores, and dots"
            )
        
        return value

    @validator('settings')
    def validate_settings(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        """Validate organization settings structure and required keys."""
        if not isinstance(value, dict):
            raise ValueError("Settings must be a dictionary")

        # Ensure required settings are present
        missing_settings = REQUIRED_SETTINGS - set(value.keys())
        if missing_settings:
            # Apply defaults for missing required settings
            defaults = {
                'notification_email': None,
                'language': 'pt-BR',
                'timezone': 'America/Sao_Paulo'
            }
            for setting in missing_settings:
                value[setting] = defaults[setting]

        return value

class OrganizationCreate(OrganizationBase):
    """Schema for creating a new organization with required fields and defaults."""

    @root_validator
    def validate_create(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate complete organization creation data."""
        # Ensure required fields are present
        required_fields = {'name', 'plan'}
        missing_fields = required_fields - set(values.keys())
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

        # Initialize settings if not provided
        if 'settings' not in values:
            values['settings'] = {}

        return values

class OrganizationUpdate(BaseModel):
    """Schema for updating an existing organization with optional fields."""
    
    name: Optional[str] = Field(
        None,
        min_length=NAME_MIN_LENGTH,
        max_length=NAME_MAX_LENGTH
    )
    plan: Optional[VALID_PLANS] = None
    settings: Optional[Dict[str, Any]] = None

    @root_validator
    def validate_update(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate partial update data."""
        # Ensure at least one field is being updated
        update_fields = {k for k, v in values.items() if v is not None}
        if not update_fields:
            raise ValueError("At least one field must be provided for update")

        # Validate name if provided
        if values.get('name'):
            values['name'] = OrganizationBase.validate_name(None, values['name'])

        # Validate settings if provided
        if values.get('settings') is not None:
            values['settings'] = OrganizationBase.validate_settings(None, values['settings'])

        return values

class OrganizationInDB(OrganizationBase):
    """Schema representing organization data as stored in database."""
    
    id: UUID
    is_active: bool
    subscription_ends_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
    )

class OrganizationResponse(OrganizationInDB):
    """Schema for organization API responses with computed fields."""
    
    is_trial: bool = Field(
        default=False,
        description="Indicates if organization is in trial period"
    )
    days_remaining: int = Field(
        default=0,
        description="Days remaining in current subscription period"
    )

    @root_validator
    def compute_trial_status(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Compute trial status and days remaining."""
        now = datetime.utcnow()
        subscription_ends_at = values.get('subscription_ends_at')
        created_at = values.get('created_at')

        if not all([subscription_ends_at, created_at]):
            return values

        # Compute trial status (trial if within 30 days of creation and on free plan)
        values['is_trial'] = (
            values.get('plan') == 'free' and
            (now - created_at) <= timedelta(days=30)
        )

        # Compute days remaining in subscription
        if subscription_ends_at > now:
            values['days_remaining'] = (subscription_ends_at - now).days
        else:
            values['days_remaining'] = 0

        return values