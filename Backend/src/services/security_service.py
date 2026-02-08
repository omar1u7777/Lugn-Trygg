"""
Security Service - Comprehensive security operations

Handles authentication, authorization, input validation, encryption,
and security monitoring for the entire application.
"""

from typing import Optional, Dict, Any, List, Tuple
import logging
import hashlib
import secrets
import hmac
import time
import re
from datetime import datetime, timezone, timedelta
from functools import wraps

from ..config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ENCRYPTION_KEY,
)
import os
# HIPAA_ENCRYPTION_KEY is optional and defined in security_config
HIPAA_ENCRYPTION_KEY = os.getenv('HIPAA_ENCRYPTION_KEY', '')

from ..utils.error_handling import handle_service_errors, ServiceError, ValidationError
from . import IAuditService

logger = logging.getLogger(__name__)

class SecurityService:
    """Comprehensive security service"""

    def __init__(self, audit_service: IAuditService):
        self.audit = audit_service
        self._encryption_key = ENCRYPTION_KEY.encode() if ENCRYPTION_KEY else None
        if not self._encryption_key:
            logger.critical("⚠️ ENCRYPTION_KEY not set! Generating random key — encrypted data will NOT survive restarts!")
            self._encryption_key = secrets.token_bytes(32)
        self._hipaa_key = HIPAA_ENCRYPTION_KEY.encode() if HIPAA_ENCRYPTION_KEY else None
        if not self._hipaa_key:
            logger.warning("⚠️ HIPAA_ENCRYPTION_KEY not set — using random key")
            self._hipaa_key = secrets.token_bytes(32)
        self._rate_limit_store: Dict[str, list] = {}  # In-memory rate limit tracking

    @handle_service_errors
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        try:
            import bcrypt
            salt = bcrypt.gensalt(rounds=12)
            return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        except ImportError:
            # Fallback to PBKDF2 if bcrypt not available
            import hashlib
            salt = secrets.token_bytes(32)
            key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
            return f"pbkdf2:{salt.hex()}:{key.hex()}"

    @handle_service_errors
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        try:
            import bcrypt
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        except ImportError:
            # Handle PBKDF2 fallback
            if hashed.startswith('pbkdf2:'):
                parts = hashed.split(':')
                if len(parts) != 3:
                    return False
                salt = bytes.fromhex(parts[1])
                stored_key = bytes.fromhex(parts[2])
                key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
                return hmac.compare_digest(key, stored_key)
            return False

    @handle_service_errors
    def encrypt_sensitive_data(self, data: str, hipaa_compliant: bool = False) -> str:
        """Encrypt sensitive data using AES"""
        try:
            from cryptography.fernet import Fernet
            key = self._hipaa_key if hipaa_compliant else self._encryption_key
            f = Fernet(key)
            return f.encrypt(data.encode()).decode()
        except ImportError:
            # Fallback: use HMAC-based obfuscation (less secure but not plaintext)
            logger.warning("Cryptography library not available, using HMAC-based fallback")
            import base64
            key = self._hipaa_key if hipaa_compliant else self._encryption_key
            mac = hmac.new(key, data.encode(), hashlib.sha256).hexdigest()
            encoded = base64.b64encode(data.encode()).decode()
            return f"hmac:{mac}:{encoded}"

    @handle_service_errors
    def decrypt_sensitive_data(self, encrypted_data: str, hipaa_compliant: bool = False) -> str:
        """Decrypt sensitive data"""
        try:
            from cryptography.fernet import Fernet
            key = self._hipaa_key if hipaa_compliant else self._encryption_key
            f = Fernet(key)
            return f.decrypt(encrypted_data.encode()).decode()
        except ImportError:
            # Fallback: decode HMAC-based obfuscation
            if encrypted_data.startswith('hmac:'):
                import base64
                parts = encrypted_data.split(':', 2)
                if len(parts) == 3:
                    return base64.b64decode(parts[2]).decode()
            raise ValueError("Cannot decrypt data: cryptography library not available")

    @handle_service_errors
    def generate_secure_token(self, length: int = 32) -> str:
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)

    @handle_service_errors
    def hash_token(self, token: str) -> str:
        """Create hash of token for storage"""
        return hashlib.sha256(token.encode()).hexdigest()

    @handle_service_errors
    def validate_token_format(self, token: str) -> bool:
        """Validate JWT token format and structure"""
        if not token or len(token) < 20:
            return False

        # Validate JWT structure (3 parts separated by dots)
        if token.count('.') != 2:
            return False

        return True

    @handle_service_errors
    def sanitize_input(self, input_str: str, max_length: int = 1000) -> str:
        """Sanitize user input to prevent XSS and injection attacks"""
        if not input_str:
            return ""

        # Truncate if too long
        if len(input_str) > max_length:
            input_str = input_str[:max_length]

        # Basic HTML escaping
        input_str = input_str.replace('&', '&')
        input_str = input_str.replace('<', '<')
        input_str = input_str.replace('>', '>')
        input_str = input_str.replace('"', '"')
        input_str = input_str.replace("'", '&#x27;')

        # Remove potential script tags
        input_str = input_str.replace('<script', '')
        input_str = input_str.replace('</script>', '')

        return input_str.strip()

    @handle_service_errors
    def validate_email_format(self, email: str) -> bool:
        """Validate email format"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    @handle_service_errors
    def check_sql_injection(self, input_str: str) -> bool:
        """Check for potential SQL injection patterns"""
        sql_patterns = [
            r';\s*--',  # Semicolon followed by comment
            r';\s*/\*',  # Semicolon followed by block comment
            r'union\s+select',  # UNION SELECT
            r'/\*.*\*/',  # Block comments
            r'--.*$',  # Line comments
            r';\s*drop',  # DROP statements
            r';\s*delete',  # DELETE statements
            r';\s*update',  # UPDATE statements
            r';\s*insert',  # INSERT statements
        ]

        input_lower = input_str.lower()
        for pattern in sql_patterns:
            if re.search(pattern, input_lower, re.IGNORECASE):
                return True
        return False

    @handle_service_errors
    def rate_limit_check(self, identifier: str, action: str, max_requests: int = 100, window_seconds: int = 3600) -> bool:
        """Check if request should be rate limited using sliding window."""
        key = f"{identifier}:{action}"
        now = time.time()
        
        # Clean up old entries
        if key in self._rate_limit_store:
            self._rate_limit_store[key] = [
                ts for ts in self._rate_limit_store[key]
                if now - ts < window_seconds
            ]
        else:
            self._rate_limit_store[key] = []
        
        # Check count
        if len(self._rate_limit_store[key]) >= max_requests:
            logger.warning(f"Rate limit exceeded for {identifier} on {action}")
            return True  # Rate limited
        
        # Record this request
        self._rate_limit_store[key].append(now)
        return False  # Not rate limited

    @handle_service_errors
    def log_security_event(self, event_type: str, user_id: str, details: Dict[str, Any],
                          ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        """Log security-related events"""
        security_details = {
            **details,
            'security_event': True,
            'event_type': event_type,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        self.audit.log_event(f"SECURITY_{event_type.upper()}", user_id, security_details)

    @handle_service_errors
    def validate_request_origin(self, request, allowed_origins: List[str]) -> bool:
        """Validate request origin for CORS and CSRF protection"""
        origin = request.headers.get('Origin') or request.headers.get('Referer', '').split('/')[2]

        if not origin:
            return False

        for allowed in allowed_origins:
            if allowed.startswith('*'):
                # Wildcard matching
                domain = allowed[1:]  # Remove *
                if origin.endswith(domain):
                    return True
            elif origin == allowed:
                return True

        return False

    @handle_service_errors
    def generate_csrf_token(self, session_id: str) -> str:
        """Generate CSRF token for session"""
        timestamp = str(int(time.time()))
        message = f"{session_id}:{timestamp}"
        signature = hmac.new(self._encryption_key, message.encode(), hashlib.sha256).hexdigest()
        return f"{timestamp}:{signature}"

    @handle_service_errors
    def validate_csrf_token(self, token: str, session_id: str) -> bool:
        """Validate CSRF token"""
        try:
            timestamp_str, signature = token.split(':', 1)
            timestamp = int(timestamp_str)

            # Check if token is not too old (5 minutes)
            if time.time() - timestamp > 300:
                return False

            message = f"{session_id}:{timestamp_str}"
            expected_signature = hmac.new(self._encryption_key, message.encode(), hashlib.sha256).hexdigest()

            return hmac.compare_digest(signature, expected_signature)
        except (ValueError, TypeError):
            return False

    def require_auth(self, f):
        """Decorator for requiring authentication via JWT token."""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import g, request as flask_request
            
            # Allow OPTIONS preflight
            if flask_request.method == 'OPTIONS':
                return ('', 204)
            
            auth_header = flask_request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return {'error': 'Authorization header saknas eller är ogiltig!'}, 401
            
            token = auth_header.split(' ')[1]
            if not self.validate_token_format(token):
                return {'error': 'Ogiltigt token-format!'}, 401
            
            try:
                import jwt as pyjwt
                payload = pyjwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
                user_id = payload.get('sub')
                if not user_id:
                    return {'error': 'Ogiltigt token-innehåll!'}, 401
                g.user_id = user_id
            except Exception:
                return {'error': 'Ogiltigt eller utgånget token!'}, 401
            
            return f(*args, **kwargs)
        return decorated_function

    def require_permission(self, permission: str):
        """Decorator for requiring specific permissions."""
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                from flask import g
                user_id = getattr(g, 'user_id', None)
                if not user_id:
                    return {'error': 'Autentisering krävs'}, 401
                
                # Check admin permission from Firestore
                try:
                    from ..firebase_config import db
                    user_doc = db.collection('users').document(user_id).get()
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        user_role = user_data.get('role', 'user')
                        user_permissions = user_data.get('permissions', [])
                        
                        # Admin has all permissions
                        if user_role == 'admin':
                            return f(*args, **kwargs)
                        
                        # Check specific permission
                        if permission in user_permissions:
                            return f(*args, **kwargs)
                    
                    logger.warning(f"Permission denied: user {user_id} lacks '{permission}'")
                    return {'error': 'Behörighet saknas'}, 403
                except Exception as e:
                    logger.error(f"Permission check failed: {e}")
                    return {'error': 'Kunde inte verifiera behörighet'}, 500
            return decorated_function
        return decorator

    @handle_service_errors
    def audit_access(self, user_id: str, resource: str, action: str, success: bool,
                    ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        """Audit resource access"""
        self.audit.log_event("ACCESS_AUDIT", user_id, {
            'resource': resource,
            'action': action,
            'success': success,
            'ip_address': ip_address,
            'user_agent': user_agent
        })

    @handle_service_errors
    def check_password_strength(self, password: str) -> Tuple[bool, List[str]]:
        """Check password strength and return issues"""
        issues = []

        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")

        if not re.search(r'[A-Z]', password):
            issues.append("Password must contain at least one uppercase letter")

        if not re.search(r'[a-z]', password):
            issues.append("Password must contain at least one lowercase letter")

        if not re.search(r'\d', password):
            issues.append("Password must contain at least one digit")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            issues.append("Password must contain at least one special character")

        return len(issues) == 0, issues