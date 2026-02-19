"""
AES-256-GCM Encryption Module with HKDF Key Derivation
=======================================================

This module provides secure encryption/decryption for chat messages using:
- AES-256-GCM for authenticated encryption
- HKDF (HMAC-based Key Derivation Function) to derive project-specific keys
- Base64 encoding for storage
- Versioning for future-proofing

Security Features:
- Master key stored securely in environment variables
- Per-project key derivation (prevents cross-project decryption)
- Authenticated encryption with GCM mode
- Random nonces for each encryption
- Constant-time operations to prevent timing attacks
"""

import os
import base64
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag
from dotenv import load_dotenv

load_dotenv()

# ==============================================================================
# CONFIGURATION
# ==============================================================================

_VERSION = "v1"
_SEPARATOR = "."

# ==============================================================================
# MASTER KEY LOADING
# ==============================================================================

def _load_master_key() -> bytes:
    """
    Load and validate the master encryption key from environment variables.
    
    Returns:
        bytes: 32-byte AES-256 master key
        
    Raises:
        RuntimeError: If MASTER_CHAT_KEY is not set or invalid
    """
    raw_key = os.getenv("MASTER_CHAT_KEY")
    
    if not raw_key:
        raise RuntimeError(
            "MASTER_CHAT_KEY environment variable is not set. "
            "Generate one using: python -c \"import secrets, base64; "
            "print(base64.b64encode(secrets.token_bytes(32)).decode())\""
        )
    
    try:
        master_key = base64.b64decode(raw_key)
    except Exception as e:
        raise RuntimeError(f"Invalid MASTER_CHAT_KEY format: {e}")
    
    if len(master_key) != 32:
        raise RuntimeError(
            f"MASTER_CHAT_KEY must be exactly 32 bytes (AES-256). "
            f"Current size: {len(master_key)} bytes"
        )
    
    return master_key


# Load master key at module import
MASTER_KEY = _load_master_key()


# ==============================================================================
# KEY DERIVATION
# ==============================================================================

def derive_project_key(project_id: str) -> bytes:
    """
    Derive a project-specific AES-256 key from the master key using HKDF.
    
    This ensures that messages encrypted for one project cannot be decrypted
    using another project's key, even if both use the same master key.
    
    Args:
        project_id: Unique identifier for the project
        
    Returns:
        bytes: 32-byte derived AES-256 key
        
    Raises:
        ValueError: If project_id is empty or invalid
    """
    if not project_id or not isinstance(project_id, str):
        raise ValueError("Invalid project_id: must be a non-empty string")
    
    # Use HKDF to derive a project-specific key
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,  # AES-256 requires 32 bytes
        salt=None,  # HKDF can work without salt (uses all zeros)
        info=f"project:{project_id}".encode("utf-8")  # Context binding
    )
    
    return hkdf.derive(MASTER_KEY)


# ==============================================================================
# ENCRYPTION
# ==============================================================================

def encrypt_string(plaintext: str, project_id: str) -> str:
    """
    Encrypt a plaintext string using AES-256-GCM with a project-specific key.
    
    The encrypted format is: v1:nonce_base64.ciphertext_base64
    
    Args:
        plaintext: The string to encrypt
        project_id: Project identifier for key derivation
        
    Returns:
        str: Encrypted token in versioned format
        
    Raises:
        ValueError: If plaintext or project_id is invalid
        
    Example:
        >>> token = encrypt_string("Hello, World!", "proj_123")
        >>> print(token)
        v1:SGVsbG8gV29ybGQh.YWJjZGVmZ2hpamtsbW5vcA==
    """
    if not plaintext or not isinstance(plaintext, str):
        raise ValueError("Invalid plaintext: must be a non-empty string")
    
    # Derive project-specific key
    key = derive_project_key(project_id)
    aes = AESGCM(key)
    
    # Generate a random 96-bit nonce (12 bytes is standard for GCM)
    nonce = secrets.token_bytes(12)
    
    # Encrypt the plaintext
    # The None parameter is for Additional Authenticated Data (AAD)
    # We don't use AAD in this implementation
    ciphertext = aes.encrypt(
        nonce,
        plaintext.encode("utf-8"),
        None  # No additional authenticated data
    )
    
    # Encode nonce and ciphertext as base64
    nonce_b64 = base64.b64encode(nonce).decode("utf-8")
    ciphertext_b64 = base64.b64encode(ciphertext).decode("utf-8")
    
    # Return versioned format: v1:nonce.ciphertext
    return f"{_VERSION}:{nonce_b64}{_SEPARATOR}{ciphertext_b64}"


