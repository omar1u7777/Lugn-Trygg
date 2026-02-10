"""
Comprehensive tests for feedback_routes.py
Tests feedback submission, listing, statistics, and user feedback history.

NOTE: Uses client fixture from conftest.py which properly mocks Firebase.
Blueprint registered at /api/v1/feedback in main.py.
"""
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE = "/api/v1/feedback"

# Must be 20-128 alphanumeric chars to satisfy USER_ID_PATTERN
VALID_USER_ID = "a" * 20


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def mock_email():
    """Mock EmailService used inside feedback_routes."""
    with patch("src.routes.feedback_routes.email_service") as mock:
        yield mock


@pytest.fixture
def mock_field_filter(mocker):
    """Mock FieldFilter so that google.cloud.firestore imports succeed."""
    mocker.patch(
        "google.cloud.firestore.FieldFilter",
        side_effect=lambda *args, **kwargs: MagicMock(),
    )


def _make_admin_user_mock():
    """Return a mock user doc that passes the admin check."""
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {
        "role": "admin",
        "email": "admin@example.com",
        "name": "Admin User",
        "feedback_submissions": 0,
    }
    return doc


def _make_regular_user_mock(extra=None):
    """Return a mock user doc for a non-admin user."""
    data = {
        "email": "user@example.com",
        "name": "Test User",
        "feedback_submissions": 5,
    }
    if extra:
        data.update(extra)
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = data
    return doc


# ===================================================================
# /submit  (POST - public, no jwt_required)
# ===================================================================
class TestSubmitFeedback:
    """Tests for POST /api/v1/feedback/submit"""

    def test_submit_feedback_success(self, mock_db, mock_email, client):
        """Successful submission stores feedback and returns feedbackId."""
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "feedback123"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={
                "user_id": VALID_USER_ID,
                "rating": 5,
                "category": "feature",
                "message": "Great app!",
                "allow_contact": True,
            },
            content_type="application/json",
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["feedbackId"] == "feedback123"

        # Verify feedback document was stored
        mock_feedback_ref.set.assert_called_once()
        stored = mock_feedback_ref.set.call_args[0][0]
        assert stored["user_id"] == VALID_USER_ID
        assert stored["rating"] == 5
        assert stored["status"] == "pending"

    def test_submit_feedback_with_feature_request(self, mock_db, mock_email, client):
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_feat"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={
                "user_id": VALID_USER_ID,
                "rating": 4,
                "category": "feature",
                "feature_request": "Add dark mode please",
            },
            content_type="application/json",
        )
        assert resp.status_code == 200
        stored = mock_feedback_ref.set.call_args[0][0]
        assert stored["feature_request"] == "Add dark mode please"

    def test_submit_feedback_with_bug_report(self, mock_db, mock_email, client):
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_bug"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={
                "user_id": VALID_USER_ID,
                "rating": 3,
                "category": "bug",
                "bug_report": "App crashes on startup",
            },
            content_type="application/json",
        )
        assert resp.status_code == 200
        stored = mock_feedback_ref.set.call_args[0][0]
        assert stored["bug_report"] == "App crashes on startup"

    def test_submit_feedback_missing_user_id(self, client):
        resp = client.post(
            f"{BASE}/submit",
            json={"rating": 5, "message": "Great!"},
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert "user_id" in body["message"].lower()

    def test_submit_feedback_invalid_user_id_format(self, client):
        """user_id shorter than 20 chars should be rejected."""
        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": "short", "rating": 5, "message": "Hi"},
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False

    def test_submit_feedback_invalid_rating_too_high(self, client):
        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 6, "message": "Test"},
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "rating" in body["message"].lower()

    def test_submit_feedback_invalid_rating_too_low(self, client):
        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 0, "message": "Bad"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_submit_feedback_no_content(self, client):
        """Missing message, feature_request, and bug_report -> 400."""
        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 3},
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "feedback" in body["message"].lower()

    def test_submit_feedback_email_confirmation_sent(self, mock_db, mock_email, client):
        """Confirmation email sent when allow_contact is True and user has email."""
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_email"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={
                "user_id": VALID_USER_ID,
                "rating": 5,
                "message": "Great!",
                "allow_contact": True,
            },
            content_type="application/json",
        )
        assert resp.status_code == 200
        mock_email.send_feedback_confirmation.assert_called_once()
        assert (
            mock_email.send_feedback_confirmation.call_args[1]["to_email"]
            == "user@example.com"
        )

    def test_submit_feedback_admin_notification_sent(self, mock_db, mock_email, client):
        """Admin notification email is always sent."""
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_admin"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={
                "user_id": VALID_USER_ID,
                "rating": 3,
                "message": "Feedback",
            },
            content_type="application/json",
        )
        assert resp.status_code == 200
        mock_email.send_feedback_admin_notification.assert_called_once()

    def test_submit_feedback_email_failure_does_not_break(
        self, mock_db, mock_email, client
    ):
        """Email errors are swallowed - submission still succeeds."""
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_fail"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock()

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col
        mock_email.send_feedback_admin_notification.side_effect = Exception("SMTP down")

        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 4, "message": "Test"},
            content_type="application/json",
        )
        assert resp.status_code == 200

    def test_submit_feedback_updates_user_stats(self, mock_db, mock_email, client):
        """User's feedback_submissions counter is incremented."""
        mock_feedback_ref = MagicMock()
        mock_feedback_ref.id = "fb_stats"

        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = _make_regular_user_mock(
            {"feedback_submissions": 10}
        )

        def col(name):
            if name == "feedback":
                c = MagicMock()
                c.document.return_value = mock_feedback_ref
                return c
            if name == "users":
                c = MagicMock()
                c.document.return_value = mock_user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 5, "message": "Test"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        mock_user_ref.update.assert_called_once()
        update_data = mock_user_ref.update.call_args[0][0]
        assert update_data["feedback_submissions"] == 11

    def test_submit_feedback_options_request(self, client):
        """OPTIONS preflight returns 204 (handled by before_request)."""
        resp = client.options(f"{BASE}/submit")
        assert resp.status_code == 204

    def test_submit_feedback_database_error(self, mock_db, client):
        """Database error -> 500 with error envelope."""
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            f"{BASE}/submit",
            json={"user_id": VALID_USER_ID, "rating": 5, "message": "Test"},
            content_type="application/json",
        )
        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False


