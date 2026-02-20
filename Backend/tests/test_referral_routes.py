"""
Comprehensive tests for referral routes.
Blueprint registered at: /api/v1/referral
"""
import pytest
from unittest.mock import MagicMock, patch

TEST_USER_ID = "testuser1234567890ab"


# ---------------------------------------------------------------------------
# Helper to build a Firestore-doc-like mock
# ---------------------------------------------------------------------------

def _mock_doc(exists=True, data=None):
    """Return a mock Firestore document snapshot."""
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict = MagicMock(return_value=data or {})
    return doc


# =========================================================================
# POST /api/v1/referral/generate
# =========================================================================

class TestReferralGeneration:
    """Tests for POST /api/v1/referral/generate"""

    def test_generate_new_referral(self, mock_db, client):
        """New user -> creates referral doc, returns code with zero counters."""
        col = mock_db.collection("referrals")
        doc_ref = col.document.return_value
        doc_ref.get.return_value = _mock_doc(exists=False)

        resp = client.post("/api/v1/referral/generate", json={})

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "referralCode" in body["data"]
        assert body["data"]["userId"] == TEST_USER_ID
        assert body["data"]["totalReferrals"] == 0
        assert body["data"]["successfulReferrals"] == 0
        assert body["data"]["pendingReferrals"] == 0
        assert body["data"]["rewardsEarned"] == 0
        doc_ref.set.assert_called_once()

    def test_generate_existing_referral(self, mock_db, client):
        """Existing referral -> returns stored data, does NOT create new doc."""
        existing = {
            "user_id": TEST_USER_ID,
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "successful_referrals": 3,
            "pending_referrals": 1,
            "rewards_earned": 4,
            "created_at": "2024-01-01T00:00:00+00:00",
        }
        col = mock_db.collection("referrals")
        doc_ref = col.document.return_value
        doc_ref.get.return_value = _mock_doc(exists=True, data=existing)

        resp = client.post("/api/v1/referral/generate", json={})

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["referralCode"] == "TEST1234"
        assert body["data"]["totalReferrals"] == 5
        assert body["data"]["successfulReferrals"] == 3
        doc_ref.set.assert_not_called()

    def test_generate_database_error(self, mock_db, client):
        """DB failure -> 500 with REFERRAL_ERROR."""
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post("/api/v1/referral/generate", json={})

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "REFERRAL_ERROR"

    def test_generate_options_request(self, client):
        """OPTIONS preflight -> 204 (before_request handler)."""
        resp = client.options("/api/v1/referral/generate")
        assert resp.status_code == 204


# =========================================================================
# GET /api/v1/referral/stats
# =========================================================================

class TestReferralStats:
    """Tests for GET /api/v1/referral/stats"""

    def test_get_stats_existing_user(self, mock_db, client):
        existing = {
            "user_id": TEST_USER_ID,
            "referral_code": "TEST1234",
            "total_referrals": 10,
            "successful_referrals": 7,
            "pending_referrals": 2,
            "rewards_earned": 10,
            "created_at": "2024-01-01T00:00:00+00:00",
            "last_referral_at": "2024-06-01T00:00:00+00:00",
        }
        col = mock_db.collection("referrals")
        doc_ref = col.document.return_value
        doc_ref.get.return_value = _mock_doc(exists=True, data=existing)

        resp = client.get("/api/v1/referral/stats")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["totalReferrals"] == 10
        assert body["data"]["successfulReferrals"] == 7
        assert body["data"]["rewardsEarned"] == 10

    def test_get_stats_new_user_creates_referral(self, mock_db, client):
        """When no referral doc exists, one is created with zero counters."""
        col = mock_db.collection("referrals")
        doc_ref = col.document.return_value
        doc_ref.get.return_value = _mock_doc(exists=False)

        resp = client.get("/api/v1/referral/stats")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["totalReferrals"] == 0
        assert "referralCode" in body["data"]
        doc_ref.set.assert_called_once()

    def test_get_stats_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.get("/api/v1/referral/stats")

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "STATS_ERROR"

    def test_get_stats_options_request(self, client):
        resp = client.options("/api/v1/referral/stats")
        assert resp.status_code == 204


# =========================================================================
# POST /api/v1/referral/invite
# =========================================================================

