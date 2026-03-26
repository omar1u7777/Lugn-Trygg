"""
Sentry monitoring and error tracking configuration for production.
Provides real-time error tracking, performance monitoring, and alerting.
"""
import logging
import os
from typing import Any, Literal

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = logging.getLogger(__name__)


def _get_env_float(name: str, default: float, *, minimum: float = 0.0, maximum: float = 1.0) -> float:
    """Read float env value safely and clamp it to an accepted range."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid %s value '%s', using default %.3f", name, raw, default)
        return default
    return max(minimum, min(maximum, value))


def _anonymize_ip(ip_address: str) -> str:
    """Mask IPv4/IPv6 addresses for privacy-safe telemetry."""
    if not ip_address:
        return ip_address

    if "." in ip_address:
        parts = ip_address.split(".")
        if len(parts) == 4:
            return ".".join(parts[:2] + ["xxx", "xxx"])
        return ip_address

    if ":" in ip_address:
        parts = ip_address.split(":")
        if len(parts) >= 4:
            return ":".join(parts[:4] + ["0000"])
    return ip_address


def init_sentry(app=None):
    """
    Initialize Sentry SDK with Flask integration.

    Args:
        app: Flask application instance (optional)

    Returns:
        bool: True if Sentry initialized successfully
    """
    sentry_dsn = os.getenv('SENTRY_DSN')

    if not sentry_dsn:
        logger.warning("SENTRY_DSN not configured - monitoring disabled")
        return False

    environment = os.getenv('SENTRY_ENVIRONMENT', 'production')
    traces_sample_rate = _get_env_float('SENTRY_TRACES_SAMPLE_RATE', 0.1)
    profiles_sample_rate = _get_env_float('SENTRY_PROFILES_SAMPLE_RATE', 0.1)

    # Configure logging integration
    logging_integration = LoggingIntegration(
        level=logging.INFO,  # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Send errors as events
    )

    # CRITICAL FIX: Initialize Sentry with production-ready configuration
    try:
        # Define endpoint-specific sampling rates for 10k users
        def traces_sampler(context: dict[str, Any]) -> float:
            """Sample traces based on endpoint for performance optimization"""
            transaction_name = str(context.get('transaction_context', {}).get('name', '')).lower()

            # Health checks: very low sampling (1%)
            if '/health' in transaction_name:
                return 0.01

            # High-traffic endpoints: moderate sampling (5-10%)
            if '/api/mood/get' in transaction_name or '/api/dashboard' in transaction_name:
                return 0.05

            # Write endpoints: higher sampling (10%)
            if '/api/mood/log' in transaction_name:
                return 0.1

            # AI endpoints: higher sampling (20%) due to potential issues
            if '/api/ai' in transaction_name or '/api/chatbot' in transaction_name:
                return 0.2

            # Default sampling rate
            return traces_sample_rate

        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                FlaskIntegration(
                    transaction_style='endpoint',  # Track by endpoint
                ),
                logging_integration,
            ],

            # Performance Monitoring
            traces_sample_rate=traces_sample_rate,
            profiles_sample_rate=profiles_sample_rate,
            traces_sampler=traces_sampler,  # Custom sampler for 10k users

            # Release tracking
            release=os.getenv('SENTRY_RELEASE', 'lugn-trygg@1.0.0'),

            # Environment
            environment=environment,

            # Additional options
            send_default_pii=False,  # HIPAA compliance - don't send PII
            attach_stacktrace=True,
            max_breadcrumbs=50,

            # CRITICAL FIX: Error filtering for production
            before_send=before_send_filter,
            before_breadcrumb=before_breadcrumb_filter,

            # CRITICAL FIX: Performance monitoring for 10k users
            enable_tracing=True,
        )

        logger.info("Sentry initialized for %s environment", environment)
        logger.info("  - Traces sample rate: %.2f%%", traces_sample_rate * 100)
        logger.info("  - Profiles sample rate: %.2f%%", profiles_sample_rate * 100)
        logger.info("  - Error tracking: ENABLED")
        logger.info("  - Performance monitoring: ENABLED")

    except Exception:
        logger.exception("Failed to initialize Sentry")
        return False

    return True

def before_send_filter(event: dict[str, Any], hint: dict[str, Any] | None):
    """
    Filter events before sending to Sentry.
    Use this to scrub sensitive data and filter out noise.

    Args:
        event: Sentry event dictionary
        hint: Additional context about the event

    Returns:
        Modified event or None to drop the event
    """
    # Filter out health check errors
    if str(event.get('request', {}).get('url', '')).endswith('/health'):
        return None

    # Filter out rate limit errors (expected behavior)
    if 'rate limit' in str(event.get('exception', {})).lower():
        return None

    if event.get('tags', {}).get('http.status_code') == '429':
        return None

    # Scrub sensitive data from request
    if 'request' in event:
        event_request = event['request']

        # Remove authorization headers
        if 'headers' in event_request:
            headers = event_request['headers']
            if isinstance(headers, dict):
                for header_name in list(headers.keys()):
                    normalized = str(header_name).lower()
                    if normalized in {'authorization', 'cookie', 'x-api-key', 'x-auth-token'}:
                        headers.pop(header_name, None)

        # Remove sensitive query parameters
        if 'query_string' in event_request:
            sensitive_params = ['token', 'api_key', 'password', 'secret']
            for param in sensitive_params:
                if param in str(event_request['query_string']).lower():
                    event_request['query_string'] = '[FILTERED]'
                    break

        # Do not include raw request body in monitoring payloads.
        if 'data' in event_request:
            event_request['data'] = '[FILTERED]'

    # Scrub user data for HIPAA compliance
    if 'user' in event:
        user = event['user']
        # Only keep non-identifiable information
        allowed_fields = {'id', 'ip_address'}
        filtered_user = {k: v for k, v in user.items() if k in allowed_fields}
        # Anonymize IP address
        if 'ip_address' in filtered_user:
            filtered_user['ip_address'] = _anonymize_ip(str(filtered_user['ip_address']))
        event['user'] = filtered_user

    return event

def before_breadcrumb_filter(crumb: dict[str, Any], hint: dict[str, Any] | None):
    """
    Filter breadcrumbs before adding to event.

    Args:
        crumb: Breadcrumb dictionary
        hint: Additional context

    Returns:
        Modified breadcrumb or None to drop it
    """
    # Filter out noisy breadcrumbs
    if crumb.get('category') == 'query' and '/health' in str(crumb.get('message', '')):
        return None

    # Scrub sensitive data from HTTP breadcrumbs
    if crumb.get('type') == 'http':
        if 'data' in crumb:
            crumb['data'] = '[FILTERED]'
        if isinstance(crumb.get('message'), str):
            message = crumb['message'].lower()
            if any(token in message for token in ['token=', 'password=', 'api_key=']):
                crumb['message'] = '[FILTERED]'

    return crumb

def capture_exception(exception: Exception, context: dict[str, Any] | None = None):
    """
    Manually capture an exception with additional context.

    Args:
        exception: Exception to capture
        context: Additional context dictionary

    Example:
        try:
            risky_operation()
        except Exception as e:
            capture_exception(e, {'user_id': user_id, 'operation': 'payment'})
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            for key, value in context.items():
                scope.set_context(key, value)

        sentry_sdk.capture_exception(exception)

