"""
2026-Compliant Correlation ID Middleware
Adds request_id, trace_id, and correlation headers to all requests
"""

from __future__ import annotations

from uuid import uuid4

from flask import g, request

from ..utils.structured_logging import (
    get_request_id,
    get_trace_id,
    get_user_id,
    set_request_id,
    set_trace_id,
    set_user_id,
)


def setup_correlation_ids() -> None:
    """
    Setup correlation IDs for request tracking and distributed tracing.

    Checks for X-Request-ID and X-Trace-ID headers, or generates new ones.
    Sets them in Flask g and context variables for logging.
    """
    # Get or generate request ID
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        request_id = str(uuid4())

    # Get or generate trace ID (for distributed tracing)
    trace_id = request.headers.get("X-Trace-ID")
    if not trace_id:
        # Try to get from parent request or generate new
        trace_id = str(uuid4())

    # Set in Flask g for access in routes
    g.request_id = request_id
    g.trace_id = trace_id

    # Set in context variables for structured logging
    set_request_id(request_id)
    set_trace_id(trace_id)

    # Try to get user ID from JWT (if authenticated)
    if hasattr(g, "user_id") and g.user_id:
        set_user_id(g.user_id)


def add_correlation_headers(response):
    """
    Add correlation headers to response for distributed tracing.

    Adds X-Request-ID and X-Trace-ID headers so client can track requests.
    """
    if hasattr(g, "request_id"):
        response.headers["X-Request-ID"] = g.request_id

    if hasattr(g, "trace_id"):
        response.headers["X-Trace-ID"] = g.trace_id

    return response


def get_correlation_context() -> dict[str, str | None]:
    """Get current correlation context for logging"""
    return {
        "request_id": get_request_id(),
        "trace_id": get_trace_id(),
        "user_id": get_user_id() if hasattr(g, "user_id") else None,
    }


__all__ = [
    "setup_correlation_ids",
    "add_correlation_headers",
    "get_correlation_context",
]

