from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from ..firebase_config import db


class AuthRepository:
    """Repository for auth-related Firestore operations."""

    def __init__(self) -> None:
        if db is None:
            raise RuntimeError("Database unavailable")
        self._db = db

    def create_user_profile(self, user_id: str, user_data: dict[str, Any]) -> None:
        self._db.collection("users").document(user_id).set(user_data, merge=True)

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        doc = self._db.collection("users").document(user_id).get()
        if not doc.exists:
            return {}
        return doc.to_dict() or {}

    def update_last_login(self, user_id: str) -> None:
        self._db.collection("users").document(user_id).set(
            {"last_login": datetime.now(UTC).isoformat()},
            merge=True,
        )

    def _session_doc_id(self, user_id: str, jti: str) -> str:
        return f"{user_id}:{jti}"

    def store_refresh_session(self, user_id: str, jti: str, refresh_token: str, expires_at: datetime) -> None:
        token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        self._db.collection("refresh_sessions").document(self._session_doc_id(user_id, jti)).set(
            {
                "user_id": user_id,
                "jti": jti,
                "token_hash": token_hash,
                "expires_at": expires_at.isoformat(),
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
        self._db.collection("refresh_sessions").document(self._session_doc_id(user_id, jti)).set(
            {
                "revoked": True,
                "revoked_reason": reason,
                "revoked_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

    def revoke_all_user_sessions(self, user_id: str, reason: str) -> None:
        query = self._db.collection("refresh_sessions").where(filter=FieldFilter("user_id", "==", user_id)).stream()
        now = datetime.now(UTC).isoformat()
        for doc in query:
            doc.reference.set(
                {
                    "revoked": True,
                    "revoked_reason": reason,
                    "revoked_at": now,
                },
                merge=True,
            )

    def blacklist_refresh_jti(self, user_id: str, jti: str, expires_at: datetime, reason: str) -> None:
        self._db.collection("refresh_blacklist").document(jti).set(
            {
                "user_id": user_id,
                "jti": jti,
                "expires_at": expires_at.isoformat(),
                "reason": reason,
                "created_at": datetime.now(UTC).isoformat(),
            },
            merge=True,
        )

    def is_refresh_jti_blacklisted(self, jti: str) -> bool:
        doc = self._db.collection("refresh_blacklist").document(jti).get()
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

        return datetime.now(UTC) < expiry
