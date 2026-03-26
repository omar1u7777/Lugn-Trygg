"""
Pydantic validation middleware for Flask
Automatic request/response validation with error handling
"""

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import Response, g, jsonify, make_response, request
from pydantic import ValidationError

logger = logging.getLogger(__name__)

class ValidationMiddleware:
    """Middleware for automatic Pydantic validation"""

    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        """Initialize middleware with Flask app"""
        self.app = app

        # Register error handlers
        app.register_error_handler(ValidationError, self.handle_validation_error)

    def handle_validation_error(self, error: ValidationError):
        """Handle Pydantic validation errors"""
        logger.warning("Valideringsfel i request: %d fel", len(error.errors()))

        # Format validation errors for client
        errors = {}
        for err in error.errors():
            field_path = '.'.join(str(x) for x in err['loc'])
            errors[field_path] = err['msg']

        response = {
            'success': False,
            'error': 'Validering misslyckades',
            'error_code': 'VALIDATION_ERROR',
            'details': errors,
            'message': 'Ett eller flera falt kunde inte valideras'
        }

        return jsonify(response), 400

def validate_request(schema_class: type, source: str = 'json') -> Callable:
    """
    Decorator to validate request data with Pydantic schema

    Args:
        schema_class: Pydantic model class
        source: Data source ('json', 'form', 'args', 'files')
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args: Any, **kwargs: Any):
            # Short-circuit preflight; global CORS middleware should set headers.
            if request.method == 'OPTIONS':
                return make_response('', 204)

            try:
                # Get data based on source
                if source == 'json':
                    try:
                        data = request.get_json(silent=False)
                        if data is None:
                            # Handle empty request body
                            data = {}
                    except Exception:
                        logger.warning("JSON-parsning misslyckades for %s", request.path)
                        response = {
                            'success': False,
                            'error': 'Ogiltig JSON',
                            'error_code': 'JSON_PARSE_ERROR',
                            'message': 'Request body innehaller ogiltig JSON'
                        }
                        return jsonify(response), 400
                elif source == 'form':
                    data = request.form.to_dict()
                elif source == 'args':
                    data = request.args.to_dict()
                elif source == 'files':
                    data: dict[str, Any] = dict(request.files.to_dict())
                else:
                    logger.warning("Okand request-kalla for validering: %s", source)
                    return jsonify({
                        'success': False,
                        'error': 'Ogiltig valideringskonfiguration',
                        'error_code': 'VALIDATION_SOURCE_ERROR',
                        'message': 'Intern konfigurationsavvikelse upptacktes'
                    }), 500

                # Handle file uploads with form data
                if source == 'files' and request.form:
                    data.update(request.form.to_dict())

                # Validate with Pydantic
                if hasattr(schema_class, 'model_validate'):
                    # Pydantic v2
                    validated_data = schema_class.model_validate(data)
                else:
                    # Pydantic v1
                    validated_data = schema_class(**data)

                # Store validated data in flask g object
                g.validated_data = validated_data

                # Add validated data to kwargs
                kwargs['validated_data'] = validated_data

                return f(*args, **kwargs)

            except ValidationError:
                logger.warning("Request-validering misslyckades for %s", request.path)
                # Re-raise to be handled by error handler
                raise
            except Exception:
                logger.exception("Ovantat valideringsfel i request for %s", request.path)
                response = {
                    'success': False,
                    'error': 'Valideringsfel',
                    'error_code': 'VALIDATION_ERROR',
                    'message': 'Kunde inte validera inkommande data'
                }
                return jsonify(response), 400

        return decorated_function
    return decorator

def validate_response(schema_class: type) -> Callable:
    """
    Decorator to validate response data with Pydantic schema

    Args:
        schema_class: Pydantic model class for response
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args: Any, **kwargs: Any):
            result = f(*args, **kwargs)

            if isinstance(result, Response):
                return result

            # If result is already a response tuple, return as-is
            if isinstance(result, tuple):
                if len(result) == 2:
                    response_data, status_code = result
                    response_headers = None
                elif len(result) == 3:
                    response_data, status_code, response_headers = result
                else:
                    return result
            else:
                response_data, status_code, response_headers = result, 200, None

            try:
                # Validate response data
                if isinstance(response_data, dict):
                    if hasattr(schema_class, 'model_validate'):
                        # Pydantic v2
                        validated_response = schema_class.model_validate(response_data)
                    else:
                        # Pydantic v1
                        validated_response = schema_class(**response_data)

                    # Convert back to dict for JSON response
                    response_data = validated_response.dict() if hasattr(validated_response, 'dict') else validated_response.model_dump()

                if response_headers is not None:
                    return response_data, status_code, response_headers
                return response_data, status_code

            except ValidationError:
                logger.error("Responsvalidering misslyckades for endpoint %s", request.path)
                error_response = {
                    'success': False,
                    'error': 'Responsvalideringsfel',
                    'error_code': 'RESPONSE_VALIDATION_ERROR',
                    'message': 'Serversvaret kunde inte valideras'
                }
                return jsonify(error_response), 500
            except Exception:
                logger.exception("Ovantat fel i responsvalidering for %s", request.path)
                return result

        return decorated_function
    return decorator

