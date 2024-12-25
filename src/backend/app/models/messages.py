"""
SQLAlchemy ORM model for WhatsApp messages with comprehensive tracking and validation.
Implements real-time status updates, content validation, and detailed audit trails.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer,
    ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import json
import logging
from pydantic import validators

from ..db.base import Base
from .users import User

# Configure logging
logger = logging.getLogger(__name__)

class MessageType(str, Enum):
    """
    Enumeration of supported WhatsApp message types with content validation rules.
    """
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    DOCUMENT = "DOCUMENT"
    LOCATION = "LOCATION"
    CONTACT = "CONTACT"

class MessageStatus(str, Enum):
    """
    Enumeration of message delivery statuses with valid transition rules.
    """
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"

class Message(Base):
    """
    SQLAlchemy model representing a WhatsApp message with comprehensive tracking and validation.
    Implements real-time status updates and content validation.
    """
    __tablename__ = "messages"

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sender_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    whatsapp_message_id = Column(String(255), unique=True, nullable=True)
    
    # Message content and type
    message_type = Column(SQLEnum(MessageType), nullable=False)
    content = Column(String, nullable=False)
    metadata = Column(JSON, nullable=False, default={})
    
    # Status tracking
    status = Column(SQLEnum(MessageStatus), nullable=False, default=MessageStatus.PENDING)
    is_from_customer = Column(Boolean, nullable=False, default=False)
    is_from_assistant = Column(Boolean, nullable=False, default=False)
    
    # Timestamps
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Audit and tracking
    status_history = Column(JSON, nullable=False, default=[])
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    content_validation = Column(JSON, nullable=False, default={})

    # Relationships
    chat = relationship(
        "Chat",
        back_populates="messages",
        lazy="joined"
    )
    sender = relationship(
        "User",
        back_populates="sent_messages",
        lazy="joined"
    )

    def __init__(
        self,
        chat_id: uuid.UUID,
        message_type: MessageType,
        content: str,
        metadata: Optional[Dict] = None,
        sender_id: Optional[uuid.UUID] = None,
        is_from_customer: bool = False,
        is_from_assistant: bool = False
    ) -> None:
        """
        Initialize a new Message instance with validation.

        Args:
            chat_id: UUID of associated chat
            message_type: Type of message (TEXT, IMAGE, etc.)
            content: Message content
            metadata: Optional metadata dictionary
            sender_id: Optional UUID of message sender
            is_from_customer: Whether message is from customer
            is_from_assistant: Whether message is from AI assistant
        """
        self.id = uuid.uuid4()
        self.chat_id = chat_id
        self.message_type = message_type
        self.content = content
        self.metadata = metadata or {}
        self.sender_id = sender_id
        self.is_from_customer = is_from_customer
        self.is_from_assistant = is_from_assistant
        
        # Initialize tracking fields
        self.status = MessageStatus.PENDING
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.status_history = []
        self.retry_count = 0
        
        # Validate content based on message type
        self._validate_content()

    def _validate_content(self) -> None:
        """
        Validate message content based on type and update validation results.
        """
        validation_result = {"valid": True, "errors": []}
        
        try:
            if self.message_type == MessageType.TEXT:
                if not self.content or len(self.content) > 4096:
                    validation_result["valid"] = False
                    validation_result["errors"].append("Text content must be 1-4096 characters")
                    
            elif self.message_type in (MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT):
                if not validators.url(self.content):
                    validation_result["valid"] = False
                    validation_result["errors"].append("Media content must be a valid URL")
                    
            elif self.message_type == MessageType.LOCATION:
                try:
                    location_data = json.loads(self.content)
                    if not all(k in location_data for k in ["latitude", "longitude"]):
                        raise ValueError("Missing coordinates")
                except Exception:
                    validation_result["valid"] = False
                    validation_result["errors"].append("Invalid location format")
                    
            elif self.message_type == MessageType.CONTACT:
                try:
                    contact_data = json.loads(self.content)
                    if not contact_data.get("phone"):
                        raise ValueError("Missing phone number")
                except Exception:
                    validation_result["valid"] = False
                    validation_result["errors"].append("Invalid contact format")
        
        except Exception as e:
            validation_result["valid"] = False
            validation_result["errors"].append(f"Validation error: {str(e)}")
            
        self.content_validation = validation_result

    def update_status(
        self,
        new_status: MessageStatus,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update message delivery status with validation and audit trail.

        Args:
            new_status: New message status
            error_message: Optional error message for failed status

        Returns:
            bool: Success status of update operation
        """
        try:
            # Validate status transition
            valid_transitions = {
                MessageStatus.PENDING: [MessageStatus.SENT, MessageStatus.FAILED],
                MessageStatus.SENT: [MessageStatus.DELIVERED, MessageStatus.FAILED],
                MessageStatus.DELIVERED: [MessageStatus.READ, MessageStatus.FAILED],
                MessageStatus.READ: [MessageStatus.FAILED],
                MessageStatus.FAILED: [MessageStatus.PENDING]
            }
            
            if new_status not in valid_transitions.get(self.status, []):
                raise ValueError(f"Invalid status transition: {self.status} -> {new_status}")

            # Update status and timestamp
            old_status = self.status
            self.status = new_status
            self.updated_at = datetime.utcnow()
            
            # Set status-specific timestamps
            if new_status == MessageStatus.SENT:
                self.sent_at = datetime.utcnow()
            elif new_status == MessageStatus.DELIVERED:
                self.delivered_at = datetime.utcnow()
            elif new_status == MessageStatus.READ:
                self.read_at = datetime.utcnow()
            elif new_status == MessageStatus.FAILED:
                self.error_message = error_message
                self.retry_count += 1
                
            # Update status history
            self.status_history.append({
                "from_status": old_status,
                "to_status": new_status,
                "timestamp": datetime.utcnow().isoformat(),
                "error_message": error_message if new_status == MessageStatus.FAILED else None
            })
            
            logger.info(f"Message {self.id} status updated: {old_status} -> {new_status}")
            return True
            
        except Exception as e:
            logger.error(f"Status update failed for message {self.id}: {str(e)}")
            return False

    def update_metadata(self, new_metadata: Dict) -> Dict:
        """
        Update message metadata with schema validation.

        Args:
            new_metadata: New metadata to merge with existing

        Returns:
            Dict: Updated metadata dictionary
        """
        try:
            # Validate metadata
            if not isinstance(new_metadata, dict):
                raise ValueError("Metadata must be a dictionary")
                
            # Check metadata size
            metadata_size = len(json.dumps(new_metadata))
            if metadata_size > 16384:  # 16KB limit
                raise ValueError("Metadata size exceeds 16KB limit")
                
            # Merge with existing metadata
            self.metadata = {**self.metadata, **new_metadata}
            self.updated_at = datetime.utcnow()
            
            return self.metadata
            
        except Exception as e:
            logger.error(f"Metadata update failed for message {self.id}: {str(e)}")
            raise

    def to_dict(self, include_relationships: bool = False) -> Dict:
        """
        Convert message to dictionary representation.

        Args:
            include_relationships: Whether to include related entities

        Returns:
            Dict: Message data dictionary
        """
        message_dict = {
            "id": str(self.id),
            "chat_id": str(self.chat_id),
            "sender_id": str(self.sender_id) if self.sender_id else None,
            "whatsapp_message_id": self.whatsapp_message_id,
            "message_type": self.message_type.value,
            "content": self.content,
            "metadata": self.metadata,
            "status": self.status.value,
            "is_from_customer": self.is_from_customer,
            "is_from_assistant": self.is_from_assistant,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status_history": self.status_history,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "content_validation": self.content_validation
        }
        
        if include_relationships:
            message_dict.update({
                "chat": self.chat.to_dict() if self.chat else None,
                "sender": self.sender.to_dict() if self.sender else None
            })
            
        return message_dict

    def __repr__(self) -> str:
        """String representation of the Message instance."""
        return f"<Message(id={self.id}, type={self.message_type.value}, status={self.status.value})>"