"""
Standardized API Response Utilities for Lugn & Trygg Backend

This module provides consistent response formatting across all API endpoints.
All responses follow a standardized JSON structure for better frontend integration.
"""

import logging
from typing import Any

from flask import jsonify

logger = logging.getLogger(__name__)


class APIResponse:
    """Standardized API response class for consistent formatting."""

    @staticmethod
    def success(
        data: Any = None,
        message: str = "Operation completed successfully",
        status_code: int = 200,
        meta: dict[str, Any] | None = None
    ) -> tuple:
        """
        Create a standardized success response.

        Args:
            data: The main response data (can be dict, list, or any serializable object)
            message: Human-readable success message
            status_code: HTTP status code (default: 200)
            meta: Optional metadata (pagination info, timestamps, etc.)

        Returns:
            Tuple of (jsonified response, status_code)
        """
        response = {
            "success": True,
            "message": message,
            "data": data
        }

        if meta:
            response["meta"] = meta

        logger.debug(f"API Success Response: {status_code} - {message}")
        return jsonify(response), status_code

    @staticmethod
    def error(
        message: str = "An error occurred",
        error_code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Any | None = None
    ) -> tuple:
        """
        Create a standardized error response.

        Args:
            message: Human-readable error message
            error_code: Machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
            status_code: HTTP status code (default: 500)
            details: Optional additional error details

        Returns:
            Tuple of (jsonified response, status_code)
        """
        response = {
            "success": False,
            "error": error_code,
            "message": message
        }

        if details:
            response["details"] = details

        logger.warning(f"API Error Response: {status_code} - {error_code} - {message}")
        return jsonify(response), status_code

    @staticmethod
    def created(
        data: Any = None,
        message: str = "Resource created successfully",
        meta: dict[str, Any] | None = None
    ) -> tuple:
        """Create a standardized 201 Created response."""
        return APIResponse.success(data, message, 201, meta)

    @staticmethod
    def no_content(message: str = "Operation completed") -> tuple:
        """Create a standardized 204 No Content response."""
        # For 204 responses, we return empty body but still log the message
        logger.debug(f"API No Content Response: {message}")
        return '', 204

    @staticmethod
    def bad_request(
        message: str = "Invalid request",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 400 Bad Request response."""
        return APIResponse.error(message, "BAD_REQUEST", 400, details)

    @staticmethod
    def unauthorized(
        message: str = "Authentication required",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 401 Unauthorized response."""
        return APIResponse.error(message, "UNAUTHORIZED", 401, details)

    @staticmethod
    def forbidden(
        message: str = "Access denied",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 403 Forbidden response."""
        return APIResponse.error(message, "FORBIDDEN", 403, details)

    @staticmethod
    def not_found(
        message: str = "Resource not found",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 404 Not Found response."""
        return APIResponse.error(message, "NOT_FOUND", 404, details)

    @staticmethod
    def conflict(
        message: str = "Resource conflict",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 409 Conflict response."""
        return APIResponse.error(message, "CONFLICT", 409, details)

    @staticmethod
    def unprocessable_entity(
        message: str = "Validation failed",
        details: Any | None = None
    ) -> tuple:
        """Create a standardized 422 Unprocessable Entity response."""
        return APIResponse.error(message, "VALIDATION_ERROR", 422, details)


# Convenience functions for backward compatibility and ease of use
def success_response(data=None, message="Operation completed successfully", status_code=200, meta=None):
    """Convenience function for success responses."""
    return APIResponse.success(data, message, status_code, meta)


def error_response(message="An error occurred", error_code="INTERNAL_ERROR", status_code=500, details=None):
    """Convenience function for error responses."""
    return APIResponse.error(message, error_code, status_code, details)


def created_response(data=None, message="Resource created successfully", meta=None):
    """Convenience function for created responses."""
    return APIResponse.created(data, message, meta)


def validation_error_response(message="Validation failed", details=None):
    """Convenience function for validation errors."""
    return APIResponse.unprocessable_entity(message, details)


# Common error codes for consistency
ERROR_CODES = {
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "AUTHENTICATION_ERROR": "AUTHENTICATION_ERROR",
    "AUTHORIZATION_ERROR": "AUTHORIZATION_ERROR",
    "NOT_FOUND": "NOT_FOUND",
    "CONFLICT": "CONFLICT",
    "INTERNAL_ERROR": "INTERNAL_ERROR",
    "SERVICE_UNAVAILABLE": "SERVICE_UNAVAILABLE",
    "RATE_LIMITED": "RATE_LIMITED",
    "BAD_REQUEST": "BAD_REQUEST"
}
