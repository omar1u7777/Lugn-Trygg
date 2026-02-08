"""
Standardized Error Handling Utilities for Services

This module provides consistent error handling patterns across all services.
All services should use these utilities for uniform error handling and logging.
"""

import logging
from typing import Any, Callable, Optional, Tuple, TypeVar, Coroutine, cast
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ServiceError(Exception):
    """Base exception for service-level errors"""

    def __init__(self, message: str, error_code: str = "SERVICE_ERROR", details: Optional[Any] = None):
        self.message = message
        self.error_code = error_code
        self.details = details
        super().__init__(message)


class ValidationError(ServiceError):
    """Exception for validation errors"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "VALIDATION_ERROR", details)


class AuthenticationError(ServiceError):
    """Exception for authentication errors"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "AUTHENTICATION_ERROR", details)


class AuthorizationError(ServiceError):
    """Exception for authorization errors"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "AUTHORIZATION_ERROR", details)


class NotFoundError(ServiceError):
    """Exception for resource not found errors"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "NOT_FOUND", details)


def handle_service_errors(func: Callable[..., Any]) -> Callable[..., Tuple[Any, Optional[str]]]:
    """
    Decorator for service methods to provide standardized error handling.

    Converts exceptions to (result, error_message) tuples for consistent error handling.
    All service methods should return Tuple[result, error_message] where error_message is None on success.

    Args:
        func: The service method to wrap

    Returns:
        Wrapped function that returns (result, error_message)
    """
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Tuple[Any, Optional[str]]:
        try:
            result = func(*args, **kwargs)
            return result, None
        except ServiceError as e:
            logger.warning(f"Service error in {func.__name__}: {e.error_code} - {e.message}")
            return None, e.message
        except Exception as e:
            logger.exception(f"Unexpected error in {func.__name__}: {str(e)}")
            return None, "Ett internt fel uppstod. Försök igen senare."

    return wrapper


def handle_async_service_errors(func: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., Coroutine[Any, Any, T]]:
    """
    Decorator for async service methods to provide standardized error handling.

    Re-raises ServiceError exceptions as-is, logs other exceptions and raises ServiceError.

    Args:
        func: The async service method to wrap

    Returns:
        Wrapped async function
    """
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> T:
        try:
            return await func(*args, **kwargs)
        except ServiceError:
            raise  # Re-raise service errors as-is
        except Exception as e:
            logger.exception(f"Unexpected error in async {func.__name__}: {str(e)}")
            raise ServiceError("Ett internt fel uppstod. Försök igen senare.", "INTERNAL_ERROR", str(e))

    return cast(Callable[..., Coroutine[Any, Any, T]], wrapper)


def validate_required_fields(data: dict, required_fields: list) -> None:
    """
    Validate that required fields are present in data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Raises:
        ValidationError: If any required fields are missing
    """
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        raise ValidationError(f"Required fields are missing: {', '.join(missing_fields)}")


def validate_field_types(data: dict, field_types: dict) -> None:
    """
    Validate field types in data dictionary.

    Args:
        data: Dictionary to validate
        field_types: Dictionary mapping field names to expected types

    Raises:
        ValidationError: If any field has incorrect type
    """
    for field, expected_type in field_types.items():
        if field in data and data[field] is not None:
            if not isinstance(data[field], expected_type):
                raise ValidationError(f"Field '{field}' must be of type {expected_type.__name__}")


def safe_get(data: dict, key: str, default: Any = None) -> Any:
    """
    Safely get a value from a dictionary with logging for missing keys.

    Args:
        data: Dictionary to get value from
        key: Key to retrieve
        default: Default value if key is missing

    Returns:
        Value from dictionary or default
    """
    if key not in data:
        logger.debug(f"Key '{key}' not found in data, using default: {default}")
        return default
    return data[key]


# Common error messages for consistency
ERROR_MESSAGES = {
    "USER_NOT_FOUND": "Användaren kunde inte hittas",
    "INVALID_CREDENTIALS": "Ogiltiga inloggningsuppgifter",
    "ACCOUNT_LOCKED": "Kontot är tillfälligt låst på grund av för många misslyckade inloggningsförsök",
    "TOKEN_EXPIRED": "Inloggningstoken har gått ut",
    "TOKEN_INVALID": "Ogiltig inloggningstoken",
    "INSUFFICIENT_PERMISSIONS": "Otillräckliga behörigheter",
    "RESOURCE_NOT_FOUND": "Resursen kunde inte hittas",
    "VALIDATION_FAILED": "Validering misslyckades",
    "SERVICE_UNAVAILABLE": "Tjänsten är tillfälligt otillgänglig",
    "RATE_LIMIT_EXCEEDED": "För många förfrågningar, försök igen senare",
    "DUPLICATE_RESOURCE": "Resursen finns redan",
    "INVALID_REQUEST": "Ogiltig förfrågan",
    "INTERNAL_ERROR": "Ett internt fel uppstod"
}