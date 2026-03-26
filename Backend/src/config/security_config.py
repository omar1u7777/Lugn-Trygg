"""
Security Configuration - Security settings and policies

DEPRECATION NOTICE: This module is scheduled for consolidation into settings.py.
The canonical source of truth for JWT, lockout, and CORS settings is config/__init__.py
(and settings.py for Pydantic-based configuration). Constants here should NOT be imported
directly in production code — use `from ..config import <CONSTANT>` instead.

Unique settings (password policy, session config, input validation, compliance flags)
will be migrated to the Pydantic Settings class in a future release.
"""

import logging
import os

logger = logging.getLogger(__name__)


def _get_bool_env(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        logger.warning("Ogiltigt heltalsvärde för %s (%s), använder standardvärde %d", name, raw, default)
        return default


def _get_csv_env(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    if not raw:
        return []
    return [item.strip() for item in raw.split(',') if item.strip()]

# Password Security Settings
PASSWORD_MIN_LENGTH = _get_int_env('PASSWORD_MIN_LENGTH', 8)
PASSWORD_MAX_LENGTH = _get_int_env('PASSWORD_MAX_LENGTH', 128)
PASSWORD_REQUIRE_UPPERCASE = _get_bool_env('PASSWORD_REQUIRE_UPPERCASE', True)
PASSWORD_REQUIRE_LOWERCASE = _get_bool_env('PASSWORD_REQUIRE_LOWERCASE', True)
PASSWORD_REQUIRE_DIGITS = _get_bool_env('PASSWORD_REQUIRE_DIGITS', True)
PASSWORD_REQUIRE_SPECIAL_CHARS = _get_bool_env('PASSWORD_REQUIRE_SPECIAL_CHARS', True)

# Account Security Settings — values MUST match config/__init__.py
MAX_FAILED_LOGIN_ATTEMPTS = _get_int_env('MAX_FAILED_LOGIN_ATTEMPTS', 5)
LOCKOUT_DURATION_MINUTES_FIRST = _get_int_env('LOCKOUT_DURATION_MINUTES_FIRST', 5)
LOCKOUT_DURATION_MINUTES_SECOND = _get_int_env('LOCKOUT_DURATION_MINUTES_SECOND', 15)
LOCKOUT_DURATION_MINUTES_THIRD = _get_int_env('LOCKOUT_DURATION_MINUTES_THIRD', 60)

# Session Security Settings
SESSION_TIMEOUT_MINUTES = _get_int_env('SESSION_TIMEOUT_MINUTES', 480)  # 8 hours
SESSION_RENEWAL_THRESHOLD_MINUTES = _get_int_env('SESSION_RENEWAL_THRESHOLD_MINUTES', 60)
ABSOLUTE_SESSION_TIMEOUT_HOURS = _get_int_env('ABSOLUTE_SESSION_TIMEOUT_HOURS', 24)

# JWT Security Settings — values MUST match config/__init__.py
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
JWT_REFRESH_SECRET_KEY = os.getenv('JWT_REFRESH_SECRET_KEY')
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = _get_int_env('JWT_EXPIRATION_MINUTES', 15)
JWT_REFRESH_TOKEN_EXPIRE_DAYS = _get_int_env('JWT_REFRESH_EXPIRATION_DAYS', 30)

# Rate Limiting Settings
RATE_LIMIT_REQUESTS_PER_HOUR = _get_int_env('RATE_LIMIT_REQUESTS_PER_HOUR', 1000)
RATE_LIMIT_REQUESTS_PER_MINUTE = _get_int_env('RATE_LIMIT_REQUESTS_PER_MINUTE', 100)
RATE_LIMIT_BURST_LIMIT = _get_int_env('RATE_LIMIT_BURST_LIMIT', 50)

# API Rate Limits by Endpoint Type
API_RATE_LIMITS = {
    'auth': {'requests_per_minute': 10, 'burst': 5},
    'mood': {'requests_per_minute': 60, 'burst': 20},
    'memory': {'requests_per_minute': 30, 'burst': 10},
    'admin': {'requests_per_minute': 120, 'burst': 30},
    'public': {'requests_per_minute': 300, 'burst': 100},
}

# CORS Security Settings
CORS_ALLOWED_ORIGINS: list[str] = _get_csv_env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
CORS_ALLOWED_METHODS: list[str] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
CORS_ALLOWED_HEADERS: list[str] = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin',
    'User-Agent'
]
CORS_EXPOSE_HEADERS: list[str] = ['X-Total-Count', 'X-Rate-Limit-Remaining']
CORS_SUPPORTS_CREDENTIALS = True
CORS_MAX_AGE = 86400  # 24 hours

# Content Security Policy
CSP_DEFAULT_SRC = ["'self'"]
CSP_SCRIPT_SRC = ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"]
CSP_STYLE_SRC = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
CSP_FONT_SRC = ["'self'", "https://fonts.gstatic.com"]
CSP_IMG_SRC = ["'self'", "data:", "https:"]
CSP_CONNECT_SRC = ["'self'"]
CSP_FRAME_ANCESTORS = ["'none'"]

# Security Headers
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}

