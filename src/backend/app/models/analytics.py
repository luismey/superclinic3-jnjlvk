# sqlalchemy v2.0.0
# sqlalchemy.dialects.postgresql v2.0.0

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, Dict, Any
from uuid import UUID as PyUUID

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, JSON, ForeignKey, 
    Index, Enum, Boolean
)
from sqlalchemy.dialects.postgresql import UUID

from ..db.base import Base

# Enums for validation
class MetricCategory(PyEnum):
    SYSTEM = "system"
    BUSINESS = "business"
    PERFORMANCE = "performance"
    USER = "user"
    WHATSAPP = "whatsapp"

class EventType(PyEnum):
    USER_ACTION = "user_action"
    SYSTEM_EVENT = "system_event"
    ERROR = "error"
    BUSINESS = "business"
    INTEGRATION = "integration"

class AggregationType(PyEnum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class TimePeriod(PyEnum):
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"

@Base.registry.mapped
@Index('idx_metric_org_time', 'organization_id', 'timestamp')
@Index('idx_metric_category', 'category')
class Metric:
    """
    Model for storing system and business metrics with validation and indexing.
    Tracks various performance indicators and business metrics with temporal data.
    """
    __tablename__ = "metrics"

    id = Column(UUID, primary_key=True, server_default="gen_random_uuid()")
    name = Column(String(100), nullable=False)
    category = Column(Enum(MetricCategory), nullable=False)
    value = Column(Float, nullable=False)
    metadata = Column(JSON, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    organization_id = Column(UUID, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(
        self,
        name: str,
        category: str,
        value: float,
        organization_id: PyUUID,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None
    ):
        """Initialize a new metric instance with validation."""
        # Validate metric name
        if not name or len(name) > 100:
            raise ValueError("Metric name must be between 1 and 100 characters")
        
        # Validate category
        if not MetricCategory.__members__.get(category.upper()):
            raise ValueError(f"Invalid metric category. Must be one of: {', '.join(MetricCategory.__members__.keys())}")
        
        # Set validated values
        self.name = name.lower().replace(" ", "_")
        self.category = MetricCategory[category.upper()]
        self.value = float(value)
        self.organization_id = organization_id
        self.metadata = metadata or {}
        self.timestamp = timestamp or datetime.utcnow()
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at

@Base.registry.mapped
@Index('idx_event_org_time', 'organization_id', 'created_at')
@Index('idx_event_type', 'event_type')
class AnalyticsEvent:
    """
    Model for storing analytics events and user interactions with type validation.
    Captures detailed event data with context for analysis.
    """
    __tablename__ = "analytics_events"

    id = Column(UUID, primary_key=True, server_default="gen_random_uuid()")
    event_type = Column(Enum(EventType), nullable=False)
    event_data = Column(JSON, nullable=False)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    source = Column(String(50), nullable=True)
    context = Column(JSON, nullable=True)

    def __init__(
        self,
        event_type: str,
        event_data: Dict[str, Any],
        organization_id: PyUUID,
        user_id: Optional[PyUUID] = None,
        source: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """Initialize a new analytics event with validation."""
        # Validate event type
        if not EventType.__members__.get(event_type.upper()):
            raise ValueError(f"Invalid event type. Must be one of: {', '.join(EventType.__members__.keys())}")
        
        # Validate event data
        if not event_data or not isinstance(event_data, dict):
            raise ValueError("Event data must be a non-empty dictionary")

        # Set validated values
        self.event_type = EventType[event_type.upper()]
        self.event_data = event_data
        self.organization_id = organization_id
        self.user_id = user_id
        self.source = source
        self.context = context or {}
        self.created_at = datetime.utcnow()

@Base.registry.mapped
@Index('idx_agg_org_period', 'organization_id', 'time_period')
@Index('idx_agg_type_time', 'aggregation_type', 'start_time', 'end_time')
class MetricAggregation:
    """
    Model for storing aggregated metrics and statistics with time-based partitioning.
    Manages pre-calculated aggregations for efficient reporting.
    """
    __tablename__ = "metric_aggregations"

    id = Column(UUID, primary_key=True, server_default="gen_random_uuid()")
    aggregation_type = Column(Enum(AggregationType), nullable=False)
    time_period = Column(Enum(TimePeriod), nullable=False)
    aggregated_data = Column(JSON, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    organization_id = Column(UUID, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    metadata = Column(JSON, nullable=True)
    is_final = Column(Boolean, nullable=False, default=False)

    def __init__(
        self,
        aggregation_type: str,
        time_period: str,
        aggregated_data: Dict[str, Any],
        start_time: datetime,
        end_time: datetime,
        organization_id: PyUUID,
        metadata: Optional[Dict[str, Any]] = None,
        is_final: bool = False
    ):
        """Initialize a new metric aggregation with validation."""
        # Validate aggregation type
        if not AggregationType.__members__.get(aggregation_type.upper()):
            raise ValueError(f"Invalid aggregation type. Must be one of: {', '.join(AggregationType.__members__.keys())}")
        
        # Validate time period
        if not TimePeriod.__members__.get(time_period.upper()):
            raise ValueError(f"Invalid time period. Must be one of: {', '.join(TimePeriod.__members__.keys())}")
        
        # Validate time range
        if end_time <= start_time:
            raise ValueError("End time must be after start time")

        # Set validated values
        self.aggregation_type = AggregationType[aggregation_type.upper()]
        self.time_period = TimePeriod[time_period.upper()]
        self.aggregated_data = aggregated_data
        self.start_time = start_time
        self.end_time = end_time
        self.organization_id = organization_id
        self.metadata = metadata or {}
        self.is_final = is_final
        self.created_at = datetime.utcnow()