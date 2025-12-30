"""
Encryption utilities for HIPAA compliance
"""

from cryptography.fernet import Fernet
import base64
import hashlib
import os

def encrypt_data(data: str, key: str) -> str:
    """Encrypt sensitive data using Fernet"""
    # Ensure key is proper format for Fernet (32 bytes)
    if len(key) != 32:
        # Hash the key to get 32 bytes
        key_bytes = hashlib.sha256(key.encode()).digest()
    else:
        key_bytes = key.encode()

    fernet = Fernet(base64.urlsafe_b64encode(key_bytes))
    encrypted = fernet.encrypt(data.encode())
    return encrypted.decode()

def decrypt_data(encrypted_data: str, key: str) -> str:
    """Decrypt sensitive data using Fernet"""
    # Ensure key is proper format for Fernet (32 bytes)
    if len(key) != 32:
        # Hash the key to get 32 bytes
        key_bytes = hashlib.sha256(key.encode()).digest()
    else:
        key_bytes = key.encode()

    fernet = Fernet(base64.urlsafe_b64encode(key_bytes))
    decrypted = fernet.decrypt(encrypted_data.encode())
    return decrypted.decode()