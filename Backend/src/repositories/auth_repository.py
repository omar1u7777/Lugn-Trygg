from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from ..firebase_config import db


def _normalize_id(value: Any, field_name: str) -> str:
    """Validate and normalize identifier fields used in Firestore paths."""
    if value is None:
        raise ValueError(f"{field_name} must not be empty")
    normalized = str(value).strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be empty")
    return normalized


def _normalize_reason(reason: Any) -> str:
    """Keep reason bounded and safe for logging/storage."""
    normalized = str(reason).strip() if reason is not None else ""
    return normalized[:256] if normalized else "unspecified"


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class AuthRepository:
    """Repository for auth-related Firestore operations."""

    def __init__(self) -> None:
        if db is None:
            raise RuntimeError("Database unavailable")
        self._db = db

    def create_user_profile(self, user_id: str, user_data: dict[str, Any]) -> None:
        normalized_user_id = _normalize_id(user_id, "user_id")
        self._db.collection("users").document(normalized_user_id).set(user_data, merge=True)

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        normalized_user_id = _normalize_id(user_id, "user_id")
        doc = self._db.collection("users").document(normalized_user_id).get()
        if not doc.exists:
            return {}
        return doc.to_dict() or {}

    def update_last_login(self, user_id: str) -> None:
        normalized_user_id = _normalize_id(user_id, "user_id")
        self._db.collection("users").document(normalized_user_id).set(
            {"last_login": datetime.now(UTC).isoformat()},
            merge=True,
        )

    def _session_doc_id(self, user_id: str, jti: str) -> str:
        normalized_user_id = _normalize_id(user_id, "user_id")
        normalized_jti = _normalize_id(jti, "jti")
        return f"{normalized_user_id}:{normalized_jti}"

    def store_refresh_session(self, user_id: str, jti: str, refresh_token: str, expires_at: datetime) -> None:
        if not refresh_token:
            raise ValueError("refresh_token must not be empty")

        normalized_user_id = _normalize_id(user_id, "user_id")
        normalized_jti = _normalize_id(jti, "jti")
        expiry = _ensure_utc(expires_at)
        token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        self._db.collection("refresh_sessions").document(self._session_doc_id(normalized_user_id, normalized_jti)).set(
            {
                "user_id": normalized_user_id,
                "jti": normalized_jti,
                "token_hash": token_hash,
                "expires_at": expiry.isoformat(),
                "revoked": False,
                "created_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

    def get_refresh_session(self, user_id: str, jti: str) -> dict[str, Any] | None:
        doc = self._db.collection("refresh_sessions").document(self._session_doc_id(user_id, jti)).get()
        if not doc.exists:
            return None
        return doc.to_dict() or None

    def revoke_refresh_session(self, user_id: str, jti: str, reason: str) -> None:
        normalized_reason = _normalize_reason(reason)
        self._db.collection("refresh_sessions").document(self._session_doc_id(user_id, jti)).set(
            {
                "revoked": True,
                "revoked_reason": normalized_reason,
                "revoked_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

    def revoke_all_user_sessions(self, user_id: str, reason: str) -> None:
        normalized_user_id = _normalize_id(user_id, "user_id")
        normalized_reason = _normalize_reason(reason)
        query = self._db.collection("refresh_sessions").where(filter=FieldFilter("user_id", "==", normalized_user_id)).stream()
        now = datetime.now(UTC).isoformat()
        for doc in query:
            doc.reference.set(
                {
                    "revoked": True,
                    "revoked_reason": normalized_reason,
                    "revoked_at": now,
                },
                merge=True,
            )

    def blacklist_refresh_jti(self, user_id: str, jti: str, expires_at: datetime, reason: str) -> None:
        normalized_user_id = _normalize_id(user_id, "user_id")
        normalized_jti = _normalize_id(jti, "jti")
        normalized_reason = _normalize_reason(reason)
        expiry = _ensure_utc(expires_at)
        self._db.collection("refresh_blacklist").document(normalized_jti).set(
            {
                "user_id": normalized_user_id,
                "jti": normalized_jti,
                "expires_at": expiry.isoformat(),
                "reason": normalized_reason,
                "created_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

    def is_refresh_jti_blacklisted(self, jti: str) -> bool:
        normalized_jti = _normalize_id(jti, "jti")
        doc = self._db.collection("refresh_blacklist").document(normalized_jti).get()
        if not doc.exists:
            return False

        data = doc.to_dict() or {}
        expires_at = data.get("expires_at")
        if not expires_at:
            return True

        try:
            expiry = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except Exception:
            return True

        expiry = _ensure_utc(expiry)

        return datetime.now(UTC) < expiry
