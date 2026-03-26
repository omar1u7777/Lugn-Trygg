"""
Security Middleware - Flask middleware for security hardening

Provides comprehensive security middleware including:
- Input validation and sanitization
- Rate limiting
- CSRF protection
- Security headers
- Request logging and monitoring
"""

import logging
import secrets
import time
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import g, jsonify, request

from ..services.audit_service import AuditService
from ..services.security_service import SecurityService

logger = logging.getLogger(__name__)

class SecurityMiddleware:
    """Security middleware for Flask applications"""

    def __init__(self, app=None, security_service: SecurityService | None = None):
        self.app = app
        self.security_service = security_service or SecurityService(AuditService())
        self.rate_limits: dict[str, dict[str, Any]] = {}

        if app:
            self.init_app(app)

    def init_app(self, app):
        """Initialize middleware with Flask app"""

        # Register before_request handlers
        app.before_request(self._before_request)

        # Register after_request handlers
        app.after_request(self._after_request)

        # Register error handlers
        app.errorhandler(400)(self._handle_bad_request)
        app.errorhandler(401)(self._handle_unauthorized)
        app.errorhandler(403)(self._handle_forbidden)
        app.errorhandler(429)(self._handle_rate_limit)

        # Add security headers
        app.after_request(self._add_security_headers)

        logger.info("Security middleware initialized")

    def _before_request(self):
        """Process request before handling"""
        # Store request start time early so rejected requests are also measurable.
        g.request_start_time = time.time()
        g.csp_nonce = secrets.token_urlsafe(16)

        # Get client information
        ip_address = self._get_client_ip()
        user_agent = self._truncate_user_agent(request.headers.get('User-Agent'))
        user_id = getattr(g, 'user_id', None)
        safe_user_id = self._mask_user_id(user_id)

        # Rate limiting check
        if self._check_rate_limit(ip_address):
            return self._rate_limit_response()

        # Input validation and sanitization
        if request.method in ['POST', 'PUT', 'PATCH']:
            validation_response = self._validate_and_sanitize_input()
            if validation_response is not None:
                return validation_response

        # CSRF protection for state-changing operations
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            if not self._validate_csrf():
                return jsonify({"error": "Ogiltig CSRF-token"}), 403

        # Log security event
        self.security_service.log_security_event(
            'REQUEST',
            safe_user_id,
            {
                'method': request.method,
                'path': request.path,
                'has_query_string': bool(request.query_string),
                'query_string_length': len(request.query_string),
                'content_length': int(request.content_length or 0)
            },
            self._anonymize_ip(ip_address),
            user_agent
        )

    def _after_request(self, response):
        """Process response after handling"""
        # Calculate request duration
        if hasattr(g, 'request_start_time'):
            duration = time.time() - g.request_start_time
            # Log slow requests
            if duration > 5.0:  # 5 seconds
                logger.warning(
                    "Langsam request: %s %s tog %.2fs",
                    request.method,
                    request.path,
                    duration,
                )

        # Audit successful responses
        if response.status_code < 400:
            user_id = getattr(g, 'user_id', 'anonymous')
            self.security_service.audit_access(
                user_id,
                request.path,
                request.method,
                True,
                self._anonymize_ip(self._get_client_ip()),
                self._truncate_user_agent(request.headers.get('User-Agent'))
            )

        return response

    def _add_security_headers(self, response):
        """Add security headers to response"""
        # HTTPS and security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy with per-request nonce for inline scripts.
        nonce = getattr(g, 'csp_nonce', '')
        csp = (
            "default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: https://*.googleusercontent.com; "
            "connect-src 'self' https://lugn-trygg-backend.onrender.com https://*.firebaseio.com https://*.googleapis.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self';"
        )
        response.headers['Content-Security-Policy'] = csp

        # Remove server header for security
        response.headers.pop('Server', None)

        return response

    def _validate_and_sanitize_input(self):
        """Validate and sanitize request input"""
        # Sanitize JSON data
        if request.is_json:
            data = request.get_json(silent=True)
            if isinstance(data, dict):
                sanitized = self._sanitize_dict(data)
                # Replace request data (this is a bit of a hack, but works for validation)
                request._cached_json = (sanitized, sanitized)
            elif isinstance(data, list):
                sanitized_list = [
                    self._sanitize_dict(item) if isinstance(item, dict)
                    else self.security_service.sanitize_input(item) if isinstance(item, str)
                    else item
                    for item in data
                ]
                request._cached_json = (sanitized_list, sanitized_list)

        # Check for SQL injection in query parameters
        for key, value in request.args.items():
            if isinstance(value, str) and self.security_service.check_sql_injection(value):
                logger.warning("SQL-injection forsok upptackt i query-parameter: %s", key)
                self.security_service.log_security_event(
                    'SQL_INJECTION_ATTEMPT',
                    self._mask_user_id(getattr(g, 'user_id', None)),
                    {'parameter': key, 'path': request.path},
                    self._anonymize_ip(self._get_client_ip())
                )
                return jsonify({"error": "Ogiltiga forfragningsparametrar"}), 400

        return None

    def _sanitize_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively sanitize dictionary values"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = self.security_service.sanitize_input(value)
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self.security_service.sanitize_input(item) if isinstance(item, str)
                    else self._sanitize_dict(item) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized

    def _validate_csrf(self) -> bool:
        """Validate CSRF token"""
        # Skip CSRF for API endpoints with proper auth
        if request.path.startswith('/api/') and request.headers.get('Authorization'):
            return True

        # Skip CSRF for authentication endpoints (register, login, reset password, etc.)
        auth_endpoints = [
            '/api/v1/auth/register',
            '/api/v1/auth/login',
            '/api/v1/auth/google-login',
            '/api/v1/auth/reset-password',
            '/api/v1/auth/confirm-password-reset',
            '/api/v1/auth/refresh'
        ]
        if request.path in auth_endpoints:
            return True

        # For forms, check CSRF token
        token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
        if not token:
            return False

        session_id = getattr(g, 'session_id', 'anonymous')
        result, _error = self.security_service.validate_csrf_token(token, session_id)
        return result if result is not None else False

    def _check_rate_limit(self, identifier: str) -> bool:
        """Check if request should be rate limited"""
        result, _error = self.security_service.rate_limit_check(
            identifier,
            f"{request.method}:{request.path}",
            max_requests=100,  # 100 requests per hour
            window_seconds=3600
        )
        return result if result is not None else False

    def _rate_limit_response(self):
        """Return rate limit exceeded response"""
        return jsonify({
            "error": "For manga forfragningar",
            "retry_after": 3600
        }), 429

    def _get_client_ip(self) -> str:
        """Get real client IP address"""
        # Check for forwarded headers (behind proxy/load balancer)
        forwarded = request.headers.get('X-Forwarded-For')
        if forwarded:
            # Take first IP if multiple
            return forwarded.split(',')[0].strip()

        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip

        return request.remote_addr or 'unknown'

    def _anonymize_ip(self, ip_address: str) -> str:
        """Mask client IP for GDPR-safe logs."""
        if not ip_address or ip_address == 'unknown':
            return 'unknown'

        # Basic IPv4 anonymization; fallback masks last segment for unknown formats.
        if '.' in ip_address:
            parts = ip_address.split('.')
            if len(parts) == 4:
                return '.'.join(parts[:3] + ['0'])
        if ':' in ip_address:
            # IPv6: keep only first 4 blocks and mask rest.
            parts = ip_address.split(':')
            return ':'.join(parts[:4] + ['0000'])
        return ip_address[:32]

    def _truncate_user_agent(self, user_agent: str | None) -> str:
        """Cap User-Agent size to avoid oversized log payloads."""
        if not user_agent:
            return ''
        return user_agent[:256]

    def _mask_user_id(self, user_id: Any) -> str:
        """Mask user identifier before logging to security events."""
        if not user_id:
            return 'anonymous'
        user_id_str = str(user_id)
        if len(user_id_str) <= 6:
            return '***'
        return f"{user_id_str[:3]}***{user_id_str[-2:]}"

    def _handle_bad_request(self, e):
        """Handle 400 Bad Request errors"""
        self.security_service.log_security_event(
            'BAD_REQUEST',
            self._mask_user_id(getattr(g, 'user_id', None)),
            {'path': request.path, 'error_type': type(e).__name__},
            self._anonymize_ip(self._get_client_ip())
        )
        return jsonify({"error": "Ogiltig begaran"}), 400

    def _handle_unauthorized(self, e):
        """Handle 401 Unauthorized errors"""
        self.security_service.log_security_event(
            'UNAUTHORIZED_ACCESS',
            self._mask_user_id(getattr(g, 'user_id', None)),
            {'path': request.path},
            self._anonymize_ip(self._get_client_ip())
        )
        return jsonify({"error": "Obeharig"}), 401

    def _handle_forbidden(self, e):
        """Handle 403 Forbidden errors"""
        from ..services.tamper_detection_service import tamper_detection_service

        user_id = getattr(g, 'user_id', 'anonymous')
        client_ip = self._get_client_ip()

        self.security_service.log_security_event(
            'FORBIDDEN_ACCESS',
            self._mask_user_id(user_id),
            {'path': request.path},
            self._anonymize_ip(client_ip)
        )

        # Record in tamper detection - forbidden access is suspicious
        tamper_detection_service.record_event(
            event_type='FORBIDDEN_ACCESS',
            message=f'Forbjudet atkomstforsok till {request.path}',
            severity='high',
            metadata={
                'user_id': self._mask_user_id(user_id),
                'path': request.path,
                'ip': self._anonymize_ip(client_ip),
                'method': request.method
            }
        )

        return jsonify({"error": "Atkomst nekad"}), 403

    def _handle_rate_limit(self, e):
        """Handle 429 Rate Limit errors"""
        from ..services.tamper_detection_service import tamper_detection_service

        user_id = getattr(g, 'user_id', 'anonymous')
        client_ip = self._get_client_ip()

        self.security_service.log_security_event(
            'RATE_LIMIT_EXCEEDED',
            self._mask_user_id(user_id),
            {'path': request.path},
            self._anonymize_ip(client_ip)
        )

        # Record in tamper detection for dashboard visibility
        tamper_detection_service.record_event(
            event_type='RATE_LIMIT_EXCEEDED',
            message=f'Rate limit overskriden via middleware for {request.path}',
            severity='medium',
            metadata={
                'user_id': self._mask_user_id(user_id),
                'path': request.path,
                'ip': self._anonymize_ip(client_ip)
            }
        )

        return jsonify({"error": "For manga forfragningar", "retry_after": 3600}), 429

# Decorator for requiring authentication
def require_auth(f: Callable) -> Callable:
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        security_service = SecurityService(AuditService())
        return security_service.require_auth(f)(*args, **kwargs)
    return decorated_function

# Decorator for requiring specific permissions
def require_permission(permission: str) -> Callable:
    """Decorator to require specific permission"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            security_service = SecurityService(AuditService())
            return security_service.require_permission(permission)(f)(*args, **kwargs)
        return decorated_function
    return decorator

# Decorator for input validation
def validate_input(schema_class: Any) -> Callable:
    """Decorator to validate input using Pydantic schema"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if request.is_json:
                    data = request.get_json(silent=True)
                    if not isinstance(data, dict):
                        return jsonify({"error": "Ogiltigt indataformat"}), 400
                    validated_data = schema_class(**data)
                    # Add validated data to kwargs
                    kwargs['validated_data'] = validated_data
                return f(*args, **kwargs)
            except Exception as e:
                logger.warning("Indatavalidering misslyckades: %s", type(e).__name__)
                return jsonify({"error": "Ogiltig indata", "details": "Validering misslyckades. Kontrollera din begaran."}), 400
        return decorated_function
    return decorator