class TestSendInvitation:
    """Tests for POST /api/v1/referral/invite"""

    @patch("src.routes.referral_routes.email_service")
    def test_send_invitation_success(self, mock_email_svc, mock_db, client):
        referral_data = {
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "pending_referrals": 1,
        }
        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        mock_email_svc.send_referral_invitation.return_value = {
            "success": True,
            "message": "Email sent",
        }

        resp = client.post(
            "/api/v1/referral/invite",
            json={"email": "friend@example.com", "referrer_name": "Test User"},
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["emailSent"] is True

    def test_send_invitation_missing_email(self, client):
        """No email field -> 400."""
        resp = client.post("/api/v1/referral/invite", json={})

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "BAD_REQUEST"

    def test_send_invitation_empty_email(self, client):
        """Whitespace-only email -> sanitized to '' -> 400."""
        resp = client.post("/api/v1/referral/invite", json={"email": "   "})

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False

    def test_send_invitation_no_referral_code(self, mock_db, client):
        """User has no referral doc -> 404."""
        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(exists=False)

        resp = client.post(
            "/api/v1/referral/invite", json={"email": "friend@example.com"}
        )

        assert resp.status_code == 404
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "NOT_FOUND"

    def test_send_invitation_doc_exists_but_no_code(self, mock_db, client):
        """Referral doc exists but referral_code is missing -> 404."""
        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data={"user_id": TEST_USER_ID}
        )

        resp = client.post(
            "/api/v1/referral/invite", json={"email": "friend@example.com"}
        )

        assert resp.status_code == 404

    @patch("src.routes.referral_routes.email_service")
    def test_send_invitation_email_failure(self, mock_email_svc, mock_db, client):
        """Email service fails -> still 200 but emailSent=False."""
        referral_data = {
            "referral_code": "TEST1234",
            "total_referrals": 5,
            "pending_referrals": 1,
        }
        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        mock_email_svc.send_referral_invitation.return_value = {
            "success": False,
            "message": "Email service unavailable",
        }

        resp = client.post(
            "/api/v1/referral/invite", json={"email": "friend@example.com"}
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["emailSent"] is False

    def test_send_invitation_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            "/api/v1/referral/invite", json={"email": "friend@example.com"}
        )

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False

    def test_send_invitation_options_request(self, client):
        resp = client.options("/api/v1/referral/invite")
        assert resp.status_code == 204


# =========================================================================
# POST /api/v1/referral/complete
# =========================================================================

