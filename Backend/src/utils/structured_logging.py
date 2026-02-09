"""
2026-Compliant Structured Logging with JSON output
Provides correlation IDs, distributed tracing, and structured logging
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

# Context variables for correlation IDs (thread-safe)
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging (2026 standard)"""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add correlation IDs if available
        request_id = request_id_var.get()
        trace_id = trace_id_var.get()
        user_id = user_id_var.get()

        if request_id:
            log_data["request_id"] = request_id
        if trace_id:
            log_data["trace_id"] = trace_id
        if user_id:
            log_data["user_id"] = user_id

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields from record
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)

        # Add context data if present
        if hasattr(record, "context"):
            log_data["context"] = record.context

        return json.dumps(log_data, ensure_ascii=False)


class StructuredLogger:
    """Enhanced logger with structured logging support"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._setup_logger()

    def _setup_logger(self):
        """Setup logger with JSON formatting if not already configured"""
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(JSONFormatter())
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
            self.logger.propagate = False

    def _get_context(self) -> dict[str, Any]:
        """Get current context (request_id, trace_id, user_id)"""
        context: dict[str, Any] = {}

        request_id = request_id_var.get()
        trace_id = trace_id_var.get()
        user_id = user_id_var.get()

        if request_id:
            context["request_id"] = request_id
        if trace_id:
            context["trace_id"] = trace_id
        if user_id:
            context["user_id"] = user_id

        return context

    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message with structured data"""
        extra = kwargs.pop("extra", {})
        extra["extra_fields"] = kwargs
        extra["context"] = self._get_context()
        self.logger.info(message, extra=extra)

    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message with structured data"""
        extra = kwargs.pop("extra", {})
        extra["extra_fields"] = kwargs
        extra["context"] = self._get_context()
        self.logger.warning(message, extra=extra)

    def error(self, message: str, exc_info: bool = True, **kwargs: Any) -> None:
        """Log error message with structured data"""
        extra = kwargs.pop("extra", {})
        extra["extra_fields"] = kwargs
        extra["context"] = self._get_context()
        self.logger.error(message, exc_info=exc_info, extra=extra)

    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message with structured data"""
        extra = kwargs.pop("extra", {})
        extra["extra_fields"] = kwargs
        extra["context"] = self._get_context()
        self.logger.debug(message, extra=extra)

    def critical(self, message: str, exc_info: bool = True, **kwargs: Any) -> None:
        """Log critical message with structured data"""
        extra = kwargs.pop("extra", {})
        extra["extra_fields"] = kwargs
        extra["context"] = self._get_context()
        self.logger.critical(message, exc_info=exc_info, extra=extra)


def get_logger(name: str) -> StructuredLogger:
    """Get structured logger instance"""
    return StructuredLogger(name)


def set_request_id(request_id: str | None = None) -> str:
    """Set request ID for correlation"""
    if request_id is None:
        request_id = str(uuid4())
    request_id_var.set(request_id)
    return request_id


def set_trace_id(trace_id: str | None = None) -> str:
    """Set trace ID for distributed tracing"""
    if trace_id is None:
        trace_id = str(uuid4())
    trace_id_var.set(trace_id)
    return trace_id


def set_user_id(user_id: str | None) -> None:
    """Set user ID for logging context"""
    user_id_var.set(user_id)


def get_request_id() -> str | None:
    """Get current request ID"""
    return request_id_var.get()


def get_trace_id() -> str | None:
    """Get current trace ID"""
    return trace_id_var.get()


def get_user_id() -> str | None:
    """Get current user ID"""
    return user_id_var.get()


def clear_context() -> None:
    """Clear all context variables"""
    request_id_var.set(None)
    trace_id_var.set(None)
    user_id_var.set(None)


__all__ = [
    "StructuredLogger",
    "get_logger",
    "set_request_id",
    "set_trace_id",
    "set_user_id",
    "get_request_id",
    "get_trace_id",
    "get_user_id",
    "clear_context",
    "JSONFormatter",
]

