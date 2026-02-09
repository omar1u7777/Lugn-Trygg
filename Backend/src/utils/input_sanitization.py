"""
Input Sanitization Utilities for Lugn & Trygg
Comprehensive input cleaning and validation to prevent XSS, injection attacks, and data corruption
"""

import logging
import re
from functools import wraps
from typing import Any
from urllib.parse import quote, unquote

import bleach
from flask import g, request

logger = logging.getLogger(__name__)

class InputSanitizer:
    """Comprehensive input sanitization and validation"""

    def __init__(self):
        # XSS prevention patterns
        self.xss_patterns = [
            r'<script[^>]*>.*?</script>',
            r'javascript:',
            r'vbscript:',
            r'on\w+\s*=',
            r'<iframe[^>]*>.*?</iframe>',
            r'<object[^>]*>.*?</object>',
            r'<embed[^>]*>.*?</embed>',
            r'<form[^>]*>.*?</form>',
            r'<input[^>]*>',
            r'<meta[^>]*>',
            r'<link[^>]*>',
        ]

        # SQL injection patterns (additional to Pydantic validation)
        self.sql_injection_patterns = [
            r';\s*(drop|delete|update|insert|alter|create|truncate)\s',
            r'union\s+select',
            r'--',
            r'/\*.*?\*/',
            r'xp_cmdshell',
            r'exec\s*\(',
        ]

        # Path traversal patterns
        self.path_traversal_patterns = [
            r'\.\./',
            r'\.\.\\',
            r'%2e%2e%2f',
            r'%2e%2e%5c',
        ]

        # Bleach configuration for HTML sanitization
        self.bleach_config = {
            'tags': ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
            'attributes': {},
            'strip': True,
            'strip_comments': True,
        }

        # Content type specific sanitizers
        self.content_sanitizers = {
            'text': self._sanitize_text,
            'html': self._sanitize_html,
            'json': self._sanitize_json,
            'url': self._sanitize_url,
            'email': self._sanitize_email,
            'filename': self._sanitize_filename,
            'sql': self._sanitize_sql_identifier,
        }

    def sanitize(self, input_data: Any, content_type: str = 'text',
                max_length: int | None = None) -> Any:
        """
        Main sanitization method

        Args:
            input_data: Data to sanitize
            content_type: Type of content (text, html, json, url, email, filename, sql)
            max_length: Maximum allowed length

        Returns:
            Sanitized data
        """
        if input_data is None:
            return None

        # Convert to string for processing
        if not isinstance(input_data, str):
            input_data = str(input_data)

        # Length validation
        if max_length and len(input_data) > max_length:
            logger.warning(f"Input exceeds max length {max_length}: {len(input_data)}")
            input_data = input_data[:max_length]

        # Get appropriate sanitizer
        sanitizer = self.content_sanitizers.get(content_type, self._sanitize_text)

        try:
            sanitized = sanitizer(input_data)

            # Log sanitization if content changed
            if sanitized != input_data:
                logger.info(f"Input sanitized: {content_type} - {len(input_data)} -> {len(sanitized)} chars")

            return sanitized

        except Exception as e:
            logger.error(f"Sanitization failed for {content_type}: {e}")
            return ""

    def sanitize_dict(self, data: dict[str, Any], field_rules: dict[str, dict] | None = None) -> dict[str, Any]:
        """
        Sanitize dictionary data with field-specific rules

        Args:
            data: Dictionary to sanitize
            field_rules: Rules per field {'field_name': {'type': 'text', 'max_length': 100}}
        """
        sanitized = {}

        for key, value in data.items():
            rules = field_rules.get(key, {}) if field_rules else {}
            content_type = rules.get('type', 'text')
            max_length = rules.get('max_length')

            if isinstance(value, dict):
                sanitized[key] = self.sanitize_dict(value, field_rules)
            elif isinstance(value, list):
                sanitized[key] = [self.sanitize(item, content_type, max_length) for item in value]
            else:
                sanitized[key] = self.sanitize(value, content_type, max_length)

        return sanitized

    # Public convenience methods for direct access

    def sanitize_html(self, html_content: str) -> str:
        """Public method to sanitize HTML content"""
        return self._sanitize_html(html_content)

    def sanitize_email(self, email: str) -> str:
        """Public method to sanitize email address"""
        return self._sanitize_email(email)

    def sanitize_url(self, url: str) -> str:
        """Public method to sanitize URL"""
        return self._sanitize_url(url)

    def validate_phone(self, phone: str) -> bool:
        """Validate phone number format"""
        if not phone:
            return False

        # Remove common formatting characters
        clean_phone = re.sub(r'[\s\-\(\)\.]', '', phone)

        # Check if it's a valid phone number (international format)
        # Accepts formats like: +46701234567, +1234567890, etc.
        phone_pattern = r'^\+?[1-9]\d{1,14}$'

        return bool(re.match(phone_pattern, clean_phone))

    def _sanitize_text(self, text: str) -> str:
        """Sanitize plain text input.

        NOTE: We intentionally do NOT call html.escape() here because the
        escaped entities (&amp; &lt; &quot; etc.) would be permanently stored
        in Firestore and corrupt user content.  XSS protection is achieved by
        stripping dangerous patterns (script tags, event handlers, etc.) and
        removing control characters.
        """
        if not text:
            return text

        # Remove null bytes
        text = text.replace('\x00', '')

        # Remove XSS patterns (script tags, event handlers, etc.)
        for pattern in self.xss_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)

        # Remove control characters except newlines and tabs
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

        return text.strip()

    def _sanitize_html(self, html_content: str) -> str:
        """Sanitize HTML content using Bleach"""
        if not html_content:
            return html_content

        try:
            # Use Bleach for HTML sanitization
            sanitized = bleach.clean(
                html_content,
                tags=self.bleach_config['tags'],
                attributes=self.bleach_config['attributes'],
                strip=self.bleach_config['strip'],
                strip_comments=self.bleach_config['strip_comments']
            )

            # Additional XSS pattern removal
            for pattern in self.xss_patterns:
                sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE | re.DOTALL)

            return sanitized

        except Exception as e:
            logger.error(f"HTML sanitization failed: {e}")
            return self._sanitize_text(html_content)  # Fallback to text sanitization

    def _sanitize_json(self, json_str: str) -> str:
        """Sanitize JSON-like strings"""
        if not json_str:
            return json_str

        # Basic text sanitization first
        json_str = self._sanitize_text(json_str)

        # Remove potentially dangerous JSON constructs
        dangerous_patterns = [
            r'\\u[0-9a-fA-F]{4}',  # Unicode escapes
            r'\\x[0-9a-fA-F]{2}',  # Hex escapes
        ]

        for pattern in dangerous_patterns:
            json_str = re.sub(pattern, '', json_str)

        return json_str

    def _sanitize_url(self, url: str) -> str:
        """Sanitize URL input"""
        if not url:
            return url

        # URL decode to check for encoded attacks
        decoded = unquote(url)

        # Check for path traversal
        for pattern in self.path_traversal_patterns:
            if re.search(pattern, decoded, re.IGNORECASE):
                logger.warning(f"Path traversal attempt detected: {url}")
                return ""  # Reject suspicious URLs

        # URL encode dangerous characters
        url = quote(url, safe=':/?#[]@!$&\'()*+,;=-._~')

        # Remove javascript: and data: schemes for non-images
        if re.match(r'^(javascript|vbscript|data):', url, re.IGNORECASE):
            logger.warning(f"Dangerous URL scheme detected: {url}")
            return ""

        return url

    def _sanitize_email(self, email: str) -> str:
        """Sanitize email addresses"""
        if not email:
            return email

        # Basic email pattern validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        if not re.match(email_pattern, email):
            logger.warning(f"Invalid email format: {email}")
            return ""

        # Remove potentially dangerous characters
        email = re.sub(r'[<>]', '', email)

        return email.lower().strip()

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filenames"""
        if not filename:
            return filename

        # Remove path separators
        filename = re.sub(r'[\/\\]', '', filename)

        # Remove dangerous characters
        filename = re.sub(r'[<>:"|?*]', '', filename)

        # Remove control characters
        filename = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', filename)

        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            if ext:
                filename = name[:250] + '.' + ext[:4]
            else:
                filename = filename[:255]

        return filename

    def _sanitize_sql_identifier(self, identifier: str) -> str:
        """Sanitize SQL identifiers (table names, column names)"""
        if not identifier:
            return identifier

        # Only allow alphanumeric, underscore, and dollar sign
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_$]*$', identifier):
            logger.warning(f"Invalid SQL identifier: {identifier}")
            return ""

        # Check for SQL injection patterns
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, identifier, re.IGNORECASE):
                logger.warning(f"SQL injection pattern detected in identifier: {identifier}")
                return ""

        return identifier

    def validate_input(self, input_data: Any, rules: dict[str, Any]) -> dict[str, Any]:
        """
        Validate input against rules

        Args:
            input_data: Data to validate
            rules: Validation rules

        Returns:
            Dict with 'valid': bool and 'errors': list
        """
        errors = []

        # Type validation
        expected_type = rules.get('type')
        if expected_type and not isinstance(input_data, expected_type):
            errors.append(f"Expected type {expected_type.__name__}, got {type(input_data).__name__}")

        # Length validation
        if isinstance(input_data, (str, list, dict)):
            min_length = rules.get('min_length')
            max_length = rules.get('max_length')

            if min_length and len(input_data) < min_length:
                errors.append(f"Minimum length {min_length}, got {len(input_data)}")

            if max_length and len(input_data) > max_length:
                errors.append(f"Maximum length {max_length}, got {len(input_data)}")

        # Pattern validation
        pattern = rules.get('pattern')
        if pattern and isinstance(input_data, str):
            if not re.match(pattern, input_data):
                errors.append("Input does not match required pattern")

        # Range validation for numbers
        if isinstance(input_data, (int, float)):
            min_value = rules.get('min_value')
            max_value = rules.get('max_value')

            if min_value is not None and input_data < min_value:
                errors.append(f"Value must be >= {min_value}")

            if max_value is not None and input_data > max_value:
                errors.append(f"Value must be <= {max_value}")

        # Custom validation function
        custom_validator = rules.get('validator')
        if custom_validator and callable(custom_validator):
            try:
                if not custom_validator(input_data):
                    errors.append("Custom validation failed")
            except Exception as e:
                errors.append(f"Custom validation error: {e}")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'sanitized_value': input_data
        }

    def sanitize_request_data(self, content_type_overrides: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
        """
        Sanitize all request data (JSON, form, args)

        Args:
            content_type_overrides: Override content types for specific fields {'field': {'type': 'text', 'max_length': 100}}
        """
        sanitized: dict[str, Any] = {}

        # Sanitize JSON data
        if request.is_json and request.get_json():
            json_data = request.get_json()
            sanitized['json'] = self.sanitize_dict(json_data, content_type_overrides)

        # Sanitize form data
        if request.form:
            form_data = dict(request.form)
            sanitized['form'] = self.sanitize_dict(form_data, content_type_overrides)

        # Sanitize URL args
        if request.args:
            args_data = dict(request.args)
            sanitized['args'] = self.sanitize_dict(args_data, {'*': {'type': 'url'}})

        return sanitized

# Global sanitizer instance
input_sanitizer = InputSanitizer()

# Flask middleware
def sanitize_request():
    """Function to automatically sanitize request data - callable from before_request"""
    try:
        # Sanitize request data
        sanitized_data = input_sanitizer.sanitize_request_data()

        # Store sanitized data in request context
        g.sanitized_data = sanitized_data

        # Log sanitization
        logger.debug(f"Request data sanitized for {request.endpoint}")

    except Exception as e:
        logger.error(f"Request sanitization failed: {e}")
        g.sanitized_data = {}

def sanitize_request_decorator(f):
    """Decorator to automatically sanitize request data"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Sanitize request data
            sanitized_data = input_sanitizer.sanitize_request_data()

            # Store sanitized data in request context
            g.sanitized_data = sanitized_data

            # Log sanitization
            logger.debug(f"Request data sanitized for {request.endpoint}")

        except Exception as e:
            logger.error(f"Request sanitization failed: {e}")
            g.sanitized_data = {}

        return f(*args, **kwargs)

    return decorated_function

