"""
Encryption/Decryption Demo

This script demonstrates how to use the security module to encrypt and decrypt messages.
It shows both direct usage of crypto_utils and the higher-level ChatSecurity class.
"""
import sys
import os
import json
from pathlib import Path

# Add parent directory to path so we can import the security module
sys.path.insert(0, str(Path(__file__).parent.parent))

from security.crypto_utils import generate_aes_key, encrypt_data, decrypt_data, hybrid_encrypt, hybrid_decrypt
from security.chat_security import ChatSecurity, encrypt_chat_message, decrypt_chat_message
from security.auth_utils import PUBLIC_KEY, PRIVATE_KEY

def demo_basic_encryption():
    """Demonstrate basic AES encryption/decryption"""
    print("\n=== Basic AES Encryption/Decryption ===")
    
    # The message to encrypt
    message = "This is a secret message! 🔒"
    print(f"Original message: {message}")
    
    # Encrypt the message
    encrypted, key = encrypt_data(message)
    print(f"\nEncrypted (base64): {encrypted}")
    print(f"AES Key (base64): {key}")
    
    # Decrypt the message
    decrypted = decrypt_data(encrypted, key).decode('utf-8')
    print(f"\nDecrypted message: {decrypted}")
    
    # Verify
    if message == decrypted:
        print("✅ Success! The message was correctly decrypted.")
    else:
        print("❌ Error: The decrypted message doesn't match the original!")

def demo_hybrid_encryption():
    """Demonstrate hybrid (RSA+AES) encryption/decryption"""
    print("\n=== Hybrid (RSA+AES) Encryption/Decryption ===")
    
    # The message to encrypt
    message = "This is a highly secure message using hybrid encryption! 🔐"
    print(f"Original message: {message}")
    
    try:
        # Encrypt the message using hybrid encryption
        print("\nEncrypting message...")
        encrypted_data, encrypted_key = hybrid_encrypt(
            message,
            public_key_path=os.path.join(os.path.dirname(__file__), '..', 'config', 'keys', 'public.pem')
        )
        print(f"Encrypted data (base64): {encrypted_data}")
        print(f"Encrypted key (base64): {encrypted_key}")
        
        # Decrypt the message
        print("\nDecrypting message...")
        decrypted = hybrid_decrypt(
            encrypted_data, 
            encrypted_key,
            private_key_path=os.path.join(os.path.dirname(__file__), '..', 'config', 'keys', 'private.pem')
        )
        
        if isinstance(decrypted, bytes):
            decrypted = decrypted.decode('utf-8')
            
        print(f"\nDecrypted message: {decrypted}")
        
        # Verify
        if message == decrypted:
            print("✅ Success! The message was correctly decrypted.")
        else:
            print("❌ Error: The decrypted message doesn't match the original!")
    except Exception as e:
        print(f"❌ Error during hybrid encryption/decryption: {str(e)}")
        import traceback
        traceback.print_exc()

def demo_chat_security():
    """Demonstrate using the ChatSecurity class"""
    print("\n=== ChatSecurity Class Demo ===")
    
    # The message to encrypt
    message = "Hello from ChatSecurity! This message is secure. 🔒🔑"
    print(f"Original message: {message}")
    
    try:
        # Set the key paths in environment variables for ChatSecurity
        os.environ['PRIVATE_KEY_PATH'] = os.path.join(os.path.dirname(__file__), '..', 'config', 'keys', 'private.pem')
        os.environ['PUBLIC_KEY_PATH'] = os.path.join(os.path.dirname(__file__), '..', 'config', 'keys', 'public.pem')
        
        # Reload the auth_utils module to pick up the new environment variables
        import importlib
        from security import auth_utils
        importlib.reload(auth_utils)
        
        # Re-import the functions to use the updated module
        from security.chat_security import encrypt_chat_message, decrypt_chat_message
        
        # Encrypt the message using ChatSecurity
        print("\nEncrypting message...")
        encrypted_data = encrypt_chat_message(message)
        print("Encrypted message structure:")
        print(json.dumps(encrypted_data, indent=2))
        
        # Decrypt the message
        print("\nDecrypting message...")
        decrypted_data = decrypt_chat_message(encrypted_data)
        
        if isinstance(decrypted_data, bytes):
            decrypted_data = decrypted_data.decode('utf-8')
            
        print(f"\nDecrypted message: {decrypted_data}")
        
        # The decrypted data might be a JSON string or plain text
        try:
            # First try to parse as JSON
            try:
                decrypted_json = json.loads(decrypted_data)
                print(f"Message content: {decrypted_json.get('message')}")
                print(f"Sent at: {decrypted_json.get('timestamp')}")
                
                if decrypted_json.get('message') == message:
                    print("✅ Success! The message was correctly decrypted and verified.")
                else:
                    print("❌ Error: The decrypted message doesn't match the original!")
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                print(f"Decrypted message (plain text): {decrypted_data}")
                if decrypted_data == message:
                    print("✅ Success! The message was correctly decrypted and verified.")
                else:
                    print("❌ Error: The decrypted message doesn't match the original!")
        except Exception as e:
            print(f"❌ Error processing decrypted message: {str(e)}")
    except Exception as e:
        print(f"❌ Error during ChatSecurity demo: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔐 Encryption/Decryption Demo 🔐")
    print("==============================")
    
    # Run the demos
    demo_basic_encryption()
    demo_hybrid_encryption()
    demo_chat_security()
    
    print("\n✨ Demo complete! ✨")
