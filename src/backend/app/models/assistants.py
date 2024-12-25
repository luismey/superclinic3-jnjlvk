"""
SQLAlchemy ORM model for AI Virtual Assistant entity with comprehensive configuration
and performance tracking capabilities.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional
from sqlalchemy import (
    Column, String, DateTime, Enum as SQLEnum,
    Boolean, ForeignKey, JSON, Integer, Float
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import logging

from ..db.base import Base
from .users import User
from .organizations import Organization

# Configure logging
logger = logging.getLogger(__name__)

class AssistantType(str, Enum):
    """
    Enumeration of possible virtual assistant types with specific behavior patterns.
    Aligned with business requirements for different use cases.
    """
    CUSTOMER_SERVICE = "CUSTOMER_SERVICE"  # General customer support
    SALES = "SALES"                       # Sales and product inquiries
    APPOINTMENT = "APPOINTMENT"           # Scheduling and calendar management
    CUSTOM = "CUSTOM"                     # Custom behavior patterns

class Assistant(Base):
    """
    SQLAlchemy model representing an AI virtual assistant with comprehensive
    configuration, knowledge base management, and performance tracking capabilities.
    """
    __tablename__ = "assistants"

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    type = Column(SQLEnum(AssistantType), nullable=False)
    config = Column(JSON, nullable=False, default={
        "language": "pt-BR",
        "greeting": "",
        "farewell": "",
        "tone": "professional",
        "max_turns": 10,
        "fallback_behavior": "transfer",
        "working_hours": {"enabled": False, "schedule": {}}
    })
    knowledge_base = Column(JSON, nullable=False, default={
        "categories": [],
        "documents": [],
        "last_updated": None
    })
    
    # Status and metrics
    is_active = Column(Boolean, nullable=False, default=True)
    message_count = Column(Integer, nullable=False, default=0)
    avg_response_time = Column(Float, nullable=False, default=0.0)
    
    # Relationships and foreign keys
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship definitions
    organization = relationship(
        "Organization",
        back_populates="virtual_assistants",
        foreign_keys=[organization_id]
    )
    created_by = relationship(
        "User",
        foreign_keys=[created_by_id]
    )

    def __init__(
        self,
        name: str,
        type: AssistantType,
        organization_id: UUID,
        created_by_id: Optional[UUID] = None,
        config: Optional[Dict] = None,
        knowledge_base: Optional[Dict] = None
    ) -> None:
        """
        Initialize a new Assistant instance with required fields.

        Args:
            name: Assistant display name
            type: AssistantType enum value
            organization_id: UUID of associated organization
            created_by_id: UUID of creating user (optional)
            config: Initial configuration dictionary (optional)
            knowledge_base: Initial knowledge base dictionary (optional)
        """
        self.id = uuid.uuid4()
        self.name = name
        self.type = type
        self.organization_id = organization_id
        self.created_by_id = created_by_id
        
        if config:
            self.config.update(config)
        if knowledge_base:
            self.knowledge_base.update(knowledge_base)
            
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def update_config(self, new_config: Dict) -> Dict:
        """
        Update assistant configuration with type-specific schema validation.

        Args:
            new_config: Dictionary containing new configuration values

        Returns:
            Dict: Updated and validated configuration dictionary

        Raises:
            ValueError: If configuration is invalid for assistant type
        """
        try:
            # Validate configuration schema based on assistant type
            if not isinstance(new_config, dict):
                raise ValueError("Configuration must be a dictionary")

            # Preserve required fields based on assistant type
            required_fields = {
                "language": self.config.get("language", "pt-BR"),
                "tone": self.config.get("tone", "professional"),
                "max_turns": self.config.get("max_turns", 10)
            }

            # Add type-specific required fields
            if self.type == AssistantType.APPOINTMENT:
                required_fields.update({
                    "working_hours": self.config.get("working_hours", {
                        "enabled": False,
                        "schedule": {}
                    })
                })

            # Merge configurations preserving required fields
            merged_config = {**self.config, **new_config, **required_fields}
            
            # Update configuration and timestamp
            self.config = merged_config
            self.updated_at = datetime.utcnow()
            
            logger.info(f"Configuration updated for assistant {self.id}")
            return self.config

        except Exception as e:
            logger.error(f"Configuration update failed for assistant {self.id}: {str(e)}")
            raise

    def update_knowledge_base(self, new_knowledge: Dict) -> Dict:
        """
        Update assistant knowledge base with format validation.

        Args:
            new_knowledge: Dictionary containing new knowledge base data

        Returns:
            Dict: Updated and validated knowledge base dictionary

        Raises:
            ValueError: If knowledge base format is invalid
        """
        try:
            # Validate knowledge base format
            if not isinstance(new_knowledge, dict):
                raise ValueError("Knowledge base must be a dictionary")

            required_structure = {
                "categories": list,
                "documents": list
            }

            # Verify required structure
            for key, type_ in required_structure.items():
                if key in new_knowledge and not isinstance(new_knowledge[key], type_):
                    raise ValueError(f"{key} must be a {type_.__name__}")

            # Merge knowledge preserving structure
            merged_knowledge = {
                **self.knowledge_base,
                **new_knowledge,
                "last_updated": datetime.utcnow().isoformat()
            }

            # Update knowledge base and timestamp
            self.knowledge_base = merged_knowledge
            self.updated_at = datetime.utcnow()
            
            logger.info(f"Knowledge base updated for assistant {self.id}")
            return self.knowledge_base

        except Exception as e:
            logger.error(f"Knowledge base update failed for assistant {self.id}: {str(e)}")
            raise

    def update_metrics(self, new_message_count: int, response_time: float) -> None:
        """
        Update assistant performance metrics with running averages.

        Args:
            new_message_count: Number of new messages to add
            response_time: Response time in seconds for calculation

        Raises:
            ValueError: If input values are invalid
        """
        try:
            # Validate input values
            if new_message_count < 0:
                raise ValueError("Message count cannot be negative")
            if response_time < 0:
                raise ValueError("Response time cannot be negative")

            # Calculate new running average
            total_messages = self.message_count + new_message_count
            if total_messages > 0:
                current_total = self.avg_response_time * self.message_count
                new_total = current_total + (response_time * new_message_count)
                self.avg_response_time = new_total / total_messages

            # Update message count and timestamp
            self.message_count += new_message_count
            self.updated_at = datetime.utcnow()
            
            logger.debug(f"Metrics updated for assistant {self.id}")

        except Exception as e:
            logger.error(f"Metrics update failed for assistant {self.id}: {str(e)}")
            raise

    def __repr__(self) -> str:
        """String representation of the Assistant instance."""
        return f"<Assistant(id={self.id}, name='{self.name}', type={self.type.name})>"