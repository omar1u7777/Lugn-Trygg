"""
Authentication and user management schemas
Pydantic models for login, registration, and user data validation
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .base import (
    Address,
    BaseRequest,
    BaseResponse,
    ContactInfo,
    HealthMetrics,
    Language,
    Preferences,
    SanitizedString,
    SubscriptionPlan,
    validate_password,
    validate_safe_string,
)


# Authentication schemas
class LoginRequest(BaseRequest):
    """Login request schema"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")

    @field_validator('password', mode='before')
    @classmethod
    def validate_password_not_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError('Password cannot be empty')
        return v

class RegisterRequest(BaseRequest):
    """User registration request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password (min 8 chars)")
    name: SanitizedString = Field(..., min_length=1, max_length=100, description="User display name")
    language: Language = Field(default=Language.SWEDISH, description="Preferred language")
    accept_terms: bool = Field(..., description="Accept terms and conditions")
    accept_privacy: bool = Field(..., description="Accept privacy policy")
    referral_code: SanitizedString | None = Field(None, max_length=50, description="Referral code")

    @field_validator('password', mode='before')
    @classmethod
    def validate_password_strength(cls, v):
        return validate_password(v)

    @field_validator('accept_terms', 'accept_privacy', mode='before')
    @classmethod
    def validate_acceptance(cls, v):
        if not v:
            raise ValueError('You must accept the terms and privacy policy')
        return v

class GoogleAuthRequest(BaseRequest):
    """Google OAuth authentication"""
    id_token: str = Field(..., description="Google ID token")
    access_token: str | None = None
    language: Language = Field(default=Language.SWEDISH)

class ResetPasswordRequest(BaseRequest):
    """Password reset request"""
    email: EmailStr = Field(..., description="User email address")

class ConfirmPasswordResetRequest(BaseRequest):
    """Confirm password reset with token"""
    token: str = Field(..., min_length=1, description="Password reset token")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator('new_password', mode='before')
    @classmethod
    def validate_new_password(cls, v):
        return validate_password(v)

class ChangePasswordRequest(BaseRequest):
    """Change password request"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator('new_password', mode='before')
    @classmethod
    def validate_new_password(cls, v):
        return validate_password(v)

class TwoFactorSetupRequest(BaseRequest):
    """2FA setup request"""
    method: str = Field(..., pattern=r'^(sms|app)$', description="2FA method (sms or app)")
    phone_number: str | None = None

    @field_validator('phone_number', mode='before')
    @classmethod
    def validate_phone_for_sms(cls, v, info):
        if info.data.get('method') == 'sms' and not v:
            raise ValueError('Phone number required for SMS 2FA')
        return v

class TwoFactorVerifyRequest(BaseRequest):
    """2FA verification request"""
    code: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$', description="6-digit verification code")

# User profile schemas
class UserProfile(BaseModel):
    """Complete user profile"""
    id: str
    email: EmailStr
    email_verified: bool = False
    language: Language = Language.SWEDISH
    subscription: SubscriptionPlan = SubscriptionPlan.FREE
    subscription_active: bool = False

    # Personal info
    first_name: SanitizedString | None = None
    last_name: SanitizedString | None = None
    display_name: SanitizedString | None = None

    # Contact info
    contact: ContactInfo = Field(default_factory=ContactInfo)

    # Address
    address: Address | None = None

    # Health info
    health: HealthMetrics | None = None

    # Preferences
    preferences: Preferences = Field(default_factory=Preferences)

    # System fields
    created_at: datetime
    updated_at: datetime
    last_login: datetime | None = None
    login_count: int = 0

    # Security
    two_factor_enabled: bool = False
    two_factor_method: str | None = None

    model_config = ConfigDict()

class UpdateProfileRequest(BaseRequest):
    """Update user profile request"""
    first_name: SanitizedString | None = Field(None, max_length=50)
    last_name: SanitizedString | None = Field(None, max_length=50)
    display_name: SanitizedString | None = Field(None, max_length=100)
    language: Language | None = None

    # Nested updates
    contact: ContactInfo | None = None
    address: Address | None = None
    health: HealthMetrics | None = None
    preferences: Preferences | None = None

    @field_validator('first_name', 'last_name', 'display_name', mode='before')
    @classmethod
    def validate_names(cls, v):
        if v is not None:
            return validate_safe_string(v, 100)
        return v

