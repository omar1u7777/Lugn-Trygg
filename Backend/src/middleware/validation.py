"""
Pydantic validation middleware for Flask
Automatic request/response validation with error handling
"""

from functools import wraps
from flask import request, jsonify, g
from pydantic import ValidationError
from typing import Type, Optional, Dict, Any, Callable
import logging

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
        logger.warning(f"Validation error: {error}")

        # Format validation errors for client
        errors = {}
        for err in error.errors():
            field_path = '.'.join(str(x) for x in err['loc'])
            errors[field_path] = err['msg']

        response = {
            'success': False,
            'error': 'Validation failed',
            'error_code': 'VALIDATION_ERROR',
            'details': errors,
            'message': 'One or more fields failed validation'
        }

        return jsonify(response), 400

def validate_request(schema_class: Type, source: str = 'json') -> Callable:
    """
    Decorator to validate request data with Pydantic schema

    Args:
        schema_class: Pydantic model class
        source: Data source ('json', 'form', 'args', 'files')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # CRITICAL FIX: Return 204 with proper CORS headers for OPTIONS preflight requests
            # Don't call the decorated function as it may require validated_data argument
            if request.method == 'OPTIONS':
                from flask import Response
                response = Response('', status=204)
                origin = request.headers.get('Origin', '')
                # Allow all localhost and common origins for preflight
                if origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:') or origin.startswith('http://192.168.'):
                    response.headers['Access-Control-Allow-Origin'] = origin
                    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
                    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, X-CSRFToken, x-csrftoken, x-csrf-token'
                    response.headers['Access-Control-Allow-Credentials'] = 'true'
                    response.headers['Access-Control-Max-Age'] = '86400'
                return response
            
            try:
                # Get data based on source
                if source == 'json':
                    try:
                        data = request.get_json()
                        if data is None:
                            # Handle empty request body
                            data = {}
                    except Exception as json_error:
                        logger.warning(f"JSON parsing failed: {json_error}")
                        response = {
                            'success': False,
                            'error': 'Invalid JSON',
                            'error_code': 'JSON_PARSE_ERROR',
                            'message': 'Request body contains invalid JSON'
                        }
                        return jsonify(response), 400
                elif source == 'form':
                    data = request.form.to_dict()
                elif source == 'args':
                    data = request.args.to_dict()
                elif source == 'files':
                    data = request.files.to_dict()
                else:
                    data = {}

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

            except ValidationError as e:
                logger.warning(f"Request validation failed: {e}")
                # Re-raise to be handled by error handler
                raise e
            except Exception as e:
                logger.error(f"Unexpected validation error: {e}")
                response = {
                    'success': False,
                    'error': 'Validation error',
                    'error_code': 'VALIDATION_ERROR',
                    'message': 'Failed to validate request data'
                }
                return jsonify(response), 400

        return decorated_function
    return decorator

def validate_response(schema_class: Type) -> Callable:
    """
    Decorator to validate response data with Pydantic schema

    Args:
        schema_class: Pydantic model class for response
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            result = f(*args, **kwargs)

            # If result is already a response tuple, return as-is
            if isinstance(result, tuple):
                response_data, status_code = result
            else:
                response_data, status_code = result, 200

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

                return response_data, status_code

            except ValidationError as e:
                logger.error(f"Response validation failed: {e}")
                error_response = {
                    'success': False,
                    'error': 'Response validation error',
                    'error_code': 'RESPONSE_VALIDATION_ERROR',
                    'message': 'Server response failed validation'
                }
                return jsonify(error_response), 500
            except Exception as e:
                logger.error(f"Unexpected response validation error: {e}")
                return result

        return decorated_function
    return decorator

def validate_query_params(schema_class: Type) -> Callable:
    """
    Decorator to validate query parameters with Pydantic schema

    Args:
        schema_class: Pydantic model class for query params
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get query parameters
                query_data = request.args.to_dict()

                # Convert string values to appropriate types
                for key, value in query_data.items():
                    # Try to convert to int/float/bool
                    if value.isdigit():
                        query_data[key] = int(value)
                    elif value.replace('.', '').isdigit() and '.' in value:
                        query_data[key] = float(value)
                    elif value.lower() in ('true', 'false'):
                        query_data[key] = value.lower() == 'true'

                # Validate with Pydantic
                if hasattr(schema_class, 'model_validate'):
                    validated_params = schema_class.model_validate(query_data)
                else:
                    validated_params = schema_class(**query_data)

                # Store in flask g
                g.validated_query = validated_params
                kwargs['query_params'] = validated_params

                return f(*args, **kwargs)

            except ValidationError as e:
                logger.warning(f"Query parameter validation failed: {e}")
                raise e

        return decorated_function
    return decorator

def sanitize_request_data() -> Callable:
    """
    Decorator to automatically sanitize string inputs in request data
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if request.is_json:
                    json_data = request.get_json(silent=True)
                    if json_data:
                        # Import here to avoid circular imports
                        from src.schemas.base import sanitize_input
                        sanitized_data = sanitize_input(json_data)
                        # Replace request data (this is a bit of a hack but works)
                        request._cached_json = (sanitized_data, request._cached_json[1] if request._cached_json else None)

                elif request.form:
                    # Sanitize form data
                    from src.schemas.base import sanitize_input
                    sanitized_form = sanitize_input(request.form.to_dict())
                    # Note: Flask form data is immutable, so we can't modify it directly
                    # Instead, store sanitized data in g
                    g.sanitized_form = sanitized_form

                return f(*args, **kwargs)

            except Exception as e:
                logger.warning(f"Request sanitization failed: {e}")
                # Continue with original request if sanitization fails
                return f(*args, **kwargs)

        return decorated_function
    return decorator

# Utility functions
def get_validated_data() -> Optional[Any]:
    """Get validated request data from flask g object"""
    return getattr(g, 'validated_data', None)

def get_validated_query() -> Optional[Any]:
    """Get validated query parameters from flask g object"""
    return getattr(g, 'validated_query', None)

def get_sanitized_form() -> Optional[Dict[str, Any]]:
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