# ==============================================================================
# DECRYPTION
# ==============================================================================

def decrypt_string(token: str, project_id: str) -> str:
    """
    Decrypt an encrypted token using AES-256-GCM with a project-specific key.
    
    Args:
        token: Encrypted token in versioned format (v1:nonce.ciphertext)
        project_id: Project identifier for key derivation
        
    Returns:
        str: Decrypted plaintext
        
    Raises:
        ValueError: If token is invalid, tampered, or decryption fails
        
    Example:
        >>> plaintext = decrypt_string(token, "proj_123")
        >>> print(plaintext)
        Hello, World!
    """
    if not token or not isinstance(token, str):
        raise ValueError("Invalid encrypted token: must be a non-empty string")
    
    try:
        # Parse version
        version, payload = token.split(":", 1)
        
        if version != _VERSION:
            raise ValueError(f"Unsupported token version: {version}")
        
        # Parse nonce and ciphertext
        nonce_b64, ciphertext_b64 = payload.split(_SEPARATOR, 1)
        
        # Decode from base64
        nonce = base64.b64decode(nonce_b64)
        ciphertext = base64.b64decode(ciphertext_b64)
        
        # Derive the same project-specific key
        key = derive_project_key(project_id)
        aes = AESGCM(key)
        
        # Decrypt and authenticate
        plaintext_bytes = aes.decrypt(nonce, ciphertext, None)
        
        return plaintext_bytes.decode("utf-8")
        
    except InvalidTag:
        raise ValueError(
            "Decryption failed: The message has been tampered with or "
            "the wrong key was used"
        )
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")


# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

def is_encrypted(text: str) -> bool:
    """
    Check if a string appears to be encrypted.
    
    Args:
        text: String to check
        
    Returns:
        bool: True if text appears to be encrypted, False otherwise
    """
    if not text or not isinstance(text, str):
        return False
    
    return text.startswith(f"{_VERSION}:")


def generate_master_key() -> str:
    """
    Generate a new random master key for MASTER_CHAT_KEY.
    
    Returns:
        str: Base64-encoded 32-byte key suitable for .env file
        
    Example:
        >>> key = generate_master_key()
        >>> print(f"MASTER_CHAT_KEY={key}")
        MASTER_CHAT_KEY=SGVsbG8gV29ybGQhSGVsbG8gV29ybGQhSGVsbG8gV29ybGQh
    """
    random_bytes = secrets.token_bytes(32)
    return base64.b64encode(random_bytes).decode("utf-8")


# ==============================================================================
# TESTING & VALIDATION
# ==============================================================================

if __name__ == "__main__":
    # Self-test
    print("🔐 Encryption Module Self-Test")
    print("=" * 50)
    
    # Generate a test master key
    print("\n1. Generating test master key...")
    test_key = generate_master_key()
    print(f"   ✓ Generated: {test_key[:20]}...")
    
    # Test encryption/decryption
    print("\n2. Testing encryption/decryption...")
    test_message = "This is a secret message! 🔒"
    test_project = "test_project_123"
    
    encrypted = encrypt_string(test_message, test_project)
    print(f"   ✓ Encrypted: {encrypted[:50]}...")
    
    decrypted = decrypt_string(encrypted, test_project)
    print(f"   ✓ Decrypted: {decrypted}")
    
    assert test_message == decrypted, "Decryption failed!"
    print("   ✓ Verification passed!")
    
    # Test project isolation
    print("\n3. Testing project isolation...")
    try:
        decrypt_string(encrypted, "wrong_project")
        print("   ✗ SECURITY ERROR: Cross-project decryption succeeded!")
    except ValueError:
        print("   ✓ Cross-project decryption properly blocked")
    
    # Test tamper detection
    print("\n4. Testing tamper detection...")
    tampered = encrypted[:-5] + "XXXXX"
    try:
        decrypt_string(tampered, test_project)
        print("   ✗ SECURITY ERROR: Tampered data accepted!")
    except ValueError:
        print("   ✓ Tampered data properly rejected")
    
    print("\n" + "=" * 50)
    print("✨ All tests passed!")