# Input Validation Settings
MAX_STRING_LENGTH = _get_int_env('MAX_STRING_LENGTH', 10000)
MAX_LIST_LENGTH = _get_int_env('MAX_LIST_LENGTH', 1000)
MAX_DICT_DEPTH = _get_int_env('MAX_DICT_DEPTH', 10)
MAX_FILE_SIZE_MB = _get_int_env('MAX_FILE_SIZE_MB', 10)

# File Upload Security
ALLOWED_FILE_EXTENSIONS = {
    'images': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'documents': ['pdf', 'doc', 'docx', 'txt'],
    'audio': ['mp3', 'wav', 'm4a', 'ogg'],
    'video': ['mp4', 'avi', 'mov'],
}

# Encryption Settings
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
HIPAA_ENCRYPTION_KEY = os.getenv('HIPAA_ENCRYPTION_KEY')

# Audit Logging Settings
AUDIT_LOG_SECURITY_EVENTS = _get_bool_env('AUDIT_LOG_SECURITY_EVENTS', True)
AUDIT_LOG_FAILED_LOGINS = _get_bool_env('AUDIT_LOG_FAILED_LOGINS', True)
AUDIT_LOG_RATE_LIMITS = _get_bool_env('AUDIT_LOG_RATE_LIMITS', True)
AUDIT_LOG_SUSPICIOUS_ACTIVITY = _get_bool_env('AUDIT_LOG_SUSPICIOUS_ACTIVITY', True)

# IP Security Settings
TRUSTED_PROXIES: list[str] = _get_csv_env('TRUSTED_PROXIES')
BLOCKED_IPS: list[str] = _get_csv_env('BLOCKED_IPS')
ALLOWED_COUNTRIES: list[str] = _get_csv_env('ALLOWED_COUNTRIES')

# Two-Factor Authentication Settings
TFA_ENABLED = _get_bool_env('TFA_ENABLED', True)
TFA_REQUIRED_FOR_ADMINS = _get_bool_env('TFA_REQUIRED_FOR_ADMINS', True)
TFA_BACKUP_CODES_COUNT = _get_int_env('TFA_BACKUP_CODES_COUNT', 10)

# API Key Security
API_KEY_REQUIRED = _get_bool_env('API_KEY_REQUIRED', False)
API_KEY_ROTATION_DAYS = _get_int_env('API_KEY_ROTATION_DAYS', 90)

# Monitoring and Alerting
SECURITY_ALERT_EMAILS: list[str] = _get_csv_env('SECURITY_ALERT_EMAILS')
FAILED_LOGIN_ALERT_THRESHOLD = _get_int_env('FAILED_LOGIN_ALERT_THRESHOLD', 10)
SUSPICIOUS_ACTIVITY_ALERT_THRESHOLD = _get_int_env('SUSPICIOUS_ACTIVITY_ALERT_THRESHOLD', 5)

