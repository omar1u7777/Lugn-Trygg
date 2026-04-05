"""
[DB3] JournalRepository — Firestore access layer for the `journal_entries`
collection (and the users/{uid}/journal sub-collection mirror).

All reads pass through JournalEntryDoc validation before being returned.
Note: journal content is stored AES-encrypted in `content_encrypted`;
decryption happens in the service layer, not here.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from ..firebase_config import db
from ..schemas.firestore_schemas import JournalEntryDoc

logger = logging.getLogger(__name__)

_PAGE_SIZE = 20


def _normalize_uid(user_id: Any) -> str:
    if not user_id:
        raise ValueError("user_id must not be empty")
    uid = str(user_id).strip()
    if not uid:
        raise ValueError("user_id must not be empty")
    return uid


class JournalRepository:
    """Firestore repository for journal entries."""

    def __init__(self) -> None:
        if db is None:
            raise RuntimeError("Firestore unavailable")
        self._db = db

    # ──────────────────────────────────────────────────────────────
    # Write operations
    # ──────────────────────────────────────────────────────────────

    def create(self, user_id: str, entry_data: dict[str, Any]) -> str:
        """Persist an encrypted journal entry.  Returns the document ID."""
        uid = _normalize_uid(user_id)
        now = datetime.now(UTC).isoformat()
        payload = {
            **entry_data,
            "user_id": uid,
            "created_at": now,
            "updated_at": now,
        }
        # Validate schema before writing
        JournalEntryDoc.model_validate({"id": "", **payload})

        ref = self._db.collection("journal_entries").document()
        ref.set(payload)
        logger.info("JournalRepository.create uid=%s doc=%s", uid, ref.id)
        return ref.id

    def update(self, entry_id: str, user_id: str, updates: dict[str, Any]) -> None:
        """Update an existing journal entry after ownership check."""
        uid = _normalize_uid(user_id)
        eid = str(entry_id).strip()
        if not eid:
            raise ValueError("entry_id must not be empty")

        doc_ref = self._db.collection("journal_entries").document(eid)
        snap = doc_ref.get()
        if not snap.exists:
            raise KeyError(f"Journal entry {eid} not found")

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            raise PermissionError("Not the owner of this journal entry")

        updates["updated_at"] = datetime.now(UTC).isoformat()
        doc_ref.update(updates)

    def delete(self, entry_id: str, user_id: str) -> None:
        """Delete a journal entry after ownership check."""
        uid = _normalize_uid(user_id)
        eid = str(entry_id).strip()
        if not eid:
            raise ValueError("entry_id must not be empty")

        doc_ref = self._db.collection("journal_entries").document(eid)
        snap = doc_ref.get()
        if not snap.exists:
            raise KeyError(f"Journal entry {eid} not found")

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            raise PermissionError("Not the owner of this journal entry")

        doc_ref.delete()

    # ──────────────────────────────────────────────────────────────
    # Read operations
    # ──────────────────────────────────────────────────────────────

    def get_by_id(self, entry_id: str, user_id: str) -> JournalEntryDoc | None:
        """Fetch a single journal entry, verified to belong to user_id."""
        uid = _normalize_uid(user_id)
        eid = str(entry_id).strip()
        if not eid:
            raise ValueError("entry_id must not be empty")

        snap = self._db.collection("journal_entries").document(eid).get()
        if not snap.exists:
            return None

        data = snap.to_dict() or {}
        if data.get("user_id") != uid:
            return None

        return JournalEntryDoc.model_validate({"id": snap.id, **data})

    def list_for_user(
        self,
        user_id: str,
        limit: int = _PAGE_SIZE,
        start_after_id: str | None = None,
        tags: list[str] | None = None,
    ) -> list[JournalEntryDoc]:
        """Return up to `limit` journal entries for user_id, newest first.

        Optionally filter by `tags` (AND logic — all tags must be present).
        """
        uid = _normalize_uid(user_id)
        limit = max(1, min(int(limit), 100))

        query = (
            self._db.collection("journal_entries")
            .where(filter=FieldFilter("user_id", "==", uid))
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )

        if tags:
            for tag in tags[:5]:  # cap to avoid excessive compound queries
                query = query.where(filter=FieldFilter("tags", "array_contains", str(tag)[:100]))

        if start_after_id:
            cursor_snap = self._db.collection("journal_entries").document(start_after_id).get()
            if cursor_snap.exists:
                query = query.start_after(cursor_snap)

        results: list[JournalEntryDoc] = []
        for doc in query.stream():
            try:
                entry = JournalEntryDoc.model_validate({"id": doc.id, **(doc.to_dict() or {})})
                results.append(entry)
            except Exception as exc:  # noqa: BLE001
                logger.warning("JournalRepository: skipping invalid doc %s — %s", doc.id, exc)

        return results

    def search(self, user_id: str, keyword: str, limit: int = 20) -> list[JournalEntryDoc]:
        """Basic title-keyword search (Firestore does not support full-text).

        Fetches the last N entries and filters in Python.  For production
        full-text search, index entries in Algolia or Typesense.
        """
        uid = _normalize_uid(user_id)
        limit = max(1, min(int(limit), 50))
        kw = keyword.strip().lower()[:100]

        all_entries = self.list_for_user(uid, limit=200)
        return [e for e in all_entries if kw in (e.title or "").lower()][:limit]
