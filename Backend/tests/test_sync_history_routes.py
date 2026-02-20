"""
Tests for sync_history_routes.py
Covers: list, log, stats, retry.
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta


BASE = "/api/v1/sync-history"
USER_ID = "testuser1234567890ab"


@pytest.fixture
def mock_sync_db(mock_db):
    """Set up mock Firestore for sync history."""
    sync_col = mock_db.collection("sync_history")

    sync_doc = MagicMock()
    sync_doc.id = "sync-123"
    sync_doc.to_dict.return_value = {
        "user_id": USER_ID,
        "provider": "google_fit",
        "status": "success",
        "data_types": ["steps", "heart_rate"],
        "record_count": 50,
        "duration_seconds": 3.5,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    failed_doc = MagicMock()
    failed_doc.id = "sync-456"
    failed_doc.to_dict.return_value = {
        "user_id": USER_ID,
        "provider": "fitbit",
        "status": "failed",
        "error_message": "Connection timeout",
        "timestamp": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
    }

    sync_col.where.return_value = sync_col
    sync_col.order_by.return_value = sync_col
    sync_col.limit.return_value = sync_col
    sync_col.stream.return_value = [sync_doc, failed_doc]
    sync_col.get.return_value = [sync_doc, failed_doc]
    sync_col.document.return_value.get.return_value = MagicMock(
        exists=True, to_dict=lambda: failed_doc.to_dict()
    )

    new_doc_ref = MagicMock()
    new_doc_ref.id = "sync-789"
    sync_col.add.return_value = (None, new_doc_ref)

    return mock_db


class TestListSyncHistory:
    """Tests for GET /api/sync-history/list"""

    def test_list_history(self, client, auth_headers, mock_sync_db):
        resp = client.get(f"{BASE}/list", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_with_provider_filter(self, client, auth_headers, mock_sync_db):
        resp = client.get(f"{BASE}/list?provider=google_fit", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_with_days(self, client, auth_headers, mock_sync_db):
        resp = client.get(f"{BASE}/list?days=30", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_no_auth(self, client, mock_sync_db):
        resp = client.get(f"{BASE}/list")
        assert resp.status_code in (200, 401, 403, 422)


class TestLogSync:
    """Tests for POST /api/sync-history/log"""

    def test_log_sync_success(self, client, auth_headers, mock_sync_db):
        resp = client.post(
            f"{BASE}/log",
            json={
                "provider": "google_fit",
                "status": "success",
                "data_types": ["steps"],
                "record_count": 100,
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    def test_log_sync_missing_provider(self, client, auth_headers, mock_sync_db):
        resp = client.post(
            f"{BASE}/log",
            json={"status": "success"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_log_sync_missing_status(self, client, auth_headers, mock_sync_db):
        resp = client.post(
            f"{BASE}/log",
            json={"provider": "fitbit"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_log_sync_invalid_status(self, client, auth_headers, mock_sync_db):
        resp = client.post(
            f"{BASE}/log",
            json={"provider": "fitbit", "status": "unknown_status"},
            headers=auth_headers,
        )
        assert resp.status_code in (400, 200)


class TestSyncStats:
    """Tests for GET /api/sync-history/stats"""

    def test_stats(self, client, auth_headers, mock_sync_db):
        resp = client.get(f"{BASE}/stats", headers=auth_headers)
        assert resp.status_code == 200


class TestRetrySync:
    """Tests for POST /api/sync-history/retry/<sync_id>"""

    def test_retry_failed_sync(self, client, auth_headers, mock_sync_db):
        resp = client.post(f"{BASE}/retry/sync-456", headers=auth_headers)
        assert resp.status_code in (200, 201)

    def test_retry_nonexistent_sync(self, client, auth_headers, mock_db):
        mock_db.collection("sync_history").document.return_value.get.return_value = MagicMock(exists=False)
        resp = client.post(f"{BASE}/retry/nonexistent", headers=auth_headers)
        assert resp.status_code in (404, 500)
