"""
Comprehensive tests for subscription_routes.py
Tests Stripe integration, subscription management, and payment flows
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone


@pytest.fixture
def client():
    """Create Flask test client"""
    from main import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_db():
    """Mock Firebase database"""
    with patch('src.routes.subscription_routes.db') as mock:
        yield mock


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


class TestCreateCheckoutSession:
    """Tests for POST /create-session - Stripe checkout creation"""

    def test_create_session_premium_success(self, mock_db, mock_stripe, mock_stripe_available, client):
        """Test creating checkout session for premium plan"""
        # Mock Stripe session creation
        mock_session = Mock()
        mock_session.id = "cs_test_123"
        mock_session.url = "https://checkout.stripe.com/test"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["sessionId"] == "cs_test_123"
        assert data["url"] == "https://checkout.stripe.com/test"
        
        # Verify Stripe was called correctly
        mock_stripe.checkout.Session.create.assert_called_once()
        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["mode"] == "subscription"
        assert call_args["customer_email"] == "test@example.com"
        assert call_args["metadata"]["user_id"] == "test123"
        assert call_args["metadata"]["plan"] == "premium"

    def test_create_session_enterprise_success(self, mock_db, mock_stripe, mock_stripe_available, client):
        """Test creating checkout session for enterprise plan"""
        mock_session = Mock()
        mock_session.id = "cs_enterprise_123"
        mock_session.url = "https://checkout.stripe.com/enterprise"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "enterprise_user",
                                  "email": "clinic@example.com",
                                  "plan": "enterprise"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["sessionId"] == "cs_enterprise_123"
        assert data["url"] == "https://checkout.stripe.com/enterprise"
        
        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["metadata"]["plan"] == "enterprise"

    def test_create_session_missing_user_id(self, mock_stripe_available, client):
        """Test checkout with missing user_id"""
        response = client.post('/api/subscription/create-session',
                              json={
                                  "email": "test@example.com",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Användar-ID" in data["error"] or "user_id" in data["error"].lower()

    def test_create_session_missing_email(self, mock_stripe_available, client):
        """Test checkout with missing email"""
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "e-post" in data["error"].lower() or "email" in data["error"].lower()

    def test_create_session_invalid_plan(self, mock_stripe_available, client):
        """Test checkout with invalid plan"""
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "plan": "invalid_plan"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "plan" in data["error"].lower() or "ogiltig" in data["error"].lower()

    def test_create_session_stripe_unavailable(self, mock_stripe_unavailable, client):
        """Test checkout when Stripe is unavailable"""
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 503
        data = response.get_json()
        assert "tillgänglig" in data["error"].lower() or "unavailable" in data["error"].lower()

    def test_create_session_stripe_api_error(self, mock_stripe, mock_stripe_available, client):
        """Test checkout with Stripe API error"""
        # Mock a Stripe API error
        mock_stripe.checkout.Session.create.side_effect = Exception("Card declined")
        
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_create_session_empty_strings(self, mock_stripe_available, client):
        """Test checkout with empty string values"""
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "   ",
                                  "email": "   ",
                                  "plan": "premium"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400

    def test_create_session_default_plan(self, mock_db, mock_stripe, mock_stripe_available, client):
        """Test checkout defaults to premium when plan not specified"""
        mock_session = Mock()
        mock_session.id = "cs_default_123"
        mock_session.url = "https://checkout.stripe.com/default"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        response = client.post('/api/subscription/create-session',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com"
                              },
                              headers={"Content-Type": "application/json"})
        
        # Should succeed with default premium plan
        assert response.status_code == 200


class TestGetSubscriptionStatus:
    """Tests for GET /status/<user_id> - Get subscription status"""

    def test_get_status_active_subscription(self, mock_db, client):
        """Test getting status for user with active subscription"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "active",
                "plan": "premium",
                "start_date": "2024-01-01"
            }
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/status/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "active"
        assert data["plan"] == "premium"
        assert data["limits"]["chatMessagesPerDay"] == -1
        assert data["usage"].get("chat_messages") == 0

    def test_get_status_free_tier(self, mock_db, client):
        """Test getting status for free tier user"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "free",
                "plan": "free"
            }
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/status/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "free"
        assert data["plan"] == "free"

    def test_get_status_no_subscription_field(self, mock_db, client):
        """Test status when user has no subscription field (defaults to free)"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {}  # No subscription field
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/status/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "free"
        assert data["plan"] == "free"

    def test_get_status_user_not_found(self, mock_db, client):
        """Test status for non-existent user"""
        mock_doc = Mock()
        mock_doc.exists = False
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()
        
        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/status/test-user-id')
        
        assert response.status_code == 404
        data = response.get_json()
        assert "hittades inte" in data["error"].lower() or "not found" in data["error"].lower()

    def test_get_status_empty_user_id(self, client):
        """Test status with empty user_id"""
        response = client.get('/api/subscription/status/')
        
        # Should get 404 since route won't match
        assert response.status_code == 404

    def test_get_status_database_error(self, mock_db, client):
        """Test status with database error"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/subscription/status/test-user-id')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data


class TestStripeWebhook:
    """Tests for POST /webhook - Stripe webhook handling"""

    def test_webhook_checkout_completed_subscription(self, mock_db, mock_stripe_available, client):
        """Test webhook for completed subscription checkout"""
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "cus_test123",
                    "subscription": "sub_test123",
                    "metadata": {
                        "user_id": "test123",
                        "plan": "premium"
                    }
                }
            }
        }
        
        mock_update = Mock()
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.update = mock_update
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={
                                  "Content-Type": "application/json",
                                  "stripe-signature": "test_sig"
                              })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        
        # Verify user subscription was updated
        mock_update.assert_called_once()
        update_args = mock_update.call_args[0][0]
        assert update_args["subscription"]["status"] == "active"
        assert update_args["subscription"]["plan"] == "premium"

    def test_webhook_checkout_completed_cbt_module(self, mock_db, mock_stripe_available, client):
        """Test webhook for completed CBT module purchase"""
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {
                        "user_id": "test123",
                        "type": "cbt_module",
                        "module": "anxiety_management"
                    }
                }
            }
        }
        
        mock_user_doc = Mock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "purchases": []
        }
        mock_user_ref = Mock()
        mock_user_ref.get.return_value = mock_user_doc
        
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={
                                  "Content-Type": "application/json",
                                  "stripe-signature": "test_sig"
                              })
        
        assert response.status_code == 200
        
        # Verify module was added to purchases
        mock_user_ref.update.assert_called_once()
        update_args = mock_user_ref.update.call_args[0][0]
        assert "anxiety_management" in update_args["purchases"]

    def test_webhook_payment_succeeded(self, mock_stripe_available, client):
        """Test webhook for successful payment"""
        webhook_payload = {
            "type": "invoice.payment_succeeded",
            "data": {
                "object": {
                    "subscription": "sub_test123"
                }
            }
        }
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={
                                  "Content-Type": "application/json",
                                  "stripe-signature": "test_sig"
                              })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"

    def test_webhook_payment_failed(self, mock_stripe_available, client):
        """Test webhook for failed payment"""
        webhook_payload = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "subscription": "sub_test123"
                }
            }
        }
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={
                                  "Content-Type": "application/json",
                                  "stripe-signature": "test_sig"
                              })
        
        assert response.status_code == 200

    def test_webhook_subscription_deleted(self, mock_db, mock_stripe_available, client):
        """Test webhook for subscription cancellation"""
        webhook_payload = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "customer": "cus_test123"
                }
            }
        }
        
        mock_user_doc = Mock()
        mock_user_doc.id = "test123"
        
        mock_users_collection = Mock()
        mock_users_collection.where.return_value.stream.return_value = [mock_user_doc]
        
        mock_update = Mock()
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.update = mock_update
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={
                                  "Content-Type": "application/json",
                                  "stripe-signature": "test_sig"
                              })
        
        assert response.status_code == 200
        
        # Verify subscription was marked as canceled
        mock_update.assert_called_once()
        update_args = mock_update.call_args[0][0]
        assert update_args["subscription.status"] == "canceled"

    def test_webhook_stripe_unavailable(self, mock_stripe_unavailable, client):
        """Test webhook when Stripe is unavailable"""
        webhook_payload = {"type": "test.event"}
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 503

    def test_webhook_invalid_json(self, mock_stripe_available, client):
        """Test webhook with invalid JSON payload"""
        response = client.post('/api/subscription/webhook',
                              data="invalid json",
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 500

    def test_webhook_unknown_event_type(self, mock_stripe_available, client):
        """Test webhook with unknown event type"""
        webhook_payload = {
            "type": "unknown.event.type",
            "data": {}
        }
        
        response = client.post('/api/subscription/webhook',
                              data=json.dumps(webhook_payload),
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200


class TestPurchaseCBTModule:
    """Tests for POST /purchase-cbt-module - CBT module purchase"""

    def test_purchase_module_success(self, mock_stripe, mock_stripe_available, client):
        """Test successful CBT module purchase"""
        mock_session = Mock()
        mock_session.id = "cs_cbt_123"
        mock_session.url = "https://checkout.stripe.com/cbt"
        mock_stripe.checkout.Session.create.return_value = mock_session
        
        response = client.post('/api/subscription/purchase-cbt-module',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "module": "anxiety_management"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["sessionId"] == "cs_cbt_123"
        assert data["url"] == "https://checkout.stripe.com/cbt"
        
        # Verify Stripe session was created with correct metadata
        call_args = mock_stripe.checkout.Session.create.call_args[1]
        assert call_args["mode"] == "payment"  # One-time payment
        assert call_args["metadata"]["module"] == "anxiety_management"
        assert call_args["metadata"]["type"] == "cbt_module"

    def test_purchase_module_missing_fields(self, mock_stripe_available, client):
        """Test purchase with missing required fields"""
        response = client.post('/api/subscription/purchase-cbt-module',
                              json={
                                  "user_id": "test123"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_purchase_module_stripe_unavailable(self, mock_stripe_unavailable, client):
        """Test purchase when Stripe unavailable"""
        response = client.post('/api/subscription/purchase-cbt-module',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "module": "anxiety_management"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 503

    def test_purchase_module_stripe_error(self, mock_stripe, mock_stripe_available, client):
        """Test purchase with Stripe error"""
        mock_stripe.checkout.Session.create.side_effect = Exception("Invalid request")
        
        response = client.post('/api/subscription/purchase-cbt-module',
                              json={
                                  "user_id": "test123",
                                  "email": "test@example.com",
                                  "module": "anxiety_management"
                              },
                              headers={"Content-Type": "application/json"})
        
        assert response.status_code == 400


class TestGetAvailablePlans:
    """Tests for GET /plans - Get available subscription plans"""

    def test_get_plans_success(self, client):
        """Test retrieving all available plans"""
        response = client.get('/api/subscription/plans')
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify all plans are present
        assert "free" in data
        assert "premium" in data
        assert "enterprise" in data
        
        # Verify plan structure
        assert data["free"]["price"] == 0
        assert data["premium"]["price"] > 0
        assert data["enterprise"]["price"] > 0
        
        # Verify features
        assert "features" in data["free"]
        assert "features" in data["premium"]
        assert "features" in data["enterprise"]
        assert len(data["free"]["features"]) > 0


class TestGetUserPurchases:
    """Tests for GET /purchases/<user_id> - Get user purchases"""

    def test_get_purchases_with_items(self, mock_db, client):
        """Test getting purchases for user with purchased items"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "purchases": ["anxiety_management", "depression_support"]
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/purchases/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "purchases" in data
        assert len(data["purchases"]) == 2
        assert "anxiety_management" in data["purchases"]
        assert "depression_support" in data["purchases"]

    def test_get_purchases_empty(self, mock_db, client):
        """Test getting purchases for user with no purchases"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "purchases": []
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/purchases/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["purchases"] == []

    def test_get_purchases_no_field(self, mock_db, client):
        """Test purchases when user has no purchases field"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {}
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/purchases/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["purchases"] == []

    def test_get_purchases_user_not_found(self, mock_db, client):
        """Test purchases for non-existent user"""
        mock_doc = Mock()
        mock_doc.exists = False
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.get('/api/subscription/purchases/test-user-id')
        
        assert response.status_code == 404

    def test_get_purchases_database_error(self, mock_db, client):
        """Test purchases with database error"""
        mock_db.collection.side_effect = Exception("DB error")
        
        response = client.get('/api/subscription/purchases/test-user-id')
        
        assert response.status_code == 500


