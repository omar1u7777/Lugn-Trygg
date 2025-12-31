"""
Input Validation Service - Comprehensive input validation and sanitization

Provides robust validation for all user inputs including:
- Email validation
- Password strength validation
- SQL injection detection
- XSS prevention
- Data type validation
- Length limits
- Format validation
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, timezone
from email_validator import validate_email, EmailNotValidError

from ..utils.error_handling import handle_service_errors, ValidationError

logger = logging.getLogger(__name__)

class InputValidationService:
    """Comprehensive input validation service"""

    # Common validation patterns
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    PHONE_PATTERN = re.compile(r'^\+?[\d\s\-\(\)]{10,15}$')
    URL_PATTERN = re.compile(r'^https?://[^\s/$.?#].[^\s]*$', re.IGNORECASE)
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r';\s*--',  # Semicolon followed by comment
        r';\s*/\*',  # Semicolon followed by block comment
        r'union\s+select',  # UNION SELECT
        r'/\*.*\*/',  # Block comments
        r'--.*$',  # Line comments
        r';\s*drop',  # DROP statements
        r';\s*delete',  # DELETE statements
        r';\s*update',  # UPDATE statements
        r';\s*insert',  # INSERT statements
        r';\s*alter',  # ALTER statements
        r';\s*create',  # CREATE statements
        r';\s*exec',  # EXEC statements
        r';\s*execute',  # EXECUTE statements
        r'xp_',  # Extended stored procedures
        r'sp_',  # System stored procedures
    ]

    # XSS patterns
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # Script tags
        r'javascript:',  # JavaScript URLs
        r'vbscript:',  # VBScript URLs
        r'on\w+\s*=',  # Event handlers
        r'<iframe[^>]*>.*?</iframe>',  # Iframe tags
        r'<object[^>]*>.*?</object>',  # Object tags
        r'<embed[^>]*>.*?</embed>',  # Embed tags
        r'expression\s*\(',  # CSS expressions
        r'vbscript:',  # VBScript
        r'data:text/html',  # Data URLs
    ]

    def __init__(self):
        self.max_string_length = 10000  # Maximum string length
        self.max_list_length = 1000     # Maximum list length
        self.max_dict_depth = 10        # Maximum nested dict depth

    @handle_service_errors
    def validate_email(self, email: str) -> Tuple[bool, Optional[str]]:
        """
        Validate email address with comprehensive checks

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not email or not isinstance(email, str):
            return False, "Email is required and must be a string"

        email = email.strip()

        if len(email) > 254:  # RFC 5321 limit
            return False, "Email address is too long"

        # Basic regex check first
        if not self.EMAIL_PATTERN.match(email):
            return False, "Invalid email format"

        # Advanced validation with email_validator
        try:
            validated = validate_email(email, check_deliverability=False)
            return True, None
        except EmailNotValidError as e:
            return False, str(e)

    @handle_service_errors
    def validate_password(self, password: str) -> Tuple[bool, Optional[List[str]]]:
        """
        Validate password strength

        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        if not password or not isinstance(password, str):
            return False, ["Password is required"]

        issues = []

        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")

        if len(password) > 128:
            issues.append("Password must be less than 128 characters long")

        if not re.search(r'[A-Z]', password):
            issues.append("Password must contain at least one uppercase letter")

        if not re.search(r'[a-z]', password):
            issues.append("Password must contain at least one lowercase letter")

        if not re.search(r'\d', password):
            issues.append("Password must contain at least one digit")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            issues.append("Password must contain at least one special character")

        # Check for common weak passwords
        weak_passwords = ['password', '123456', 'qwerty', 'admin', 'letmein']
        if password.lower() in weak_passwords:
            issues.append("Password is too common")

        # Check for sequential characters
        if re.search(r'(.)\1{2,}', password):  # Three or more identical characters
            issues.append("Password contains too many repeated characters")

        return len(issues) == 0, issues if issues else None

    @handle_service_errors
    def sanitize_string(self, input_str: str, max_length: Optional[int] = None) -> str:
        """
        Sanitize string input to prevent XSS and other attacks
        """
        if not isinstance(input_str, str):
            return ""

        # Truncate if needed
        if max_length and len(input_str) > max_length:
            input_str = input_str[:max_length]

        # Remove null bytes
        input_str = input_str.replace('\x00', '')

        # Basic HTML escaping
        input_str = input_str.replace('&', '&')
        input_str = input_str.replace('<', '<')
        input_str = input_str.replace('>', '>')
        input_str = input_str.replace('"', '"')
        input_str = input_str.replace("'", '&#x27;')

        # Remove potential script content
        input_str = re.sub(r'<script[^>]*>.*?</script>', '', input_str, flags=re.IGNORECASE | re.DOTALL)
        input_str = re.sub(r'<iframe[^>]*>.*?</iframe>', '', input_str, flags=re.IGNORECASE | re.DOTALL)

        return input_str.strip()

    @handle_service_errors
    def check_sql_injection(self, input_str: str) -> Tuple[bool, Optional[str]]:
        """
        Check for potential SQL injection patterns

        Returns:
            Tuple of (is_safe, detected_pattern)
        """
        if not isinstance(input_str, str):
            return True, None

        input_lower = input_str.lower()

        for pattern in self.SQL_INJECTION_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                return False, pattern

        return True, None

    @handle_service_errors
    def check_xss(self, input_str: str) -> Tuple[bool, Optional[str]]:
        """
        Check for potential XSS patterns

        Returns:
            Tuple of (is_safe, detected_pattern)
        """
        if not isinstance(input_str, str):
            return True, None

        input_lower = input_str.lower()

        for pattern in self.XSS_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                return False, pattern

        return True, None

    @handle_service_errors
    def validate_string_length(self, input_str: str, min_length: int = 0,
                              max_length: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate string length constraints
        """
        if not isinstance(input_str, str):
            return False, "Input must be a string"

        actual_length = len(input_str.strip())

        if actual_length < min_length:
            return False, f"String must be at least {min_length} characters long"

        if max_length and actual_length > max_length:
            return False, f"String must be at most {max_length} characters long"

        return True, None

    @handle_service_errors
    def validate_phone_number(self, phone: str) -> Tuple[bool, Optional[str]]:
        """
        Validate phone number format
        """
        if not phone or not isinstance(phone, str):
            return False, "Phone number is required"

        phone = phone.strip()

        if not self.PHONE_PATTERN.match(phone):
            return False, "Invalid phone number format"

        return True, None

    @handle_service_errors
    def validate_url(self, url: str) -> Tuple[bool, Optional[str]]:
        """
        Validate URL format
        """
        if not url or not isinstance(url, str):
            return False, "URL is required"

        url = url.strip()

        if len(url) > 2048:  # Common URL length limit
            return False, "URL is too long"

        if not self.URL_PATTERN.match(url):
            return False, "Invalid URL format"

        return True, None

    @handle_service_errors
    def validate_uuid(self, uuid_str: str) -> Tuple[bool, Optional[str]]:
        """
        Validate UUID format
        """
        if not uuid_str or not isinstance(uuid_str, str):
            return False, "UUID is required"

        if not self.UUID_PATTERN.match(uuid_str):
            return False, "Invalid UUID format"

        return True, None

    @handle_service_errors
    def validate_date(self, date_str: str, date_format: str = "%Y-%m-%d") -> Tuple[bool, Optional[datetime]]:
        """
        Validate and parse date string

        Returns:
            Tuple of (is_valid, parsed_datetime)
        """
        if not date_str or not isinstance(date_str, str):
            return False, None

        try:
            parsed_date = datetime.strptime(date_str, date_format)
            # Ensure it's not in the future (optional)
            now = datetime.now(timezone.utc)
            if parsed_date > now:
                return False, None
            return True, parsed_date
        except ValueError:
            return False, None

    @handle_service_errors
    def validate_json_data(self, data: Any, max_depth: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate JSON data structure and size
        """
        max_depth = max_depth or self.max_dict_depth

        def validate_recursive(obj: Any, current_depth: int = 0) -> Tuple[bool, Optional[str]]:
            if current_depth > max_depth:
                return False, f"Maximum nesting depth ({max_depth}) exceeded"

            if isinstance(obj, dict):
                if len(obj) > self.max_list_length:
                    return False, f"Dictionary has too many keys (max {self.max_list_length})"

                for key, value in obj.items():
                    if not isinstance(key, str):
                        return False, "Dictionary keys must be strings"
                    if len(key) > 100:  # Reasonable key length limit
                        return False, "Dictionary key is too long"

                    is_valid, error = validate_recursive(value, current_depth + 1)
                    if not is_valid:
                        return False, error

            elif isinstance(obj, list):
                if len(obj) > self.max_list_length:
                    return False, f"List has too many items (max {self.max_list_length})"

                for item in obj:
                    is_valid, error = validate_recursive(item, current_depth + 1)
                    if not is_valid:
                        return False, error

            elif isinstance(obj, str):
                if len(obj) > self.max_string_length:
                    return False, f"String is too long (max {self.max_string_length} characters)"

                # Check for injection attacks
                is_safe, pattern = self.check_sql_injection(obj)
                if not is_safe:
                    return False, f"Potential SQL injection detected: {pattern}"

                is_safe, pattern = self.check_xss(obj)
                if not is_safe:
                    return False, f"Potential XSS attack detected: {pattern}"

            return True, None

        return validate_recursive(data)

    @handle_service_errors
    def sanitize_data(self, data: Any) -> Any:
        """
        Recursively sanitize data structure
        """
        if isinstance(data, dict):
            return {key: self.sanitize_data(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self.sanitize_data(item) for item in data]
        elif isinstance(data, str):
            return self.sanitize_string(data)
        else:
            return data

    @handle_service_errors
    def validate_and_sanitize(self, data: Any) -> Tuple[bool, Any, Optional[str]]:
        """
        Validate and sanitize data in one operation

        Returns:
            Tuple of (is_valid, sanitized_data, error_message)
        """
        # First validate
        is_valid, error = self.validate_json_data(data)
        if not is_valid:
            return False, None, error

        # Then sanitize
        sanitized = self.sanitize_data(data)

        return True, sanitized, None