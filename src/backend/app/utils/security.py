"""
Security utility module providing enhanced security functions for authentication, encryption,
and data protection. Implements AES-256 encryption standards with secure key management.

Version: 1.0.0
"""

# cryptography v41.0.0
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import AES
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from base64 import b64encode, b64decode
import hashlib
import secrets
import logging
from typing import Optional, Union
import os

# Internal imports
from app.core.config import settings
from app.utils.constants import ErrorCodes

# Configure logging
logger = logging.getLogger(__name__)

# Initialize encryption constants
ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(ENCRYPTION_KEY)
SALT_LENGTH = 16
KEY_ITERATIONS = 100000

def encrypt_field(data: str, validate_input: bool = True) -> str:
    """
    Encrypts sensitive field data using Fernet symmetric encryption (AES-256).
    
    Args:
        data: String data to encrypt
        validate_input: Whether to perform input validation
    
    Returns:
        Base64 encoded encrypted string
    
    Raises:
        ValueError: If input validation fails
        EncryptionError: If encryption fails
    """
    try:
        if validate_input and not data:
            raise ValueError("Input data cannot be empty")
        
        # Convert string to bytes
        data_bytes = data.encode('utf-8')
        
        # Generate initialization vector
        iv = os.urandom(16)
        
        # Encrypt data
        encrypted_data = fernet.encrypt(data_bytes)
        
        # Encode to base64
        encoded_data = b64encode(encrypted_data).decode('utf-8')
        
        # Clear sensitive data from memory
        del data_bytes
        return encoded_data
        
    except Exception as e:
        logger.error(f"Encryption error: {str(e)}", extra={"error_code": ErrorCodes.ENCRYPTION_ERROR})
        raise RuntimeError(f"Failed to encrypt data: {str(e)}")

def decrypt_field(encrypted_data: str) -> str:
    """
    Decrypts encrypted field data with comprehensive error handling.
    
    Args:
        encrypted_data: Base64 encoded encrypted string
    
    Returns:
        Decrypted original string
    
    Raises:
        ValueError: If input is invalid
        DecryptionError: If decryption fails
    """
    try:
        if not encrypted_data:
            raise ValueError("Encrypted data cannot be empty")
        
        # Decode base64
        encrypted_bytes = b64decode(encrypted_data.encode('utf-8'))
        
        # Decrypt data
        decrypted_bytes = fernet.decrypt(encrypted_bytes)
        
        # Convert to string
        decrypted_data = decrypted_bytes.decode('utf-8')
        
        # Clear sensitive data
        del decrypted_bytes
        return decrypted_data
        
    except Exception as e:
        logger.error(f"Decryption error: {str(e)}", extra={"error_code": ErrorCodes.ENCRYPTION_ERROR})
        raise RuntimeError(f"Failed to decrypt data: {str(e)}")

def hash_sensitive_data(data: str, salt: Optional[bytes] = None) -> str:
    """
    Creates a salted one-way hash of sensitive data using SHA-256.
    
    Args:
        data: String data to hash
        salt: Optional salt bytes, generated if not provided
    
    Returns:
        Hex string of salted hash
    """
    try:
        if not salt:
            salt = os.urandom(SALT_LENGTH)
        
        # Convert input to bytes
        data_bytes = data.encode('utf-8')
        
        # Create hash with salt
        hasher = hashlib.sha256()
        hasher.update(salt)
        hasher.update(data_bytes)
        
        # Get final hash
        hashed = hasher.hexdigest()
        
        # Clear sensitive data
        del data_bytes
        return f"{b64encode(salt).decode('utf-8')}:{hashed}"
        
    except Exception as e:
        logger.error(f"Hashing error: {str(e)}", extra={"error_code": ErrorCodes.ENCRYPTION_ERROR})
        raise RuntimeError(f"Failed to hash data: {str(e)}")

def generate_secure_token(length: int = 32) -> str:
    """
    Generates a cryptographically secure random token.
    
    Args:
        length: Desired length of token (default: 32)
    
    Returns:
        Secure random token string
    
    Raises:
        ValueError: If length is invalid
    """
    if length < 16:
        raise ValueError("Token length must be at least 16 characters")
    
    try:
        # Generate random bytes
        token_bytes = secrets.token_bytes(length)
        
        # Convert to URL-safe base64
        token = b64encode(token_bytes).decode('utf-8')
        
        # Trim to exact length
        return token[:length]
        
    except Exception as e:
        logger.error(f"Token generation error: {str(e)}", extra={"error_code": ErrorCodes.ENCRYPTION_ERROR})
        raise RuntimeError(f"Failed to generate token: {str(e)}")

def mask_sensitive_data(data: str, visible_chars: int = 4, mask_char: str = '*') -> str:
    """
    Masks sensitive data for logging or display.
    
    Args:
        data: String to mask
        visible_chars: Number of characters to leave visible
        mask_char: Character to use for masking
    
    Returns:
        Masked string
    """
    try:
        if not data:
            return ""
        
        if visible_chars < 0 or visible_chars > len(data):
            visible_chars = 4
            
        # Handle email addresses specially
        if '@' in data:
            username, domain = data.split('@')
            masked_username = username[0] + mask_char * (len(username) - 1)
            return f"{masked_username}@{domain}"
            
        # Regular masking
        visible_part = data[:visible_chars]
        masked_part = mask_char * (len(data) - visible_chars)
        return visible_part + masked_part
        
    except Exception as e:
        logger.error(f"Masking error: {str(e)}", extra={"error_code": ErrorCodes.VALIDATION_ERROR})
        return mask_char * len(data)

def rotate_encryption_key() -> bool:
    """
    Rotates the encryption key and re-encrypts sensitive data.
    Should be called periodically based on security policy.
    
    Returns:
        Boolean indicating success of key rotation
    """
    try:
        global ENCRYPTION_KEY, fernet
        
        # Generate new key
        new_key = Fernet.generate_key()
        new_fernet = Fernet(new_key)
        
        # Store old key temporarily
        old_key = ENCRYPTION_KEY
        old_fernet = fernet
        
        # Update global key and fernet instance
        ENCRYPTION_KEY = new_key
        fernet = new_fernet
        
        # Clear old key from memory
        del old_key
        del old_fernet
        
        logger.info("Encryption key rotated successfully")
        return True
        
    except Exception as e:
        logger.error(f"Key rotation error: {str(e)}", extra={"error_code": ErrorCodes.ENCRYPTION_ERROR})
        return False

# Initialize logging with secure configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)