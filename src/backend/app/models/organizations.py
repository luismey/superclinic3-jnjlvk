"""
Organization model for the Porfin platform.
Implements comprehensive organization management including settings, subscription plans, and relationships.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from sqlalchemy import Column, String, DateTime, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import Base
import uuid

# Valid subscription plans
VALID_PLANS = ['free', 'starter', 'professional', 'enterprise']

class Organization(Base):
    """
    SQLAlchemy model representing a business organization with comprehensive management capabilities.
    
    Attributes:
        id (UUID): Unique identifier for the organization
        name (str): Organization name
        plan (str): Current subscription plan
        settings (JSON): Organization-specific settings and configurations
        is_active (bool): Organization active status
        subscription_ends_at (DateTime): Subscription expiration date
        created_at (DateTime): Record creation timestamp
        updated_at (DateTime): Record last update timestamp
        users (relationship): Related users in the organization
        whatsapp_accounts (relationship): Related WhatsApp accounts
        virtual_assistants (relationship): Related virtual assistants
        campaigns (relationship): Related marketing campaigns
    """
    
    __tablename__ = 'organizations'

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    plan = Column(String(50), nullable=False)
    settings = Column(JSON, nullable=False, default={})
    is_active = Column(Boolean, nullable=False, default=True)
    subscription_ends_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    whatsapp_accounts = relationship("WhatsAppAccount", back_populates="organization", cascade="all, delete-orphan")
    virtual_assistants = relationship("VirtualAssistant", back_populates="organization", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="organization", cascade="all, delete-orphan")

    def __init__(self, name: str, plan: str = 'free', settings: Optional[Dict] = None) -> None:
        """
        Initialize a new Organization instance.

        Args:
            name (str): Organization name
            plan (str, optional): Initial subscription plan. Defaults to 'free'.
            settings (Dict, optional): Initial settings dictionary. Defaults to None.
        
        Raises:
            ValueError: If plan is not in VALID_PLANS
        """
        if plan not in VALID_PLANS:
            raise ValueError(f"Invalid plan. Must be one of: {', '.join(VALID_PLANS)}")
        
        self.id = uuid.uuid4()
        self.name = name
        self.plan = plan
        self.settings = settings or {}
        self.is_active = True
        self.subscription_ends_at = datetime.utcnow() + timedelta(days=30)
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def update_settings(self, new_settings: Dict) -> Dict:
        """
        Update organization settings with validation.

        Args:
            new_settings (Dict): New settings to merge with existing ones

        Returns:
            Dict: Updated settings dictionary

        Raises:
            ValueError: If new_settings is not a valid dictionary
        """
        if not isinstance(new_settings, dict):
            raise ValueError("Settings must be a dictionary")

        # Merge new settings with existing ones
        self.settings = {**self.settings, **new_settings}
        self.updated_at = datetime.utcnow()
        
        return self.settings

    def update_subscription(self, plan: str, ends_at: Optional[datetime] = None) -> None:
        """
        Update organization subscription details.

        Args:
            plan (str): New subscription plan
            ends_at (datetime, optional): New subscription end date. 
                                        Defaults to 30 days from now.

        Raises:
            ValueError: If plan is not in VALID_PLANS
        """
        if plan not in VALID_PLANS:
            raise ValueError(f"Invalid plan. Must be one of: {', '.join(VALID_PLANS)}")

        self.plan = plan
        self.subscription_ends_at = ends_at or datetime.utcnow() + timedelta(days=30)
        self.updated_at = datetime.utcnow()

    def deactivate(self) -> None:
        """
        Deactivate organization and associated resources.
        This will cascade to all related entities through relationship settings.
        """
        self.is_active = False
        self.updated_at = datetime.utcnow()
        
        # Deactivate related resources (handled by cascade settings)
        # Log deactivation event if logging is implemented
        
    def __repr__(self) -> str:
        """String representation of the Organization instance."""
        return f"<Organization(id={self.id}, name='{self.name}', plan='{self.plan}')>"