"""
Main entry point for the utils package, providing centralized access to utility functions,
constants, and validators with enhanced LGPD compliance and Brazilian market support.

Version: 1.0.0
"""

import logging  # version: standard library
from typing import Optional

# Internal imports with specific member imports for clarity
from app.utils.constants import WhatsAppMessageType
from app.utils.helpers import format_phone_number
from app.utils.security import (
    validate_phone,
    validate_data_consent,
    log_data_access
)

# Brazilian market and LGPD compliance constants
BRAZILIAN_PHONE_REGEX = r'^\+55\d{2}\d{8,9}$'
LGPD_CONSENT_REQUIRED = True
DATA_ACCESS_LOG_ENABLED = True

def setup_logging(log_level: str = "INFO") -> None:
    """
    Configures enhanced logging for security and debugging with LGPD compliance.
    
    Args:
        log_level (str): Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        
    Returns:
        None: Configures logging system with specified settings
    """
    # Define secure logging format with essential tracking information
    log_format = (
        '%(asctime)s - %(name)s - %(levelname)s - '
        '%(message)s - [request_id: %(request_id)s]'
    )
    
    # Configure date format for Brazilian timezone
    date_format = '%Y-%m-%d %H:%M:%S %z'
    
    # Set up basic configuration
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        datefmt=date_format
    )
    
    # Create logger instance
    logger = logging.getLogger(__name__)
    
    # Add security-specific logging handler for LGPD compliance
    if DATA_ACCESS_LOG_ENABLED:
        # Create file handler for security audit log
        security_handler = logging.FileHandler('security_audit.log')
        security_handler.setLevel(logging.INFO)
        security_handler.setFormatter(
            logging.Formatter(log_format, date_format)
        )
        logger.addHandler(security_handler)
    
    logger.info(
        "Logging system initialized with LGPD compliance settings",
        extra={"request_id": "system_init"}
    )

# Initialize logging with default configuration
setup_logging()

# Initialize module logger
logger = logging.getLogger(__name__)

# Log package initialization with LGPD compliance notice
logger.info(
    "Utils package initialized with LGPD compliance and Brazilian market support",
    extra={"request_id": "package_init"}
)

# Export commonly used utilities and constants
__all__ = [
    # Message type enums
    'WhatsAppMessageType',
    
    # Phone number utilities
    'format_phone_number',
    'BRAZILIAN_PHONE_REGEX',
    
    # LGPD compliance utilities
    'validate_phone',
    'validate_data_consent',
    'log_data_access',
    'LGPD_CONSENT_REQUIRED',
    'DATA_ACCESS_LOG_ENABLED',
    
    # Logging configuration
    'setup_logging'
]

# Version information
__version__ = "1.0.0"
__author__ = "Porfin Development Team"
__description__ = "Utility package for Porfin WhatsApp automation platform"