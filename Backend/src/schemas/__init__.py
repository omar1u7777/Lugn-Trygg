"""
Pydantic Schemas for Lugn & Trygg API
Request/Response validation models
"""

from .auth import (
    AuthResponse,
    AuthTokens,
    ChangePasswordRequest,
    ConfirmPasswordResetRequest,
    ConsentUpdateRequest,
    DeleteAccountRequest,
    GoogleAuthRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TwoFactorSetupRequest,
    TwoFactorVerifyRequest,
    UpdateProfileRequest,
    UserProfile,
)
from .base import (
    Address,
    BaseRequest,
    BaseResponse,
    ContactInfo,
    HealthMetrics,
    Language,
    MoodValue,
    Preferences,
    SanitizedString,
    SubscriptionPlan,
    UserBase,
    validate_password,
    validate_safe_string,
)
from .mood import (
    MoodAnalysisResponse,
    MoodCategory,
    MoodEntry,
    MoodIntensity,
    MoodListResponse,
    MoodLogRequest,
    MoodLogResponse,
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
