"""Guard against unconfigured Stripe price IDs reaching Stripe.

STRIPE_PRICE_* fall back to literal placeholders ("price_premium" etc.) when
their env vars are unset. Those are not real Stripe price IDs, so forwarding
one yields an opaque "No such price" from Stripe and a checkout the user can
do nothing about -- which is exactly what was happening in production.
"""

from unittest.mock import patch

BASE = "/api/v1/subscription"


class TestStripePriceConfigGuard:
    def test_placeholder_price_id_is_rejected_before_calling_stripe(self, client, csrf_headers):
        with patch("src.routes.subscription_routes.STRIPE_AVAILABLE", True), \
             patch("src.routes.subscription_routes.STRIPE_PRICE_PREMIUM", "price_premium"), \
             patch("src.routes.subscription_routes.stripe") as mock_stripe:
            resp = client.post(
                f"{BASE}/create-session",
                json={"plan": "premium", "email": "user@example.com", "billing_cycle": "monthly"},
                content_type="application/json",
                headers=csrf_headers,
            )

        assert resp.status_code == 503
        assert resp.get_json()["error"] == "STRIPE_PRICE_NOT_CONFIGURED"
        # The whole point is that we never hand Stripe a bogus price id.
        mock_stripe.checkout.Session.create.assert_not_called()

    def test_real_price_id_is_passed_through_to_stripe(self, client, csrf_headers):
        with patch("src.routes.subscription_routes.STRIPE_AVAILABLE", True), \
             patch("src.routes.subscription_routes.STRIPE_PRICE_PREMIUM", "price_1ABCdefGHIjkl"), \
             patch("src.routes.subscription_routes.stripe") as mock_stripe:
            mock_stripe.checkout.Session.create.return_value = type(
                "S", (), {"id": "cs_test_123", "url": "https://checkout.stripe.com/x"}
            )()

            resp = client.post(
                f"{BASE}/create-session",
                json={"plan": "premium", "email": "user@example.com", "billing_cycle": "monthly"},
                content_type="application/json",
                headers=csrf_headers,
            )

        assert resp.status_code != 503
        mock_stripe.checkout.Session.create.assert_called_once()
        sent_price = mock_stripe.checkout.Session.create.call_args.kwargs["line_items"][0]["price"]
        assert sent_price == "price_1ABCdefGHIjkl"
