"""
Comprehensive test suite for security utility functions.
Tests encryption, hashing, token generation, and other security features.

Version: 1.0.0
"""

# pytest v7.0.0
import pytest
from pytest import raises
# pytest-benchmark v4.0.0
from pytest_benchmark.fixture import BenchmarkFixture

# Standard library imports
import secrets
import base64
from typing import List, Dict
import concurrent.futures
import time

# Internal imports
from app.utils.security import (
    encrypt_field,
    decrypt_field,
    hash_sensitive_data,
    generate_secure_token,
    mask_sensitive_data,
    rotate_encryption_key
)
from app.utils.constants import ErrorCodes

# Test constants
TEST_DATA = secrets.token_hex(32)
TEST_TOKEN_LENGTH = 32
ENCRYPTION_MODES = ["CBC", "GCM"]
KEY_SIZES = [128, 192, 256]
TEST_EMAILS = [
    "test@example.com",
    "user.name@domain.com",
    "sensitive.data@company.org"
]

@pytest.mark.security
@pytest.mark.unit
class TestEncryptionOperations:
    """Test suite for encryption and decryption operations."""
    
    def test_encrypt_decrypt_field(self):
        """Test field encryption and decryption with data integrity verification."""
        # Test with various data types and sizes
        test_cases = [
            TEST_DATA,
            "Short text",
            "å∫ç∂´ƒ©˙∆˚¬",  # Unicode characters
            "A" * 1000  # Large string
        ]
        
        for test_data in test_cases:
            # Encrypt data
            encrypted = encrypt_field(test_data)
            assert encrypted != test_data
            assert isinstance(encrypted, str)
            
            # Verify base64 encoding
            try:
                base64.b64decode(encrypted)
            except Exception:
                pytest.fail("Encrypted data is not valid base64")
            
            # Decrypt and verify
            decrypted = decrypt_field(encrypted)
            assert decrypted == test_data
            assert isinstance(decrypted, str)

    def test_encrypt_field_validation(self):
        """Test input validation for encryption."""
        with raises(ValueError):
            encrypt_field("")
        
        with raises(ValueError):
            encrypt_field(None)

    def test_decrypt_field_validation(self):
        """Test input validation for decryption."""
        with raises(ValueError):
            decrypt_field("")
        
        with raises(ValueError):
            decrypt_field(None)
        
        with raises(RuntimeError):
            decrypt_field("invalid_encrypted_data")

@pytest.mark.security
@pytest.mark.unit
class TestHashingOperations:
    """Test suite for hashing operations."""

    def test_hash_sensitive_data(self):
        """Test secure hashing with salt."""
        # Test basic hashing
        hashed = hash_sensitive_data(TEST_DATA)
        assert isinstance(hashed, str)
        assert ":" in hashed  # Salt and hash separator
        
        # Verify salt and hash components
        salt_b64, hash_value = hashed.split(":")
        assert len(base64.b64decode(salt_b64)) == 16  # Salt length
        assert len(hash_value) == 64  # SHA-256 hex length
        
        # Test consistency with same salt
        salt = base64.b64decode(salt_b64)
        hashed2 = hash_sensitive_data(TEST_DATA, salt)
        assert hashed2 == hashed
        
        # Test uniqueness with different salts
        hashed3 = hash_sensitive_data(TEST_DATA)
        assert hashed3 != hashed

    def test_hash_validation(self):
        """Test hash input validation."""
        with raises(ValueError):
            hash_sensitive_data("")
        
        with raises(ValueError):
            hash_sensitive_data(None)

@pytest.mark.security
@pytest.mark.unit
class TestTokenOperations:
    """Test suite for token generation and validation."""

    def test_generate_secure_token(self):
        """Test secure token generation."""
        # Test token length
        token = generate_secure_token(TEST_TOKEN_LENGTH)
        assert len(token) == TEST_TOKEN_LENGTH
        
        # Test uniqueness
        tokens = [generate_secure_token(TEST_TOKEN_LENGTH) for _ in range(100)]
        assert len(set(tokens)) == 100
        
        # Test character set
        for token in tokens:
            assert all(c in base64.b64encode(b'dummy').decode('utf-8') for c in token)

    def test_token_validation(self):
        """Test token generation validation."""
        with raises(ValueError):
            generate_secure_token(8)  # Too short
        
        with raises(ValueError):
            generate_secure_token(-1)  # Invalid length

@pytest.mark.security
@pytest.mark.unit
class TestDataMasking:
    """Test suite for sensitive data masking."""

    def test_mask_sensitive_data(self):
        """Test data masking functionality."""
        # Test regular string masking
        data = "1234567890"
        masked = mask_sensitive_data(data, visible_chars=4)
        assert masked.startswith("1234")
        assert all(c == '*' for c in masked[4:])
        assert len(masked) == len(data)
        
        # Test email masking
        for email in TEST_EMAILS:
            masked = mask_sensitive_data(email)
            assert '@' in masked
            username, domain = masked.split('@')
            assert username[0] == email[0]
            assert all(c == '*' for c in username[1:])
            assert domain == email.split('@')[1]

    def test_mask_validation(self):
        """Test masking input validation."""
        assert mask_sensitive_data("") == ""
        assert mask_sensitive_data(None) == ""
        assert len(mask_sensitive_data("test", visible_chars=10)) == 4

@pytest.mark.security
@pytest.mark.unit
class TestKeyRotation:
    """Test suite for encryption key rotation."""

    def test_key_rotation(self):
        """Test encryption key rotation process."""
        # Initial encryption
        encrypted = encrypt_field(TEST_DATA)
        
        # Perform key rotation
        assert rotate_encryption_key() is True
        
        # Verify old data can still be decrypted
        decrypted = decrypt_field(encrypted)
        assert decrypted == TEST_DATA
        
        # Verify new encryption works
        new_encrypted = encrypt_field(TEST_DATA)
        assert new_encrypted != encrypted
        assert decrypt_field(new_encrypted) == TEST_DATA

@pytest.mark.benchmark
@pytest.mark.security
def test_security_performance(benchmark: BenchmarkFixture):
    """Benchmark security operations performance."""
    def security_operations():
        # Perform all security operations
        encrypted = encrypt_field(TEST_DATA)
        decrypted = decrypt_field(encrypted)
        hashed = hash_sensitive_data(TEST_DATA)
        token = generate_secure_token(TEST_TOKEN_LENGTH)
        masked = mask_sensitive_data(TEST_DATA)
        return all([encrypted, decrypted == TEST_DATA, hashed, token, masked])
    
    # Run benchmark
    result = benchmark(security_operations)
    assert result is True

@pytest.mark.security
@pytest.mark.unit
def test_concurrent_operations():
    """Test security operations under concurrent execution."""
    def concurrent_operation(data: str) -> bool:
        try:
            encrypted = encrypt_field(data)
            decrypted = decrypt_field(encrypted)
            return decrypted == data
        except Exception:
            return False
    
    # Test with multiple concurrent operations
    test_data = [f"{TEST_DATA}_{i}" for i in range(100)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(concurrent_operation, test_data))
    
    assert all(results)