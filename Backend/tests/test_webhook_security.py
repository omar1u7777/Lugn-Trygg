"""
Tests for Stripe webhook security — production guard against unverified webhooks.
Covers: STRIPE_WEBHOOK_SECRET enforcement, signature verification, event handling.
"""
import json
import os
from unittest.mock import MagicMock, patch


class StripeObjectLike:
    """Stands in for the stripe.Event that construct_event actually returns.

    Since stripe 12 — requirements pins 15.4.0 — StripeObject is no longer a
    dict subclass. It resolves unknown attributes against the payload, so
    `.get` is read as a FIELD named "get", is not found, and raises
    AttributeError. Verified directly against 15.4.0.

    Hand-built rather than a real stripe.Event so the contract holds whichever
    stripe version the runner happens to have installed; the local venv has
    11.3.0, where Event still IS a dict and the bug is invisible.

    The previous version of this test used a MagicMock with `.get` ATTACHED —
    the exact opposite of the real object, and the reason a handler that could
    never succeed in production had a green test.
    """

    def __init__(self, data: dict):
        self._data = data

    def __getitem__(self, key):
        return self._data[key]

    def __getattr__(self, key):
        try:
            return self._data[key]
        except KeyError as exc:
            raise AttributeError(key) from exc


class TestWebhookProductionGuard:
    """Tests that webhooks are rejected in production when STRIPE_WEBHOOK_SECRET is not set."""

    def test_webhook_rejected_in_production_without_secret(self, client):
        """Webhook should be rejected in production when STRIPE_WEBHOOK_SECRET is empty."""
        payload = json.dumps({
            'type': 'checkout.session.completed',
            'data': {'object': {'metadata': {'user_id': 'test-user'}}}
        })
        with patch.dict(os.environ, {'FLASK_ENV': 'production'}), \
             patch('src.routes.subscription_routes.STRIPE_WEBHOOK_SECRET', ''), \
             patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True):
            response = client.post(
                '/api/v1/subscription/webhook',
                data=payload,
                content_type='application/json'
            )
            # Should reject with 503 or error status
            assert response.status_code in [400, 403, 500, 503]

    def test_webhook_allowed_in_development_without_secret(self, client):
        """Webhook should be allowed in development without STRIPE_WEBHOOK_SECRET (with warning)."""
        event_data = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'metadata': {'user_id': 'testuser1234567890ab', 'plan': 'premium'},
                    'customer': 'cus_test123',
                    'subscription': 'sub_test123'
                }
            }
        }
        payload = json.dumps(event_data)
        with patch.dict(os.environ, {'FLASK_ENV': 'development'}), \
             patch('src.routes.subscription_routes.STRIPE_WEBHOOK_SECRET', ''), \
             patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True):
            response = client.post(
                '/api/v1/subscription/webhook',
                data=payload,
                content_type='application/json'
            )
            # Should accept in dev mode (200) or handle gracefully
            assert response.status_code in [200, 400, 500]

    def test_webhook_with_valid_signature(self, client, mock_db):
        """Webhook should be accepted when STRIPE_WEBHOOK_SECRET is set and signature is valid."""
        event_data = {
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'metadata': {'user_id': 'testuser1234567890ab', 'plan': 'premium'},
                    'customer': 'cus_test123',
                    'subscription': 'sub_test123'
                }
            }
        }
        mock_event = StripeObjectLike(event_data)

        payload = json.dumps(event_data)
        with patch('src.routes.subscription_routes.STRIPE_WEBHOOK_SECRET', 'whsec_test_secret'), \
             patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True), \
             patch('src.routes.subscription_routes.stripe') as mock_stripe:
            mock_stripe.Webhook.construct_event.return_value = mock_event
            response = client.post(
                '/api/v1/subscription/webhook',
                data=payload,
                content_type='application/json',
                headers={'stripe-signature': 'test_sig'}
            )
            # Was `in [200, 400, 500]`, which accepts the very crash it was
            # meant to catch: the handler returned 500 on every real webhook
            # for as long as this test was green.
            assert response.status_code == 200

    def test_webhook_with_invalid_signature_rejected(self, client):
        """Webhook should be rejected when signature verification fails."""
        payload = json.dumps({
            'type': 'checkout.session.completed',
            'data': {'object': {}}
        })
        with patch('src.routes.subscription_routes.STRIPE_WEBHOOK_SECRET', 'whsec_test_secret'), \
             patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True), \
             patch('src.routes.subscription_routes.stripe') as mock_stripe:
            class MockSignatureVerificationError(Exception):
                pass

            mock_stripe.error.SignatureVerificationError = MockSignatureVerificationError
            mock_stripe.Webhook.construct_event.side_effect = MockSignatureVerificationError("Invalid signature")
            response = client.post(
                '/api/v1/subscription/webhook',
                data=payload,
                content_type='application/json',
                headers={'stripe-signature': 'bad_sig'}
            )
            assert response.status_code == 400


class TestWebhookEventHandling:
    """Tests for individual webhook event types."""

    def test_webhook_without_stripe_available(self, client):
        """Should return error when Stripe is not available."""
        with patch('src.routes.subscription_routes.STRIPE_AVAILABLE', False):
            response = client.post(
                '/api/v1/subscription/webhook',
                data=json.dumps({'type': 'test'}),
                content_type='application/json'
            )
            assert response.status_code in [400, 500, 503]

    def test_webhook_missing_payload(self, client):
        """Should handle missing/empty payload gracefully."""
        with patch('src.routes.subscription_routes.STRIPE_AVAILABLE', True):
            response = client.post(
                '/api/v1/subscription/webhook',
                data='',
                content_type='application/json'
            )
            assert response.status_code in [400, 500]