class TestCancelSubscription:
    """Tests for POST /cancel/<user_id> - Cancel subscription"""

    def test_cancel_subscription_success(self, mock_db, mock_stripe, mock_stripe_available, client):
        """Test successful subscription cancellation"""
        # Mock user with active subscription
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "active",
                "stripe_subscription_id": "sub_test123"
            }
        }
        
        mock_update = Mock()
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_user_doc_ref.update = mock_update
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        mock_stripe.Subscription.modify.return_value = Mock()
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "message" in data
        
        # Verify Stripe cancellation was called
        mock_stripe.Subscription.modify.assert_called_once_with(
            "sub_test123",
            cancel_at_period_end=True
        )
        
        # Verify database was updated
        mock_update.assert_called_once()
        update_args = mock_update.call_args[0][0]
        assert update_args["subscription.status"] == "canceling"

    def test_cancel_subscription_not_active(self, mock_db, mock_stripe_available, client):
        """Test canceling non-active subscription"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "free"
            }
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "ingen aktiv" in data["error"].lower() or "no active" in data["error"].lower()

    def test_cancel_subscription_user_not_found(self, mock_db, mock_stripe_available, client):
        """Test canceling for non-existent user"""
        mock_doc = Mock()
        mock_doc.exists = False
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 404

    def test_cancel_subscription_no_stripe_id(self, mock_db, mock_stripe_available, client):
        """Test canceling when Stripe subscription ID missing"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "active"
                # Missing stripe_subscription_id
            }
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "stripe" in data["error"].lower() or "id" in data["error"].lower()

    def test_cancel_subscription_stripe_unavailable(self, mock_stripe_unavailable, client):
        """Test canceling when Stripe unavailable"""
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 503

    def test_cancel_subscription_stripe_error(self, mock_db, mock_stripe, mock_stripe_available, client):
        """Test canceling with Stripe error"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "subscription": {
                "status": "active",
                "stripe_subscription_id": "sub_test123"
            }
        }
        
        mock_user_doc_ref = Mock()
        mock_user_doc_ref.get.return_value = mock_doc
        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc_ref

        def collection_side_effect(name):
            if name == "users":
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect
        
        mock_stripe.Subscription.modify.side_effect = Exception("Subscription not found")
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 400

    def test_cancel_subscription_database_error(self, mock_db, mock_stripe_available, client):
        """Test canceling with database error"""
        mock_db.collection.side_effect = Exception("DB error")
        
        response = client.post('/api/subscription/cancel/test-user-id')
        
        assert response.status_code == 500