# ===================================================================
# /list  (GET - admin only, jwt_required)
# ===================================================================
class TestListFeedback:
    """Tests for GET /api/v1/feedback/list (admin only)"""

    def _setup_admin_and_feedback(self, mock_db, feedback_docs):
        """Helper: mock admin user check + feedback collection query chain."""
        admin_doc = _make_admin_user_mock()

        # Build fluent query chain: collection -> order_by -> [where] -> limit -> stream
        mock_fb_col = MagicMock()
        chain = MagicMock()
        chain.limit.return_value = chain
        chain.where.return_value = chain
        chain.stream.return_value = feedback_docs
        mock_fb_col.order_by.return_value = chain

        admin_ref = MagicMock()
        admin_ref.get.return_value = admin_doc

        def col(name):
            if name == "feedback":
                return mock_fb_col
            if name == "users":
                c = MagicMock()
                c.document.return_value = admin_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

    def test_list_feedback_success(self, mock_db, mock_field_filter, client):
        doc1 = MagicMock(id="fb1")
        doc1.to_dict.return_value = {
            "user_id": "user1",
            "rating": 5,
            "category": "feature",
            "message": "Great!",
            "status": "pending",
        }
        doc2 = MagicMock(id="fb2")
        doc2.to_dict.return_value = {
            "user_id": "user2",
            "rating": 3,
            "category": "bug",
            "message": "Issue",
            "status": "pending",
        }
        self._setup_admin_and_feedback(mock_db, [doc1, doc2])

        resp = client.get(f"{BASE}/list")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["count"] == 2
        assert len(body["data"]["feedback"]) == 2
        assert body["data"]["feedback"][0]["id"] == "fb1"

    def test_list_feedback_empty(self, mock_db, mock_field_filter, client):
        self._setup_admin_and_feedback(mock_db, [])

        resp = client.get(f"{BASE}/list")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["count"] == 0
        assert body["data"]["feedback"] == []

    def test_list_feedback_filter_by_status(self, mock_db, mock_field_filter, client):
        doc = MagicMock(id="fb_pending")
        doc.to_dict.return_value = {"status": "pending", "rating": 4}
        self._setup_admin_and_feedback(mock_db, [doc])

        resp = client.get(f"{BASE}/list?status=pending")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["count"] == 1

    def test_list_feedback_filter_by_category(self, mock_db, mock_field_filter, client):
        doc = MagicMock(id="fb_bug")
        doc.to_dict.return_value = {"category": "bug", "rating": 2}
        self._setup_admin_and_feedback(mock_db, [doc])

        resp = client.get(f"{BASE}/list?category=bug")
        assert resp.status_code == 200

    def test_list_feedback_with_limit(self, mock_db, mock_field_filter, client):
        docs = [MagicMock(id=f"fb{i}") for i in range(10)]
        for d in docs:
            d.to_dict.return_value = {"rating": 5}
        self._setup_admin_and_feedback(mock_db, docs)

        resp = client.get(f"{BASE}/list?limit=10")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["count"] == 10

    def test_list_feedback_non_admin_forbidden(self, mock_db, mock_field_filter, client):
        """Non-admin user gets 403."""
        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {"role": "user"}

        user_ref = MagicMock()
        user_ref.get.return_value = user_doc

        def col(name):
            if name == "users":
                c = MagicMock()
                c.document.return_value = user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/list")
        assert resp.status_code == 403
        assert resp.get_json()["success"] is False

    def test_list_feedback_user_not_found(self, mock_db, mock_field_filter, client):
        """User doc not found -> 404."""
        user_doc = MagicMock()
        user_doc.exists = False

        user_ref = MagicMock()
        user_ref.get.return_value = user_doc

        def col(name):
            if name == "users":
                c = MagicMock()
                c.document.return_value = user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/list")
        assert resp.status_code == 404

    def test_list_feedback_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("DB error")
        resp = client.get(f"{BASE}/list")
        assert resp.status_code == 500

    def test_list_feedback_options(self, client):
        resp = client.options(f"{BASE}/list")
        assert resp.status_code == 204


