import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
import base64
import os
from pathlib import Path

# For AES encryption/decryption
def generate_aes_key():
    """Generate a secure random 256-bit (32-byte) AES key"""
    return os.urandom(32)

def encrypt_data(data, key=None):
    """
    Encrypt data using AES-256-CBC with PKCS7 padding
    
    Args:
        data: The data to encrypt (string or bytes)
        key: Optional encryption key (32 bytes for AES-256). If None, a new key is generated.
        
    Returns:
        tuple: (encrypted_data, key_used) where both are base64-encoded strings
    """
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    # Generate a random IV (Initialization Vector)
    iv = os.urandom(16)
    
    # Generate a new key if none provided
    if key is None:
        key = generate_aes_key()
    elif isinstance(key, str):
        key = base64.b64decode(key)
    
    # Set up the cipher with AES-256-CBC
    cipher = Cipher(
        algorithms.AES(key),
        modes.CBC(iv),
        backend=default_backend()
    )
    
    # Pad the data to be a multiple of the block size
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(data) + padder.finalize()
    
    # Encrypt the data
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    
    # Combine IV and encrypted data
    result = iv + encrypted
    
    # Return base64-encoded results
    return base64.b64encode(result).decode('utf-8'), base64.b64encode(key).decode('utf-8')

def decrypt_data(encrypted_data, key):
    """
    Decrypt data that was encrypted with encrypt_data()
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        key: Base64-encoded key used for encryption
        
    Returns:
        bytes: The decrypted data
    """
    try:
        # Decode the base64 data
        if isinstance(encrypted_data, str):
            encrypted_data = base64.b64decode(encrypted_data)
        
        if isinstance(key, str):
            key = base64.b64decode(key)
        
        # Extract the IV (first 16 bytes)
        iv = encrypted_data[:16]
        encrypted = encrypted_data[16:]
        
        # Set up the cipher
        cipher = Cipher(
            algorithms.AES(key),
            modes.CBC(iv),
            backend=default_backend()
        )
        
        # Decrypt the data
        decryptor = cipher.decryptor()
        decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()
        
        # Unpad the data
        unpadder = padding.PKCS7(128).unpadder()
        decrypted = unpadder.update(decrypted_padded) + unpadder.finalize()
        
        return decrypted
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")

# For RSA encryption/decryption using existing keys
def rsa_encrypt(data, public_key_path=None):
    """
    Encrypt data using RSA-OAEP with SHA-256
    
    Args:
        data: The data to encrypt (string or bytes)
        public_key_path: Path to the public key file. If None, uses the default from auth_utils
        
    Returns:
        str: Base64-encoded encrypted data
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import padding as rsa_padding
    from cryptography.hazmat.primitives import hashes
    
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    # Load the public key
    if public_key_path is None:
        from .auth_utils import PUBLIC_KEY
        public_key = serialization.load_pem_public_key(
            PUBLIC_KEY.encode('utf-8'),
            backend=default_backend()
        )
    else:
        with open(public_key_path, 'rb') as key_file:
            public_key = serialization.load_pem_public_key(
                key_file.read(),
                backend=default_backend()
            )
    
    # Encrypt the data
    encrypted = public_key.encrypt(
        data,
        rsa_padding.OAEP(
            mgf=rsa_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return base64.b64encode(encrypted).decode('utf-8')

def rsa_decrypt(encrypted_data, private_key_path=None):
    """
    Decrypt data using RSA-OAEP with SHA-256
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        private_key_path: Path to the private key file. If None, uses the default from auth_utils
        
    Returns:
        bytes: The decrypted data
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import padding as rsa_padding
    from cryptography.hazmat.primitives import hashes
    
    try:
        # Decode the base64 data
        if isinstance(encrypted_data, str):
            encrypted_data = base64.b64decode(encrypted_data)
        
        # Load the private key
        if private_key_path is None:
            from .auth_utils import PRIVATE_KEY
            private_key = serialization.load_pem_private_key(
                PRIVATE_KEY.encode('utf-8'),
                password=None,
                backend=default_backend()
            )
        else:
            with open(private_key_path, 'rb') as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=None,
                    backend=default_backend()
                )
        
        # Decrypt the data
        decrypted = private_key.decrypt(
            encrypted_data,
            rsa_padding.OAEP(
                mgf=rsa_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        return decrypted
    except Exception as e:
        raise ValueError(f"RSA decryption failed: {str(e)}")

# Hybrid encryption (combines RSA and AES)
def hybrid_encrypt(data, public_key_path=None):
    """
    Encrypt data using a hybrid approach:
    1. Generate a random AES key
    2. Encrypt the data with AES-256-CBC
    3. Encrypt the AES key with RSA-OAEP
    4. Return both encrypted data and encrypted key
    
    Args:
        data: The data to encrypt (string or bytes)
        public_key_path: Path to the public key file for RSA encryption
        
    Returns:
        tuple: (encrypted_data, encrypted_key) both as base64-encoded strings
    """
    # Generate a new AES key
    aes_key = generate_aes_key()
    
    # Encrypt the data with AES using the generated key
    encrypted_data = encrypt_data(data, aes_key)[0]  # [0] to get just the encrypted data
    
    # Convert the AES key to base64 string for RSA encryption
    aes_key_b64 = base64.b64encode(aes_key).decode('utf-8')
    
    # Encrypt the AES key with RSA
    encrypted_key = rsa_encrypt(aes_key_b64, public_key_path)
    
    return encrypted_data, encrypted_key

def hybrid_decrypt(encrypted_data, encrypted_key, private_key_path=None):
    """
    Decrypt data that was encrypted with hybrid_encrypt()
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        encrypted_key: Base64-encoded encrypted AES key
        private_key_path: Path to the private key file for RSA decryption
        
    Returns:
        bytes: The decrypted data
    """
    try:
        # Decrypt the AES key with RSA
        decrypted_key = rsa_decrypt(encrypted_key, private_key_path)
        
        # The decrypted key is a base64 string, convert it back to bytes
        if isinstance(decrypted_key, bytes):
            # If it's bytes, it's the base64 string as bytes
            aes_key = base64.b64decode(decrypted_key)
        else:
            # If it's a string, it's already the base64 string
            aes_key = base64.b64decode(decrypted_key.encode('utf-8'))
            
        # Convert the key to base64 string for the decrypt_data function
        aes_key_b64 = base64.b64encode(aes_key).decode('utf-8')
        
        # Decrypt the data with AES
        decrypted_data = decrypt_data(encrypted_data, aes_key_b64)
        
        return decrypted_data
    except Exception as e:
        raise ValueError(f"Hybrid decryption failed: {str(e)}")
