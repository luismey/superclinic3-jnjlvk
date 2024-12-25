"""
Pydantic schemas for WhatsApp campaign data validation and serialization.
Implements comprehensive validation for campaign management including rate limiting,
schedule validation, and message tracking.

Version: 2.0.0
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, validator, root_validator

from ..models.campaigns import CampaignStatus, CampaignType
from ..utils.validators import validate_campaign_schedule, validate_rate_limit

class CampaignBase(BaseModel):
    """Base Pydantic model for campaign data validation."""
    name: str = Field(
        min_length=3,
        max_length=255,
        description="Campaign name"
    )
    type: CampaignType = Field(
        description="Campaign type (BROADCAST, SEQUENTIAL, TRIGGERED)"
    )
    message_template: Dict[str, Any] = Field(
        description="Message template configuration"
    )
    target_filters: Dict[str, Any] = Field(
        default={},
        description="Campaign targeting criteria"
    )
    schedule_config: Dict[str, Any] = Field(
        description="Campaign schedule configuration"
    )
    rate_limit: Optional[int] = Field(
        default=60,
        ge=60,
        le=120,
        description="Seconds between messages (60-120s)"
    )
    is_active: bool = Field(
        default=True,
        description="Campaign active status"
    )

    @validator("schedule_config")
    def validate_schedule(cls, schedule_config: Dict[str, Any]) -> Dict[str, Any]:
        """Validates campaign schedule configuration."""
        validation_result = validate_campaign_schedule(schedule_config)
        if not validation_result.is_valid:
            raise ValueError(validation_result.error_message)
        return schedule_config

    @validator("rate_limit")
    def validate_rate_limit(cls, rate_limit: Optional[int]) -> Optional[int]:
        """Validates message rate limit compliance."""
        if rate_limit is None:
            return 60  # Default rate limit

        validation_result = validate_rate_limit(rate_limit)
        if not validation_result.is_valid:
            raise ValueError(validation_result.error_message)
        return rate_limit

    @validator("message_template")
    def validate_template(cls, template: Dict[str, Any]) -> Dict[str, Any]:
        """Validates message template structure."""
        required_fields = {"content", "type"}
        if not all(field in template for field in required_fields):
            raise ValueError("Message template must contain 'content' and 'type' fields")
        return template

class CampaignCreate(CampaignBase):
    """Schema for campaign creation requests."""
    user_id: UUID = Field(description="ID of campaign creator")

class CampaignUpdate(BaseModel):
    """Schema for campaign update requests."""
    name: Optional[str] = Field(
        min_length=3,
        max_length=255,
        description="Campaign name"
    )
    status: Optional[CampaignStatus] = Field(
        description="Campaign status"
    )
    message_template: Optional[Dict[str, Any]] = Field(
        description="Message template configuration"
    )
    target_filters: Optional[Dict[str, Any]] = Field(
        description="Campaign targeting criteria"
    )
    schedule_config: Optional[Dict[str, Any]] = Field(
        description="Campaign schedule configuration"
    )
    rate_limit: Optional[int] = Field(
        ge=60,
        le=120,
        description="Seconds between messages"
    )
    is_active: Optional[bool] = Field(
        description="Campaign active status"
    )

    @root_validator
    def validate_status_transition(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validates campaign status transitions."""
        if "status" in values:
            new_status = values["status"]
            valid_transitions = {
                CampaignStatus.DRAFT: [CampaignStatus.SCHEDULED, CampaignStatus.FAILED],
                CampaignStatus.SCHEDULED: [CampaignStatus.RUNNING, CampaignStatus.FAILED],
                CampaignStatus.RUNNING: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED, CampaignStatus.FAILED],
                CampaignStatus.PAUSED: [CampaignStatus.RUNNING, CampaignStatus.FAILED],
                CampaignStatus.COMPLETED: [CampaignStatus.FAILED],
                CampaignStatus.FAILED: [CampaignStatus.DRAFT]
            }

            if new_status not in valid_transitions.get(values.get("current_status", CampaignStatus.DRAFT), []):
                raise ValueError(f"Invalid status transition to {new_status}")

        return values

class CampaignResponse(BaseModel):
    """Schema for campaign response data."""
    id: UUID
    user_id: UUID
    name: str
    type: CampaignType
    status: CampaignStatus
    message_template: Dict[str, Any]
    target_filters: Dict[str, Any]
    schedule_config: Dict[str, Any]
    total_recipients: int = Field(ge=0)
    messages_sent: int = Field(ge=0)
    messages_delivered: int = Field(ge=0)
    messages_failed: int = Field(ge=0)
    rate_limit: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_active: bool
    delivery_metrics: Dict[str, Any] = Field(
        default_factory=lambda: {
            "success_rate": 0,
            "bounce_rate": 0,
            "average_delivery_time": 0,
            "completion_percentage": 0
        }
    )
    error_logs: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        """Pydantic model configuration."""
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.replace(tzinfo=timezone.utc).isoformat()
        }

    @classmethod
    def from_orm(cls, db_campaign: Any) -> "CampaignResponse":
        """Creates response schema from ORM model."""
        # Convert ORM model to dictionary
        campaign_data = {
            "id": db_campaign.id,
            "user_id": db_campaign.user_id,
            "name": db_campaign.name,
            "type": db_campaign.type,
            "status": db_campaign.status,
            "message_template": db_campaign.message_template,
            "target_filters": db_campaign.target_filters,
            "schedule_config": db_campaign.schedule_config,
            "total_recipients": db_campaign.total_recipients,
            "messages_sent": db_campaign.messages_sent,
            "messages_delivered": db_campaign.messages_delivered,
            "messages_failed": db_campaign.messages_failed,
            "rate_limit": db_campaign.rate_limit,
            "start_time": db_campaign.start_time,
            "end_time": db_campaign.end_time,
            "created_at": db_campaign.created_at,
            "updated_at": db_campaign.updated_at,
            "is_active": db_campaign.is_active,
            "delivery_metrics": db_campaign.delivery_metrics,
            "error_logs": db_campaign.error_logs
        }
        return cls(**campaign_data)