class TestCompleteReferral:
    """Tests for POST /api/v1/referral/complete"""

    def test_complete_missing_fields(self, client):
        """Missing invitee_id -> 400."""
        resp = client.post(
            "/api/v1/referral/complete", json={"referrer_id": "ref123"}
        )

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "BAD_REQUEST"

    def test_complete_missing_both_ids(self, client):
        """Empty body -> 400."""
        resp = client.post("/api/v1/referral/complete", json={})

        assert resp.status_code == 400

    def test_complete_referrer_not_found(self, mock_db, client):
        """Referrer doc doesn't exist -> 404."""
        # Default mock_db returns exists=False for all docs
        resp = client.post(
            "/api/v1/referral/complete",
            json={"referrer_id": "unknown", "invitee_id": "inv456"},
        )

        assert resp.status_code == 404
        body = resp.get_json()
        assert body["success"] is False

    @patch("src.routes.referral_routes.push_notification_service")
    @patch("src.routes.referral_routes.email_service")
    def test_complete_referral_bronze_tier(
        self, mock_email, mock_push, mock_db, client
    ):
        """3rd referral (Bronze tier, < 5) -> rewardsEarned = 3."""
        referral_data = {
            "user_id": "referrer123",
            "referral_code": "REF1234",
            "successful_referrals": 2,
            "pending_referrals": 1,
            "rewards_earned": 2,
        }
        referrer_info = {
            "email": "ref@example.com",
            "name": "Referrer",
            "fcm_token": "tok123",
        }

        referrals_col = mock_db.collection("referrals")
        referrals_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referrer_info
        )

        resp = client.post(
            "/api/v1/referral/complete",
            json={
                "referrer_id": "referrer123",
                "invitee_id": "inv456",
                "invitee_name": "New User",
                "invitee_email": "new@example.com",
            },
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["successfulReferrals"] == 3
        # 3 base + 0 bonus(3//10*2) + 0 tier = 3
        assert body["data"]["rewardsEarned"] == 3

    @patch("src.routes.referral_routes.push_notification_service")
    @patch("src.routes.referral_routes.email_service")
    def test_complete_referral_silver_tier(
        self, mock_email, mock_push, mock_db, client
    ):
        """5th referral -> Silver tier bonus (+4 weeks)."""
        referral_data = {
            "successful_referrals": 4,
            "pending_referrals": 1,
            "rewards_earned": 4,
        }
        referrer_info = {
            "email": "r@example.com",
            "name": "R",
            "fcm_token": "t",
        }

        referrals_col = mock_db.collection("referrals")
        referrals_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referrer_info
        )

        resp = client.post(
            "/api/v1/referral/complete",
            json={
                "referrer_id": "referrer123",
                "invitee_id": "inv456",
                "invitee_name": "New User",
            },
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["successfulReferrals"] == 5
        # 5 base + 0 bonus + 4 silver = 9
        assert body["data"]["rewardsEarned"] == 9

    @patch("src.routes.referral_routes.push_notification_service")
    @patch("src.routes.referral_routes.email_service")
    def test_complete_referral_gold_tier(
        self, mock_email, mock_push, mock_db, client
    ):
        """15th referral -> Gold tier bonus (+12 weeks)."""
        referral_data = {
            "successful_referrals": 14,
            "pending_referrals": 1,
            "rewards_earned": 14,
        }
        referrer_info = {"email": "r@example.com", "name": "R", "fcm_token": "t"}

        referrals_col = mock_db.collection("referrals")
        referrals_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referrer_info
        )

        resp = client.post(
            "/api/v1/referral/complete",
            json={"referrer_id": "ref", "invitee_id": "inv"},
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["successfulReferrals"] == 15
        # 15 base + 2 bonus(15//10*2) + 12 gold = 29
        assert body["data"]["rewardsEarned"] == 29

    @patch("src.routes.referral_routes.push_notification_service")
    @patch("src.routes.referral_routes.email_service")
    def test_complete_referral_platinum_tier(
        self, mock_email, mock_push, mock_db, client
    ):
        """30th referral -> Platinum tier bonus (+24 weeks)."""
        referral_data = {
            "successful_referrals": 29,
            "pending_referrals": 1,
            "rewards_earned": 29,
        }
        referrer_info = {"email": "r@example.com", "name": "R", "fcm_token": "t"}

        referrals_col = mock_db.collection("referrals")
        referrals_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referrer_info
        )

        resp = client.post(
            "/api/v1/referral/complete",
            json={"referrer_id": "ref", "invitee_id": "inv"},
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["successfulReferrals"] == 30
        # 30 base + 6 bonus(30//10*2) + 24 platinum = 60
        assert body["data"]["rewardsEarned"] == 60

    @patch("src.routes.referral_routes.push_notification_service")
    @patch("src.routes.referral_routes.email_service")
    def test_complete_referral_no_fcm_token(
        self, mock_email, mock_push, mock_db, client
    ):
        """Referrer has no fcm_token -> push not sent, still succeeds."""
        referral_data = {
            "successful_referrals": 0,
            "pending_referrals": 1,
            "rewards_earned": 0,
        }
        referrer_info = {"email": "r@example.com", "name": "R"}

        referrals_col = mock_db.collection("referrals")
        referrals_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referrer_info
        )

        resp = client.post(
            "/api/v1/referral/complete",
            json={"referrer_id": "ref", "invitee_id": "inv"},
        )

        assert resp.status_code == 200
        mock_push.send_referral_success_notification.assert_not_called()

    def test_complete_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            "/api/v1/referral/complete",
            json={"referrer_id": "ref", "invitee_id": "inv"},
        )

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "COMPLETE_ERROR"

    def test_complete_options_request(self, client):
        resp = client.options("/api/v1/referral/complete")
        assert resp.status_code == 204


# =========================================================================
# GET /api/v1/referral/leaderboard  (NO auth required)
# =========================================================================

