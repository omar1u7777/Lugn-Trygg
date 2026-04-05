"""
[DB1] Pydantic Firestore schema validators — Lugn & Trygg
=========================================================
Every public collection read from Firestore MUST be validated through one of
these models before being used in application logic.

Usage example (in a route or service)::

    from src.schemas.firestore_schemas import MoodEntryDoc

    doc = db.collection("moods").document(mood_id).get()
    if doc.exists:
        entry = MoodEntryDoc.model_validate(doc.to_dict() | {"id": doc.id})

All models use ``model_config = ConfigDict(extra="ignore")`` so that unknown
fields added in future migrations do not cause validation errors.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _coerce_str(v: Any, max_len: int = 2000) -> str:
    """Safely coerce any value to a bounded string."""
    if v is None:
        return ""
    return str(v)[:max_len]


# ─── Shared config ───────────────────────────────────────────────────────────

class _FirestoreDoc(BaseModel):
    """Base class for all Firestore document schemas."""
    model_config = ConfigDict(extra="ignore", validate_assignment=True)

    id: str = ""  # populated from doc.id after retrieval


# ─── users ───────────────────────────────────────────────────────────────────

class UserDoc(_FirestoreDoc):
    """users/{uid}"""
    email: str = ""
    display_name: str | None = None
    avatar_url: str | None = None
    language: str = "sv"
    timezone: str = "Europe/Stockholm"
    role: str = "user"
    subscription_tier: str = "free"
    email_verified: bool = False
    onboarding_completed: bool = False
    created_at: str | datetime | None = None
    updated_at: str | datetime | None = None
    last_login: str | datetime | None = None

    @field_validator("role", mode="before")
    @classmethod
    def _validate_role(cls, v: Any) -> str:
        allowed = {"user", "admin", "moderator"}
        val = _coerce_str(v)
        return val if val in allowed else "user"

    @field_validator("subscription_tier", mode="before")
    @classmethod
    def _validate_tier(cls, v: Any) -> str:
        allowed = {"free", "basic", "premium", "enterprise"}
        val = _coerce_str(v)
        return val if val in allowed else "free"


# ─── moods ───────────────────────────────────────────────────────────────────

class MoodEntryDoc(_FirestoreDoc):
    """moods/{moodId}  (also users/{uid}/moods/{moodId})"""
    user_id: str
    mood_value: int = Field(ge=1, le=10)
    valence: int | None = Field(None, ge=1, le=10)
    arousal: int | None = Field(None, ge=1, le=10)
    category: str | None = None
    note: str | None = None
    triggers: list[str] = Field(default_factory=list)
    activities: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    timestamp: str | datetime | None = None
    created_at: str | datetime | None = None

    @field_validator("note", mode="before")
    @classmethod
    def _limit_note(cls, v: Any) -> str | None:
        if v is None:
            return None
        return _coerce_str(v, 1000)

    @field_validator("triggers", "activities", "tags", mode="before")
    @classmethod
    def _safe_list(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(item, 100) for item in v[:20]]


# ─── memories ────────────────────────────────────────────────────────────────

class MemoryDoc(_FirestoreDoc):
    """memories/{memoryId}"""
    user_id: str
    title: str = ""
    content: str = ""
    audio_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_encrypted: bool = False
    created_at: str | datetime | None = None
    updated_at: str | datetime | None = None

    @field_validator("content", mode="before")
    @classmethod
    def _limit_content(cls, v: Any) -> str:
        return _coerce_str(v, 10_000)

    @field_validator("tags", mode="before")
    @classmethod
    def _safe_tags(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(t, 100) for t in v[:20]]


# ─── ai_stories ──────────────────────────────────────────────────────────────

class AIStoryDoc(_FirestoreDoc):
    """ai_stories/{docId}"""
    user_id: str
    title: str = ""
    content: str = ""
    mood_context: dict[str, Any] = Field(default_factory=dict)
    model: str = ""
    generated_at: str | datetime | None = None

    @field_validator("content", mode="before")
    @classmethod
    def _limit_content(cls, v: Any) -> str:
        return _coerce_str(v, 50_000)


# ─── subscriptions ───────────────────────────────────────────────────────────

class SubscriptionDoc(_FirestoreDoc):
    """subscriptions/{subId}  — backend-managed; never exposed to client SDK"""
    user_id: str
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    plan: str = "free"
    status: str = "inactive"
    current_period_start: str | datetime | None = None
    current_period_end: str | datetime | None = None
    cancel_at_period_end: bool = False
    created_at: str | datetime | None = None
    updated_at: str | datetime | None = None

    @field_validator("plan", mode="before")
    @classmethod
    def _validate_plan(cls, v: Any) -> str:
        allowed = {"free", "basic", "premium", "enterprise"}
        val = _coerce_str(v)
        return val if val in allowed else "free"

    @field_validator("status", mode="before")
    @classmethod
    def _validate_status(cls, v: Any) -> str:
        allowed = {"active", "inactive", "canceled", "past_due", "trialing"}
        val = _coerce_str(v)
        return val if val in allowed else "inactive"


# ─── audit_logs ──────────────────────────────────────────────────────────────

class AuditLogDoc(_FirestoreDoc):
    """audit_logs/{logId}"""
    user_id: str | None = None
    action: str = ""
    resource: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    success: bool = True
    details: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | datetime | None = None


# ─── peer_chat_messages ──────────────────────────────────────────────────────

class PeerChatMessageDoc(_FirestoreDoc):
    """peer_chat_messages/{messageId}"""
    sender_id: str
    room_id: str
    room_participants: list[str] = Field(default_factory=list)
    content: str = ""
    is_encrypted: bool = False
    created_at: str | datetime | None = None
    edited_at: str | datetime | None = None

    @field_validator("content", mode="before")
    @classmethod
    def _limit_content(cls, v: Any) -> str:
        return _coerce_str(v, 5000)

    @field_validator("room_participants", mode="before")
    @classmethod
    def _safe_participants(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(uid, 128) for uid in v[:50]]


# ─── challenges ──────────────────────────────────────────────────────────────

class ChallengeDoc(_FirestoreDoc):
    """challenges/{challengeId}"""
    title: str = ""
    description: str = ""
    difficulty: str = "medium"
    category: str = ""
    max_participants: int | None = None
    start_date: str | datetime | None = None
    end_date: str | datetime | None = None
    reward_xp: int = 0
    created_by: str | None = None
    created_at: str | datetime | None = None

    @field_validator("difficulty", mode="before")
    @classmethod
    def _validate_difficulty(cls, v: Any) -> str:
        allowed = {"easy", "medium", "hard", "expert"}
        val = _coerce_str(v)
        return val if val in allowed else "medium"

    @field_validator("reward_xp", mode="before")
    @classmethod
    def _cap_xp(cls, v: Any) -> int:
        try:
            return max(0, min(int(v), 10_000))
        except (TypeError, ValueError):
            return 0


# ─── user_challenges ─────────────────────────────────────────────────────────

class UserChallengeDoc(_FirestoreDoc):
    """user_challenges/{docId}"""
    user_id: str
    challenge_id: str
    status: str = "joined"
    progress: int = 0
    completed_at: str | datetime | None = None
    joined_at: str | datetime | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _validate_status(cls, v: Any) -> str:
        allowed = {"joined", "in_progress", "completed", "abandoned"}
        val = _coerce_str(v)
        return val if val in allowed else "joined"

    @field_validator("progress", mode="before")
    @classmethod
    def _cap_progress(cls, v: Any) -> int:
        try:
            return max(0, min(int(v), 100))
        except (TypeError, ValueError):
            return 0


# ─── reward_profiles ─────────────────────────────────────────────────────────

class RewardProfileDoc(_FirestoreDoc):
    """reward_profiles/{userId}"""
    user_id: str = ""
    total_xp: int = 0
    level: int = 1
    badges: list[str] = Field(default_factory=list)
    streak_days: int = 0
    updated_at: str | datetime | None = None

    @field_validator("total_xp", mode="before")
    @classmethod
    def _cap_xp(cls, v: Any) -> int:
        try:
            return max(0, int(v))
        except (TypeError, ValueError):
            return 0

    @field_validator("badges", mode="before")
    @classmethod
    def _safe_badges(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(b, 64) for b in v[:200]]


# ─── user_devices ────────────────────────────────────────────────────────────

class UserDeviceDoc(_FirestoreDoc):
    """user_devices/{docId}"""
    user_id: str
    provider: str = ""
    device_name: str | None = None
    access_token_hash: str | None = None  # hashed; never store raw tokens
    scopes: list[str] = Field(default_factory=list)
    connected_at: str | datetime | None = None
    last_synced_at: str | datetime | None = None
    is_active: bool = True

    @field_validator("provider", mode="before")
    @classmethod
    def _validate_provider(cls, v: Any) -> str:
        allowed = {"google_fit", "fitbit", "apple_health", "garmin", "polar"}
        val = _coerce_str(v, 64)
        return val if val in allowed else val  # allow unknown providers with coercion


# ─── journal_entries ─────────────────────────────────────────────────────────

class JournalEntryDoc(_FirestoreDoc):
    """journal_entries/{entryId}  (also users/{uid}/journal/{entryId})"""
    user_id: str
    content_encrypted: str = ""  # AES-encrypted content
    title: str = ""
    mood_snapshot: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    word_count: int = 0
    created_at: str | datetime | None = None
    updated_at: str | datetime | None = None

    @field_validator("word_count", mode="before")
    @classmethod
    def _cap_word_count(cls, v: Any) -> int:
        try:
            return max(0, min(int(v), 100_000))
        except (TypeError, ValueError):
            return 0

    @field_validator("tags", mode="before")
    @classmethod
    def _safe_tags(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(t, 100) for t in v[:20]]


# ─── onboarding_data ─────────────────────────────────────────────────────────

class OnboardingDataDoc(_FirestoreDoc):
    """onboarding_data/{userId}"""
    user_id: str = ""
    selected_goals: list[str] = Field(default_factory=list)
    wellbeing_baseline: int | None = Field(None, ge=1, le=10)
    primary_concern: str | None = None
    preferred_language: str = "sv"
    notifications_enabled: bool = True
    completed_at: str | datetime | None = None

    @field_validator("selected_goals", mode="before")
    @classmethod
    def _safe_goals(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_coerce_str(g, 128) for g in v[:20]]


# ─── usage ───────────────────────────────────────────────────────────────────

class UsageDoc(_FirestoreDoc):
    """usage/{docId}  — daily API usage quota per user"""
    user_id: str
    date: str = ""  # ISO date "YYYY-MM-DD"
    ai_requests: int = 0
    mood_logs: int = 0
    journal_entries: int = 0
    voice_sessions: int = 0
    last_updated: str | datetime | None = None

    @field_validator("ai_requests", "mood_logs", "journal_entries", "voice_sessions", mode="before")
    @classmethod
    def _cap_counter(cls, v: Any) -> int:
        try:
            return max(0, min(int(v), 100_000))
        except (TypeError, ValueError):
            return 0


# ─── chat_history ────────────────────────────────────────────────────────────

class ChatMessageDoc(BaseModel):
    """Nested message object inside ChatHistoryDoc.messages"""
    model_config = ConfigDict(extra="ignore")

    role: str = "user"  # "user" | "assistant" | "system"
    content: str = ""
    timestamp: str | datetime | None = None

    @field_validator("role", mode="before")
    @classmethod
    def _validate_role(cls, v: Any) -> str:
        allowed = {"user", "assistant", "system"}
        val = _coerce_str(v, 16)
        return val if val in allowed else "user"

    @field_validator("content", mode="before")
    @classmethod
    def _limit_content(cls, v: Any) -> str:
        return _coerce_str(v, 10_000)


class ChatHistoryDoc(_FirestoreDoc):
    """chat_history/{docId}"""
    user_id: str
    session_id: str = ""
    messages: list[ChatMessageDoc] = Field(default_factory=list)
    total_tokens: int = 0
    created_at: str | datetime | None = None
    updated_at: str | datetime | None = None

    @field_validator("messages", mode="before")
    @classmethod
    def _safe_messages(cls, v: Any) -> list[dict[str, Any]]:
        if not isinstance(v, list):
            return []
        return v[:500]  # cap to 500 messages per session

    @field_validator("total_tokens", mode="before")
    @classmethod
    def _cap_tokens(cls, v: Any) -> int:
        try:
            return max(0, int(v))
        except (TypeError, ValueError):
            return 0
