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
        # Get client information
        ip_address = self._get_client_ip()
        user_agent = request.headers.get('User-Agent', '')
        user_id = getattr(g, 'user_id', None)

        # Rate limiting check
        if self._check_rate_limit(ip_address):
            return self._rate_limit_response()

        # Input validation and sanitization
        if request.method in ['POST', 'PUT', 'PATCH']:
            self._validate_and_sanitize_input()

        # CSRF protection for state-changing operations
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            if not self._validate_csrf():
                return jsonify({"error": "CSRF token validation failed"}), 403

        # Log security event
        self.security_service.log_security_event(
            'REQUEST',
            user_id or 'anonymous',
            {
                'method': request.method,
                'path': request.path,
                'query_string': request.query_string.decode(),
                'content_length': request.content_length
            },
            ip_address,
            user_agent
        )

        # Store request start time for performance monitoring
        g.request_start_time = time.time()

    def _after_request(self, response):
        """Process response after handling"""
        # Calculate request duration
        if hasattr(g, 'request_start_time'):
            duration = time.time() - g.request_start_time
            # Log slow requests
            if duration > 5.0:  # 5 seconds
                logger.warning(f"Slow request: {request.method} {request.path} took {duration:.2f}s")

        # Audit successful responses
        if response.status_code < 400:
            user_id = getattr(g, 'user_id', 'anonymous')
            self.security_service.audit_access(
                user_id,
                request.path,
                request.method,
                True,
                self._get_client_ip(),
                request.headers.get('User-Agent')
            )

        return response

    def _add_security_headers(self, response):
        """Add security headers to response"""
        # HTTPS and security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://lugn-trygg-backend.onrender.com https://*.firebaseio.com https://*.googleapis.com; "
            "frame-ancestors 'none';"
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
            if data:
                sanitized = self._sanitize_dict(data)
                # Replace request data (this is a bit of a hack, but works for validation)
                request._cached_json = (sanitized, sanitized)

        # Check for SQL injection in query parameters
        for key, value in request.args.items():
            if isinstance(value, str) and self.security_service.check_sql_injection(value):
                logger.warning(f"SQL injection attempt detected in query param: {key}")
                self.security_service.log_security_event(
                    'SQL_INJECTION_ATTEMPT',
                    getattr(g, 'user_id', 'anonymous'),
                    {'parameter': key, 'value': value[:100]},  # Truncate for security
                    self._get_client_ip()
                )
                return jsonify({"error": "Invalid request parameters"}), 400

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
        result, error = self.security_service.validate_csrf_token(token, session_id)
        return result if result is not None else False

    def _check_rate_limit(self, identifier: str) -> bool:
        """Check if request should be rate limited"""
        result, error = self.security_service.rate_limit_check(
            identifier,
            f"{request.method}:{request.path}",
            max_requests=100,  # 100 requests per hour
            window_seconds=3600
        )
        return result if result is not None else False

    def _rate_limit_response(self):
        """Return rate limit exceeded response"""
        return jsonify({
            "error": "Rate limit exceeded",
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

    def _handle_bad_request(self, e):
        """Handle 400 Bad Request errors"""
        self.security_service.log_security_event(
            'BAD_REQUEST',
            getattr(g, 'user_id', 'anonymous'),
            {'error': str(e), 'path': request.path},
            self._get_client_ip()
        )
        return jsonify({"error": "Bad request", "details": str(e)}), 400

    def _handle_unauthorized(self, e):
        """Handle 401 Unauthorized errors"""
        self.security_service.log_security_event(
            'UNAUTHORIZED_ACCESS',
            getattr(g, 'user_id', 'anonymous'),
            {'path': request.path},
            self._get_client_ip()
        )
        return jsonify({"error": "Unauthorized"}), 401

    def _handle_forbidden(self, e):
        """Handle 403 Forbidden errors"""
        from ..services.tamper_detection_service import tamper_detection_service

        user_id = getattr(g, 'user_id', 'anonymous')
        client_ip = self._get_client_ip()

        self.security_service.log_security_event(
            'FORBIDDEN_ACCESS',
            user_id,
            {'path': request.path},
            client_ip
        )

        # Record in tamper detection - forbidden access is suspicious
        tamper_detection_service.record_event(
            event_type='FORBIDDEN_ACCESS',
            message=f'Forbidden access attempt to {request.path}',
            severity='high',
            metadata={
                'user_id': user_id,
                'path': request.path,
                'ip': client_ip,
                'method': request.method
            }
        )

        return jsonify({"error": "Forbidden"}), 403

    def _handle_rate_limit(self, e):
        """Handle 429 Rate Limit errors"""
        from ..services.tamper_detection_service import tamper_detection_service

        user_id = getattr(g, 'user_id', 'anonymous')
        client_ip = self._get_client_ip()

        self.security_service.log_security_event(
            'RATE_LIMIT_EXCEEDED',
            user_id,
            {'path': request.path},
            client_ip
        )

        # Record in tamper detection for dashboard visibility
        tamper_detection_service.record_event(
            event_type='RATE_LIMIT_EXCEEDED',
            message=f'Rate limit exceeded via middleware for {request.path}',
            severity='medium',
            metadata={
                'user_id': user_id,
                'path': request.path,
                'ip': client_ip
            }
        )

        return jsonify({"error": "Rate limit exceeded", "retry_after": 3600}), 429

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
                    data = request.get_json()
                    validated_data = schema_class(**data)
                    # Add validated data to kwargs
                    kwargs['validated_data'] = validated_data
                return f(*args, **kwargs)
            except Exception as e:
                logger.warning("Input validation failed: %s", str(e))
                return jsonify({"error": "Invalid input", "details": "Validation failed. Check your request data."}), 400
        return decorated_function
    return decorator
