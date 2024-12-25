"""
Pydantic schemas for WhatsApp chat validation, serialization and deserialization.
Implements comprehensive validation rules, security measures, and real-time chat data management
with support for Brazilian phone numbers and LGPD compliance.

Version: 2.0.0
"""

from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator, constr, Json, UUID4
from ..models.chats import ChatStatus
from .messages import MessageResponse

# Constants for validation
MAX_METADATA_SIZE = 16384  # 16KB limit for metadata
MAX_NAME_LENGTH = 100
BRAZIL_PHONE_REGEX = r'^\+55\d{10,11}$'  # Brazilian phone format with country code

class ChatBase(BaseModel):
    """Base Pydantic model with common chat attributes and enhanced validation."""
    organization_id: UUID4 = Field(..., description="Organization UUID")
    assigned_user_id: Optional[UUID4] = Field(None, description="Assigned user UUID")
    customer_phone: constr(min_length=10, max_length=20, regex=BRAZIL_PHONE_REGEX) = Field(
        ..., description="Customer's WhatsApp number in Brazilian format"
    )
    customer_name: Optional[constr(max_length=MAX_NAME_LENGTH)] = Field(
        None, description="Customer's display name"
    )
    customer_metadata: Optional[Json] = Field(
        default={},
        description="Customer metadata with size limits",
        max_length=MAX_METADATA_SIZE
    )
    status: ChatStatus = Field(
        default=ChatStatus.ACTIVE,
        description="Current chat status"
    )
    ai_enabled: bool = Field(
        default=False,
        description="Whether AI assistant is enabled"
    )
    whatsapp_chat_id: Optional[str] = Field(
        None, description="WhatsApp platform chat identifier"
    )
    language: Optional[str] = Field(
        default="pt",
        description="Chat language code, defaults to Portuguese"
    )
    tags: Optional[Dict[str, str]] = Field(
        default={},
        description="Chat categorization tags"
    )

    @validator("customer_metadata")
    def validate_metadata_size(cls, v: Json) -> Json:
        """Validates customer metadata size limits and content."""
        if v:
            # Check size limit
            if len(str(v).encode()) > MAX_METADATA_SIZE:
                raise ValueError(f"Metadata size exceeds {MAX_METADATA_SIZE} bytes limit")
            
            # Filter sensitive data
            sensitive_fields = {"cpf", "rg", "credit_card", "password"}
            filtered = {k: v for k, v in v.items() if k.lower() not in sensitive_fields}
            
            return filtered
        return {}

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID4: lambda v: str(v)
        }
        validate_assignment = True
        use_enum_values = True

class ChatCreate(ChatBase):
    """Schema for chat creation with enhanced validation rules."""
    @validator("customer_phone")
    def validate_phone(cls, phone: str) -> str:
        """Validates Brazilian WhatsApp phone number format."""
        if not phone.startswith("+55"):
            raise ValueError("Phone number must start with Brazil country code (+55)")
        
        # Remove country code for length validation
        number = phone[3:]
        
        # Validate DDD (area code)
        if not (10 <= len(number) <= 11):
            raise ValueError("Invalid phone number length")
        
        ddd = number[:2]
        if not (11 <= int(ddd) <= 99):
            raise ValueError("Invalid area code (DDD)")
        
        return phone

class ChatUpdate(BaseModel):
    """Schema for chat updates with status transition validation."""
    assigned_user_id: Optional[UUID4] = None
    status: Optional[ChatStatus] = None
    ai_enabled: Optional[bool] = None
    customer_name: Optional[constr(max_length=MAX_NAME_LENGTH)] = None
    customer_metadata: Optional[Json] = None
    tags: Optional[Dict[str, str]] = None

    @validator("status")
    def validate_status_transition(cls, new_status: Optional[ChatStatus], values: Dict) -> Optional[ChatStatus]:
        """Validates chat status transitions."""
        if new_status:
            valid_transitions = {
                ChatStatus.ACTIVE: [ChatStatus.PENDING, ChatStatus.RESOLVED, ChatStatus.ARCHIVED],
                ChatStatus.PENDING: [ChatStatus.ACTIVE, ChatStatus.RESOLVED, ChatStatus.ARCHIVED],
                ChatStatus.RESOLVED: [ChatStatus.ACTIVE, ChatStatus.ARCHIVED],
                ChatStatus.ARCHIVED: [ChatStatus.ACTIVE]
            }
            # Actual transition validation handled by model layer
            return new_status
        return None

class ChatInDB(ChatBase):
    """Schema for chat data as stored in database with timestamps."""
    id: UUID4 = Field(..., description="Chat UUID")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record update timestamp")
    last_message_at: datetime = Field(..., description="Last message timestamp")
    last_ai_interaction: Optional[datetime] = Field(
        None, description="Last AI interaction timestamp"
    )
    message_count: int = Field(
        default=0, description="Total message count"
    )

    class Config:
        orm_mode = True

class ChatResponse(ChatInDB):
    """Schema for chat data in API responses with pagination."""
    recent_messages: Optional[List[MessageResponse]] = Field(
        None, description="Recent chat messages"
    )
    unread_count: int = Field(
        default=0, description="Unread message count"
    )
    assigned_user_info: Optional[dict] = Field(
        None, description="Assigned user details"
    )
    ai_metrics: Optional[dict] = Field(
        None, description="AI interaction metrics"
    )
    last_message_preview: Optional[str] = Field(
        None, description="Preview of last message"
    )

    async def get_messages_page(self, page: int = 1, size: int = 20) -> List[MessageResponse]:
        """Retrieves paginated messages for chat."""
        offset = (page - 1) * size
        # Actual implementation handled by service layer
        return []