# ===================================================================
# /stats  (GET - admin only, jwt_required)
# ===================================================================
class TestFeedbackStats:
    """Tests for GET /api/v1/feedback/stats (admin only)"""

    def _setup_admin_and_stats(self, mock_db, feedback_docs):
        """Mock admin user + feedback collection (where -> stream)."""
        admin_doc = _make_admin_user_mock()
        admin_ref = MagicMock()
        admin_ref.get.return_value = admin_doc

        fb_col = MagicMock()
        chain = MagicMock()
        chain.stream.return_value = feedback_docs
        fb_col.where.return_value = chain

        def col(name):
            if name == "users":
                c = MagicMock()
                c.document.return_value = admin_ref
                return c
            if name == "feedback":
                return fb_col
            return MagicMock()

        mock_db.collection.side_effect = col

    def test_feedback_stats_success(self, mock_db, mock_field_filter, client):
        docs = []
        for rating, cat in [(5, "feature"), (4, "bug"), (5, "feature")]:
            d = MagicMock()
            d.to_dict.return_value = {"rating": rating, "category": cat}
            docs.append(d)

        self._setup_admin_and_stats(mock_db, docs)

        resp = client.get(f"{BASE}/stats")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["totalFeedback"] == 3
        assert body["data"]["averageRating"] == round((5 + 4 + 5) / 3, 2)
        assert body["data"]["categories"]["feature"] == 2
        assert body["data"]["categories"]["bug"] == 1

    def test_feedback_stats_empty(self, mock_db, mock_field_filter, client):
        self._setup_admin_and_stats(mock_db, [])

        resp = client.get(f"{BASE}/stats")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["totalFeedback"] == 0
        assert body["data"]["averageRating"] == 0
        assert body["data"]["categories"] == {}

    def test_feedback_stats_custom_days(self, mock_db, mock_field_filter, client):
        self._setup_admin_and_stats(mock_db, [])
        resp = client.get(f"{BASE}/stats?days=7")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["dateRangeDays"] == 7

    def test_feedback_stats_non_admin_forbidden(
        self, mock_db, mock_field_filter, client
    ):
        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {"role": "user"}
        user_ref = MagicMock()
        user_ref.get.return_value = user_doc

        def col(name):
            if name == "users":
                c = MagicMock()
                c.document.return_value = user_ref
                return c
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/stats")
        assert resp.status_code == 403

    def test_feedback_stats_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("DB error")
        resp = client.get(f"{BASE}/stats")
        assert resp.status_code == 500

    def test_feedback_stats_options(self, client):
        resp = client.options(f"{BASE}/stats")
        assert resp.status_code == 204


# ===================================================================
# /my-feedback  (GET - jwt_required, uses g.user_id)
# ===================================================================
class TestGetUserFeedback:
    """Tests for GET /api/v1/feedback/my-feedback"""

    def test_get_user_feedback_success(self, mock_db, mock_field_filter, client):
        doc1 = MagicMock(id="fb1")
        doc1.to_dict.return_value = {
            "user_id": "test-user-id",
            "rating": 5,
            "message": "Great!",
            "created_at": "2026-01-02T00:00:00",
        }
        doc2 = MagicMock(id="fb2")
        doc2.to_dict.return_value = {
            "user_id": "test-user-id",
            "rating": 4,
            "message": "Good",
            "created_at": "2026-01-01T00:00:00",
        }

        fb_col = MagicMock()
        chain = MagicMock()
        chain.stream.return_value = [doc1, doc2]
        fb_col.where.return_value = chain

        def col(name):
            if name == "feedback":
                return fb_col
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/my-feedback")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["count"] == 2
        assert len(body["data"]["feedback"]) == 2

    def test_get_user_feedback_empty(self, mock_db, mock_field_filter, client):
        fb_col = MagicMock()
        chain = MagicMock()
        chain.stream.return_value = []
        fb_col.where.return_value = chain

        def col(name):
            if name == "feedback":
                return fb_col
            return MagicMock()

        mock_db.collection.side_effect = col

        resp = client.get(f"{BASE}/my-feedback")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["count"] == 0
        assert body["data"]["feedback"] == []

    def test_get_user_feedback_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("DB error")
        resp = client.get(f"{BASE}/my-feedback")
        assert resp.status_code == 500

    def test_get_user_feedback_options(self, client):
        resp = client.options(f"{BASE}/my-feedback")
        assert resp.status_code == 204