def sanitize_input(content_type: str = 'text', max_length: int | None = None):
    """Decorator to sanitize specific function parameters"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Sanitize positional arguments
            sanitized_args = []
            for arg in args:
                if isinstance(arg, str):
                    sanitized_args.append(input_sanitizer.sanitize(arg, content_type, max_length))
                else:
                    sanitized_args.append(arg)

            # Sanitize keyword arguments
            sanitized_kwargs = {}
            for key, value in kwargs.items():
                if isinstance(value, str):
                    sanitized_kwargs[key] = input_sanitizer.sanitize(value, content_type, max_length)
                else:
                    sanitized_kwargs[key] = value

            return f(*sanitized_args, **sanitized_kwargs)

        return decorated_function

    return decorator

def validate_and_sanitize(rules: dict[str, dict]):
    """Decorator to validate and sanitize function parameters"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get parameter names
            import inspect
            sig = inspect.signature(f)
            param_names = list(sig.parameters.keys())

            # Map args to parameter names
            args_dict = dict(zip(param_names, args, strict=False))
            args_dict.update(kwargs)

            # Validate and sanitize
            validated_data = {}
            validation_errors = []

            for param_name, value in args_dict.items():
                if param_name in rules:
                    rule = rules[param_name]
                    validation_result = input_sanitizer.validate_input(value, rule)

                    if not validation_result['valid']:
                        validation_errors.extend(validation_result['errors'])
                    else:
                        validated_data[param_name] = validation_result['sanitized_value']
                else:
                    validated_data[param_name] = value

            if validation_errors:
                from flask import jsonify
                return jsonify({
                    'error': 'Validation failed',
                    'details': validation_errors
                }), 400

            # Call function with validated data
            return f(**validated_data)

        return decorated_function

    return decorator

