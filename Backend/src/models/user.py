from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from ..utils.timestamp_utils import parse_iso_timestamp


def _coerce_bool(value: Any, default: bool = False) -> bool:
    """Convert common Firestore/string representations to bool safely."""
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off", ""}:
            return False
        return default
    return bool(value)


def _coerce_str(value: Any, default: str = "") -> str:
    """Convert incoming values to a safe string representation."""
    if value is None:
        return default
    return str(value)


@dataclass
class User:
    uid: str
    email: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    last_login: datetime | None = None
    email_verified: bool = field(default=False)

    def update_last_login(self):
        """Update timestamp for the latest successful login."""
        self.last_login = datetime.now(UTC)

    def to_dict(self) -> dict[str, Any]:
        """Convert User object to a dictionary for persistence."""
        return {
            "uid": self.uid,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "email_verified": self.email_verified
        }

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "User":
        """Create a User instance from a dictionary (for example Firestore data)."""
        email_verified = _coerce_bool(data.get("email_verified", False), default=False)

        return User(
            uid=_coerce_str(data.get("uid")),
            email=_coerce_str(data.get("email")),
            created_at=parse_iso_timestamp(data.get("created_at")),
            last_login=parse_iso_timestamp(data.get("last_login")) if data.get("last_login") else None,
            email_verified=email_verified
        )


@dataclass
class UserProfile:
    """User profile with extended information for display and personalization."""
    uid: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    language: str = "sv"
    timezone: str = "Europe/Stockholm"
    onboarding_completed: bool = False
    subscription_tier: str = "free"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "uid": self.uid,
            "email": self.email,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "language": self.language,
            "timezone": self.timezone,
            "onboarding_completed": self.onboarding_completed,
            "subscription_tier": self.subscription_tier,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "UserProfile":
        return UserProfile(
            uid=_coerce_str(data.get("uid")),
            email=_coerce_str(data.get("email")),
            display_name=_coerce_str(data.get("display_name"), default="") or None,
            avatar_url=_coerce_str(data.get("avatar_url"), default="") or None,
            bio=_coerce_str(data.get("bio"), default="") or None,
            language=_coerce_str(data.get("language"), default="sv") or "sv",
            timezone=_coerce_str(data.get("timezone"), default="Europe/Stockholm") or "Europe/Stockholm",
            onboarding_completed=_coerce_bool(data.get("onboarding_completed", False), default=False),
            subscription_tier=_coerce_str(data.get("subscription_tier"), default="free") or "free",
            created_at=parse_iso_timestamp(data.get("created_at")),
            updated_at=parse_iso_timestamp(data.get("updated_at")) if data.get("updated_at") else None,
        )


@dataclass
class UserPreferences:
    """User preferences for notifications, privacy and app behavior."""
    uid: str
    dark_mode: bool = False
    notifications_enabled: bool = True
    email_notifications: bool = True
    push_notifications: bool = True
    daily_reminder_time: str | None = "09:00"
    weekly_summary: bool = True
    data_sharing_analytics: bool = False
    data_sharing_research: bool = False
    mood_reminder_frequency: str = "daily"
    language: str = "sv"

    def to_dict(self) -> dict[str, Any]:
        return {
            "uid": self.uid,
            "dark_mode": self.dark_mode,
            "notifications_enabled": self.notifications_enabled,
            "email_notifications": self.email_notifications,
            "push_notifications": self.push_notifications,
            "daily_reminder_time": self.daily_reminder_time,
            "weekly_summary": self.weekly_summary,
            "data_sharing_analytics": self.data_sharing_analytics,
            "data_sharing_research": self.data_sharing_research,
            "mood_reminder_frequency": self.mood_reminder_frequency,
            "language": self.language,
        }

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "UserPreferences":
        return UserPreferences(
            uid=_coerce_str(data.get("uid")),
            dark_mode=_coerce_bool(data.get("dark_mode", False), default=False),
            notifications_enabled=_coerce_bool(data.get("notifications_enabled", True), default=True),
            email_notifications=_coerce_bool(data.get("email_notifications", True), default=True),
            push_notifications=_coerce_bool(data.get("push_notifications", True), default=True),
            daily_reminder_time=_coerce_str(data.get("daily_reminder_time"), default="09:00") or None,
            weekly_summary=_coerce_bool(data.get("weekly_summary", True), default=True),
            data_sharing_analytics=_coerce_bool(data.get("data_sharing_analytics", False), default=False),
            data_sharing_research=_coerce_bool(data.get("data_sharing_research", False), default=False),
            mood_reminder_frequency=_coerce_str(data.get("mood_reminder_frequency"), default="daily") or "daily",
            language=_coerce_str(data.get("language"), default="sv") or "sv",
        )
