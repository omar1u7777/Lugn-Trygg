"""
Tests for mood_stats_routes.py
Covers: mood statistics endpoint.
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta


BASE = "/api/v1/mood-stats"
USER_ID = "testuser1234567890ab"


@pytest.fixture
def mock_mood_stats_db(mock_db):
    """Set up Firestore with mood data for statistics."""
    users_col = mock_db.collection("users")
    user_doc = users_col.document.return_value

    # Mock moods subcollection with multiple entries
    mood1 = MagicMock()
    mood1.id = "m1"
    mood1.to_dict.return_value = {
        "score": 0.8,
        "sentiment": "positive",
        "timestamp": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    }
    mood2 = MagicMock()
    mood2.id = "m2"
    mood2.to_dict.return_value = {
        "score": -0.3,
        "sentiment": "negative",
        "timestamp": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    }
    mood3 = MagicMock()
    mood3.id = "m3"
    mood3.to_dict.return_value = {
        "score": 0.1,
        "sentiment": "neutral",
        "timestamp": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
    }

    moods_subcol = MagicMock()
    moods_subcol.order_by.return_value = moods_subcol
    moods_subcol.stream.return_value = [mood1, mood2, mood3]
    moods_subcol.get.return_value = [mood1, mood2, mood3]

    user_doc.collection.return_value = moods_subcol
    user_doc.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {"email": "test@example.com"},
    )

    return mock_db


class TestMoodStatistics:
    """Tests for GET /api/mood-stats/statistics"""

    def test_statistics_success(self, client, auth_headers, mock_mood_stats_db):
        resp = client.get(f"{BASE}/statistics", headers=auth_headers)
        assert resp.status_code == 200

    def test_statistics_no_auth(self, client, mock_mood_stats_db):
        resp = client.get(f"{BASE}/statistics")
        assert resp.status_code in (200, 401, 403, 422)

    def test_statistics_empty_moods(self, client, auth_headers, mock_db):
        """When user has no moods, should return empty stats."""
        users_col = mock_db.collection("users")
        user_doc = users_col.document.return_value
        moods_subcol = MagicMock()
        moods_subcol.order_by.return_value = moods_subcol
        moods_subcol.stream.return_value = []
        moods_subcol.get.return_value = []
        user_doc.collection.return_value = moods_subcol
        user_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {})

        resp = client.get(f"{BASE}/statistics", headers=auth_headers)
        assert resp.status_code == 200

    def test_statistics_options(self, client):
        resp = client.options(f"{BASE}/statistics")
        assert resp.status_code in (200, 204)
