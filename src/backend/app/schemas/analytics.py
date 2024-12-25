# pydantic v2.0.0
# typing (latest)
# uuid (latest)
# datetime (latest)

from datetime import datetime
from typing import Dict, List, Optional, Union, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, constr, field_validator

# Import analytics models
from ..models.analytics import MetricCategory, EventType, TimePeriod, AggregationType

# Schema version for tracking
SCHEMA_VERSION = "1.0"

# Type definitions for validation
MetricName = constr(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9_.-]+$')
SourceName = constr(min_length=1, max_length=50, pattern=r'^[a-zA-Z0-9_-]+$')

class MetricBase(BaseModel):
    """Base schema for metric data with enhanced validation."""
    name: MetricName = Field(
        description="Metric name with alphanumeric characters, dots, dashes and underscores"
    )
    category: MetricCategory = Field(
        description="Category of the metric (system, business, performance, user, whatsapp)"
    )
    value: float = Field(
        ge=0,
        description="Non-negative metric value"
    )
    metadata: Optional[Dict] = Field(
        default=None,
        description="Optional metadata for additional metric context"
    )
    timestamp: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of metric recording"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "api_response_time",
                "category": "performance",
                "value": 156.7,
                "metadata": {"endpoint": "/api/v1/messages", "method": "POST"},
                "timestamp": "2024-01-20T10:30:00Z"
            }
        }
    )

class MetricCreate(MetricBase):
    """Schema for creating new metrics with organization context."""
    organization_id: UUID = Field(
        description="Organization ID for metric ownership"
    )

class MetricResponse(MetricBase):
    """Schema for metric responses with system-generated fields."""
    id: UUID = Field(description="Unique identifier for the metric")
    created_at: datetime = Field(description="Metric creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

class AnalyticsEventBase(BaseModel):
    """Base schema for analytics events."""
    event_type: EventType = Field(
        description="Type of analytics event"
    )
    event_data: Dict = Field(
        description="Event-specific data payload"
    )
    source: Optional[SourceName] = Field(
        default=None,
        description="Source system or component that generated the event"
    )
    context: Optional[Dict] = Field(
        default=None,
        description="Additional context information for the event"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "event_type": "user_action",
                "event_data": {
                    "action": "message_sent",
                    "chat_id": "123e4567-e89b-12d3-a456-426614174000"
                },
                "source": "whatsapp_service",
                "context": {"user_agent": "Mobile/iOS"}
            }
        }
    )

    @field_validator("event_data")
    def validate_event_data(cls, v: Dict) -> Dict:
        """Validate event data is not empty."""
        if not v:
            raise ValueError("Event data cannot be empty")
        return v

class AnalyticsEventCreate(AnalyticsEventBase):
    """Schema for creating analytics events."""
    organization_id: UUID = Field(description="Organization ID for event ownership")
    user_id: Optional[UUID] = Field(
        default=None,
        description="User ID associated with the event"
    )

class AnalyticsEventResponse(AnalyticsEventBase):
    """Schema for analytics event responses."""
    id: UUID = Field(description="Unique identifier for the event")
    created_at: datetime = Field(description="Event creation timestamp")
    organization_id: UUID = Field(description="Organization ID")
    user_id: Optional[UUID] = Field(description="Associated user ID")

class MetricAggregationBase(BaseModel):
    """Base schema for metric aggregations."""
    aggregation_type: AggregationType = Field(
        description="Type of aggregation (hourly, daily, weekly, monthly)"
    )
    time_period: TimePeriod = Field(
        description="Time period for the aggregation"
    )
    start_time: datetime = Field(description="Start of aggregation period")
    end_time: datetime = Field(description="End of aggregation period")
    aggregated_data: Dict = Field(description="Aggregated metric data")
    metadata: Optional[Dict] = Field(
        default=None,
        description="Additional aggregation metadata"
    )
    is_final: bool = Field(
        default=False,
        description="Indicates if aggregation is final or may be updated"
    )

    @field_validator("end_time")
    def validate_time_range(cls, v: datetime, values: Dict) -> datetime:
        """Validate end_time is after start_time."""
        if "start_time" in values and v <= values["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "aggregation_type": "hourly",
                "time_period": "hour",
                "start_time": "2024-01-20T10:00:00Z",
                "end_time": "2024-01-20T11:00:00Z",
                "aggregated_data": {
                    "api_response_time": {
                        "avg": 156.7,
                        "min": 120.0,
                        "max": 200.0,
                        "count": 1000
                    }
                },
                "is_final": True
            }
        }
    )

class MetricAggregationCreate(MetricAggregationBase):
    """Schema for creating metric aggregations."""
    organization_id: UUID = Field(description="Organization ID for aggregation ownership")

class MetricAggregationResponse(MetricAggregationBase):
    """Schema for metric aggregation responses."""
    id: UUID = Field(description="Unique identifier for the aggregation")
    created_at: datetime = Field(description="Aggregation creation timestamp")
    organization_id: UUID = Field(description="Organization ID")

# Export schemas for use in API endpoints
__all__ = [
    "MetricCreate",
    "MetricResponse",
    "AnalyticsEventCreate",
    "AnalyticsEventResponse",
    "MetricAggregationCreate",
    "MetricAggregationResponse",
    "SCHEMA_VERSION"
]