"""
SQLAlchemy ORM model for User entity with enhanced security features and LGPD compliance.
Implements comprehensive user management, authentication, and audit logging.

SQLAlchemy version: ^2.0.0
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Optional
from sqlalchemy import (
    Column, String, DateTime, Enum as SQLEnum, 
    Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid
import logging

from .organizations import Organization
from ..core.security import get_password_hash

# Configure logging
logger = logging.getLogger(__name__)

# Create base model class
Base = declarative_base()

class UserRole(str, Enum):
    """
    Enumeration of possible user roles with corresponding permissions.
    Aligned with authorization matrix specifications.
    """
    ADMIN = "ADMIN"         # Full system access
    MANAGER = "MANAGER"     # Organization-wide access
    OPERATOR = "OPERATOR"   # Limited operational access
    AGENT = "AGENT"        # Chat-only access

class User(Base):
    """
    SQLAlchemy model representing a user with enhanced security and audit features.
    Implements LGPD compliance measures and comprehensive security tracking.
    """
    __tablename__ = "users"

    # Primary columns
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    organization_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # User preferences and settings
    preferences = Column(JSON, nullable=False, default={})
    security_metadata = Column(JSON, nullable=False, default={})
    
    # Tracking and audit columns
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Security management columns
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    account_locked_until = Column(DateTime, nullable=True)
    password_history = Column(JSON, nullable=False, default={"history": []})
    
    # LGPD compliance columns
    consent_tracking = Column(JSON, nullable=False, default={
        "terms_accepted": False,
        "marketing_consent": False,
        "data_processing_consent": False,
        "consent_history": []
    })
    two_factor_enabled = Column(Boolean, nullable=False, default=False)

    # Relationships
    organization = relationship(
        "Organization",
        back_populates="users",
        foreign_keys=[organization_id]
    )

    def __init__(self, email: str, full_name: str, role: UserRole, 
                 organization_id: UUID) -> None:
        """
        Initialize a new User instance with required fields.

        Args:
            email: User's email address
            full_name: User's full name
            role: UserRole enum value
            organization_id: UUID of associated organization
        """
        self.id = uuid.uuid4()
        self.email = email.lower()
        self.full_name = full_name
        self.role = role
        self.organization_id = organization_id
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def set_password(self, password: str) -> bool:
        """
        Hash and set user password with complexity validation and history tracking.

        Args:
            password: Plain text password to hash and set

        Returns:
            bool: True if password was set successfully
        """
        try:
            # Validate password complexity
            if len(password) < 8:
                raise ValueError("Password must be at least 8 characters long")
            
            # Check password history (prevent reuse of last 5 passwords)
            history = self.password_history.get("history", [])
            for old_hash in history[-5:]:
                if verify_password(password, old_hash):
                    raise ValueError("Password was recently used")

            # Hash and set new password
            self.hashed_password = get_password_hash(password)
            
            # Update password history
            history.append(self.hashed_password)
            self.password_history["history"] = history[-5:]  # Keep last 5
            
            # Update audit trail
            self.updated_at = datetime.utcnow()
            self.security_metadata["last_password_change"] = datetime.utcnow().isoformat()
            
            logger.info(f"Password updated for user {self.id}")
            return True

        except Exception as e:
            logger.error(f"Password update failed for user {self.id}: {str(e)}")
            return False

    def track_login_attempt(self, success: bool) -> bool:
        """
        Track and manage failed login attempts with account locking.

        Args:
            success: Whether the login attempt was successful

        Returns:
            bool: True if account is locked
        """
        try:
            if success:
                # Reset counters on successful login
                self.failed_login_attempts = 0
                self.account_locked_until = None
                self.last_login = datetime.utcnow()
                self.security_metadata["last_successful_login"] = datetime.utcnow().isoformat()
            else:
                # Increment failed attempts
                self.failed_login_attempts += 1
                
                # Lock account after 5 failed attempts
                if self.failed_login_attempts >= 5:
                    self.account_locked_until = datetime.utcnow() + timedelta(minutes=30)
                    logger.warning(f"Account locked for user {self.id}")
                    
            self.updated_at = datetime.utcnow()
            return bool(self.account_locked_until and 
                       self.account_locked_until > datetime.utcnow())

        except Exception as e:
            logger.error(f"Error tracking login attempt for user {self.id}: {str(e)}")
            return False

    def update_preferences(self, new_preferences: Dict) -> Dict:
        """
        Update user preferences with audit logging.

        Args:
            new_preferences: Dictionary of new preference settings

        Returns:
            Dict: Updated preferences dictionary
        """
        try:
            # Validate new preferences
            if not isinstance(new_preferences, dict):
                raise ValueError("Preferences must be a dictionary")

            # Merge with existing preferences
            self.preferences = {**self.preferences, **new_preferences}
            
            # Update audit trail
            self.updated_at = datetime.utcnow()
            self.security_metadata["last_preferences_update"] = datetime.utcnow().isoformat()
            
            return self.preferences

        except Exception as e:
            logger.error(f"Preference update failed for user {self.id}: {str(e)}")
            raise

    def handle_consent(self, consent_type: str, granted: bool) -> Dict:
        """
        Manage LGPD consent tracking with audit trail.

        Args:
            consent_type: Type of consent being updated
            granted: Whether consent is granted or revoked

        Returns:
            Dict: Updated consent status
        """
        try:
            valid_consent_types = {
                "terms_accepted", "marketing_consent", 
                "data_processing_consent"
            }
            
            if consent_type not in valid_consent_types:
                raise ValueError(f"Invalid consent type. Must be one of: {valid_consent_types}")

            # Update consent status
            self.consent_tracking[consent_type] = granted
            
            # Add to consent history
            consent_event = {
                "type": consent_type,
                "granted": granted,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.consent_tracking["consent_history"].append(consent_event)
            
            # Update audit trail
            self.updated_at = datetime.utcnow()
            
            logger.info(f"Consent updated for user {self.id}: {consent_type}={granted}")
            return self.consent_tracking

        except Exception as e:
            logger.error(f"Consent update failed for user {self.id}: {str(e)}")
            raise

    def __repr__(self) -> str:
        """String representation of the User instance."""
        return f"<User(id={self.id}, email='{self.email}', role={self.role.name})>"