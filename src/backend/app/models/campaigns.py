"""
SQLAlchemy ORM model for WhatsApp message campaigns with comprehensive tracking and analytics.
Implements enhanced campaign management, rate limiting, and detailed metrics tracking.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer,
    ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID
import uuid
import logging

from ..db.base import Base
from .users import User
from .messages import Message

# Configure logging
logger = logging.getLogger(__name__)

class CampaignStatus(str, Enum):
    """
    Enumeration of possible campaign statuses with validation rules.
    """
    DRAFT = "DRAFT"           # Initial creation state
    SCHEDULED = "SCHEDULED"   # Ready for execution
    RUNNING = "RUNNING"       # Currently executing
    PAUSED = "PAUSED"        # Temporarily stopped
    COMPLETED = "COMPLETED"   # Successfully finished
    FAILED = "FAILED"        # Execution failed

class CampaignType(str, Enum):
    """
    Enumeration of campaign types with specific behaviors.
    """
    BROADCAST = "BROADCAST"     # Send to all targets simultaneously
    SEQUENTIAL = "SEQUENTIAL"   # Send in ordered sequence
    TRIGGERED = "TRIGGERED"     # Event-based sending

class Campaign(Base):
    """
    SQLAlchemy model for WhatsApp message campaigns with comprehensive tracking.
    Implements rate limiting, metrics tracking, and detailed analytics.
    """
    __tablename__ = "campaigns"

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name = Column(String(255), nullable=False)
    type = Column(SQLEnum(CampaignType), nullable=False)
    status = Column(SQLEnum(CampaignStatus), nullable=False, default=CampaignStatus.DRAFT)

    # Campaign configuration
    message_template = Column(JSON, nullable=False)
    target_filters = Column(JSON, nullable=False, default={})
    schedule_config = Column(JSON, nullable=False, default={})
    
    # Campaign metrics
    total_recipients = Column(Integer, nullable=False, default=0)
    messages_sent = Column(Integer, nullable=False, default=0)
    messages_delivered = Column(Integer, nullable=False, default=0)
    messages_failed = Column(Integer, nullable=False, default=0)
    
    # Rate limiting
    rate_limit = Column(Integer, nullable=False, default=60)  # Seconds between messages
    
    # Performance tracking
    delivery_metrics = Column(JSON, nullable=False, default={})
    error_logs = Column(JSON, nullable=False, default=[])
    
    # Timestamps
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    last_message_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Status flag
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    user = relationship(
        "User",
        back_populates="campaigns",
        lazy="joined"
    )
    messages = relationship(
        "Message",
        back_populates="campaign",
        cascade="all, delete-orphan"
    )

    def __init__(
        self,
        user_id: uuid.UUID,
        name: str,
        campaign_type: CampaignType,
        message_template: Dict,
        target_filters: Optional[Dict] = None,
        schedule_config: Optional[Dict] = None,
        rate_limit: int = 60
    ) -> None:
        """
        Initialize a new Campaign instance with validation.

        Args:
            user_id: UUID of campaign creator
            name: Campaign name
            campaign_type: Type of campaign
            message_template: Message template configuration
            target_filters: Optional targeting criteria
            schedule_config: Optional scheduling configuration
            rate_limit: Seconds between messages (default: 60)
        """
        self.id = uuid.uuid4()
        self.user_id = user_id
        self.name = name
        self.type = campaign_type
        self.message_template = message_template
        self.target_filters = target_filters or {}
        self.schedule_config = schedule_config or {}
        self.rate_limit = rate_limit
        
        # Initialize tracking
        self.status = CampaignStatus.DRAFT
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.delivery_metrics = {
            "success_rate": 0,
            "bounce_rate": 0,
            "average_delivery_time": 0,
            "completion_percentage": 0
        }

    @validates('rate_limit')
    def validate_rate_limit(self, key: str, value: int) -> int:
        """
        Validate rate limit value against platform constraints.

        Args:
            key: Field name being validated
            value: Rate limit value in seconds

        Returns:
            int: Validated rate limit value

        Raises:
            ValueError: If rate limit is invalid
        """
        min_limit = 60  # Minimum 60 seconds between messages
        max_limit = 120  # Maximum 120 seconds between messages
        
        if not isinstance(value, int) or value < min_limit or value > max_limit:
            raise ValueError(f"Rate limit must be between {min_limit} and {max_limit} seconds")
        
        return value

    def update_status(self, new_status: CampaignStatus, metadata: Optional[Dict] = None) -> bool:
        """
        Update campaign status with validation and audit trail.

        Args:
            new_status: New campaign status
            metadata: Optional status change metadata

        Returns:
            bool: Success status of update operation
        """
        try:
            # Validate status transition
            valid_transitions = {
                CampaignStatus.DRAFT: [CampaignStatus.SCHEDULED, CampaignStatus.FAILED],
                CampaignStatus.SCHEDULED: [CampaignStatus.RUNNING, CampaignStatus.FAILED],
                CampaignStatus.RUNNING: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED, CampaignStatus.FAILED],
                CampaignStatus.PAUSED: [CampaignStatus.RUNNING, CampaignStatus.FAILED],
                CampaignStatus.COMPLETED: [CampaignStatus.FAILED],
                CampaignStatus.FAILED: [CampaignStatus.DRAFT]
            }

            if new_status not in valid_transitions.get(self.status, []):
                raise ValueError(f"Invalid status transition: {self.status} -> {new_status}")

            # Update status and timestamps
            old_status = self.status
            self.status = new_status
            self.updated_at = datetime.utcnow()

            if new_status == CampaignStatus.RUNNING:
                self.start_time = datetime.utcnow()
            elif new_status in [CampaignStatus.COMPLETED, CampaignStatus.FAILED]:
                self.end_time = datetime.utcnow()

            # Log status change
            status_change = {
                "from_status": old_status.value,
                "to_status": new_status.value,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {}
            }
            
            if new_status == CampaignStatus.FAILED:
                self.error_logs.append(status_change)

            logger.info(f"Campaign {self.id} status updated: {old_status} -> {new_status}")
            return True

        except Exception as e:
            logger.error(f"Status update failed for campaign {self.id}: {str(e)}")
            return False

    def update_metrics(self) -> Dict:
        """
        Update comprehensive campaign delivery metrics.

        Returns:
            Dict: Updated campaign metrics
        """
        try:
            total_messages = self.messages_sent + self.messages_failed
            
            # Calculate delivery statistics
            self.delivery_metrics = {
                "success_rate": (self.messages_delivered / self.messages_sent * 100) if self.messages_sent > 0 else 0,
                "bounce_rate": (self.messages_failed / total_messages * 100) if total_messages > 0 else 0,
                "average_delivery_time": self._calculate_average_delivery_time(),
                "completion_percentage": (self.messages_sent / self.total_recipients * 100) if self.total_recipients > 0 else 0,
                "status_breakdown": {
                    "sent": self.messages_sent,
                    "delivered": self.messages_delivered,
                    "failed": self.messages_failed,
                    "pending": self.total_recipients - (self.messages_sent + self.messages_failed)
                },
                "last_updated": datetime.utcnow().isoformat()
            }

            self.updated_at = datetime.utcnow()
            return self.delivery_metrics

        except Exception as e:
            logger.error(f"Metrics update failed for campaign {self.id}: {str(e)}")
            raise

    def validate_rate_limit(self, current_time: datetime) -> bool:
        """
        Validates and updates message rate limiting.

        Args:
            current_time: Current timestamp for rate check

        Returns:
            bool: Whether message can be sent
        """
        if not self.last_message_time:
            self.last_message_time = current_time
            return True

        time_diff = (current_time - self.last_message_time).total_seconds()
        
        if time_diff >= self.rate_limit:
            self.last_message_time = current_time
            return True
            
        return False

    def _calculate_average_delivery_time(self) -> float:
        """
        Calculate average message delivery time from message history.

        Returns:
            float: Average delivery time in seconds
        """
        try:
            delivery_times = []
            for message in self.messages:
                if message.sent_at and message.delivered_at:
                    delivery_time = (message.delivered_at - message.sent_at).total_seconds()
                    delivery_times.append(delivery_time)

            return sum(delivery_times) / len(delivery_times) if delivery_times else 0

        except Exception as e:
            logger.error(f"Error calculating delivery time for campaign {self.id}: {str(e)}")
            return 0

    def __repr__(self) -> str:
        """String representation of the Campaign instance."""
        return f"<Campaign(id={self.id}, name='{self.name}', status={self.status.value})>"