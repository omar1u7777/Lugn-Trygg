"""
Comprehensive tests for subscription_routes.py
Tests Stripe integration, subscription management, and payment flows.

Uses conftest.py fixtures: client, mock_db, auth_headers.
The conftest patches AuthService.jwt_required so that g.user_id = 'test-user-id'.
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock


# ---------------------------------------------------------------------------
# Test-local fixtures (Stripe-specific – not in conftest)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_stripe():
    """Mock Stripe API"""
    with patch('src.routes.subscription_routes.stripe') as mock:
        yield mock


@pytest.fixture
def mock_stripe_available():
    """Mock Stripe availability"""
    with patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True):
        yield


@pytest.fixture
def mock_stripe_unavailable():
    """Mock Stripe unavailability"""
    with patch('src.routes.subscription_routes.STRIPE_AVAILABLE', False):
        yield


@pytest.fixture
def mock_webhook_no_verify():
    """Disable Stripe webhook signature verification (dev mode)."""
    with patch('src.routes.subscription_routes.STRIPE_WEBHOOK_SECRET', ''):
        yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_users_collection(mock_db, mock_doc_ref):
    """Wire mock_db so that db.collection('users').document(...) returns mock_doc_ref."""
    mock_users_collection = Mock()
    mock_users_collection.document.return_value = mock_doc_ref

    def collection_side_effect(name):
        if name == "users":
            return mock_users_collection
        return Mock()

    mock_db.collection.side_effect = collection_side_effect
    return mock_users_collection


def _user_doc_ref(exists=True, data=None):
    """Create a mock Firestore document reference with a .get() returning a snapshot."""
    mock_doc = Mock()
    mock_doc.exists = exists
    mock_doc.to_dict.return_value = data if data is not None else {}

    mock_ref = Mock()
    mock_ref.get.return_value = mock_doc
    mock_ref.update = Mock()
    mock_ref.set = Mock()
    return mock_ref


# ===========================================================================
# TestCreateCheckoutSession
# ===========================================================================

class TestCreateCheckoutSession:
    """Tests for POST /api/subscription/create-session"""

    def test_create_session_premium_success(
        self, mock_db, mock_stripe, mock_stripe_available, client
    ):
        """Successful premium checkout — user_id comes from JWT (test-user-id)."""
        mock_session = Mock()
        mock_session.id = "cs_test_123"
        mock_session.url = "https://checkout.stripe.com/test"
        mock_stripe.checkout.Session.create.return_value = mock_session

        response = client.post(
            '/api/subscription/create-session',
            json={"email": "test@example.com", "plan": "premium"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["sessionId"] == "cs_test_123"
        assert data["data"]["url"] == "https://checkout.stripe.com/test"

        # Verify Stripe was called with user_id from JWT
        mock_stripe.checkout.Session.create.assert_called_once()
        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["mode"] == "subscription"
        assert call_args["customer_email"] == "test@example.com"
        assert call_args["metadata"]["user_id"] == "test-user-id"
        assert call_args["metadata"]["plan"] == "premium"

    def test_create_session_enterprise_success(
        self, mock_db, mock_stripe, mock_stripe_available, client
    ):
        """Successful enterprise checkout."""
        mock_session = Mock()
        mock_session.id = "cs_enterprise_123"
        mock_session.url = "https://checkout.stripe.com/enterprise"
        mock_stripe.checkout.Session.create.return_value = mock_session

        response = client.post(
            '/api/subscription/create-session',
            json={"email": "clinic@example.com", "plan": "enterprise"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["sessionId"] == "cs_enterprise_123"
        assert data["data"]["url"] == "https://checkout.stripe.com/enterprise"

        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["metadata"]["plan"] == "enterprise"
        assert call_args["metadata"]["user_id"] == "test-user-id"

    def test_create_session_missing_email(
        self, mock_stripe_available, client
    ):
        """Missing email → 400."""
        response = client.post(
            '/api/subscription/create-session',
            json={"plan": "premium"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "email" in data["message"].lower() or "e-post" in data["message"].lower()

    def test_create_session_invalid_plan(
        self, mock_stripe_available, client
    ):
        """Invalid plan name → 400."""
        response = client.post(
            '/api/subscription/create-session',
            json={"email": "test@example.com", "plan": "invalid_plan"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "plan" in data["message"].lower() or "ogiltig" in data["message"].lower()

    def test_create_session_stripe_unavailable(
        self, mock_stripe_unavailable, client
    ):
        """Stripe not configured → 503."""
        response = client.post(
            '/api/subscription/create-session',
            json={"email": "test@example.com", "plan": "premium"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 503
        data = response.get_json()
        assert "not available" in data["message"].lower() or "tillgänglig" in data["message"].lower()

    def test_create_session_stripe_api_error(
        self, mock_stripe, mock_stripe_available, client
    ):
        """Stripe raises an exception → 400."""
        mock_stripe.checkout.Session.create.side_effect = Exception("Card declined")

        response = client.post(
            '/api/subscription/create-session',
            json={"email": "test@example.com", "plan": "premium"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_create_session_empty_email(
        self, mock_stripe_available, client
    ):
        """Empty/whitespace email → 400."""
        response = client.post(
            '/api/subscription/create-session',
            json={"email": "   ", "plan": "premium"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400

    def test_create_session_default_plan(
        self, mock_db, mock_stripe, mock_stripe_available, client
    ):
        """When plan omitted, defaults to premium."""
        mock_session = Mock()
        mock_session.id = "cs_default_123"
        mock_session.url = "https://checkout.stripe.com/default"
        mock_stripe.checkout.Session.create.return_value = mock_session

        response = client.post(
            '/api/subscription/create-session',
            json={"email": "test@example.com"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["metadata"]["plan"] == "premium"


# ===========================================================================
# TestGetSubscriptionStatus
# ===========================================================================

class TestGetSubscriptionStatus:
    """Tests for GET /api/subscription/status/<user_id>

    The route enforces current_user_id == user_id, so the URL must use
    'test-user-id' (the value the conftest JWT mock injects).
    """

    def test_get_status_active_subscription(self, mock_db, client):
        """Active premium subscription returns correct payload."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {
                "status": "active",
                "plan": "premium",
                "start_date": "2024-01-01",
            }
        })
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/status/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["status"] == "active"
        assert data["data"]["plan"] == "premium"
        # Limits come from shared/subscription_plans.json via SubscriptionService
        assert data["data"]["limits"]["chatMessagesPerDay"] == -1
        # Usage keys are camelCase
        assert data["data"]["usage"].get("chatMessages") is not None

    def test_get_status_free_tier(self, mock_db, client):
        """Free-tier user."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {"status": "free", "plan": "free"}
        })
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/status/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["status"] == "free"
        assert data["data"]["plan"] == "free"

    def test_get_status_no_subscription_field(self, mock_db, client):
        """User doc without subscription field defaults to free."""
        ref = _user_doc_ref(exists=True, data={})
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/status/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["status"] == "free"
        assert data["data"]["plan"] == "free"

    def test_get_status_user_not_found(self, mock_db, client):
        """Non-existent user → 404."""
        ref = _user_doc_ref(exists=False)
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/status/test-user-id')

        assert response.status_code == 404
        data = response.get_json()
        assert "not found" in data["message"].lower() or "hittades inte" in data["message"].lower()

    def test_get_status_empty_user_id(self, client):
        """Trailing-slash URL with no user_id → 404 or 405 (route doesn't match)."""
        response = client.get('/api/subscription/status/')
        assert response.status_code in (404, 405)

    def test_get_status_wrong_user_id(self, mock_db, client):
        """Requesting another user's status → 403."""
        response = client.get('/api/subscription/status/some-other-user')
        assert response.status_code == 403

    def test_get_status_database_error(self, mock_db, client):
        """Database error → 500."""
        mock_db.collection.side_effect = Exception("Database error")

        response = client.get('/api/subscription/status/test-user-id')

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data


# ===========================================================================
# TestStripeWebhook
# ===========================================================================

class TestStripeWebhook:
    """Tests for POST /api/subscription/webhook

    The webhook endpoint does NOT use @AuthService.jwt_required — it relies
    on Stripe signatures.  No auth headers needed.
    """

    def test_webhook_checkout_completed_subscription(
        self, mock_db, mock_stripe_available, mock_webhook_no_verify, client
    ):
        """checkout.session.completed → activates subscription."""
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "cus_test123",
                    "subscription": "sub_test123",
                    "metadata": {
                        "user_id": "test-user-id",
                        "plan": "premium",
                    },
                }
            },
        }

        mock_update = Mock()
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.update = mock_update
        _make_users_collection(mock_db, mock_user_doc_ref)

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["status"] == "success"

        # Verify db update
        mock_update.assert_called_once()
        update_args = mock_update.call_args[0][0]
        assert update_args["subscription"]["status"] == "active"
        assert update_args["subscription"]["plan"] == "premium"

    def test_webhook_checkout_completed_cbt_module(
        self, mock_db, mock_stripe_available, mock_webhook_no_verify, client
    ):
        """checkout.session.completed with type=cbt_module → adds module to purchases."""
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {
                        "user_id": "test-user-id",
                        "type": "cbt_module",
                        "module": "anxiety_management",
                    }
                }
            },
        }

        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {"purchases": []}
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        _make_users_collection(mock_db, mock_user_ref)

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200

        mock_user_ref.update.assert_called_once()
        update_args = mock_user_ref.update.call_args[0][0]
        assert "anxiety_management" in update_args["purchases"]

    def test_webhook_payment_succeeded(self, mock_stripe_available, mock_webhook_no_verify, client):
        """invoice.payment_succeeded → 200 acknowledged."""
        webhook_payload = {
            "type": "invoice.payment_succeeded",
            "data": {"object": {"subscription": "sub_test123"}},
        }

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["status"] == "success"

    def test_webhook_payment_failed(self, mock_stripe_available, mock_webhook_no_verify, client):
        """invoice.payment_failed → 200 acknowledged."""
        webhook_payload = {
            "type": "invoice.payment_failed",
            "data": {"object": {"subscription": "sub_test123"}},
        }

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200

    def test_webhook_subscription_deleted(
        self, mock_db, mock_stripe_available, mock_webhook_no_verify, client
    ):
        """customer.subscription.deleted → marks user as canceled."""
        webhook_payload = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": "cus_test123"}},
        }

        mock_user_doc = Mock()
        mock_user_doc.id = "test-user-id"

        mock_update = Mock()
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.update = mock_update

        mock_users_collection = Mock()
        mock_users_collection.where.return_value.stream.return_value = [mock_user_doc]
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200

        mock_update.assert_called_once()
        update_args = mock_update.call_args[0][0]
        assert update_args["subscription.status"] == "canceled"

    def test_webhook_stripe_unavailable(self, mock_stripe_unavailable, client):
        """Stripe unavailable → 503."""
        webhook_payload = {"type": "test.event"}

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 503

    def test_webhook_invalid_json(self, mock_stripe_available, mock_webhook_no_verify, client):
        """Invalid JSON → 500."""
        response = client.post(
            '/api/subscription/webhook',
            data="invalid json",
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 500

    def test_webhook_unknown_event_type(self, mock_stripe_available, mock_webhook_no_verify, client):
        """Unrecognised event type → still 200 (acknowledged)."""
        webhook_payload = {"type": "unknown.event.type", "data": {}}

        response = client.post(
            '/api/subscription/webhook',
            data=json.dumps(webhook_payload),
            headers={"Content-Type": "application/json", "stripe-signature": "test_sig"},
        )

        assert response.status_code == 200


# ===========================================================================
# TestPurchaseCBTModule
# ===========================================================================

class TestPurchaseCBTModule:
    """Tests for POST /api/subscription/purchase-cbt-module"""

    def test_purchase_module_success(
        self, mock_stripe, mock_stripe_available, client
    ):
        """Successful CBT module purchase — user_id from JWT."""
        mock_session = Mock()
        mock_session.id = "cs_cbt_123"
        mock_session.url = "https://checkout.stripe.com/cbt"
        mock_stripe.checkout.Session.create.return_value = mock_session

        response = client.post(
            '/api/subscription/purchase-cbt-module',
            json={"email": "test@example.com", "module": "anxiety_management"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["sessionId"] == "cs_cbt_123"
        assert data["data"]["url"] == "https://checkout.stripe.com/cbt"

        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["mode"] == "payment"
        assert call_args["metadata"]["module"] == "anxiety_management"
        assert call_args["metadata"]["type"] == "cbt_module"
        assert call_args["metadata"]["user_id"] == "test-user-id"

    def test_purchase_module_missing_fields(
        self, mock_stripe_available, client
    ):
        """Missing email or module → 400."""
        response = client.post(
            '/api/subscription/purchase-cbt-module',
            json={"module": "anxiety_management"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_purchase_module_missing_module(
        self, mock_stripe_available, client
    ):
        """Missing module field → 400."""
        response = client.post(
            '/api/subscription/purchase-cbt-module',
            json={"email": "test@example.com"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400

    def test_purchase_module_stripe_unavailable(
        self, mock_stripe_unavailable, client
    ):
        """Stripe unavailable → 503."""
        response = client.post(
            '/api/subscription/purchase-cbt-module',
            json={"email": "test@example.com", "module": "anxiety_management"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 503

    def test_purchase_module_stripe_error(
        self, mock_stripe, mock_stripe_available, client
    ):
        """Stripe raises → 400."""
        mock_stripe.checkout.Session.create.side_effect = Exception("Invalid request")

        response = client.post(
            '/api/subscription/purchase-cbt-module',
            json={"email": "test@example.com", "module": "anxiety_management"},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400


# ===========================================================================
# TestGetAvailablePlans
# ===========================================================================

class TestGetAvailablePlans:
    """Tests for GET /api/subscription/plans (public — no JWT)."""

    def test_get_plans_success(self, client):
        """Retrieves all plans from shared/subscription_plans.json."""
        response = client.get('/api/subscription/plans')

        assert response.status_code == 200
        data = response.get_json()

        assert "free" in data["data"]
        assert "premium" in data["data"]
        assert "enterprise" in data["data"]

        assert data["data"]["free"]["price"] == 0
        assert data["data"]["premium"]["price"] > 0
        assert data["data"]["enterprise"]["price"] > 0

        assert "features" in data["data"]["free"]
        assert "features" in data["data"]["premium"]
        assert "features" in data["data"]["enterprise"]
        assert len(data["data"]["free"]["features"]) > 0


# ===========================================================================
# TestGetUserPurchases
# ===========================================================================

class TestGetUserPurchases:
    """Tests for GET /api/subscription/purchases/<user_id>

    Route enforces current_user_id == user_id → URL must use 'test-user-id'.
    """

    def test_get_purchases_with_items(self, mock_db, client):
        """User with purchased modules."""
        ref = _user_doc_ref(exists=True, data={
            "purchases": ["anxiety_management", "depression_support"]
        })
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/purchases/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert "purchases" in data["data"]
        assert len(data["data"]["purchases"]) == 2
        assert "anxiety_management" in data["data"]["purchases"]
        assert "depression_support" in data["data"]["purchases"]

    def test_get_purchases_empty(self, mock_db, client):
        """User with no purchases."""
        ref = _user_doc_ref(exists=True, data={"purchases": []})
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/purchases/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["purchases"] == []

    def test_get_purchases_no_field(self, mock_db, client):
        """User doc missing purchases field → empty list."""
        ref = _user_doc_ref(exists=True, data={})
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/purchases/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["purchases"] == []

    def test_get_purchases_user_not_found(self, mock_db, client):
        """Non-existent user → 404."""
        ref = _user_doc_ref(exists=False)
        _make_users_collection(mock_db, ref)

        response = client.get('/api/subscription/purchases/test-user-id')

        assert response.status_code == 404

    def test_get_purchases_wrong_user(self, mock_db, client):
        """Requesting another user's purchases → 403."""
        response = client.get('/api/subscription/purchases/some-other-user')
        assert response.status_code == 403

    def test_get_purchases_database_error(self, mock_db, client):
        """Database error → 500."""
        mock_db.collection.side_effect = Exception("DB error")

        response = client.get('/api/subscription/purchases/test-user-id')

        assert response.status_code == 500


# ===========================================================================
# TestCancelSubscription
# ===========================================================================

class TestCancelSubscription:
    """Tests for POST /api/subscription/cancel/<user_id>

    Route enforces current_user_id == user_id → URL must use 'test-user-id'.
    """

    def test_cancel_subscription_success(
        self, mock_db, mock_stripe, mock_stripe_available, client
    ):
        """Successful cancellation — sets cancel_at_period_end in Stripe."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {
                "status": "active",
                "stripe_subscription_id": "sub_test123",
            }
        })
        _make_users_collection(mock_db, ref)

        mock_stripe.Subscription.modify.return_value = Mock()

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 200
        data = response.get_json()
        assert "message" in data["data"] or "message" in data

        mock_stripe.Subscription.modify.assert_called_once_with(
            "sub_test123", cancel_at_period_end=True
        )

        # DB update sets status to 'canceling'
        ref.update.assert_called_once()
        update_args = ref.update.call_args[0][0]
        assert update_args["subscription.status"] == "canceling"

    def test_cancel_subscription_not_active(
        self, mock_db, mock_stripe_available, client
    ):
        """Canceling a free subscription → 400."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {"status": "free"}
        })
        _make_users_collection(mock_db, ref)

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 400
        data = response.get_json()
        assert (
            "no active" in data["message"].lower()
            or "ingen aktiv" in data["message"].lower()
        )

    def test_cancel_subscription_user_not_found(
        self, mock_db, mock_stripe_available, client
    ):
        """Non-existent user → 404."""
        ref = _user_doc_ref(exists=False)
        _make_users_collection(mock_db, ref)

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 404

    def test_cancel_subscription_no_stripe_id(
        self, mock_db, mock_stripe_available, client
    ):
        """Active subscription but missing stripe_subscription_id → 400."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {"status": "active"}
            # No stripe_subscription_id
        })
        _make_users_collection(mock_db, ref)

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 400
        data = response.get_json()
        assert "stripe" in data["message"].lower() or "id" in data["message"].lower()

    def test_cancel_subscription_stripe_unavailable(
        self, mock_stripe_unavailable, client
    ):
        """Stripe unavailable → 503."""
        response = client.post('/api/subscription/cancel/test-user-id')
        assert response.status_code == 503

    def test_cancel_subscription_stripe_error(
        self, mock_db, mock_stripe, mock_stripe_available, client
    ):
        """Stripe.Subscription.modify raises → 400."""
        ref = _user_doc_ref(exists=True, data={
            "subscription": {
                "status": "active",
                "stripe_subscription_id": "sub_test123",
            }
        })
        _make_users_collection(mock_db, ref)

        mock_stripe.Subscription.modify.side_effect = Exception("Subscription not found")

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 400

    def test_cancel_subscription_wrong_user(self, mock_stripe_available, client):
        """Canceling another user's subscription → 403."""
        response = client.post('/api/subscription/cancel/some-other-user')
        assert response.status_code == 403

    def test_cancel_subscription_database_error(
        self, mock_db, mock_stripe_available, client
    ):
        """Database error → 500."""
        mock_db.collection.side_effect = Exception("DB error")

        response = client.post('/api/subscription/cancel/test-user-id')

        assert response.status_code == 500