# Utility functions
def sanitize_text(text: str, max_length: int | None = None) -> str:
    """Sanitize plain text"""
    return input_sanitizer.sanitize(text, 'text', max_length)

def sanitize_html(html_content: str) -> str:
    """Sanitize HTML content"""
    return input_sanitizer.sanitize(html_content, 'html')

def sanitize_email(email: str) -> str:
    """Sanitize email address"""
    return input_sanitizer.sanitize(email, 'email')

def sanitize_url(url: str) -> str:
    """Sanitize URL"""
    return input_sanitizer.sanitize(url, 'url')

def sanitize_filename(filename: str) -> str:
    """Sanitize filename"""
    return input_sanitizer.sanitize(filename, 'filename')

__all__ = [
    'InputSanitizer',
    'input_sanitizer',
    'sanitize_request',
    'sanitize_request_decorator',
    'sanitize_input',
    'validate_and_sanitize',
    'sanitize_text',
    'sanitize_html',
    'sanitize_email',
    'sanitize_url',
    'sanitize_filename',
    'validate_mood_input'
]

def validate_mood_input(mood_data: dict[str, Any]) -> bool:
    """Validate mood input data"""
    if not isinstance(mood_data, dict):
        return False

    # Required fields
    required_fields = ['mood_text', 'sentiment_score']
    for field in required_fields:
        if field not in mood_data:
            return False

    # Validate mood_text
    mood_text = mood_data.get('mood_text', '')
    if not isinstance(mood_text, str) or len(mood_text.strip()) == 0:
        return False

    # Validate sentiment_score (should be between -1 and 1)
    sentiment_score = mood_data.get('sentiment_score')
    if not isinstance(sentiment_score, (int, float)) or not (-1 <= sentiment_score <= 1):
        return False

    # Validate timestamp if provided
    timestamp = mood_data.get('timestamp')
    if timestamp is not None:
        if not isinstance(timestamp, str):
            return False
        # Basic ISO format check
        import re
        if not re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', timestamp):
            return False

    return True
