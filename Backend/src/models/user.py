from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from ..utils.timestamp_utils import parse_iso_timestamp


@dataclass
class User:
    uid: str
    email: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    last_login: datetime | None = None
    email_verified: bool = field(default=False)

    def update_last_login(self):
        """🔹 Uppdatera senaste inloggningstid."""
        self.last_login = datetime.now(UTC)

    def to_dict(self) -> dict[str, Any]:
        """🔹 Konverterar User-objekt till dictionary (t.ex. för Firestore-lagring)."""
        return {
            "uid": self.uid,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "email_verified": self.email_verified
        }

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "User":
        """🔹 Skapar en User-instans från en dictionary (t.ex. Firestore-data)."""
        email_verified_raw = data.get("email_verified", False)
        email_verified = bool(email_verified_raw) if not isinstance(email_verified_raw, bool) else email_verified_raw

        return User(
            uid=data["uid"],
            email=data["email"],
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
            uid=data.get("uid", ""),
            email=data.get("email", ""),
            display_name=data.get("display_name"),
            avatar_url=data.get("avatar_url"),
            bio=data.get("bio"),
            language=data.get("language", "sv"),
            timezone=data.get("timezone", "Europe/Stockholm"),
            onboarding_completed=data.get("onboarding_completed", False),
            subscription_tier=data.get("subscription_tier", "free"),
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
            uid=data.get("uid", ""),
            dark_mode=data.get("dark_mode", False),
            notifications_enabled=data.get("notifications_enabled", True),
            email_notifications=data.get("email_notifications", True),
            push_notifications=data.get("push_notifications", True),
            daily_reminder_time=data.get("daily_reminder_time", "09:00"),
            weekly_summary=data.get("weekly_summary", True),
            data_sharing_analytics=data.get("data_sharing_analytics", False),
            data_sharing_research=data.get("data_sharing_research", False),
            mood_reminder_frequency=data.get("mood_reminder_frequency", "daily"),
            language=data.get("language", "sv"),
        )
