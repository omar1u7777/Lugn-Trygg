"""
API Key Rotation Service for Lugn & Trygg
Automated key rotation, secure key management, and zero-downtime key updates
"""

import os
import secrets
import string
import hashlib
import hmac
import base64
import json
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional, Any, Callable, TYPE_CHECKING
from pathlib import Path
import logging
from functools import wraps
from flask import request, g, current_app
import threading
import time

# AES encryption using Fernet (AES-128-CBC with HMAC)
ENCRYPTION_AVAILABLE: bool = False

if TYPE_CHECKING:
    from cryptography.fernet import Fernet as FernetType, InvalidToken as InvalidTokenType
    _Fernet: type[FernetType] = FernetType
    _InvalidToken: type[InvalidTokenType] = InvalidTokenType
    ENCRYPTION_AVAILABLE = True
else:
    try:
        from cryptography.fernet import Fernet as _Fernet, InvalidToken as _InvalidToken
        ENCRYPTION_AVAILABLE = True
    except ImportError:
        _Fernet = None
        _InvalidToken = Exception
        ENCRYPTION_AVAILABLE = False

logger = logging.getLogger(__name__)
if not ENCRYPTION_AVAILABLE:
    logger.warning("cryptography not installed - falling back to base64 encoding")

class APIKeyRotationService:
    """Comprehensive API key rotation and management service"""

    def __init__(self, keys_dir: str = "api_keys", rotation_interval_days: int = 30):
        self.keys_dir = Path(keys_dir)
        self.keys_dir.mkdir(exist_ok=True)

        # Initialize encryption
        self._encryption_key = self._get_or_create_encryption_key()
        self._fernet = self._init_fernet()

        self.rotation_interval_days = rotation_interval_days
        self.current_keys: Dict[str, Dict] = {}
        self.key_history: Dict[str, List[Dict]] = {}
        self.rotation_schedule: Dict[str, datetime] = {}

        # Key types and their configurations
        self.key_types = {
            'jwt_secret': {'length': 64, 'rotation': 'manual'},
            'api_key': {'length': 32, 'rotation': 'auto'},
            'webhook_secret': {'length': 32, 'rotation': 'auto'},
            'encryption_key': {'length': 32, 'rotation': 'manual'},
            'firebase_key': {'length': 32, 'rotation': 'manual'},
            'oauth_secret': {'length': 32, 'rotation': 'manual'},
        }

        # Load existing keys
        self._load_keys()

        # Start rotation scheduler
        self.scheduler_thread: Optional[threading.Thread] = None
        self.is_running = False

        # Callbacks
        self.rotation_callbacks: List[Callable] = []
        self.key_update_callbacks: List[Callable] = []

    def start_rotation_scheduler(self):
        """Start the automatic key rotation scheduler"""
        if self.is_running:
            return

        self.is_running = True
        self.scheduler_thread = threading.Thread(target=self._rotation_scheduler, daemon=True)
        self.scheduler_thread.start()

        logger.info("🔄 API key rotation scheduler started")

    def stop_rotation_scheduler(self):
        """Stop the automatic key rotation scheduler"""
        self.is_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        logger.info("⏹️ API key rotation scheduler stopped")

    def _rotation_scheduler(self):
        """Background scheduler for key rotation"""
        while self.is_running:
            try:
                self._check_rotation_schedule()
                time.sleep(3600)  # Check every hour
            except Exception as e:
                logger.error(f"Rotation scheduler error: {e}")
                time.sleep(300)  # Wait 5 minutes on error

    def _check_rotation_schedule(self):
        """Check which keys need rotation"""
        now = datetime.now(UTC)

        for key_type, schedule_time in self.rotation_schedule.items():
            if now >= schedule_time:
                try:
                    self.rotate_key(key_type)
                    logger.info(f"🔄 Automatically rotated key: {key_type}")
                except Exception as e:
                    logger.error(f"Failed to rotate key {key_type}: {e}")

    def generate_key(self, key_type: str, custom_length: Optional[int] = None) -> str:
        """
        Generate a new API key

        Args:
            key_type: Type of key (jwt_secret, api_key, etc.)
            custom_length: Custom key length (optional)

        Returns:
            Generated key string
        """
        config = self.key_types.get(key_type, {'length': 32, 'rotation': 'manual'})
        length = custom_length or config['length']

        # Generate cryptographically secure random key
        alphabet = string.ascii_letters + string.digits + string.punctuation
        key = ''.join(secrets.choice(alphabet) for _ in range(length))

        # For sensitive keys, use only alphanumeric + special chars (no quotes)
        if key_type in ['jwt_secret', 'encryption_key']:
            alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
            key = ''.join(secrets.choice(alphabet) for _ in range(length))

        return key

    def rotate_key(self, key_type: str, immediate: bool = False) -> Dict[str, Any]:
        """
        Rotate an API key with zero-downtime support

        Args:
            key_type: Type of key to rotate
            immediate: Force immediate rotation

        Returns:
            Rotation result
        """
        try:
            # Generate new key
            new_key = self.generate_key(key_type)

            # Create key metadata
            key_metadata = {
                'key_type': key_type,
                'key_value': new_key,
                'generated_at': datetime.now(UTC),
                'expires_at': datetime.now(UTC) + timedelta(days=self.rotation_interval_days),
                'status': 'active',
                'version': len(self.key_history.get(key_type, [])) + 1,
                'hash': self._hash_key(new_key),
            }

            # Store old key for grace period (if it exists)
            if key_type in self.current_keys:
                old_key = self.current_keys[key_type].copy()
                old_key['status'] = 'deprecated'
                old_key['deprecated_at'] = datetime.now(UTC)
                old_key['grace_period_until'] = datetime.now(UTC) + timedelta(hours=24)

                # Add to history
                if key_type not in self.key_history:
                    self.key_history[key_type] = []
                self.key_history[key_type].append(old_key)

            # Set new key as current
            self.current_keys[key_type] = key_metadata

            # Save to persistent storage
            self._save_key(key_type, key_metadata)

            # Update rotation schedule
            if self.key_types.get(key_type, {}).get('rotation') == 'auto':
                self.rotation_schedule[key_type] = key_metadata['expires_at']

            # Trigger callbacks
            for callback in self.rotation_callbacks:
                try:
                    callback(key_type, new_key, key_metadata)
                except Exception as e:
                    logger.error(f"Rotation callback error: {e}")

            logger.info(f"✅ Successfully rotated key: {key_type} (version {key_metadata['version']})")

            return {
                'success': True,
                'key_type': key_type,
                'new_key': new_key,
                'version': key_metadata['version'],
                'expires_at': key_metadata['expires_at']
            }

        except Exception as e:
            logger.error(f"Key rotation failed for {key_type}: {e}")
            return {
                'success': False,
                'key_type': key_type,
                'error': str(e)
            }

    def get_key(self, key_type: str, allow_deprecated: bool = False) -> Optional[str]:
        """
        Get current API key

        Args:
            key_type: Type of key to retrieve
            allow_deprecated: Allow deprecated keys during grace period

        Returns:
            Key value or None if not found
        """
        if key_type in self.current_keys:
            key_data = self.current_keys[key_type]
            if key_data['status'] == 'active':
                return key_data['key_value']

            # Check if deprecated key is still in grace period
            if allow_deprecated and key_data.get('grace_period_until'):
                if datetime.now(UTC) < key_data['grace_period_until']:
                    logger.warning(f"Using deprecated key: {key_type}")
                    return key_data['key_value']

        return None

    def validate_key(self, key_type: str, provided_key: str) -> bool:
        """
        Validate a provided key against current and deprecated keys

        Args:
            key_type: Type of key
            provided_key: Key to validate

        Returns:
            True if key is valid
        """
        # Check current key
        current_key = self.get_key(key_type, allow_deprecated=False)
        if current_key and hmac.compare_digest(current_key, provided_key):
            return True

        # Check deprecated keys (grace period)
        if key_type in self.key_history:
            for old_key in self.key_history[key_type]:
                if (old_key.get('status') == 'deprecated' and
                    old_key.get('grace_period_until') and
                    datetime.now(UTC) < old_key['grace_period_until'] and
                    hmac.compare_digest(old_key['key_value'], provided_key)):
                    logger.warning(f"Accepted deprecated key: {key_type}")
                    return True

        return False

    def _hash_key(self, key: str) -> str:
        """Create a hash of the key for logging (never store actual key)"""
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create the master encryption key for API key storage"""
        key_file = self.keys_dir / ".master.key"
        
        # Try to get from environment first (recommended for production)
        env_key = os.environ.get('API_KEY_ENCRYPTION_KEY')
        if env_key:
            try:
                return base64.urlsafe_b64decode(env_key)
            except Exception:
                logger.warning("Invalid API_KEY_ENCRYPTION_KEY format, generating new key")
        
        # Try to load from file
        if key_file.exists():
            try:
                with open(key_file, 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Failed to load master key: {e}")
        
        # Generate new key
        if ENCRYPTION_AVAILABLE and _Fernet:
            key = _Fernet.generate_key()
        else:
            key = base64.urlsafe_b64encode(secrets.token_bytes(32))
        
        # Save key securely
        try:
            with open(key_file, 'wb') as f:
                f.write(key)
            # Set restrictive permissions (owner read/write only)
            os.chmod(key_file, 0o600)
            logger.info("🔐 Generated new master encryption key")
        except Exception as e:
            logger.error(f"Failed to save master key: {e}")
        
        return key

    def _init_fernet(self) -> Optional[Any]:
        """Initialize Fernet cipher for AES encryption"""
        if not ENCRYPTION_AVAILABLE or not _Fernet:
            return None
        try:
            return _Fernet(self._encryption_key)
        except Exception as e:
            logger.error(f"Failed to initialize Fernet: {e}")
            return None

    def _encrypt_value(self, value: str) -> str:
        """Encrypt a value using AES-128-CBC (Fernet)"""
        if self._fernet:
            try:
                encrypted = self._fernet.encrypt(value.encode())
                return encrypted.decode()
            except Exception as e:
                logger.error(f"Encryption failed: {e}")
        # Fallback to base64 (not secure, but backwards compatible)
        return base64.urlsafe_b64encode(value.encode()).decode()

    def _decrypt_value(self, encrypted_value: str) -> Optional[str]:
        """Decrypt a value using AES-128-CBC (Fernet)"""
        if self._fernet:
            try:
                decrypted = self._fernet.decrypt(encrypted_value.encode())
                return decrypted.decode()
            except _InvalidToken:
                logger.warning("Invalid token - attempting base64 fallback")
            except Exception as e:
                logger.error(f"Decryption failed: {e}")
        
        # Fallback: try base64 decode (for legacy/unencrypted keys)
        try:
            return base64.urlsafe_b64decode(encrypted_value.encode()).decode()
        except Exception:
            try:
                # Try standard base64 as last resort
                return base64.b64decode(encrypted_value).decode()
            except Exception:
                return None

    def _save_key(self, key_type: str, key_metadata: Dict):
        """Save key metadata to AES-encrypted file"""
        try:
            key_file = self.keys_dir / f"{key_type}.key"

            # Create encrypted data structure
            data = {
                'key_type': key_type,
                'metadata': key_metadata,
                'created_at': datetime.now(UTC).isoformat(),
                'encryption': 'fernet-aes128' if self._fernet else 'base64',
            }

            # Encrypt sensitive data (key value) using AES
            if 'key_value' in key_metadata:
                data['encrypted_key'] = self._encrypt_value(key_metadata['key_value'])

                # Remove plain key from metadata
                key_metadata = key_metadata.copy()
                del key_metadata['key_value']

            data['metadata'] = key_metadata

            # Save as JSON
            with open(key_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            # Set restrictive file permissions
            os.chmod(key_file, 0o600)

        except Exception as e:
            logger.error(f"Failed to save key {key_type}: {e}")

    def _load_keys(self):
        """Load keys from persistent storage with AES decryption"""
        try:
            for key_file in self.keys_dir.glob("*.key"):
                # Skip hidden files (master key is stored as .master.key)
                if key_file.name.startswith('.'):
                    continue
                    
                try:
                    with open(key_file, 'r') as f:
                        data = json.load(f)

                    key_type = data['key_type']
                    metadata = data['metadata']

                    # Decrypt key value using AES
                    if 'encrypted_key' in data:
                        decrypted = self._decrypt_value(data['encrypted_key'])
                        if decrypted:
                            metadata['key_value'] = decrypted
                        else:
                            logger.error(f"Failed to decrypt key: {key_type}")
                            continue

                    # Convert datetime strings back to objects
                    for date_field in ['generated_at', 'expires_at', 'deprecated_at', 'grace_period_until']:
                        if date_field in metadata and isinstance(metadata[date_field], str):
                            try:
                                metadata[date_field] = datetime.fromisoformat(metadata[date_field])
                            except Exception:
                                pass

                    self.current_keys[key_type] = metadata

                    # Set up rotation schedule
                    if metadata.get('expires_at') and self.key_types.get(key_type, {}).get('rotation') == 'auto':
                        self.rotation_schedule[key_type] = metadata['expires_at']

                except Exception as e:
                    logger.error(f"Failed to load key from {key_file}: {e}")

        except Exception as e:
            logger.error(f"Failed to load keys: {e}")

    def cleanup_expired_keys(self):
        """Clean up expired deprecated keys"""
        now = datetime.now(UTC)
        cleaned_count = 0

        for key_type in list(self.key_history.keys()):
            self.key_history[key_type] = [
                key for key in self.key_history[key_type]
                if not (key.get('grace_period_until') and now > key['grace_period_until'])
            ]

            if not self.key_history[key_type]:
                del self.key_history[key_type]
                cleaned_count += 1

        if cleaned_count > 0:
            logger.info(f"🧹 Cleaned up {cleaned_count} expired key types")

        return cleaned_count

    def get_key_status(self) -> Dict[str, Any]:
        """Get comprehensive key status"""
        status = {
            'current_keys': {},
            'rotation_schedule': {},
            'key_history_stats': {},
            'security_metrics': {}
        }

        # Current keys status
        for key_type, key_data in self.current_keys.items():
            status['current_keys'][key_type] = {
                'version': key_data.get('version', 1),
                'status': key_data.get('status', 'unknown'),
                'generated_at': key_data.get('generated_at'),
                'expires_at': key_data.get('expires_at'),
                'days_until_expiry': None
            }

            if key_data.get('expires_at'):
                expiry = key_data['expires_at']
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                status['current_keys'][key_type]['days_until_expiry'] = (
                    expiry - datetime.now(UTC)
                ).days

        # Rotation schedule
        for key_type, next_rotation in self.rotation_schedule.items():
            status['rotation_schedule'][key_type] = {
                'next_rotation': next_rotation,
                'hours_until_rotation': max(0, int((
                    next_rotation - datetime.now(UTC)
                ).total_seconds() / 3600))
            }

        # History statistics
        for key_type, history in self.key_history.items():
            status['key_history_stats'][key_type] = {
                'total_rotations': len(history),
                'deprecated_keys': len([k for k in history if k.get('status') == 'deprecated']),
                'active_grace_period': len([k for k in history
                                          if k.get('grace_period_until') and
                                          datetime.now(UTC) < k['grace_period_until']])
            }

        # Security metrics
        status['security_metrics'] = {
            'total_keys': len(self.current_keys),
            'keys_needing_rotation': len([
                k for k, v in status['current_keys'].items()
                if v.get('days_until_expiry', 999) <= 7  # Within 7 days
            ]),
            'deprecated_keys_in_grace': sum(
                stats.get('active_grace_period', 0)
                for stats in status['key_history_stats'].values()
            ),
            'auto_rotating_keys': len([
                k for k in self.key_types.keys()
                if self.key_types[k].get('rotation') == 'auto'
            ])
        }

        return status

    def force_rotate_all_keys(self) -> Dict[str, Any]:
        """Force rotation of all auto-rotating keys"""
        results = {
            'rotated': [],
            'failed': [],
            'skipped': []
        }

        for key_type, config in self.key_types.items():
            if config.get('rotation') == 'auto':
                result = self.rotate_key(key_type, immediate=True)
                if result['success']:
                    results['rotated'].append(key_type)
                else:
                    results['failed'].append({
                        'key_type': key_type,
                        'error': result.get('error', 'Unknown error')
                    })
            else:
                results['skipped'].append(key_type)

        logger.info(f"🔄 Force rotated {len(results['rotated'])} keys, "
                   f"{len(results['failed'])} failed, {len(results['skipped'])} skipped")

        return results

    def add_rotation_callback(self, callback: Callable):
        """Add callback for key rotation events"""
        self.rotation_callbacks.append(callback)

    def add_key_update_callback(self, callback: Callable):
        """Add callback for key update events"""
        self.key_update_callbacks.append(callback)

# Global key rotation service
key_rotation_service = APIKeyRotationService()

def start_key_rotation():
    """Start the key rotation service"""
    key_rotation_service.start_rotation_scheduler()

def stop_key_rotation():
    """Stop the key rotation service"""
    key_rotation_service.stop_rotation_scheduler()

def rotate_api_key(key_type: str) -> Dict[str, Any]:
    """Rotate a specific API key"""
    return key_rotation_service.rotate_key(key_type)

def get_api_key(key_type: str) -> Optional[str]:
    """Get current API key"""
    return key_rotation_service.get_key(key_type)

def validate_api_key(key_type: str, provided_key: str) -> bool:
    """Validate an API key"""
    return key_rotation_service.validate_key(key_type, provided_key)

def get_key_rotation_status() -> Dict[str, Any]:
    """Get key rotation status"""
    return key_rotation_service.get_key_status()

# Flask decorators
def require_valid_api_key(key_type: str = 'api_key'):
    """Decorator to require valid API key"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            api_key = request.headers.get('X-API-Key', '')

            # Try Authorization header first
            if auth_header.startswith('Bearer '):
                provided_key = auth_header[7:]  # Remove 'Bearer '
            else:
                provided_key = api_key

            if not provided_key:
                return {'error': 'API key required'}, 401

            if not validate_api_key(key_type, provided_key):
                return {'error': 'Invalid API key'}, 401

            # Store validated key info in request context
            g.api_key_validated = True
            g.api_key_type = key_type

            return f(*args, **kwargs)

        return decorated_function

    return decorator

__all__ = [
    'APIKeyRotationService',
    'key_rotation_service',
    'start_key_rotation',
    'stop_key_rotation',
    'rotate_api_key',
    'get_api_key',
    'validate_api_key',
    'get_key_rotation_status',
    'require_valid_api_key'
]