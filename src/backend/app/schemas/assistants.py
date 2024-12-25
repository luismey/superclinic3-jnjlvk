"""
Pydantic schemas for AI virtual assistant data validation and serialization.
Implements comprehensive data structures for assistant configuration, knowledge base,
and API operations with enhanced validation rules.

Pydantic version: ^2.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, Json, constr, validator

from ..models.assistants import AssistantType

class KnowledgeBaseSchema(BaseModel):
    """
    Schema for assistant knowledge base configuration and content validation.
    """
    categories: List[str] = Field(
        default=[],
        description="Knowledge categories for organization",
        min_items=0,
        max_items=50
    )
    documents: List[Dict] = Field(
        default=[],
        description="Knowledge documents with content",
        min_items=0,
        max_items=1000
    )
    last_updated: Optional[datetime] = Field(
        default=None,
        description="Last knowledge base update timestamp"
    )

class AssistantConfigSchema(BaseModel):
    """
    Schema for assistant behavior configuration with comprehensive validation.
    """
    language: str = Field(
        default="pt-BR",
        description="Assistant language code",
        regex="^[a-z]{2}-[A-Z]{2}$"
    )
    greeting: str = Field(
        default="",
        description="Custom greeting message",
        max_length=500
    )
    farewell: str = Field(
        default="",
        description="Custom farewell message",
        max_length=500
    )
    tone: str = Field(
        default="professional",
        description="Conversation tone setting",
        regex="^(professional|casual|friendly)$"
    )
    max_turns: int = Field(
        default=10,
        description="Maximum conversation turns",
        ge=1,
        le=50
    )
    fallback_behavior: str = Field(
        default="transfer",
        description="Behavior when unable to assist",
        regex="^(transfer|apologize|retry)$"
    )
    working_hours: Dict = Field(
        default={
            "enabled": False,
            "schedule": {}
        },
        description="Working hours configuration"
    )

class AssistantBase(BaseModel):
    """
    Base Pydantic model for virtual assistant with comprehensive validation.
    """
    name: constr(min_length=2, max_length=100, strip_whitespace=True) = Field(
        ...,
        description="Assistant display name",
        examples=["Sales Assistant", "Support Bot"]
    )
    type: AssistantType = Field(
        ...,
        description="Assistant type classification"
    )
    config: AssistantConfigSchema = Field(
        default_factory=AssistantConfigSchema,
        description="Assistant behavior configuration"
    )
    knowledge_base: KnowledgeBaseSchema = Field(
        default_factory=KnowledgeBaseSchema,
        description="Assistant knowledge base"
    )
    is_active: bool = Field(
        default=True,
        description="Assistant active status"
    )
    organization_id: UUID = Field(
        ...,
        description="Associated organization ID"
    )

    @validator("name")
    def validate_name(cls, v: str) -> str:
        """
        Validate assistant name format and content.
        
        Args:
            v: Assistant name to validate
            
        Returns:
            str: Validated assistant name
            
        Raises:
            ValueError: If name validation fails
        """
        # Check for reserved words
        reserved_words = ["system", "admin", "test", "default"]
        if v.lower() in reserved_words:
            raise ValueError(f"Name cannot be a reserved word: {', '.join(reserved_words)}")
        
        # Validate character set
        if not v.replace(" ", "").isalnum():
            raise ValueError("Name must contain only alphanumeric characters and spaces")
            
        return v

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        schema_extra = {
            "example": {
                "name": "Sales Assistant",
                "type": "SALES",
                "config": {
                    "language": "pt-BR",
                    "greeting": "Olá! Como posso ajudar?",
                    "tone": "professional",
                    "max_turns": 10
                },
                "is_active": True,
                "organization_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }

class AssistantCreate(AssistantBase):
    """
    Schema for assistant creation with additional validation rules.
    """
    @validator("config")
    def validate_config(cls, v: AssistantConfigSchema, values: Dict) -> AssistantConfigSchema:
        """
        Validate assistant configuration based on type.
        
        Args:
            v: Configuration to validate
            values: Other field values
            
        Returns:
            AssistantConfigSchema: Validated configuration
            
        Raises:
            ValueError: If configuration validation fails
        """
        assistant_type = values.get("type")
        
        if assistant_type == AssistantType.APPOINTMENT:
            if not v.working_hours.get("enabled"):
                raise ValueError("Appointment assistants must have working hours enabled")
                
        if assistant_type == AssistantType.SALES:
            required_fields = ["greeting", "farewell"]
            if not all(getattr(v, field) for field in required_fields):
                raise ValueError(f"Sales assistants require: {', '.join(required_fields)}")
                
        return v

class AssistantUpdate(BaseModel):
    """
    Schema for assistant updates with partial field validation.
    """
    name: Optional[constr(min_length=2, max_length=100)] = None
    config: Optional[AssistantConfigSchema] = None
    knowledge_base: Optional[KnowledgeBaseSchema] = None
    is_active: Optional[bool] = None

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class AssistantInDB(AssistantBase):
    """
    Schema for assistant database representation with additional fields.
    """
    id: UUID = Field(..., description="Assistant unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    message_count: int = Field(default=0, description="Total messages processed")
    avg_response_time: float = Field(
        default=0.0,
        description="Average response time in seconds",
        ge=0
    )

    class Config:
        """Pydantic model configuration."""
        orm_mode = True