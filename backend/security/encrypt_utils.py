"""
Encryption Utility Functions for API Integration
================================================

This module provides high-level wrapper functions for encrypting and decrypting
data in the API. It handles edge cases and provides a safe interface for the
chat system.
"""

from security.encrypt import encrypt_string, decrypt_string, is_encrypted
from typing import Optional

# Safe block message for failed decryptions
SAFE_BLOCK_MESSAGE = "⚠️ Content blocked for security reasons."


def encrypt_api(text: str, project_id: str) -> str:
    """
    Encrypt text for API storage with input validation.
    
    Args:
        text: Plaintext to encrypt
        project_id: Project identifier
        
    Returns:
        str: Encrypted token
        
    Raises:
        ValueError: If inputs are invalid
        
    Example:
        >>> token = encrypt_api("Hello, World!", "proj_123")
    """
    if not text or not isinstance(text, str):
        raise ValueError("Text must be a non-empty string")
    
    if not project_id or not isinstance(project_id, str):
        raise ValueError("Project ID must be a non-empty string")
    
    # Strip whitespace but preserve internal spaces
    text = text.strip()
    
    if not text:
        raise ValueError("Text cannot be empty after stripping whitespace")
    
    return encrypt_string(text, project_id)


def decrypt_api(token: str, project_id: str) -> str:
    """
    Decrypt text from API storage with safe error handling.
    
    This function handles several cases:
    1. If the token is not encrypted (legacy plaintext), return as-is
    2. If decryption succeeds, return the plaintext
    3. If decryption fails, return a safe block message
    
    Args:
        token: Encrypted token or plaintext
        project_id: Project identifier
        
    Returns:
        str: Decrypted text or safe block message
        
    Example:
        >>> plaintext = decrypt_api(token, "proj_123")
    """
    if not token or not isinstance(token, str):
        return SAFE_BLOCK_MESSAGE
    
    # Check if the token is encrypted
    if not is_encrypted(token):
        # Legacy plaintext message - return as-is
        # This allows for graceful migration from unencrypted to encrypted storage
        return token
    
    try:
        # Attempt to decrypt
        return decrypt_string(token, project_id)
    except Exception as e:
        # Log the error for debugging (you can integrate with your logging system)
        print(f"[DECRYPTION ERROR] Failed to decrypt token: {str(e)}")
        
        # Return safe block message instead of exposing the error
        return SAFE_BLOCK_MESSAGE


def decrypt_api_strict(token: str, project_id: str) -> Optional[str]:
    """
    Decrypt text with strict error handling (returns None on failure).
    
    Use this when you need to know if decryption failed, rather than
    getting a safe block message.
    
    Args:
        token: Encrypted token
        project_id: Project identifier
        
    Returns:
        str | None: Decrypted text or None if decryption failed
        
    Example:
        >>> plaintext = decrypt_api_strict(token, "proj_123")
        >>> if plaintext is None:
        >>>     print("Decryption failed!")
    """
    if not token or not isinstance(token, str):
        return None
    
    if not is_encrypted(token):
        return token  # Legacy plaintext
    
    try:
        return decrypt_string(token, project_id)
    except Exception:
        return None


def encrypt_batch(texts: list[str], project_id: str) -> list[str]:
    """
    Encrypt multiple texts in batch.
    
    Args:
        texts: List of plaintexts to encrypt
        project_id: Project identifier
        
    Returns:
        list[str]: List of encrypted tokens
        
    Example:
        >>> tokens = encrypt_batch(["msg1", "msg2", "msg3"], "proj_123")
    """
    return [encrypt_api(text, project_id) for text in texts]


def decrypt_batch(tokens: list[str], project_id: str) -> list[str]:
    """
    Decrypt multiple tokens in batch.
    
    Args:
        tokens: List of encrypted tokens
        project_id: Project identifier
        
    Returns:
        list[str]: List of decrypted texts or safe block messages
        
    Example:
        >>> texts = decrypt_batch(tokens, "proj_123")
    """
    return [decrypt_api(token, project_id) for token in tokens]


def safely_encrypt(text: str, project_id: str, fallback: str = "") -> str:
    """
    Encrypt text with fallback on error.
    
    Args:
        text: Plaintext to encrypt
        project_id: Project identifier
        fallback: Value to return if encryption fails
        
    Returns:
        str: Encrypted token or fallback value
    """
    try:
        return encrypt_api(text, project_id)
    except Exception as e:
        print(f"[ENCRYPTION ERROR] {str(e)}")
        return fallback


def safely_decrypt(token: str, project_id: str, fallback: str = SAFE_BLOCK_MESSAGE) -> str:
    """
    Decrypt token with custom fallback on error.
    
    Args:
        token: Encrypted token
        project_id: Project identifier
        fallback: Value to return if decryption fails
        
    Returns:
        str: Decrypted text or fallback value
    """
    try:
        return decrypt_api(token, project_id)
    except Exception as e:
        print(f"[DECRYPTION ERROR] {str(e)}")
        return fallback