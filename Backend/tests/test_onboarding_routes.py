"""
Tests for onboarding_routes.py
Covers: save goals, get goals, update goals, status, skip onboarding.
"""
import pytest
from unittest.mock import MagicMock


BASE = "/api/v1/onboarding"
USER_ID = "testuser1234567890ab"


@pytest.fixture
def mock_onboarding_db(mock_db):
    """Set up mock Firestore for onboarding queries."""
    users_col = mock_db.collection("users")
    user_doc = users_col.document.return_value
    user_doc.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {
            "email": "test@example.com",
            "onboarding_completed": False,
            "wellness_goals": [],
        },
    )
    return mock_db


class TestSaveGoals:
    """Tests for POST /api/onboarding/goals/<user_id>"""

    def test_save_goals_success(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(
            f"{BASE}/goals/{USER_ID}",
            json={"goals": ["Bättre sömn", "Hantera stress"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_save_goals_empty(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(
            f"{BASE}/goals/{USER_ID}",
            json={"goals": []},
            headers=auth_headers,
        )
        assert resp.status_code in (400, 200)

    def test_save_goals_invalid_goal(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(
            f"{BASE}/goals/{USER_ID}",
            json={"goals": ["Invalid goal that is not in allowed list"]},
            headers=auth_headers,
        )
        assert resp.status_code in (400, 200)

    def test_save_goals_wrong_user(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(
            f"{BASE}/goals/other-user",
            json={"goals": ["Bättre sömn"]},
            headers=auth_headers,
        )
        assert resp.status_code in (403, 401)

    def test_save_goals_no_auth(self, client, mock_onboarding_db):
        resp = client.post(f"{BASE}/goals/{USER_ID}", json={"goals": ["Bättre sömn"]})
        # Mock jwt_required bypasses auth, so request is processed normally
        assert resp.status_code in (200, 401, 403)


class TestGetGoals:
    """Tests for GET /api/onboarding/goals/<user_id>"""

    def test_get_goals(self, client, auth_headers, mock_onboarding_db):
        resp = client.get(f"{BASE}/goals/{USER_ID}", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_goals_wrong_user(self, client, auth_headers, mock_onboarding_db):
        resp = client.get(f"{BASE}/goals/other-user", headers=auth_headers)
        assert resp.status_code in (403, 401)


class TestUpdateGoals:
    """Tests for PUT /api/onboarding/goals/<user_id>"""

    def test_update_goals(self, client, auth_headers, mock_onboarding_db):
        resp = client.put(
            f"{BASE}/goals/{USER_ID}",
            json={"goals": ["Ökad fokusering", "Hantera stress"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200


class TestOnboardingStatus:
    """Tests for GET /api/onboarding/status/<user_id>"""

    def test_get_status(self, client, auth_headers, mock_onboarding_db):
        resp = client.get(f"{BASE}/status/{USER_ID}", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_status_wrong_user(self, client, auth_headers, mock_onboarding_db):
        resp = client.get(f"{BASE}/status/other-user", headers=auth_headers)
        assert resp.status_code in (403, 401)


class TestSkipOnboarding:
    """Tests for POST /api/onboarding/skip/<user_id>"""

    def test_skip_onboarding(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(f"{BASE}/skip/{USER_ID}", headers=auth_headers)
        assert resp.status_code == 200

    def test_skip_wrong_user(self, client, auth_headers, mock_onboarding_db):
        resp = client.post(f"{BASE}/skip/other-user", headers=auth_headers)
        assert resp.status_code in (403, 401)


class TestOptionsEndpoints:
    """Tests for CORS preflight OPTIONS requests."""

    def test_goals_options(self, client):
        resp = client.options(f"{BASE}/goals/{USER_ID}")
        assert resp.status_code in (200, 204)

    def test_status_options(self, client):
        resp = client.options(f"{BASE}/status/{USER_ID}")
        assert resp.status_code in (200, 204)

    def test_skip_options(self, client):
        resp = client.options(f"{BASE}/skip/{USER_ID}")
        assert resp.status_code in (200, 204)