class TestLeaderboard:
    """Tests for GET /api/v1/referral/leaderboard"""

    def test_get_leaderboard_success(self, mock_db, client):
        doc1 = MagicMock()
        doc1.to_dict.return_value = {
            "user_id": "user1",
            "successful_referrals": 50,
            "rewards_earned": 100,
        }
        doc2 = MagicMock()
        doc2.to_dict.return_value = {
            "user_id": "user2",
            "successful_referrals": 20,
            "rewards_earned": 40,
        }

        # Chain: order_by() -> limit() -> get()
        referrals_col = mock_db.collection("referrals")
        mock_query = MagicMock()
        mock_query.limit.return_value.get.return_value = [doc1, doc2]
        referrals_col.order_by.return_value = mock_query

        # User lookups
        users_col = mock_db.collection("users")

        def _user_doc(uid):
            m = MagicMock()
            if uid == "user1":
                m.get.return_value = _mock_doc(
                    exists=True, data={"name": "Top Referrer"}
                )
            elif uid == "user2":
                m.get.return_value = _mock_doc(
                    exists=True, data={"name": "Good Referrer"}
                )
            else:
                m.get.return_value = _mock_doc(exists=False)
            return m

        users_col.document = MagicMock(side_effect=_user_doc)

        resp = client.get("/api/v1/referral/leaderboard")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        lb = body["data"]["leaderboard"]
        assert len(lb) == 2
        assert lb[0]["tier"] == "Platinum"  # 50 referrals
        assert lb[0]["name"] == "Top Referrer"
        assert lb[1]["tier"] == "Gold"  # 20 referrals
        assert lb[1]["name"] == "Good Referrer"
        assert body["data"]["totalCount"] == 2

    def test_get_leaderboard_with_limit(self, mock_db, client):
        referrals_col = mock_db.collection("referrals")
        mock_query = MagicMock()
        mock_query.limit.return_value.get.return_value = []
        referrals_col.order_by.return_value = mock_query

        resp = client.get("/api/v1/referral/leaderboard?limit=5")

        assert resp.status_code == 200
        mock_query.limit.assert_called_with(5)

    def test_get_leaderboard_caps_at_100(self, mock_db, client):
        referrals_col = mock_db.collection("referrals")
        mock_query = MagicMock()
        mock_query.limit.return_value.get.return_value = []
        referrals_col.order_by.return_value = mock_query

        resp = client.get("/api/v1/referral/leaderboard?limit=200")

        assert resp.status_code == 200
        mock_query.limit.assert_called_with(100)

    def test_get_leaderboard_empty(self, mock_db, client):
        referrals_col = mock_db.collection("referrals")
        mock_query = MagicMock()
        mock_query.limit.return_value.get.return_value = []
        referrals_col.order_by.return_value = mock_query

        resp = client.get("/api/v1/referral/leaderboard")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["data"]["leaderboard"] == []
        assert body["data"]["totalCount"] == 0

    def test_get_leaderboard_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.get("/api/v1/referral/leaderboard")

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "LEADERBOARD_ERROR"

    def test_get_leaderboard_options_request(self, client):
        resp = client.options("/api/v1/referral/leaderboard")
        assert resp.status_code == 204


# =========================================================================
# GET /api/v1/referral/history
# =========================================================================

class TestReferralHistory:
    """Tests for GET /api/v1/referral/history"""

    def test_get_history_success(self, mock_db, client):
        h1 = MagicMock()
        h1.to_dict.return_value = {
            "invitee_name": "User One",
            "invitee_email": "u1@example.com",
            "completed_at": "2024-01-01T10:00:00Z",
            "rewards_granted": 1,
        }
        h2 = MagicMock()
        h2.to_dict.return_value = {
            "invitee_name": "User Two",
            "invitee_email": "u2@example.com",
            "completed_at": "2024-01-02T10:00:00Z",
            "rewards_granted": 1,
        }

        col = mock_db.collection("referral_history")
        col.where.return_value.get.return_value = [h1, h2]

        resp = client.get("/api/v1/referral/history")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["totalCount"] == 2
        # Sorted by completedAt descending
        assert body["data"]["history"][0]["inviteeName"] == "User Two"
        assert body["data"]["history"][1]["inviteeName"] == "User One"

    def test_get_history_no_referrals(self, mock_db, client):
        col = mock_db.collection("referral_history")
        col.where.return_value.get.return_value = []

        resp = client.get("/api/v1/referral/history")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["history"] == []
        assert body["data"]["totalCount"] == 0

    def test_get_history_with_user_id_param(self, mock_db, client):
        """user_id query param overrides g.user_id."""
        col = mock_db.collection("referral_history")
        col.where.return_value.get.return_value = []

        resp = client.get("/api/v1/referral/history?user_id=otheruser")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True

    def test_get_history_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.get("/api/v1/referral/history")

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "HISTORY_ERROR"

    def test_get_history_options_request(self, client):
        resp = client.options("/api/v1/referral/history")
        assert resp.status_code == 204


