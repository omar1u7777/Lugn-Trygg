from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from ..utils.timestamp_utils import parse_iso_timestamp


def _coerce_int(value: Any, default: int = 0) -> int:
    """Convert incoming values to int safely."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


@dataclass
class UserUsage:
    """Daily usage tracking for rate limiting."""
    user_id: str
    date: str  # ISO format date string (YYYY-MM-DD)
    mood_logs: int = 0
    chat_messages: int = 0
    last_updated: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "date": self.date,
            "mood_logs": self.mood_logs,
            "chat_messages": self.chat_messages,
            "last_updated": self.last_updated.isoformat(),
        }

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "UserUsage":
        return UserUsage(
            user_id=data.get("user_id", ""),
            date=data.get("date", datetime.now(UTC).strftime("%Y-%m-%d")),
            mood_logs=_coerce_int(data.get("mood_logs"), 0),
            chat_messages=_coerce_int(data.get("chat_messages"), 0),
            last_updated=parse_iso_timestamp(data.get("last_updated")) if data.get("last_updated") else datetime.now(UTC),
        )

    def increment_mood_log(self) -> None:
        """Increment mood log count."""
        self.mood_logs += 1
        self.last_updated = datetime.now(UTC)

    def increment_chat_message(self) -> None:
        """Increment chat message count."""
        self.chat_messages += 1
        self.last_updated = datetime.now(UTC)
