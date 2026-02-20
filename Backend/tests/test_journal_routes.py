"""
Tests for journal_routes.py
Covers: CRUD operations for journal entries.
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone


BASE = "/api/v1/journal"
USER_ID = "testuser1234567890ab"
OTHER_USER_ID = "otheruserid123456789"  # Valid 20-char alphanumeric, != USER_ID
ENTRY_ID = "entry_123456"  # Valid 12-char entry ID matching [a-zA-Z0-9_-]{10,64}


@pytest.fixture
def mock_journal_db(mock_db):
    """Set up mock Firestore for journal queries using collection side_effect."""

    # --- User document (for user-existence check) ---
    mock_user_doc = MagicMock()
    mock_user_doc.exists = True
    mock_user_doc.to_dict.return_value = {
        "email": "test@example.com",
        "name": "Test User",
    }
    mock_user_ref = MagicMock()
    mock_user_ref.get.return_value = mock_user_doc

    # --- Existing journal entry document ---
    entry_doc = MagicMock()
    entry_doc.id = ENTRY_ID
    entry_doc.exists = True
    entry_doc.to_dict.return_value = {
        "content": "Today was a good day",
        "mood": 8,
        "tags": ["happy"],
        "user_id": USER_ID,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    # --- Journal document ref (used for POST new doc + GET/PUT/DELETE existing) ---
    mock_journal_doc_ref = MagicMock()
    mock_journal_doc_ref.id = "new_entry_456789"
    mock_journal_doc_ref.set = MagicMock()
    mock_journal_doc_ref.update = MagicMock()
    mock_journal_doc_ref.delete = MagicMock()
    mock_journal_doc_ref.get.return_value = entry_doc

    def col(name):
        if name == "users":
            c = MagicMock()
            c.document.return_value = mock_user_ref
            return c
        if name == "journal_entries":
            c = MagicMock()
            c.document.return_value = mock_journal_doc_ref
            # Chain for where().order_by().limit().stream()
            c.where.return_value = c
            c.order_by.return_value = c
            c.limit.return_value = c
            c.stream.return_value = [entry_doc]
            return c
        return MagicMock()

    mock_db.collection.side_effect = col
    return mock_db


class TestListJournalEntries:
    """Tests for GET /api/v1/journal/<user_id>/journal"""

    def test_list_entries_success(self, client, auth_headers, mock_journal_db):
        resp = client.get(f"{BASE}/{USER_ID}/journal", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "entries" in body["data"]
        assert len(body["data"]["entries"]) == 1

    def test_list_entries_unauthorized(self, client, auth_headers, mock_journal_db):
        # Valid UID that differs from g.user_id → 403
        resp = client.get(f"{BASE}/{OTHER_USER_ID}/journal", headers=auth_headers)
        assert resp.status_code == 403

    def test_list_entries_no_auth(self, client, mock_journal_db):
        # conftest mock bypasses auth (always sets g.user_id), so returns 200
        resp = client.get(f"{BASE}/{USER_ID}/journal")
        assert resp.status_code == 200

    def test_list_entries_options(self, client):
        resp = client.options(f"{BASE}/{USER_ID}/journal")
        assert resp.status_code in (200, 204)


class TestCreateJournalEntry:
    """Tests for POST /api/v1/journal/<user_id>/journal"""

    def test_create_entry_success(self, client, auth_headers, mock_journal_db):
        resp = client.post(
            f"{BASE}/{USER_ID}/journal",
            json={"content": "This is my journal entry for today", "mood": 7, "tags": ["good"]},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["success"] is True

    def test_create_entry_missing_content(self, client, auth_headers, mock_journal_db):
        resp = client.post(
            f"{BASE}/{USER_ID}/journal",
            json={"mood": 5},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_create_entry_content_too_short(self, client, auth_headers, mock_journal_db):
        resp = client.post(
            f"{BASE}/{USER_ID}/journal",
            json={"content": "ab"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_create_entry_invalid_mood(self, client, auth_headers, mock_journal_db):
        # mood=15 exceeds 1-10 range → 400
        resp = client.post(
            f"{BASE}/{USER_ID}/journal",
            json={"content": "Valid content text here", "mood": 15},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestUpdateJournalEntry:
    """Tests for PUT /api/v1/journal/<user_id>/journal/<entry_id>"""

    def test_update_entry_success(self, client, auth_headers, mock_journal_db):
        resp = client.put(
            f"{BASE}/{USER_ID}/journal/{ENTRY_ID}",
            json={"content": "Updated journal content here"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True

    def test_update_entry_not_found(self, client, auth_headers, mock_db):
        """Entry doesn't exist → 404."""
        not_found_doc = MagicMock()
        not_found_doc.exists = False

        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {"email": "test@example.com"}
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc

        mock_entry_ref = MagicMock()
        mock_entry_ref.get.return_value = not_found_doc

        def col(name):
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            if name == "journal_entries":
                c = MagicMock()
                c.document.return_value = mock_entry_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.put(
            f"{BASE}/{USER_ID}/journal/{ENTRY_ID}",
            json={"content": "Updated text content here"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestDeleteJournalEntry:
    """Tests for DELETE /api/v1/journal/<user_id>/journal/<entry_id>"""

    def test_delete_entry_success(self, client, auth_headers, mock_journal_db):
        resp = client.delete(
            f"{BASE}/{USER_ID}/journal/{ENTRY_ID}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True

    def test_delete_entry_wrong_user(self, client, auth_headers, mock_journal_db):
        # Different valid UID triggers 403 from auth check
        resp = client.delete(
            f"{BASE}/{OTHER_USER_ID}/journal/{ENTRY_ID}",
            headers=auth_headers,
        )
        assert resp.status_code == 403