# =========================================================================
# GET /api/v1/referral/rewards/catalog  (NO auth required)
# =========================================================================

class TestRewardsCatalog:
    """Tests for GET /api/v1/referral/rewards/catalog"""

    def test_get_rewards_catalog(self, client):
        resp = client.get("/api/v1/referral/rewards/catalog")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        rewards = body["data"]["rewards"]
        assert len(rewards) == 8

        # Spot-check structure
        reward = rewards[0]
        assert "id" in reward
        assert "name" in reward
        assert "cost" in reward
        assert "description" in reward
        assert "emoji" in reward
        assert "type" in reward

    def test_get_rewards_catalog_options_request(self, client):
        resp = client.options("/api/v1/referral/rewards/catalog")
        assert resp.status_code == 204


# =========================================================================
# POST /api/v1/referral/rewards/redeem
# =========================================================================

class TestRedeemReward:
    """Tests for POST /api/v1/referral/rewards/redeem"""

    def test_redeem_reward_success(self, mock_db, client):
        referral_data = {"user_id": "test-user-id", "rewards_earned": 10}

        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        resp = client.post(
            "/api/v1/referral/rewards/redeem",
            json={"reward_id": "premium_1month"},
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["newBalance"] == 6  # 10 - 4 (premium_1month cost)
        assert body["data"]["rewardId"] == "premium_1month"

    def test_redeem_reward_insufficient_balance(self, mock_db, client):
        referral_data = {"rewards_earned": 2}

        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        resp = client.post(
            "/api/v1/referral/rewards/redeem",
            json={"reward_id": "premium_1month"},  # costs 4
        )

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "INSUFFICIENT_BALANCE"
        assert body["details"]["available"] == 2
        assert body["details"]["required"] == 4

    def test_redeem_reward_invalid_reward_id(self, mock_db, client):
        referral_data = {"rewards_earned": 10}

        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(
            exists=True, data=referral_data
        )

        resp = client.post(
            "/api/v1/referral/rewards/redeem",
            json={"reward_id": "nonexistent_reward"},
        )

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "BAD_REQUEST"

    def test_redeem_reward_missing_reward_id(self, client):
        """No reward_id in body -> 400."""
        resp = client.post("/api/v1/referral/rewards/redeem", json={})

        assert resp.status_code == 400
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "BAD_REQUEST"

    def test_redeem_reward_no_referral_data(self, mock_db, client):
        """User has never generated referral -> 404."""
        col = mock_db.collection("referrals")
        col.document.return_value.get.return_value = _mock_doc(exists=False)

        resp = client.post(
            "/api/v1/referral/rewards/redeem",
            json={"reward_id": "premium_1week"},
        )

        assert resp.status_code == 404
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "NOT_FOUND"

    def test_redeem_reward_database_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            "/api/v1/referral/rewards/redeem",
            json={"reward_id": "premium_1week"},
        )

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False

    def test_redeem_reward_options_request(self, client):
        resp = client.options("/api/v1/referral/rewards/redeem")
        assert resp.status_code == 204


# =========================================================================
# Helper function tests
# =========================================================================

class TestHelperFunctions:
    """Tests for module-level helper functions."""

    def test_generate_referral_code_format(self):
        from src.routes.referral_routes import generate_referral_code

        code = generate_referral_code("test1234")

        assert len(code) == 8
        assert code[:4] == "TEST"  # first 4 of user_id uppercased
        assert code[4:].isalpha()
        assert code[4:].isupper()

    def test_generate_referral_code_randomness(self):
        from src.routes.referral_routes import generate_referral_code

        codes = {generate_referral_code("user123") for _ in range(20)}
        # Random suffix -> at least some unique codes
        assert len(codes) > 1