# Type alias for Sentry log levels
LogLevel = Literal['debug', 'info', 'warning', 'error', 'fatal']

def capture_message(message: str, level: LogLevel = 'info', context: dict[str, Any] | None = None):
    """
    Capture a message with optional context.

    Args:
        message: Message string
        level: Severity level (debug, info, warning, error, fatal)
        context: Additional context dictionary
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            for key, value in context.items():
                scope.set_context(key, value)

        sentry_sdk.capture_message(message, level)

def set_user_context(user_id: str | None = None, email: str | None = None, username: str | None = None):
    """
    Set user context for Sentry events.
    Only use non-sensitive identifiers for HIPAA compliance.

    Args:
        user_id: Anonymous user identifier
        email: Hashed email (optional)
        username: Anonymous username (optional)
    """
    # Keep only anonymized user id to reduce accidental PII exposure.
    _ = email
    _ = username
    sentry_sdk.set_user({
        "id": user_id,
    })

def add_breadcrumb(message: str, category: str = 'info', level: LogLevel = 'info', data: dict[str, Any] | None = None):
    """
    Manually add a breadcrumb for context.

    Args:
        message: Breadcrumb message
        category: Category (default, query, navigation, etc.)
        level: Severity level
        data: Additional data dictionary
    """
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        level=level,
        data=data or {}
    )

# Performance monitoring helpers
def start_transaction(name: str, op: str = 'http.server'):
    """
    Start a performance monitoring transaction.

    Args:
        name: Transaction name (e.g., 'POST /api/moods')
        op: Operation type

    Returns:
        Transaction context manager

    Example:
        with start_transaction('process_payment'):
            # Your code here
            pass
    """
    return sentry_sdk.start_transaction(name=name, op=op)

def start_span(operation: str, description: str | None = None):
    """
    Start a performance span within a transaction.

    Args:
        operation: Span operation (e.g., 'db.query')
        description: Span description

    Returns:
        Span context manager

    Example:
        with start_span('db.query', 'fetch user data'):
            # Database query here
            pass
    """
    return sentry_sdk.start_span(op=operation, description=description)

# Health check function
def sentry_health_check() -> dict[str, Any]:
    """
    Verify Sentry is configured and working.

    Returns:
        dict: Health check status
    """
    sentry_dsn = os.getenv('SENTRY_DSN')

    return {
        'configured': bool(sentry_dsn),
        'environment': os.getenv('SENTRY_ENVIRONMENT', 'unknown'),
        'status': 'healthy' if sentry_dsn else 'disabled'
    }
