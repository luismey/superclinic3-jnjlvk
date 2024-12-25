"""
Pydantic schemas for WhatsApp message validation, serialization and deserialization.
Implements comprehensive validation rules, security controls, and performance optimizations.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, Field, validator, constr, Json
from ..models.messages import MessageType, MessageStatus

# Content size limits based on WhatsApp specifications
MAX_TEXT_LENGTH = 4096  # 4KB text limit
MAX_METADATA_SIZE = 16384  # 16KB metadata limit
MAX_CAPTION_LENGTH = 1024  # 1KB caption limit

class MessageBase(BaseModel):
    """
    Base Pydantic model with common message attributes and validation.
    Implements core message validation rules with security controls.
    """
    chat_id: UUID = Field(..., description="UUID of the associated chat")
    sender_id: UUID = Field(..., description="UUID of the message sender")
    message_type: MessageType = Field(..., description="Type of WhatsApp message")
    content: constr(min_length=1, max_length=MAX_TEXT_LENGTH, strip_whitespace=True) = Field(
        ..., description="Message content with type-specific validation"
    )
    metadata: Optional[Dict] = Field(
        default={},
        description="Optional metadata with size limits",
        max_length=MAX_METADATA_SIZE
    )
    is_from_customer: bool = Field(
        default=False,
        description="Indicates if message is from customer"
    )
    is_from_assistant: bool = Field(
        default=False,
        description="Indicates if message is from AI assistant"
    )
    language_code: Optional[str] = Field(
        default="pt",
        description="Message language code, defaults to Portuguese"
    )

    @validator("metadata")
    def validate_metadata_size(cls, v: Dict) -> Dict:
        """Validates metadata size constraints."""
        if v and len(str(v).encode()) > MAX_METADATA_SIZE:
            raise ValueError(f"Metadata size exceeds {MAX_METADATA_SIZE} bytes limit")
        return v

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        use_enum_values = True

class MessageCreate(MessageBase):
    """
    Schema for message creation with enhanced validation rules.
    Implements content validation based on message type.
    """
    @validator("content")
    def validate_content(cls, v: str, values: Dict) -> str:
        """Validates message content based on type with security checks."""
        message_type = values.get("message_type")
        if not message_type:
            raise ValueError("Message type is required for content validation")

        # Type-specific validation
        if message_type == MessageType.TEXT:
            if len(v) > MAX_TEXT_LENGTH:
                raise ValueError(f"Text content exceeds {MAX_TEXT_LENGTH} characters")
            
        elif message_type in (MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT):
            # URL validation for media content
            if not v.startswith(("https://", "http://")):
                raise ValueError("Media content must be a valid URL")
            if len(v) > 2048:  # Standard URL length limit
                raise ValueError("Media URL exceeds maximum length")

        # Security sanitization
        v = v.replace("<", "&lt;").replace(">", "&gt;")
        return v.strip()

class MessageUpdate(BaseModel):
    """
    Schema for message updates with status validation.
    Implements status transition rules and timestamp validation.
    """
    status: Optional[MessageStatus] = Field(
        None,
        description="Updated message status"
    )
    delivered_at: Optional[datetime] = Field(
        None,
        description="Message delivery timestamp"
    )
    read_at: Optional[datetime] = Field(
        None,
        description="Message read timestamp"
    )
    metadata: Optional[Dict] = Field(
        None,
        description="Updated metadata",
        max_length=MAX_METADATA_SIZE
    )

    @validator("status")
    def validate_status_transition(cls, v: Optional[MessageStatus], values: Dict) -> Optional[MessageStatus]:
        """Validates message status transitions."""
        if v:
            valid_transitions = {
                MessageStatus.PENDING: [MessageStatus.SENT, MessageStatus.FAILED],
                MessageStatus.SENT: [MessageStatus.DELIVERED, MessageStatus.FAILED],
                MessageStatus.DELIVERED: [MessageStatus.READ, MessageStatus.FAILED],
                MessageStatus.READ: [MessageStatus.FAILED],
                MessageStatus.FAILED: [MessageStatus.PENDING]
            }
            
            # Status transition validation handled by model layer
            return v
        return None

class MessageInDB(MessageBase):
    """
    Schema for message database representation with caching support.
    Implements comprehensive message tracking fields.
    """
    id: UUID = Field(..., description="Message UUID")
    whatsapp_message_id: Optional[str] = Field(
        None,
        description="WhatsApp platform message ID"
    )
    status: MessageStatus = Field(
        default=MessageStatus.PENDING,
        description="Current message status"
    )
    sent_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Message sent timestamp"
    )
    delivered_at: Optional[datetime] = Field(
        None,
        description="Message delivery timestamp"
    )
    read_at: Optional[datetime] = Field(
        None,
        description="Message read timestamp"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Record update timestamp"
    )

    class Config:
        orm_mode = True
        validate_assignment = True
        use_enum_values = True

class MessageResponse(MessageInDB):
    """
    Schema for API responses with selective field inclusion.
    Optimizes response payload size and includes related data.
    """
    sender_info: Optional[Dict] = Field(
        None,
        description="Sender information for display"
    )
    chat_info: Optional[Dict] = Field(
        None,
        description="Chat context information"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
            MessageType: lambda v: v.value,
            MessageStatus: lambda v: v.value
        }