# Data Retention and Privacy
DATA_RETENTION_DAYS = _get_int_env('DATA_RETENTION_DAYS', 2555)  # 7 years for medical data
AUDIT_LOG_RETENTION_DAYS = _get_int_env('AUDIT_LOG_RETENTION_DAYS', 2555)
SESSION_LOG_RETENTION_DAYS = _get_int_env('SESSION_LOG_RETENTION_DAYS', 90)

# Compliance Settings
GDPR_COMPLIANT = _get_bool_env('GDPR_COMPLIANT', True)
HIPAA_COMPLIANT = _get_bool_env('HIPAA_COMPLIANT', True)
DATA_ENCRYPTION_AT_REST = _get_bool_env('DATA_ENCRYPTION_AT_REST', True)
DATA_ENCRYPTION_IN_TRANSIT = _get_bool_env('DATA_ENCRYPTION_IN_TRANSIT', True)

def get_csp_header() -> str:
    """Generate Content Security Policy header"""
    csp_parts = []

    if CSP_DEFAULT_SRC:
        csp_parts.append(f"default-src {' '.join(CSP_DEFAULT_SRC)}")
    if CSP_SCRIPT_SRC:
        csp_parts.append(f"script-src {' '.join(CSP_SCRIPT_SRC)}")
    if CSP_STYLE_SRC:
        csp_parts.append(f"style-src {' '.join(CSP_STYLE_SRC)}")
    if CSP_FONT_SRC:
        csp_parts.append(f"font-src {' '.join(CSP_FONT_SRC)}")
    if CSP_IMG_SRC:
        csp_parts.append(f"img-src {' '.join(CSP_IMG_SRC)}")
    if CSP_CONNECT_SRC:
        csp_parts.append(f"connect-src {' '.join(CSP_CONNECT_SRC)}")
    if CSP_FRAME_ANCESTORS:
        csp_parts.append(f"frame-ancestors {' '.join(CSP_FRAME_ANCESTORS)}")

    return "; ".join(csp_parts)

def is_ip_blocked(ip_address: str) -> bool:
    """Check if IP address is blocked"""
    return ip_address in BLOCKED_IPS

def is_country_allowed(country_code: str) -> bool:
    """Check if country is allowed"""
    if not ALLOWED_COUNTRIES:
        return True  # No restrictions
    return country_code.upper() in [c.upper() for c in ALLOWED_COUNTRIES]

def get_rate_limit_for_endpoint(endpoint: str) -> dict[str, int]:
    """Get rate limit settings for specific endpoint"""
    # Determine endpoint type
    if endpoint.startswith('/api/auth'):
        return API_RATE_LIMITS['auth']
    elif endpoint.startswith('/api/mood'):
        return API_RATE_LIMITS['mood']
    elif endpoint.startswith('/api/memory'):
        return API_RATE_LIMITS['memory']
    elif endpoint.startswith('/api/admin'):
        return API_RATE_LIMITS['admin']
    else:
        return API_RATE_LIMITS['public']

def validate_security_config() -> list[str]:
    """Validate security configuration and return any issues"""
    issues = []

    # Check required secrets
    if not JWT_SECRET_KEY:
        issues.append("JWT_SECRET_KEY saknas")
    if not JWT_REFRESH_SECRET_KEY:
        issues.append("JWT_REFRESH_SECRET_KEY saknas")
    if not ENCRYPTION_KEY:
        issues.append("ENCRYPTION_KEY saknas")

    # Check password policy
    if PASSWORD_MIN_LENGTH < 8:
        issues.append("PASSWORD_MIN_LENGTH ska vara minst 8")
    if PASSWORD_MAX_LENGTH > 128:
        issues.append("PASSWORD_MAX_LENGTH ska vara högst 128")

    # Check rate limits
    if RATE_LIMIT_REQUESTS_PER_MINUTE > 1000:
        issues.append("RATE_LIMIT_REQUESTS_PER_MINUTE är väldigt högt")

    return issues

# Validate configuration on import
config_issues = validate_security_config()
if config_issues:
    logger.warning("Security configuration issues detected:")
    for issue in config_issues:
        logger.warning("- %s", issue)
else:
    logger.info("Security configuration validated")
