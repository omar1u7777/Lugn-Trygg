"""
Pydantic Schemas for Lugn & Trygg API
Request/Response validation models
"""

from .base import (
    BaseRequest,
    BaseResponse,
    SanitizedString,
    Language,
    SubscriptionPlan,
    MoodValue,
    validate_password,
    validate_safe_string,
    UserBase,
    ContactInfo,
    Address,
    HealthMetrics,
    Preferences,
)

from .auth import (
    LoginRequest,
    RegisterRequest,
    GoogleAuthRequest,
    ResetPasswordRequest,
    ConfirmPasswordResetRequest,
    ChangePasswordRequest,
    TwoFactorSetupRequest,
    TwoFactorVerifyRequest,
    UpdateProfileRequest,
    ConsentUpdateRequest,
    DeleteAccountRequest,
    AuthTokens,
    AuthResponse,
    LoginResponse,
    RegisterResponse,
    UserProfile,
)

from .mood import (
    MoodLogRequest,
    MoodLogResponse,
    MoodListResponse,
    MoodAnalysisResponse,
    MoodEntry,
    MoodCategory,
    MoodIntensity,
)

__all__ = [
    # Base
    "BaseRequest",
    "BaseResponse",
    "SanitizedString",
    "Language",
    "SubscriptionPlan",
    "MoodValue",
    "validate_password",
    "validate_safe_string",
    "UserBase",
    "ContactInfo",
    "Address",
    "HealthMetrics",
    "Preferences",
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "GoogleAuthRequest",
    "ResetPasswordRequest",
    "ConfirmPasswordResetRequest",
    "ChangePasswordRequest",
    "TwoFactorSetupRequest",
    "TwoFactorVerifyRequest",
    "UpdateProfileRequest",
    "ConsentUpdateRequest",
    "DeleteAccountRequest",
    "AuthTokens",
    "AuthResponse",
    "LoginResponse",
    "RegisterResponse",
    "UserProfile",
    # Mood
    "MoodLogRequest",
    "MoodLogResponse",
    "MoodListResponse",
    "MoodAnalysisResponse",
    "MoodEntry",
    "MoodCategory",
    "MoodIntensity",
]
