# pydantic_settings v2.0.0
# pydantic v2.0.0
# python-dotenv v1.0.0

import logging
from pathlib import Path
from typing import Dict, Optional

from pydantic import Field, SecretStr, validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Set up logging
logger = logging.getLogger(__name__)

# Define project root and environment file paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_FILE = PROJECT_ROOT / '.env'

def load_environment() -> None:
    """
    Load environment variables from .env file with fallback to system environment.
    Handles missing files gracefully and logs the configuration source.
    """
    try:
        if ENV_FILE.exists():
            load_dotenv(ENV_FILE)
            logger.info(f"Loaded environment variables from {ENV_FILE}")
        else:
            logger.info("No .env file found, using system environment variables")
    except Exception as e:
        logger.warning(f"Error loading .env file: {e}. Using system environment variables")

class Settings(BaseSettings):
    """
    Comprehensive application settings with strict validation and type safety.
    Manages all configuration values with appropriate defaults and validation rules.
    """
    # Application Core Settings
    PROJECT_NAME: str = Field(
        default="Porfin",
        description="Project name used in API documentation and logs"
    )
    VERSION: str = Field(
        default="1.0.0",
        description="API version string"
    )
    API_V1_PREFIX: str = Field(
        default="/api/v1",
        description="API version 1 prefix for all endpoints"
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Deployment environment (development/staging/production)"
    )
    DEBUG: bool = Field(
        default=False,
        description="Debug mode flag"
    )

    # Security Settings
    SECRET_KEY: SecretStr = Field(
        ...,
        description="Secret key for JWT token generation and encryption"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60,
        ge=30,
        le=1440,
        description="JWT access token expiration time in minutes"
    )

    # Firebase Settings
    FIREBASE_PROJECT_ID: str = Field(
        ...,
        description="Firebase project identifier"
    )
    FIREBASE_PRIVATE_KEY: SecretStr = Field(
        ...,
        description="Firebase service account private key"
    )
    FIREBASE_CLIENT_EMAIL: str = Field(
        ...,
        description="Firebase service account client email"
    )

    # OpenAI Settings
    OPENAI_API_KEY: SecretStr = Field(
        ...,
        description="OpenAI API key for AI services"
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4",
        description="OpenAI model identifier"
    )

    # Redis Settings
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # Rate Limiting Settings
    RATE_LIMIT_REQUESTS: int = Field(
        default=100,
        ge=1,
        description="Number of requests allowed per period"
    )
    RATE_LIMIT_PERIOD: int = Field(
        default=60,
        ge=1,
        description="Rate limit period in seconds"
    )

    # WhatsApp Settings
    WHATSAPP_BUSINESS_ID: str = Field(
        ...,
        description="WhatsApp Business account identifier"
    )
    WHATSAPP_ACCESS_TOKEN: SecretStr = Field(
        ...,
        description="WhatsApp Business API access token"
    )
    WHATSAPP_WEBHOOK_SECRET: SecretStr = Field(
        ...,
        description="WhatsApp webhook verification token"
    )

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = True

    @validator("ENVIRONMENT")
    def validate_environment(cls, v: str) -> str:
        """Validate deployment environment value."""
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"Environment must be one of: {', '.join(allowed)}")
        return v

    def get_firebase_credentials(self) -> Dict[str, str]:
        """
        Returns formatted Firebase service account credentials.
        
        Returns:
            Dict[str, str]: Validated Firebase service account credentials
        """
        # Format private key with proper line breaks
        private_key = self.FIREBASE_PRIVATE_KEY.get_secret_value().replace("\\n", "\n")
        
        credentials = {
            "type": "service_account",
            "project_id": self.FIREBASE_PROJECT_ID,
            "private_key": private_key,
            "client_email": self.FIREBASE_CLIENT_EMAIL,
        }

        # Validate credential format
        if not all(credentials.values()):
            raise ValueError("Invalid Firebase credentials configuration")

        return credentials

    def __init__(self, **kwargs):
        """Initialize settings with environment variables and validation."""
        # Load environment variables
        load_environment()
        
        # Initialize parent class
        super().__init__(**kwargs)

        # Verify security-critical settings in non-development environments
        if self.ENVIRONMENT != "development":
            if self.DEBUG:
                raise ValueError("Debug mode cannot be enabled in non-development environment")
            
            # Verify minimum security requirements
            if len(self.SECRET_KEY.get_secret_value()) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")

# Create global settings instance
settings = Settings()

# Export commonly used settings for convenience
PROJECT_NAME = settings.PROJECT_NAME
VERSION = settings.VERSION
API_V1_PREFIX = settings.API_V1_PREFIX
ENVIRONMENT = settings.ENVIRONMENT
DEBUG = settings.DEBUG