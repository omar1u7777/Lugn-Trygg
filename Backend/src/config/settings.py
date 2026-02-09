"""
2026-Compliant Configuration Management using Pydantic Settings
Type-safe, validated configuration with automatic environment variable loading
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = None  # Will be set after logging is configured


class Settings(BaseSettings):
    """
    Centralized application settings with automatic validation.

    All settings are loaded from environment variables with type validation.
    Missing required settings will raise ValidationError at startup.
    """

    # Flask Configuration
    flask_env: str = Field(default="production", alias="FLASK_ENV")
    flask_debug: bool = Field(default=False, alias="FLASK_DEBUG")
    port: int = Field(default=5001, alias="PORT")

    # JWT Configuration
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY", min_length=32)
    jwt_refresh_secret_key: str = Field(..., alias="JWT_REFRESH_SECRET_KEY", min_length=32)
    jwt_expiration_minutes: int = Field(default=15, alias="JWT_EXPIRATION_MINUTES", ge=1, le=1440)
    jwt_refresh_expiration_days: int = Field(default=360, alias="JWT_REFRESH_EXPIRATION_DAYS", ge=1, le=3650)

    # Firebase Configuration
    firebase_web_api_key: str = Field(..., alias="FIREBASE_WEB_API_KEY")
    firebase_api_key: str = Field(..., alias="FIREBASE_API_KEY")
    firebase_project_id: str = Field(..., alias="FIREBASE_PROJECT_ID")
    firebase_storage_bucket: str = Field(..., alias="FIREBASE_STORAGE_BUCKET")
    firebase_credentials: str = Field(default="serviceAccountKey.json", alias="FIREBASE_CREDENTIALS")
    firebase_credentials_path: str | None = Field(default=None, alias="FIREBASE_CREDENTIALS_PATH")

    # Stripe Configuration
    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_publishable_key: str | None = Field(default=None, alias="STRIPE_PUBLISHABLE_KEY")
    stripe_price_premium: str = Field(default="price_premium", alias="STRIPE_PRICE_PREMIUM")
    stripe_price_premium_yearly: str = Field(default="price_premium_yearly", alias="STRIPE_PRICE_PREMIUM_YEARLY")
    stripe_price_enterprise: str = Field(default="price_enterprise", alias="STRIPE_PRICE_ENTERPRISE")
    stripe_price_cbt_module: str = Field(default="price_cbt_module", alias="STRIPE_PRICE_CBT_MODULE")
    stripe_webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")

    # Security Configuration
    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")
    google_client_id: str | None = Field(default=None, alias="GOOGLE_CLIENT_ID")

    # Redis Configuration
    redis_host: str = Field(default="localhost", alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT", ge=1, le=65535)
    redis_password: str | None = Field(default=None, alias="REDIS_PASSWORD")
    redis_db: int = Field(default=0, alias="REDIS_DB", ge=0)
    redis_ssl: bool = Field(default=False, alias="REDIS_SSL")
    redis_max_connections: int = Field(default=20, alias="REDIS_MAX_CONNECTIONS", ge=1)

    # Cache Configuration
    cache_default_timeout: int = Field(default=300, alias="CACHE_DEFAULT_TIMEOUT", ge=0)
    cache_api_response_timeout: int = Field(default=600, alias="CACHE_API_RESPONSE_TIMEOUT", ge=0)
    cache_user_data_timeout: int = Field(default=1800, alias="CACHE_USER_DATA_TIMEOUT", ge=0)

    # CORS Configuration
    cors_allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ALLOWED_ORIGINS"
    )

    # WebAuthn Configuration
    webauthn_rp_id: str = Field(default="localhost", alias="WEBAUTHN_RP_ID")
    webauthn_rp_name: str = Field(default="Lugn & Trygg", alias="WEBAUTHN_RP_NAME")
    webauthn_origin: str = Field(default="http://localhost:3000", alias="WEBAUTHN_ORIGIN")

    # Security Settings
    max_failed_login_attempts: int = Field(default=5, alias="MAX_FAILED_LOGIN_ATTEMPTS", ge=1, le=20)
    lockout_duration_minutes_first: int = Field(default=5, alias="LOCKOUT_DURATION_MINUTES_FIRST", ge=1)
    lockout_duration_minutes_second: int = Field(default=15, alias="LOCKOUT_DURATION_MINUTES_SECOND", ge=1)
    lockout_duration_minutes_third: int = Field(default=60, alias="LOCKOUT_DURATION_MINUTES_THIRD", ge=1)

    # Sentry Configuration
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")
    sentry_environment: str = Field(default="production", alias="SENTRY_ENVIRONMENT")
    sentry_traces_sample_rate: float = Field(default=0.1, alias="SENTRY_TRACES_SAMPLE_RATE", ge=0.0, le=1.0)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        validate_assignment=True,
        str_strip_whitespace=True,
    )

    @field_validator("firebase_credentials", mode="before")
    @classmethod
    def validate_firebase_credentials(cls, v: Any) -> str:
        """Validate and process Firebase credentials"""
        if isinstance(v, str):
            v = v.strip()

        # Handle JSON string from environment variable
        if isinstance(v, str) and v.startswith("{"):
            try:
                creds_json = json.loads(v)
                with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
                    json.dump(creds_json, tf)
                    return tf.name
            except json.JSONDecodeError as exc:
                raise ValueError(
                    "FIREBASE_CREDENTIALS contains invalid JSON. "
                    "Check that the value is a valid service account payload."
                ) from exc

        return str(v) if v else "serviceAccountKey.json"

    @field_validator("cors_allowed_origins", mode="after")
    @classmethod
    def parse_cors_origins(cls, v: str) -> list[str]:
        """Parse CORS origins from comma-separated string"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v if isinstance(v, list) else []

    @model_validator(mode="after")
    def validate_production_settings(self) -> Settings:
        """Additional validation for production environment"""
        if self.flask_env == "production":
            if not self.webauthn_rp_id or self.webauthn_rp_id == "localhost":
                raise ValueError("WEBAUTHN_RP_ID is required for production environment")

            if self.flask_debug:
                raise ValueError("FLASK_DEBUG must be False in production")

            if len(self.jwt_secret_key) < 64:
                raise ValueError("JWT_SECRET_KEY must be at least 64 characters in production")

        # Process Firebase credentials path override
        if self.firebase_credentials_path:
            if Path(self.firebase_credentials_path).exists():
                object.__setattr__(self, 'firebase_credentials', self.firebase_credentials_path)

        return self

    @property
    def firebase_credentials_path_resolved(self) -> Path:
        """Get resolved path to Firebase credentials file"""
        creds_path = Path(self.firebase_credentials)

        if creds_path.is_absolute():
            return creds_path

        # Resolve relative to Backend directory
        backend_root = Path(__file__).parent.parent.parent
        resolved_path = backend_root / creds_path

        if not resolved_path.exists():
            raise FileNotFoundError(
                f"Firebase credentials file not found: {resolved_path}. "
                f"Set FIREBASE_CREDENTIALS or FIREBASE_CREDENTIALS_PATH environment variable."
            )

        return resolved_path

    @property
    def redis_url(self) -> str:
        """Build Redis URL from configuration"""
        protocol = "rediss" if self.redis_ssl else "redis"
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"{protocol}://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        """Get CORS origins as list"""
        if isinstance(self.cors_allowed_origins, str):
            return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        return self.cors_allowed_origins if isinstance(self.cors_allowed_origins, list) else []

    def model_dump_safe(self) -> dict[str, Any]:
        """Dump settings with sensitive values hidden"""
        data = self.model_dump()
        sensitive_keys = [
            "jwt_secret_key",
            "jwt_refresh_secret_key",
            "encryption_key",
            "redis_password",
            "stripe_secret_key",
            "firebase_web_api_key",
            "firebase_api_key",
            "sentry_dsn",
        ]

        for key in sensitive_keys:
            if key in data and data[key]:
                data[key] = "***HIDDEN***"

        return data


# Global settings instance - validated at import time
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get global settings instance (singleton pattern)"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# Export for backward compatibility
settings = get_settings()

# Export individual settings for backward compatibility with existing code
def __getattr__(name: str) -> Any:
    """Allow attribute access to settings for backward compatibility"""
    global _settings
    if _settings is None:
        _settings = get_settings()

    # Map old attribute names to new settings
    name_mapping: dict[str, str] = {
        "PORT": "port",
        "DEBUG": "flask_debug",
        "JWT_SECRET_KEY": "jwt_secret_key",
        "JWT_REFRESH_SECRET_KEY": "jwt_refresh_secret_key",
        "ACCESS_TOKEN_EXPIRES": "jwt_expiration_minutes",
        "REFRESH_TOKEN_EXPIRES": "jwt_refresh_expiration_days",
        "FIREBASE_WEB_API_KEY": "firebase_web_api_key",
        "FIREBASE_API_KEY": "firebase_api_key",
        "FIREBASE_PROJECT_ID": "firebase_project_id",
        "FIREBASE_STORAGE_BUCKET": "firebase_storage_bucket",
        "FIREBASE_CREDENTIALS": "firebase_credentials",
        "CORS_ALLOWED_ORIGINS": "cors_allowed_origins",
        "WEBAUTHN_RP_ID": "webauthn_rp_id",
        "WEBAUTHN_RP_NAME": "webauthn_rp_name",
        "WEBAUTHN_ORIGIN": "webauthn_origin",
        "MAX_FAILED_LOGIN_ATTEMPTS": "max_failed_login_attempts",
        "LOCKOUT_DURATION_MINUTES_FIRST": "lockout_duration_minutes_first",
        "LOCKOUT_DURATION_MINUTES_SECOND": "lockout_duration_minutes_second",
        "LOCKOUT_DURATION_MINUTES_THIRD": "lockout_duration_minutes_third",
        "REDIS_HOST": "redis_host",
        "REDIS_PORT": "redis_port",
        "REDIS_PASSWORD": "redis_password",
        "REDIS_DB": "redis_db",
        "REDIS_SSL": "redis_ssl",
        "CACHE_DEFAULT_TIMEOUT": "cache_default_timeout",
        "CACHE_API_RESPONSE_TIMEOUT": "cache_api_response_timeout",
        "CACHE_USER_DATA_TIMEOUT": "cache_user_data_timeout",
    }

    mapped_name = name_mapping.get(name, name.lower())

    try:
        return getattr(_settings, mapped_name)
    except AttributeError as err:
        raise AttributeError(f"module '{__name__}' has no attribute '{name}'") from err


__all__ = ["Settings", "get_settings", "settings"]

