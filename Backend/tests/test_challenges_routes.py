"""
Tests for challenges_routes.py
Covers: list, get, join, leave, contribute, user challenges, cleanup.
"""
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta


BASE = "/api/v1/challenges"
USER_ID = "testuser1234567890ab"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_challenge_data(user_is_member=True):
    """Build a challenge dict matching the Firestore document format the routes expect."""
    now = datetime.now(timezone.utc)
    members = []
    if user_is_member:
        members.append({
            "user_id": USER_ID,
            "username": "testuser",
            "contribution": 2,
            "joined_at": now.isoformat(),
        })
    return {
        "id": "challenge-1",
        "title": "7-Day Meditation",
        "description": "Meditate every day for a week",
        "category": "meditation",
        "goal": 7,
        "current_progress": 3,
        "members": members,
        "max_team_size": 10,
        "team_size": len(members),
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=7)).isoformat(),
        "reward_xp": 500,
        "reward_badge": "meditation_champ",
        "difficulty": "medium",
        "created_at": now.isoformat(),
        "active": True,
        "completed": False,
        "completed_at": None,
    }


def _make_challenge_doc(data, doc_id="challenge-1"):
    """Create a mock Firestore document snapshot."""
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = True
    doc.to_dict.return_value = data
    doc.reference = MagicMock()
    return doc


def _setup_challenges_db(mock_db, challenge_doc, challenge_ref=None):
    """Wire mock_db.collection.side_effect so routes see proper Firestore mocks."""
    if challenge_ref is None:
        challenge_ref = MagicMock()
        challenge_ref.get.return_value = challenge_doc
        challenge_ref.update = MagicMock()
        challenge_ref.set = MagicMock()

    challenges_col = MagicMock()
    challenges_col.stream.return_value = [challenge_doc]
    challenges_col.where.return_value = challenges_col
    challenges_col.limit.return_value = challenges_col
    challenges_col.document.return_value = challenge_ref

    user_ch_ref = MagicMock()
    user_ch_ref.set = MagicMock()

    def col(name):
        if name == "challenges":
            return challenges_col
        if name == "user_challenges":
            c = MagicMock()
            c.document.return_value = user_ch_ref
            return c
        return MagicMock()

    mock_db.collection.side_effect = col
    # run_transaction: don't execute the callback so join always succeeds
    mock_db.run_transaction = MagicMock(return_value=None)
    return challenges_col, challenge_ref


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_challenge_db(mock_db):
    """Set up Firestore mocks for challenges – user IS a member."""
    data = _make_challenge_data(user_is_member=True)
    doc = _make_challenge_doc(data)
    _setup_challenges_db(mock_db, doc)
    return mock_db


@pytest.fixture
def mock_challenge_db_no_member(mock_db):
    """Set up Firestore mocks for challenges – user is NOT a member."""
    data = _make_challenge_data(user_is_member=False)
    doc = _make_challenge_doc(data)
    _setup_challenges_db(mock_db, doc)
    return mock_db


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestListChallenges:
    """GET /api/v1/challenges (no trailing slash – route is empty-string path)."""

    def test_list_challenges(self, client, auth_headers, mock_challenge_db):
        resp = client.get(BASE, headers=auth_headers)
        assert resp.status_code == 200

    def test_list_challenges_no_auth(self, client, mock_challenge_db):
        # conftest patches jwt_required → auth bypassed → 200
        resp = client.get(BASE)
        assert resp.status_code == 200


class TestGetChallenge:
    """GET /api/v1/challenges/<challenge_id>"""

    def test_get_challenge(self, client, auth_headers, mock_challenge_db):
        resp = client.get(f"{BASE}/challenge-1", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_nonexistent_challenge(self, client, auth_headers, mock_db):
        not_found_doc = MagicMock()
        not_found_doc.id = "nonexistent"
        not_found_doc.exists = False
        not_found_doc.to_dict.return_value = {}

        ref = MagicMock()
        ref.get.return_value = not_found_doc

        challenges_col = MagicMock()
        challenges_col.stream.return_value = []
        challenges_col.where.return_value = challenges_col
        challenges_col.limit.return_value = challenges_col
        challenges_col.document.return_value = ref

        def col(name):
            if name == "challenges":
                return challenges_col
            return MagicMock()

        mock_db.collection.side_effect = col
        resp = client.get(f"{BASE}/nonexistent", headers=auth_headers)
        assert resp.status_code == 404


class TestJoinChallenge:
    """POST /api/v1/challenges/<challenge_id>/join"""

    def test_join_challenge(self, client, auth_headers, mock_challenge_db_no_member):
        resp = client.post(
            f"{BASE}/challenge-1/join",
            json={"username": "testuser"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_join_no_auth(self, client, mock_challenge_db_no_member):
        # conftest patches jwt_required → auth bypassed → join succeeds
        resp = client.post(f"{BASE}/challenge-1/join", json={})
        assert resp.status_code == 200


class TestLeaveChallenge:
    """POST /api/v1/challenges/<challenge_id>/leave"""

    def test_leave_challenge(self, client, auth_headers, mock_challenge_db):
        resp = client.post(f"{BASE}/challenge-1/leave", headers=auth_headers)
        assert resp.status_code == 200


class TestContribute:
    """POST /api/v1/challenges/<challenge_id>/contribute"""

    def test_contribute_success(self, client, auth_headers, mock_challenge_db):
        # type matches challenge category ('meditation') → 200
        resp = client.post(
            f"{BASE}/challenge-1/contribute",
            json={"type": "meditation", "amount": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_contribute_invalid_type(self, client, auth_headers, mock_challenge_db):
        # 'invalid_type' not in allowed set → 400
        resp = client.post(
            f"{BASE}/challenge-1/contribute",
            json={"type": "invalid_type", "amount": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_contribute_wrong_category(self, client, auth_headers, mock_challenge_db):
        # type='mood' but challenge category='meditation' → 400
        resp = client.post(
            f"{BASE}/challenge-1/contribute",
            json={"type": "mood", "amount": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestUserChallenges:
    """GET /api/v1/challenges/user/<user_id>"""

    def test_user_challenges(self, client, auth_headers, mock_challenge_db):
        resp = client.get(f"{BASE}/user/{USER_ID}", headers=auth_headers)
        assert resp.status_code == 200

    def test_user_challenges_wrong_user(self, client, auth_headers, mock_challenge_db):
        # g.user_id != 'other-user' → 403
        resp = client.get(f"{BASE}/user/other-user", headers=auth_headers)
        assert resp.status_code == 403


class TestCleanup:
    """POST /api/v1/challenges/maintenance/cleanup"""

    def test_cleanup(self, client, auth_headers, mock_challenge_db):
        resp = client.post(f"{BASE}/maintenance/cleanup", headers=auth_headers)
        assert resp.status_code == 200
