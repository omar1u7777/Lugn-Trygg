"""
Base Pydantic schemas for Lugn & Trygg API
Common models, validators, and utilities for request/response validation
"""

from pydantic import BaseModel, Field, field_validator, EmailStr, HttpUrl, ConfigDict
from pydantic.functional_validators import BeforeValidator
from typing import Optional, List, Dict, Any, Union, Annotated
from datetime import datetime, date, timezone
from enum import Enum
import re
import bleach

class MoodValue(int, Enum):
    """Valid mood values (1-10 scale)"""
    VERY_LOW = 1
    LOW = 2
    SOMEWHAT_LOW = 3
    NEUTRAL_LOW = 4
    NEUTRAL = 5
    NEUTRAL_HIGH = 6
    SOMEWHAT_HIGH = 7
    HIGH = 8
    VERY_HIGH = 9
    EXTREMELY_HIGH = 10

class Language(str, Enum):
    """Supported languages"""
    SWEDISH = "sv"
    ENGLISH = "en"
    NORWEGIAN = "no"

class SubscriptionPlan(str, Enum):
    """Available subscription plans"""
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

def _sanitize_string(v: Any) -> str:
    """Sanitize string input"""
    if not isinstance(v, str):
        v = str(v)
    # Remove HTML tags and sanitize
    cleaned = bleach.clean(v, tags=[], strip=True)
    # Remove potential script injections
    cleaned = re.sub(r'<script[^>]*>.*?</script>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    # Trim whitespace
    return cleaned.strip()

# Pydantic V2 style annotated type
SanitizedString = Annotated[str, BeforeValidator(_sanitize_string)]

class BaseRequest(BaseModel):
    """Base class for all API requests"""
    model_config = ConfigDict(
        validate_assignment=True,
    )

class BaseResponse(BaseModel):
    """Base class for all API responses"""
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        validate_assignment=True,
    )

class ErrorResponse(BaseResponse):
    """Standard error response"""
    success: bool = False
    error: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class PaginatedResponse(BaseResponse):
    """Response with pagination info"""
    data: List[Any]
    pagination: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('pagination', mode='before')
    @classmethod
    def set_pagination(cls, v, info):
        if not v:
            data = info.data.get('data', []) if info.data else []
            return {
                'page': 1,
                'per_page': 20,
                'total': len(data),
                'total_pages': 1
            }
        return v

# Common field validators
def validate_password(v: str) -> str:
    """Validate password strength"""
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters long')
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', v):
        raise ValueError('Password must contain at least one digit')
    return v

def validate_phone(v: Optional[str]) -> Optional[str]:
    """Validate phone number format"""
    if v is None:
        return v
    # Swedish phone number validation
    cleaned = re.sub(r'[^\d+]', '', v)
    if not re.match(r'^(\+46|0)[1-9]\d{6,8}$', cleaned):
        raise ValueError('Invalid phone number format')
    return cleaned

def validate_safe_string(v: str, max_length: int = 1000) -> str:
    """Validate and sanitize string input"""
    if not isinstance(v, str):
        raise ValueError('Must be a string')
    if len(v) > max_length:
        raise ValueError(f'String too long (max {max_length} characters)')
    if not v.strip():
        raise ValueError('String cannot be empty or whitespace only')

    # Check for suspicious patterns
    suspicious_patterns = [
        r'<script', r'javascript:', r'on\w+\s*=', r'eval\s*\(',
        r'document\.', r'window\.', r'location\.',
        r'<\s*iframe', r'<\s*object', r'<\s*embed'
    ]

    for pattern in suspicious_patterns:
        if re.search(pattern, v, re.IGNORECASE):
            raise ValueError('Invalid characters or patterns detected')

    # Return sanitized string using the _sanitize_string function
    return _sanitize_string(v)

# Common models
class UserBase(BaseModel):
    """Base user information"""
    id: str
    email: EmailStr
    language: Language = Language.SWEDISH
    subscription: Optional[SubscriptionPlan] = SubscriptionPlan.FREE
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Coordinates(BaseModel):
    """GPS coordinates"""
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

class Address(BaseModel):
    """Address information"""
    street: Optional[SanitizedString] = None
    city: Optional[SanitizedString] = None
    postal_code: Optional[str] = None
    country: Optional[SanitizedString] = None

class ContactInfo(BaseModel):
    """Contact information"""
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None

    @field_validator('phone', 'emergency_phone', mode='before')
    @classmethod
    def validate_phone_fields(cls, v):
        return validate_phone(v)

class HealthMetrics(BaseModel):
    """Basic health metrics"""
    height_cm: Optional[float] = Field(None, ge=50, le=300)
    weight_kg: Optional[float] = Field(None, ge=20, le=500)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None

class Preferences(BaseModel):
    """User preferences"""
    notifications_enabled: bool = True
    data_sharing: bool = False
    analytics_opt_in: bool = False
    theme: str = "light"
    language: Language = Language.SWEDISH

# Validation utilities
def validate_request_data(data: Dict[str, Any], schema_class: type) -> BaseModel:
    """Validate request data against a Pydantic schema"""
    try:
        return schema_class(**data)
    except Exception as e:
        raise ValueError(f"Validation error: {str(e)}")

def sanitize_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively sanitize string inputs in nested data"""
    if isinstance(data, dict):
        return {k: sanitize_input(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_input(item) for item in data]
    elif isinstance(data, str):
        return _sanitize_string(data)
    else:
        return data

def create_validation_error_response(errors: Dict[str, Any]) -> ErrorResponse:
    """Create a standardized validation error response"""
    return ErrorResponse(
        error="Validation failed",
        error_code="VALIDATION_ERROR",
        details=errors,
        message="One or more fields failed validation"
    )