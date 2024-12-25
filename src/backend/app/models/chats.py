"""
SQLAlchemy ORM model for WhatsApp chat management with AI integration capabilities.
Implements comprehensive chat tracking, status management, and customer data handling.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional, List
import logging
import uuid
import jsonschema

from sqlalchemy import (
    Column, String, DateTime, Enum as SQLEnum,
    Boolean, ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from ..db.base import Base
from .messages import Message
from .users import User
from .organizations import Organization

# Configure logging
logger = logging.getLogger(__name__)

class ChatStatus(str, Enum):
    """
    Enumeration of possible chat statuses with transition validation.
    """
    ACTIVE = "ACTIVE"       # Chat is currently active
    PENDING = "PENDING"     # Awaiting response or action
    RESOLVED = "RESOLVED"   # Chat has been resolved
    ARCHIVED = "ARCHIVED"   # Chat has been archived

    @staticmethod
    def is_valid_transition(current_status: 'ChatStatus', new_status: 'ChatStatus') -> bool:
        """
        Validate if a status transition is allowed based on business rules.

        Args:
            current_status: Current chat status
            new_status: Proposed new status

        Returns:
            bool: Whether the transition is valid
        """
        valid_transitions = {
            ChatStatus.ACTIVE: [ChatStatus.PENDING, ChatStatus.RESOLVED, ChatStatus.ARCHIVED],
            ChatStatus.PENDING: [ChatStatus.ACTIVE, ChatStatus.RESOLVED, ChatStatus.ARCHIVED],
            ChatStatus.RESOLVED: [ChatStatus.ACTIVE, ChatStatus.ARCHIVED],
            ChatStatus.ARCHIVED: [ChatStatus.ACTIVE]
        }
        return new_status in valid_transitions.get(current_status, [])

class Chat(Base):
    """
    SQLAlchemy model representing a WhatsApp chat conversation with enhanced features.
    Implements comprehensive chat management with AI integration capabilities.
    """
    __tablename__ = "chats"

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    assigned_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # WhatsApp and customer information
    whatsapp_chat_id = Column(String(255), unique=True, nullable=False)
    customer_phone = Column(String(50), nullable=False, index=True)
    customer_name = Column(String(255), nullable=True)
    customer_metadata = Column(JSON, nullable=False, default={})

    # Chat status and configuration
    status = Column(SQLEnum(ChatStatus), nullable=False, default=ChatStatus.ACTIVE)
    ai_enabled = Column(Boolean, nullable=False, default=False)
    ai_config = Column(JSON, nullable=False, default={})
    ai_metrics = Column(JSON, nullable=False, default={
        "total_interactions": 0,
        "successful_responses": 0,
        "average_response_time": 0
    })

    # Timestamps
    last_message_at = Column(DateTime, nullable=True)
    last_ai_interaction = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    messages = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    organization = relationship(
        "Organization",
        back_populates="chats",
        lazy="joined"
    )
    assigned_user = relationship(
        "User",
        back_populates="assigned_chats",
        lazy="joined"
    )
    status_history = relationship(
        "ChatStatusHistory",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    # Indexes for performance
    __table_args__ = (
        Index('ix_chats_org_status', 'organization_id', 'status'),
        Index('ix_chats_last_message', 'organization_id', 'last_message_at'),
    )

    def update_status(self, new_status: ChatStatus, metadata: Optional[Dict] = None) -> bool:
        """
        Update chat status with validation and audit trail.

        Args:
            new_status: New status to set
            metadata: Optional metadata about the status change

        Returns:
            bool: Success status of update
        """
        try:
            if not ChatStatus.is_valid_transition(self.status, new_status):
                raise ValueError(f"Invalid status transition: {self.status} -> {new_status}")

            # Create status history entry
            history_entry = {
                "from_status": self.status.value,
                "to_status": new_status.value,
                "changed_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {}
            }
            
            # Update status and timestamps
            self.status = new_status
            self.updated_at = datetime.utcnow()
            
            # Add to status history
            self.status_history.append(history_entry)
            
            logger.info(f"Chat {self.id} status updated: {history_entry}")
            return True

        except Exception as e:
            logger.error(f"Status update failed for chat {self.id}: {str(e)}")
            return False

    def assign_user(self, user_id: uuid.UUID, assignment_metadata: Optional[Dict] = None) -> bool:
        """
        Assign chat to a user with validation and tracking.

        Args:
            user_id: UUID of user to assign
            assignment_metadata: Optional metadata about the assignment

        Returns:
            bool: Success status of assignment
        """
        try:
            # Update assignment
            self.assigned_user_id = user_id
            self.updated_at = datetime.utcnow()
            
            # Track assignment history
            assignment_entry = {
                "user_id": str(user_id),
                "assigned_at": datetime.utcnow().isoformat(),
                "metadata": assignment_metadata or {}
            }
            
            # Add to customer metadata
            if "assignment_history" not in self.customer_metadata:
                self.customer_metadata["assignment_history"] = []
            self.customer_metadata["assignment_history"].append(assignment_entry)
            
            logger.info(f"Chat {self.id} assigned to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Assignment failed for chat {self.id}: {str(e)}")
            return False

    def update_customer_metadata(self, metadata: Dict) -> Dict:
        """
        Update customer metadata with validation and privacy checks.

        Args:
            metadata: New metadata to merge

        Returns:
            Dict: Updated metadata dictionary
        """
        try:
            # Validate metadata format
            if not isinstance(metadata, dict):
                raise ValueError("Metadata must be a dictionary")

            # Filter sensitive data
            sensitive_fields = {"password", "credit_card", "document"}
            filtered_metadata = {
                k: v for k, v in metadata.items() 
                if k.lower() not in sensitive_fields
            }

            # Merge with existing metadata
            self.customer_metadata = {
                **self.customer_metadata,
                **filtered_metadata,
                "last_updated": datetime.utcnow().isoformat()
            }
            
            self.updated_at = datetime.utcnow()
            return self.customer_metadata

        except Exception as e:
            logger.error(f"Metadata update failed for chat {self.id}: {str(e)}")
            raise

    def configure_ai(self, enabled: bool, config: Optional[Dict] = None) -> Dict:
        """
        Configure AI assistant settings for the chat.

        Args:
            enabled: Whether to enable AI assistance
            config: Optional AI configuration parameters

        Returns:
            Dict: Updated AI configuration
        """
        try:
            self.ai_enabled = enabled
            
            if config:
                # Validate AI configuration
                required_fields = {"model", "temperature", "max_tokens"}
                if not all(field in config for field in required_fields):
                    raise ValueError(f"Missing required AI config fields: {required_fields}")
                
                self.ai_config = {
                    **self.ai_config,
                    **config,
                    "last_updated": datetime.utcnow().isoformat()
                }
            
            self.last_ai_interaction = datetime.utcnow()
            self.updated_at = datetime.utcnow()
            
            logger.info(f"AI configuration updated for chat {self.id}: enabled={enabled}")
            return self.ai_config

        except Exception as e:
            logger.error(f"AI configuration failed for chat {self.id}: {str(e)}")
            raise

    def to_dict(
        self,
        include_messages: bool = False,
        include_history: bool = False,
        include_metrics: bool = False
    ) -> Dict:
        """
        Convert chat to dictionary with configurable detail levels.

        Args:
            include_messages: Whether to include message history
            include_history: Whether to include status history
            include_metrics: Whether to include AI metrics

        Returns:
            Dict: Formatted chat data
        """
        chat_dict = {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "assigned_user_id": str(self.assigned_user_id) if self.assigned_user_id else None,
            "whatsapp_chat_id": self.whatsapp_chat_id,
            "customer_phone": self.customer_phone,
            "customer_name": self.customer_name,
            "customer_metadata": self.customer_metadata,
            "status": self.status.value,
            "ai_enabled": self.ai_enabled,
            "ai_config": self.ai_config,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "last_ai_interaction": self.last_ai_interaction.isoformat() if self.last_ai_interaction else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

        if include_messages:
            chat_dict["messages"] = [
                message.to_dict() for message in self.messages.order_by(Message.created_at.desc())
            ]

        if include_history:
            chat_dict["status_history"] = [
                entry for entry in self.status_history
            ]

        if include_metrics:
            chat_dict["ai_metrics"] = self.ai_metrics

        return chat_dict

    def __repr__(self) -> str:
        """String representation of the Chat instance."""
        return f"<Chat(id={self.id}, status={self.status.value}, customer={self.customer_phone})>"