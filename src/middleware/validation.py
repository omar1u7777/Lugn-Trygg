"""
Simple validation middleware for Flask
Basic request validation without external dependencies
"""

from functools import wraps
from flask import request, jsonify, g
from typing import Type, Optional, Dict, Any, Callable
import logging
import re

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom validation error"""
    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(message)

class ValidationMiddleware:
    """Middleware for basic validation"""

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
        """Handle validation errors"""
        logger.warning(f"Validation error: {error}")

        response = {
            'success': False,
            'error': 'Validation failed',
            'error_code': 'VALIDATION_ERROR',
            'message': str(error.message),
            'field': error.field
        }

        return jsonify(response), 400

def validate_request(required_fields: list = None, source: str = 'json') -> Callable:
    """
    Simple decorator to validate request data has required fields

    Args:
        required_fields: List of required field names
        source: Data source ('json', 'form', 'args')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get data based on source
                if source == 'json':
                    data = request.get_json(silent=True) or {}
                elif source == 'form':
                    data = request.form.to_dict()
                elif source == 'args':
                    data = request.args.to_dict()
                else:
                    data = {}

                # Check required fields
                if required_fields:
                    missing_fields = []
                    for field in required_fields:
                        if field not in data or data[field] is None or str(data[field]).strip() == '':
                            missing_fields.append(field)

                    if missing_fields:
                        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

                # Store validated data in flask g object
                g.validated_data = data

                # Add validated data to kwargs
                kwargs['validated_data'] = data

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

def validate_response() -> Callable:
    """
    Simple decorator that ensures response is valid JSON
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
                # Basic validation - ensure it's a dict or can be JSON serialized
                if not isinstance(response_data, (dict, list, str, int, float, bool, type(None))):
                    logger.warning(f"Response data is not JSON serializable: {type(response_data)}")
                    error_response = {
                        'success': False,
                        'error': 'Response format error',
                        'message': 'Server returned invalid response format'
                    }
                    return jsonify(error_response), 500

                return response_data, status_code

            except Exception as e:
                logger.error(f"Response validation error: {e}")
                error_response = {
                    'success': False,
                    'error': 'Response validation error',
                    'message': 'Server response failed validation'
                }
                return jsonify(error_response), 500

        return decorated_function
    return decorator

def validate_query_params() -> Callable:
    """
    Simple decorator for basic query parameter validation
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get query parameters
                query_data = request.args.to_dict()

                # Basic sanitization - remove any potentially dangerous characters
                for key, value in query_data.items():
                    if not isinstance(value, str):
                        continue
                    # Remove any script tags or other potentially dangerous content
                    query_data[key] = re.sub(r'<[^>]+>', '', str(value))

                # Store in flask g
                g.validated_query = query_data
                kwargs['query_params'] = query_data

                return f(*args, **kwargs)

            except Exception as e:
                logger.warning(f"Query parameter validation failed: {e}")
                # Continue without validation if it fails
                return f(*args, **kwargs)

        return decorated_function
    return decorator

def sanitize_request_data() -> Callable:
    """
    Simple decorator to sanitize basic XSS and injection attempts
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if request.is_json:
                    json_data = request.get_json(silent=True)
                    if json_data and isinstance(json_data, dict):
                        # Basic sanitization - remove script tags
                        def sanitize_dict(data):
                            if isinstance(data, dict):
                                return {k: sanitize_dict(v) for k, v in data.items()}
                            elif isinstance(data, list):
                                return [sanitize_dict(item) for item in data]
                            elif isinstance(data, str):
                                # Remove script tags and other dangerous content
                                return re.sub(r'<[^>]+>', '', data)
                            else:
                                return data

                        sanitized_data = sanitize_dict(json_data)
                        # Store sanitized data in g
                        g.sanitized_json = sanitized_data

                elif request.form:
                    # Basic form sanitization
                    sanitized_form = {}
                    for key, value in request.form.items():
                        if isinstance(value, str):
                            sanitized_form[key] = re.sub(r'<[^>]+>', '', value)
                        else:
                            sanitized_form[key] = value
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