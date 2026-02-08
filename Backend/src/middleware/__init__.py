"""
Middleware Package - Request/Response Middleware
2026-Compliant middleware for correlation, security, and validation
"""

from .correlation import (
    add_correlation_headers,
    get_correlation_context,
    setup_correlation_ids,
)
from .error_handler import (
    CircuitBreaker,
    CircuitBreakerOpenException,
    ErrorHandler,
    error_handler,
    handle_errors,
    with_circuit_breaker,
)
from .security_headers import init_security_headers
from .security_middleware import SecurityMiddleware
from .validation import init_validation_middleware, validate_request


def init_security_middleware(app, security_service=None):
    """Initialize the security middleware on a Flask app."""
    middleware = SecurityMiddleware(app=app, security_service=security_service)
    return middleware

__all__ = [
    # Correlation
    "setup_correlation_ids",
    "add_correlation_headers",
    "get_correlation_context",
    # Error handling
    "ErrorHandler",
    "CircuitBreaker",
    "CircuitBreakerOpenException",
    "error_handler",
    "handle_errors",
    "with_circuit_breaker",
    # Security
    "init_security_headers",
    "init_security_middleware",
    # Validation
    "init_validation_middleware",
    "validate_request",
]

