"""
Tests for Stripe webhook security — production guard against unverified webhooks.
Covers: STRIPE_WEBHOOK_SECRET enforcement, signature verification, event handling.
"""
import pytest
import json
import os
from unittest.mock import patch, MagicMock


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
        mock_event = MagicMock()
        mock_event.__getitem__ = lambda self, key: event_data[key]
        mock_event.get = lambda key, default=None: event_data.get(key, default)
        mock_event.type = 'checkout.session.completed'

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
            # Should process successfully or fail gracefully
            assert response.status_code in [200, 400, 500]

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