class ConsentUpdateRequest(BaseRequest):
    """Update user consents"""
    marketing_consent: bool | None = None
    analytics_consent: bool | None = None
    data_sharing_consent: bool | None = None
    research_consent: bool | None = None

# Authentication responses
class AuthTokens(BaseModel):
    """JWT tokens response"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="Bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    refresh_expires_in: int = Field(..., description="Refresh token expiration in seconds")

class AuthResponse(BaseResponse):
    """Authentication response"""
    user: UserProfile
    tokens: AuthTokens
    requires_two_factor: bool = False
    redirect_url: str | None = None

class LoginResponse(AuthResponse):
    """Login response"""
    pass

class RegisterResponse(AuthResponse):
    """Registration response"""
    email_verification_sent: bool = True

class RefreshTokenResponse(BaseResponse):
    """Token refresh response"""
    tokens: AuthTokens

class TwoFactorSetupResponse(BaseResponse):
    """2FA setup response"""
    secret: str | None = None  # For TOTP apps
    qr_code_url: str | None = None
    backup_codes: list[str] | None = None

class TwoFactorVerifyResponse(BaseResponse):
    """2FA verification response"""
    tokens: AuthTokens

# Password management
class PasswordResetResponse(BaseResponse):
    """Password reset response"""
    reset_token_sent: bool = True
    email: str

class PasswordChangeResponse(BaseResponse):
    """Password change response"""
    password_changed: bool = True

# Account management
class DeleteAccountRequest(BaseRequest):
    """Account deletion request"""
    confirm_delete: bool = Field(..., description="Confirm account deletion")
    reason: SanitizedString | None = Field(None, max_length=500, description="Reason for deletion")
    password: str = Field(..., description="Current password for verification")

    @field_validator('confirm_delete', mode='before')
    @classmethod
    def validate_confirmation(cls, v):
        if not v:
            raise ValueError('You must confirm account deletion')
        return v

class DeleteAccountResponse(BaseResponse):
    """Account deletion response"""
    account_deleted: bool = True
    deletion_scheduled: datetime | None = None  # For GDPR compliance
    data_export_available: bool = True

# Session management
class SessionInfo(BaseModel):
    """User session information"""
    id: str
    user_id: str
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    expires_at: datetime
    is_active: bool = True

class SessionsListResponse(BaseResponse):
    """List of user sessions"""
    sessions: list[SessionInfo]
    current_session_id: str

class RevokeSessionRequest(BaseRequest):
    """Revoke session request"""
    session_id: str

class RevokeSessionResponse(BaseResponse):
    """Session revocation response"""
    session_revoked: bool = True

# Security audit
class SecurityEvent(BaseModel):
    """Security event log"""
    id: str
    user_id: str
    event_type: str  # login, logout, password_change, etc.
    ip_address: str | None
    user_agent: str | None
    timestamp: datetime
    details: dict[str, Any] | None = None

class SecurityAuditResponse(BaseResponse):
    """Security audit log response"""
    events: list[SecurityEvent]
    total_events: int
    pagination: dict[str, Any]

# Validation utilities
def validate_auth_request(data: dict[str, Any]) -> BaseModel:
    """Validate authentication request data"""
    # Determine request type based on fields
    if 'password' in data and 'email' in data and 'accept_terms' not in data:
        return LoginRequest(**data)
    elif 'password' in data and 'email' in data and 'accept_terms' in data:
        return RegisterRequest(**data)
    elif 'id_token' in data:
        return GoogleAuthRequest(**data)
    elif 'current_password' in data and 'new_password' in data:
        return ChangePasswordRequest(**data)
    elif 'email' in data and len(data) == 1:
        return ResetPasswordRequest(**data)
    else:
        raise ValueError("Could not determine authentication request type")
