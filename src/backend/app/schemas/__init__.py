"""
Pydantic schemas module for comprehensive data validation and serialization.
Centralizes and exports all data validation models used throughout the application.

Version: 2.0.0
"""

# Import all schema models
from .users import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    UserResponse,
    UserLogin,
    UserConsent
)
from .organizations import (
    OrganizationBase,
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationInDB,
    OrganizationResponse
)
from .assistants import (
    AssistantBase,
    AssistantCreate,
    AssistantUpdate,
    AssistantInDB,
    AssistantConfigSchema,
    KnowledgeBaseSchema
)

# Export all models for public use
__all__ = [
    # User schemas
    "UserBase",
    "UserCreate", 
    "UserUpdate",
    "UserInDB",
    "UserResponse",
    "UserLogin",
    "UserConsent",
    
    # Organization schemas
    "OrganizationBase",
    "OrganizationCreate",
    "OrganizationUpdate", 
    "OrganizationInDB",
    "OrganizationResponse",
    
    # Assistant schemas
    "AssistantBase",
    "AssistantCreate",
    "AssistantUpdate",
    "AssistantInDB",
    "AssistantConfigSchema",
    "KnowledgeBaseSchema"
]

# Version info
__version__ = "2.0.0"

# Module documentation
SCHEMA_DOCS = {
    "User": "Comprehensive user data validation with LGPD compliance",
    "Organization": "Business entity validation with subscription management",
    "Assistant": "AI assistant configuration and knowledge base validation"
}