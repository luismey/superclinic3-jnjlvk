"""
Helper utility module for the Porfin WhatsApp automation platform.
Provides common functions for data formatting, conversion, and manipulation
with specific support for Brazilian market requirements and LGPD compliance.

Version: 1.0.0
"""

import re
import json
from datetime import datetime
import phonenumbers
import pytz  # version: 2023.3
from typing import Dict, Optional, Union

from app.utils.constants import MessageType

# Brazilian specific constants
BR_TIMEZONE = "America/Sao_Paulo"
BR_COUNTRY_CODE = "BR"
BR_PHONE_LENGTH = 11  # Including DDD
BR_DDD_PATTERN = r"^([1-9][0-9]).*$"

# Data masking patterns
CPF_PATTERN = r"^\d{3}\.\d{3}\.\d{3}-\d{2}$"
CNPJ_PATTERN = r"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$"
EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"

def format_phone_number(phone_number: str, country_code: str = BR_COUNTRY_CODE) -> str:
    """
    Formats phone number to E.164 format for WhatsApp API with specific handling for Brazilian numbers.
    
    Args:
        phone_number (str): Input phone number string
        country_code (str): ISO country code, defaults to BR
    
    Returns:
        str: E.164 formatted phone number
        
    Raises:
        ValueError: If phone number is invalid or unsupported format
    """
    try:
        # Remove any non-numeric characters
        cleaned_number = re.sub(r'\D', '', phone_number)
        
        # Handle Brazilian specific formatting
        if country_code == BR_COUNTRY_CODE:
            # Validate DDD (area code)
            if not re.match(BR_DDD_PATTERN, cleaned_number):
                raise ValueError("Invalid Brazilian DDD (area code)")
            
            # Ensure correct length for Brazilian numbers
            if len(cleaned_number) != BR_PHONE_LENGTH:
                raise ValueError(f"Brazilian numbers must be {BR_PHONE_LENGTH} digits including DDD")
        
        # Parse and validate phone number
        parsed_number = phonenumbers.parse(cleaned_number, country_code)
        if not phonenumbers.is_valid_number(parsed_number):
            raise ValueError("Invalid phone number format")
        
        # Format to E.164
        formatted_number = phonenumbers.format_number(
            parsed_number, 
            phonenumbers.PhoneNumberFormat.E164
        )
        
        return formatted_number
    
    except phonenumbers.NumberParseException as e:
        raise ValueError(f"Failed to parse phone number: {str(e)}")

def format_datetime(dt: datetime, timezone: str = BR_TIMEZONE) -> str:
    """
    Formats datetime object to ISO format with America/Sao_Paulo timezone support.
    
    Args:
        dt (datetime): Datetime object to format
        timezone (str): Timezone name, defaults to America/Sao_Paulo
    
    Returns:
        str: ISO formatted datetime string
        
    Raises:
        ValueError: If datetime or timezone is invalid
    """
    try:
        if not isinstance(dt, datetime):
            raise ValueError("Input must be a datetime object")
        
        # Get timezone object
        tz = pytz.timezone(timezone)
        
        # Localize datetime if naive
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        else:
            dt = dt.astimezone(tz)
        
        # Format to ISO 8601 with timezone
        return dt.isoformat()
    
    except pytz.exceptions.UnknownTimeZoneError:
        raise ValueError(f"Invalid timezone: {timezone}")

def mask_sensitive_data(data: str, data_type: Optional[str] = None) -> str:
    """
    Masks sensitive data including Brazilian-specific types (CPF, CNPJ) for LGPD compliance.
    
    Args:
        data (str): Data to be masked
        data_type (str, optional): Type of data ('cpf', 'cnpj', 'email', 'phone')
    
    Returns:
        str: Masked string
        
    Raises:
        ValueError: If data format is invalid or unsupported
    """
    if not data:
        raise ValueError("Data cannot be empty")
    
    # Auto-detect data type if not specified
    if data_type is None:
        if re.match(CPF_PATTERN, data):
            data_type = 'cpf'
        elif re.match(CNPJ_PATTERN, data):
            data_type = 'cnpj'
        elif re.match(EMAIL_PATTERN, data):
            data_type = 'email'
        else:
            data_type = 'default'
    
    # Apply masking based on data type
    if data_type == 'cpf':
        # Mask CPF: XXX.XXX.123-45 -> XXX.XXX.***-**
        return re.sub(r'(\d{3}\.\d{3}\.)\d{3}-\d{2}', r'\1***-**', data)
    
    elif data_type == 'cnpj':
        # Mask CNPJ: XX.XXX.XXX/0001-XX -> XX.XXX.***/****-**
        return re.sub(r'(\d{2}\.\d{3}\.)\d{3}/\d{4}-\d{2}', r'\1***/****-**', data)
    
    elif data_type == 'email':
        # Mask email: user@domain.com -> u***@domain.com
        username, domain = data.split('@')
        masked_username = username[0] + '***'
        return f"{masked_username}@{domain}"
    
    elif data_type == 'phone':
        # Mask phone: +55 11 98765-4321 -> +55 11 ****-4321
        return re.sub(r'(\+\d{2}\s\d{2}\s)\d{4,5}-(\d{4})', r'\1****-\2', data)
    
    else:
        # Default masking: show first and last character
        return data[0] + '*' * (len(data) - 2) + data[-1]

def format_campaign_message(
    template: str,
    variables: Dict[str, str],
    media_content: Optional[Dict[str, str]] = None
) -> Dict[str, Union[str, Dict]]:
    """
    Formats campaign message with template variables and rich media support.
    
    Args:
        template (str): Message template with variables
        variables (dict): Dictionary of variable replacements
        media_content (dict, optional): Media content configuration
    
    Returns:
        dict: Formatted message with media
        
    Raises:
        ValueError: If template or variables are invalid
    """
    try:
        # Validate template
        if not template or not isinstance(template, str):
            raise ValueError("Invalid template format")
        
        # Replace template variables
        message = template
        for key, value in variables.items():
            placeholder = f"{{{key}}}"
            if placeholder in message:
                message = message.replace(placeholder, str(value))
        
        # Prepare response structure
        response = {
            "message_type": MessageType.TEXT,
            "content": message
        }
        
        # Handle media content if provided
        if media_content:
            if not isinstance(media_content, dict):
                raise ValueError("Media content must be a dictionary")
                
            # Validate media content
            required_fields = ["type", "url"]
            if not all(field in media_content for field in required_fields):
                raise ValueError("Media content missing required fields")
                
            # Add media to response
            response["message_type"] = MessageType.MEDIA
            response["media"] = media_content
        
        # Validate final message length (WhatsApp limit)
        if len(message) > 4096:
            raise ValueError("Message exceeds WhatsApp length limit")
        
        return response
    
    except KeyError as e:
        raise ValueError(f"Missing template variable: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to format campaign message: {str(e)}")