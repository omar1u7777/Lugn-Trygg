"""
[DB3] MoodRepository — Firestore access layer for the `moods` collection.

All Firestore reads pass through MoodEntryDoc Pydantic validation before
being returned to callers, ensuring schema correctness at the data boundary.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from ..firebase_config import db
from ..schemas.firestore_schemas import MoodEntryDoc

logger = logging.getLogger(__name__)

_PAGE_SIZE = 50  # default page size for list queries


def _normalize_uid(user_id: Any) -> str:
    if not user_id:
        raise ValueError("user_id must not be empty")
    uid = str(user_id).strip()
    if not uid:
        raise ValueError("user_id must not be empty")
    return uid


class MoodRepository:
    """Firestore repository for mood entries."""

    def __init__(self) -> None:
        if db is None:
            raise RuntimeError("Firestore unavailable")
        self._db = db

    # ──────────────────────────────────────────────────────────────
    # Write operations
    # ──────────────────────────────────────────────────────────────

    def create(self, user_id: str, mood_data: dict[str, Any]) -> str:
        """Persist a new mood entry.  Returns the generated document ID."""
        uid = _normalize_uid(user_id)
        now = datetime.now(UTC).isoformat()
        payload = {
            **mood_data,
            "user_id": uid,
            "created_at": now,
            "lastWrite": now,  # [D4] rate-limit guard
        }
        # Validate before writing
        MoodEntryDoc.model_validate({"id": "", **payload})

        ref = self._db.collection("moods").document()
        ref.set(payload)
        logger.info("MoodRepository.create uid=%s doc=%s", uid, ref.id)
        return ref.id

    def update(self, mood_id: str, user_id: str, updates: dict[str, Any]) -> None:
        """Update an existing mood entry after ownership check."""
        uid = _normalize_uid(user_id)
        mid = str(mood_id).strip()
        if not mid:
            raise ValueError("mood_id must not be empty")

        doc_ref = self._db.collection("moods").document(mid)
        snap = doc_ref.get()
        if not snap.exists:
            raise KeyError(f"Mood {mid} not found")

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            raise PermissionError("Not the owner of this mood entry")

        updates["lastWrite"] = datetime.now(UTC).isoformat()
        doc_ref.update(updates)

    def delete(self, mood_id: str, user_id: str) -> None:
        """Delete a mood entry after ownership check."""
        uid = _normalize_uid(user_id)
        mid = str(mood_id).strip()
        if not mid:
            raise ValueError("mood_id must not be empty")

        doc_ref = self._db.collection("moods").document(mid)
        snap = doc_ref.get()
        if not snap.exists:
            raise KeyError(f"Mood {mid} not found")

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            raise PermissionError("Not the owner of this mood entry")

        doc_ref.delete()

    # ──────────────────────────────────────────────────────────────
    # Read operations
    # ──────────────────────────────────────────────────────────────

    def get_by_id(self, mood_id: str, user_id: str) -> MoodEntryDoc | None:
        """Fetch a single mood entry, verified to belong to user_id."""
        uid = _normalize_uid(user_id)
        mid = str(mood_id).strip()
        if not mid:
            raise ValueError("mood_id must not be empty")

        snap = self._db.collection("moods").document(mid).get()
        if not snap.exists:
            return None

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            return None  # treat as not found (ownership failure)

        return MoodEntryDoc.model_validate({"id": snap.id, **data})

    def list_for_user(
        self,
        user_id: str,
        limit: int = _PAGE_SIZE,
        start_after_id: str | None = None,
    ) -> list[MoodEntryDoc]:
        """Return up to `limit` mood entries for user_id, newest first."""
        uid = _normalize_uid(user_id)
        limit = max(1, min(int(limit), 200))

        query = (
            self._db.collection("moods")
            .where(filter=FieldFilter("user_id", "==", uid))
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )

        if start_after_id:
            cursor_snap = self._db.collection("moods").document(start_after_id).get()
            if cursor_snap.exists:
                query = query.start_after(cursor_snap)

        results: list[MoodEntryDoc] = []
        for doc in query.stream():
            try:
                entry = MoodEntryDoc.model_validate({"id": doc.id, **(doc.to_dict() or {})})
                results.append(entry)
            except Exception as exc:  # noqa: BLE001
                logger.warning("MoodRepository: skipping invalid doc %s — %s", doc.id, exc)

        return results

    def list_in_range(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
    ) -> list[MoodEntryDoc]:
        """Return mood entries for user_id within a UTC date range."""
        uid = _normalize_uid(user_id)
        start_iso = start.isoformat()
        end_iso = end.isoformat()

        query = (
            self._db.collection("moods")
            .where(filter=FieldFilter("user_id", "==", uid))
            .where(filter=FieldFilter("created_at", ">=", start_iso))
            .where(filter=FieldFilter("created_at", "<=", end_iso))
            .order_by("created_at")
            .limit(500)
        )

        results: list[MoodEntryDoc] = []
        for doc in query.stream():
            try:
                entry = MoodEntryDoc.model_validate({"id": doc.id, **(doc.to_dict() or {})})
                results.append(entry)
            except Exception as exc:  # noqa: BLE001
                logger.warning("MoodRepository: skipping invalid doc %s — %s", doc.id, exc)

        return results
