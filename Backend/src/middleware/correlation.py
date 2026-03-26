"""
2026-Compliant Correlation ID Middleware
Adds request_id, trace_id, and correlation headers to all requests
"""

from __future__ import annotations

import re
from uuid import uuid4

from flask import g, has_request_context, request

from ..utils.structured_logging import (
    clear_context,
    get_request_id,
    get_trace_id,
    get_user_id,
    set_request_id,
    set_trace_id,
    set_user_id,
)

_CORRELATION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._:/-]{1,128}$")


def _sanitize_or_generate_correlation_id(value: str | None) -> str:
    """Accept only safe correlation ID characters; otherwise generate a new UUID."""
    candidate = (value or "").strip()
    if candidate and _CORRELATION_ID_PATTERN.fullmatch(candidate):
        return candidate
    return str(uuid4())


def setup_correlation_ids() -> None:
    """
    Setup correlation IDs for request tracking and distributed tracing.

    Checks for X-Request-ID and X-Trace-ID headers, or generates new ones.
    Sets them in Flask g and context variables for logging.
    """
    # Prevent stale context values leaking between requests.
    clear_context()

    # Get or generate request ID
    request_id = _sanitize_or_generate_correlation_id(request.headers.get("X-Request-ID"))

    # Get or generate trace ID (for distributed tracing)
    trace_id = _sanitize_or_generate_correlation_id(request.headers.get("X-Trace-ID"))

    # Set in Flask g for access in routes
    g.request_id = request_id
    g.trace_id = trace_id

    # Set in context variables for structured logging
    set_request_id(request_id)
    set_trace_id(trace_id)

    # Ensure user context is explicitly reset unless auth middleware set it.
    user_id = getattr(g, "user_id", None)
    set_user_id(str(user_id) if user_id else None)


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
    user_id = get_user_id()
    if user_id is None and has_request_context():
        user_id = getattr(g, "user_id", None)

    return {
        "request_id": get_request_id(),
        "trace_id": get_trace_id(),
        "user_id": str(user_id) if user_id else None,
    }


__all__ = [
    "setup_correlation_ids",
    "add_correlation_headers",
    "get_correlation_context",
]

