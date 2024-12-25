"""
Initialization module for SQLAlchemy models that exports all database models and their related enums.
Serves as the central point for model imports throughout the application, implementing a clean import interface.

SQLAlchemy version: ^2.0.0
"""

# Import models and enums
from .users import User, UserRole
from .organizations import Organization
from .chats import Chat, ChatStatus
from .assistants import Assistant, AssistantType
from .campaigns import Campaign, CampaignStatus, CampaignType
from .messages import Message, MessageType, MessageStatus

# Export all models and enums
__all__ = [
    # User model and enums
    "User",
    "UserRole",
    
    # Organization model
    "Organization",
    
    # Chat model and enums
    "Chat",
    "ChatStatus",
    
    # Assistant model and enums
    "Assistant",
    "AssistantType",
    
    # Campaign model and enums
    "Campaign",
    "CampaignStatus",
    "CampaignType",
    
    # Message model and enums
    "Message",
    "MessageType", 
    "MessageStatus"
]

# Version info
__version__ = "1.0.0"

# Module documentation
__doc__ = """
SQLAlchemy ORM models package for the Porfin platform.

This package provides all database models and their related enums for:
- User management and authentication
- Organization and multi-tenancy
- WhatsApp chat conversations
- AI virtual assistants
- Marketing campaigns
- Message handling

All models use SQLAlchemy 2.0 style declarations and implement comprehensive
tracking, validation and relationship management.
"""