def validate_query_params(schema_class: type) -> Callable:
    """
    Decorator to validate query parameters with Pydantic schema

    Args:
        schema_class: Pydantic model class for query params
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args: Any, **kwargs: Any):
            try:
                # Get query parameters
                query_data: dict[str, Any] = dict(request.args.to_dict())

                # Convert string values to appropriate types
                for key, value in list(query_data.items()):
                    # Only process string values
                    if not isinstance(value, str):
                        continue

                    lower_value = value.lower()
                    if lower_value in ('true', 'false'):
                        query_data[key] = lower_value == 'true'
                        continue

                    try:
                        if '.' in value:
                            query_data[key] = float(value)
                        else:
                            query_data[key] = int(value)
                    except ValueError:
                        # Keep original string if it is not numeric.
                        continue

                # Validate with Pydantic
                if hasattr(schema_class, 'model_validate'):
                    validated_params = schema_class.model_validate(query_data)
                else:
                    validated_params = schema_class(**query_data)

                # Store in flask g
                g.validated_query = validated_params
                kwargs['query_params'] = validated_params

                return f(*args, **kwargs)

            except ValidationError:
                logger.warning("Validering av query-parametrar misslyckades for %s", request.path)
                raise

        return decorated_function
    return decorator

def sanitize_request_data() -> Callable:
    """
    Decorator to automatically sanitize string inputs in request data
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args: Any, **kwargs: Any):
            try:
                if request.is_json:
                    json_data = request.get_json(silent=True)
                    if json_data:
                        # Import here to avoid circular imports
                        from src.schemas.base import sanitize_input
                        sanitized_data = sanitize_input(json_data)
                        # Replace request data (this is a bit of a hack but works)
                        request._cached_json = (sanitized_data, sanitized_data)

                elif request.form:
                    # Sanitize form data
                    from src.schemas.base import sanitize_input
                    sanitized_form = sanitize_input(request.form.to_dict())
                    # Note: Flask form data is immutable, so we can't modify it directly
                    # Instead, store sanitized data in g
                    g.sanitized_form = sanitized_form

                return f(*args, **kwargs)

            except Exception:
                logger.warning("Request-sanering misslyckades for %s", request.path)
                # Continue with original request if sanitization fails
                return f(*args, **kwargs)

        return decorated_function
    return decorator

# Utility functions
def get_validated_data() -> Any | None:
    """Get validated request data from flask g object"""
    return getattr(g, 'validated_data', None)

def get_validated_query() -> Any | None:
    """Get validated query parameters from flask g object"""
    return getattr(g, 'validated_query', None)

def get_sanitized_form() -> dict[str, Any] | None:
    """Get sanitized form data from flask g object"""
    return getattr(g, 'sanitized_form', None)

# Create middleware instance
validation_middleware = ValidationMiddleware()

def init_validation_middleware(app):
    """Initialize validation middleware with Flask app"""
    middleware = ValidationMiddleware(app)
    return middleware

__all__ = [
    'ValidationMiddleware',
    'validation_middleware',
    'init_validation_middleware',
    'validate_request',
    'validate_response',
    'validate_query_params',
    'sanitize_request_data',
    'get_validated_data',
    'get_validated_query',
    'get_sanitized_form'
]
