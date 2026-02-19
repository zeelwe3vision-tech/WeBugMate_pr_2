"""
Chat Message Security Module

This module provides functions to securely encrypt and decrypt chat messages
using a combination of AES-256 for message content and RSA for key exchange.
"""
import json
import datetime
from typing import Dict, Optional
from .crypto_utils import hybrid_encrypt, hybrid_decrypt
from .auth_utils import PUBLIC_KEY, PRIVATE_KEY
import base64
import os

class ChatSecurity:
    """Handles encryption and decryption of chat messages"""
    
    @staticmethod
    def encrypt_message(message: str, recipient_public_key: str = None) -> Dict:
        """
        Encrypt a chat message
        
        Args:
            message: The message text to encrypt
            recipient_public_key: Optional public key for the recipient.
                               If None, uses the server's public key.
        
        Returns:
            dict: {
                'encrypted': True,
                'ciphertext': base64_encoded_encrypted_message,
                'key': base64_encoded_encrypted_aes_key,
                'iv': base64_encoded_iv,
                'version': '1.0'
            }
        """
        try:
            # Convert the message to JSON string to handle special characters
            message_json = json.dumps({
                'message': message,
                'timestamp': str(datetime.datetime.utcnow())
            })
            
            # Use hybrid encryption (AES + RSA)
            encrypted_data, encrypted_key = hybrid_encrypt(
                message_json,
                public_key_path=recipient_public_key
            )
            
            return {
                'encrypted': True,
                'ciphertext': encrypted_data,
                'key': encrypted_key,
                'version': '1.0'
            }
            
        except Exception as e:
            # Log the error but don't expose sensitive information
            print(f"Encryption error: {str(e)}")
            return {
                'encrypted': False,
                'message': 'Failed to encrypt message',
                'error': 'ENCRYPTION_ERROR'
            }
    
    @staticmethod
    def decrypt_message(encrypted_data: Dict, private_key_path: str = None) -> str:
        """
        Decrypt a chat message
        
        Args:
            encrypted_data: Dictionary containing encrypted message data
            private_key_path: Optional path to private key. If None, uses default.
            
        Returns:
            str: Decrypted message
            
        Raises:
            ValueError: If decryption fails or data is invalid
        """
        try:
            if not encrypted_data.get('encrypted'):
                return encrypted_data.get('message', '')
                
            # Extract the encrypted data
            ciphertext = encrypted_data['ciphertext']
            encrypted_key = encrypted_data['key']
            
            # Decrypt using hybrid approach
            decrypted = hybrid_decrypt(
                ciphertext,
                encrypted_key,
                private_key_path
            )
            
            # Parse the JSON data
            message_data = json.loads(decrypted.decode('utf-8'))
            return message_data.get('message', '')
            
        except Exception as e:
            print(f"Decryption error: {str(e)}")
            raise ValueError("Failed to decrypt message")
    
    @staticmethod
    def generate_message_id() -> str:
        """Generate a unique message ID"""
        return base64.urlsafe_b64encode(os.urandom(16)).decode('utf-8')

# Helper functions for common operations
def encrypt_chat_message(message: str, recipient_public_key: str = None) -> Dict:
    """Helper function to encrypt a chat message"""
    return ChatSecurity.encrypt_message(message, recipient_public_key)

def decrypt_chat_message(encrypted_data: Dict, private_key_path: str = None) -> str:
    """Helper function to decrypt a chat message"""
    return ChatSecurity.decrypt_message(encrypted_data, private_key_path)

# Example usage
if __name__ == "__main__":
    # Example message
    message = "✨ Summary:\n\nIt seems like \"dd\" could refer to different things depending on the context. Here are a few possibilities:\n\n- **Due Diligence**: A thorough investigation or audit of a potential investment.\n- **Data Dictionary**: A centralized repository of information about data, including meaning, relationships, and usage.\n- **Design Document**: A detailed description of a software system's architecture and design.\n\nIf you have a specific context or field in mind, please let me know for a more accurate explanation!"
    
    # Encrypt the message
    print("Encrypting message...")
    encrypted = ChatSecurity.encrypt_message(message)
    print(f"Encrypted: {encrypted['ciphertext'][:100]}...")
    
    # Decrypt the message
    print("\nDecrypting message...")
    decrypted = ChatSecurity.decrypt_message(encrypted)
    print(f"Decrypted: {decrypted[:200]}...")
