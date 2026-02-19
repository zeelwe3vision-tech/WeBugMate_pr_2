import os
import sys
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

def generate_rsa_keys():
    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Generate public key
    public_key = private_key.public_key()
    
    # Get the private key in PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Get the public key in PEM format
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return private_pem, public_pem

def save_keys(private_pem, public_pem, output_dir):
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Save private key with restricted permissions (600)
    private_key_path = os.path.join(output_dir, 'private.pem')
    with open(private_key_path, 'wb') as f:
        f.write(private_pem)
    os.chmod(private_key_path, 0o600)
    
    # Save public key
    public_key_path = os.path.join(output_dir, 'public.pem')
    with open(public_key_path, 'wb') as f:
        f.write(public_pem)
    
    print(f"Keys generated successfully:")
    print(f"- Private key: {private_key_path}")
    print(f"- Public key:  {public_key_path}")

if __name__ == "__main__":
    output_dir = os.path.join('config', 'keys')
    private_pem, public_pem = generate_rsa_keys()
    save_keys(private_pem, public_pem, output_dir)
