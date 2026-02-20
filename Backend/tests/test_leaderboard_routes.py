"""
Tests for leaderboard_routes.py
Covers: XP, streaks, moods, user rank, weekly winners.
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone


BASE = "/api/v1/leaderboard"
USER_ID = "testuser1234567890ab"


@pytest.fixture
def mock_leaderboard_db(mock_db):
    """Set up mock Firestore for leaderboard queries."""
    # Mock user_rewards docs
    reward_doc = MagicMock()
    reward_doc.id = USER_ID
    reward_doc.to_dict.return_value = {
        "total_xp": 1500,
        "level": 5,
        "badges": ["first_mood", "streak_7"],
        "display_name": "TestUser",
    }
    rewards_col = mock_db.collection("user_rewards")
    rewards_col.order_by.return_value = rewards_col
    rewards_col.limit.return_value = rewards_col
    rewards_col.stream.return_value = [reward_doc]
    rewards_col.get.return_value = [reward_doc]
    rewards_col.document.return_value.get.return_value = MagicMock(
        exists=True, to_dict=lambda: reward_doc.to_dict()
    )

    # Mock users collection for streaks/moods
    user_doc = MagicMock()
    user_doc.id = USER_ID
    user_doc.to_dict.return_value = {
        "current_streak": 14,
        "longest_streak": 30,
        "mood_count": 150,
        "average_mood": 7.5,
        "display_name": "TestUser",
    }
    users_col = mock_db.collection("users")
    users_col.order_by.return_value = users_col
    users_col.limit.return_value = users_col
    users_col.stream.return_value = [user_doc]
    users_col.get.return_value = [user_doc]
    users_col.document.return_value.get.return_value = MagicMock(
        exists=True, to_dict=lambda: user_doc.to_dict()
    )

    return mock_db


class TestXPLeaderboard:
    """Tests for GET /api/leaderboard/xp"""

    def test_xp_leaderboard(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/xp", headers=auth_headers)
        assert resp.status_code == 200

    def test_xp_leaderboard_with_limit(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/xp?limit=5", headers=auth_headers)
        assert resp.status_code == 200

    def test_xp_no_auth(self, client, mock_leaderboard_db):
        resp = client.get(f"{BASE}/xp")
        assert resp.status_code in (200, 401, 403, 422)


class TestStreaksLeaderboard:
    """Tests for GET /api/leaderboard/streaks"""

    def test_streaks_leaderboard(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/streaks", headers=auth_headers)
        assert resp.status_code == 200


class TestMoodsLeaderboard:
    """Tests for GET /api/leaderboard/moods"""

    def test_moods_leaderboard(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/moods", headers=auth_headers)
        assert resp.status_code == 200


class TestUserRank:
    """Tests for GET /api/leaderboard/user/<user_id>/rank"""

    def test_user_rank(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/user/{USER_ID}/rank", headers=auth_headers)
        assert resp.status_code == 200

    def test_user_rank_alt(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/user/{USER_ID}", headers=auth_headers)
        assert resp.status_code == 200


class TestWeeklyWinners:
    """Tests for GET /api/leaderboard/weekly-winners"""

    def test_weekly_winners(self, client, auth_headers, mock_leaderboard_db):
        resp = client.get(f"{BASE}/weekly-winners", headers=auth_headers)
        assert resp.status_code == 200
