import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

# FieldFilter import with fallback
try:
    from google.cloud.firestore import FieldFilter
except ImportError:
    FieldFilter = None  # type: ignore

import os

from ..config import (
    STRIPE_PRICE_CBT_MODULE,
    STRIPE_PRICE_ENTERPRISE,
    STRIPE_PRICE_PREMIUM,
    STRIPE_PRICE_PREMIUM_YEARLY,
    STRIPE_SECRET_KEY,
)
from ..config.subscription_config import load_subscription_plans
from ..firebase_config import db

# Frontend URL for Stripe redirect - use env var, never hardcode localhost in production
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.subscription_service import SubscriptionService
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse

# Configure Stripe if available
try:
    import stripe
    if STRIPE_SECRET_KEY:
        stripe.api_key = STRIPE_SECRET_KEY
        STRIPE_AVAILABLE = True
    else:
        STRIPE_AVAILABLE = False
except ImportError:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False

subscription_bp = Blueprint("subscription", __name__)
logger = logging.getLogger(__name__)


# CORS OPTIONS handler for all endpoints
@subscription_bp.route("/create-session", methods=["OPTIONS"])
@subscription_bp.route("/status/<user_id>", methods=["OPTIONS"])
@subscription_bp.route("/webhook", methods=["OPTIONS"])
@subscription_bp.route("/purchase-cbt-module", methods=["OPTIONS"])
@subscription_bp.route("/plans", methods=["OPTIONS"])
@subscription_bp.route("/purchases/<user_id>", methods=["OPTIONS"])
@subscription_bp.route("/cancel/<user_id>", methods=["OPTIONS"])
def handle_options(user_id: str = ""):
    """Handle CORS preflight requests"""
    return APIResponse.success()


@subscription_bp.route("/create-session", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def create_checkout_session():
    """Create Stripe checkout session for subscription"""
    logger.info("🔄 Received request to create Stripe checkout session")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable - STRIPE_SECRET_KEY not configured")
            return APIResponse.error("Payment service is not available", "SERVICE_UNAVAILABLE", 503)

        data = request.get_json(force=True, silent=True) or {}

        logger.debug(f"📥 Request data: {data}")

        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        user_email = sanitize_text(data.get("email", ""), max_length=254)
        plan = sanitize_text(data.get("plan", "premium"), max_length=50).lower()
        billing_cycle = sanitize_text(data.get("billing_cycle", "monthly"), max_length=20).lower() or "monthly"

        logger.info(f"👤 Processing checkout for user_id: {user_id}, email: {user_email}, plan: {plan}")

        if not user_email:
            logger.warning("❌ Missing required field: email")
            return APIResponse.bad_request("Email is required")

        # Determine price ID based on plan
        if plan == "premium":
            if billing_cycle == "yearly" and STRIPE_PRICE_PREMIUM_YEARLY:
                price_id = STRIPE_PRICE_PREMIUM_YEARLY
            else:
                price_id = STRIPE_PRICE_PREMIUM
        elif plan == "enterprise":
            price_id = STRIPE_PRICE_ENTERPRISE
        else:
            logger.warning(f"❌ Invalid plan: {plan}")
            return APIResponse.bad_request("Invalid plan selected")

        # Create Stripe checkout session
        logger.info(f"💳 Creating Stripe checkout session with price_id: {price_id} for plan: {plan}")
        checkout_session = stripe.checkout.Session.create(  # type: ignore
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/dashboard?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/dashboard?canceled=true",
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "plan": plan,
                "billing_cycle": billing_cycle,
            }
        )

        audit_log("CHECKOUT_SESSION_CREATED", user_id, {"plan": plan, "sessionId": checkout_session.id})
        logger.info(f"✅ Stripe checkout session created successfully for user: {user_id}, session_id: {checkout_session.id}")

        return APIResponse.success({
            "sessionId": checkout_session.id,
            "url": checkout_session.url
        }, "Checkout session created")

    except Exception as e:
        logger.error(f"❌ Error during checkout session creation: {e}")
        return APIResponse.error("Payment processing failed", "PAYMENT_ERROR", 400)


@subscription_bp.route("/status/<user_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_subscription_status(user_id: str):
    """Get user's subscription status"""
    try:
        user_id = sanitize_text(user_id, max_length=128)
        if not user_id:
            return APIResponse.bad_request("User ID is required")

        # Security: Only allow users to view their own status
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        if current_user_id != user_id:
            return APIResponse.forbidden("Cannot view another user's status")

        # Get user document
        user_doc = db.collection("users").document(user_id).get()  # type: ignore

        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict()
        payload = SubscriptionService.build_status_payload(user_id, user_data)

        return APIResponse.success(payload, "Subscription status retrieved")

    except Exception as e:
        logger.exception(f"❌ Subscription status retrieval failed: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@subscription_bp.route("/webhook", methods=["POST"])
@rate_limit_by_endpoint
def stripe_webhook():
    """Handle Stripe webhooks for subscription events"""
    logger.info("🔄 Received Stripe webhook")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable for webhook processing")
            return APIResponse.error("Payment service is not available", "SERVICE_UNAVAILABLE", 503)

        payload = request.get_data(as_text=True)
        sig_header = request.headers.get("stripe-signature")

        logger.debug(f"📥 Webhook payload length: {len(payload)} bytes")
        logger.debug(f"🔐 Signature header present: {bool(sig_header)}")

        # Verify webhook signature when secret is configured (production)
        if STRIPE_WEBHOOK_SECRET and sig_header:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, STRIPE_WEBHOOK_SECRET
                )
                logger.info("✅ Stripe webhook signature verified")
            except stripe.error.SignatureVerificationError as e:
                logger.error(f"❌ Webhook signature verification failed: {e}")
                return APIResponse.error("Invalid webhook signature", "SIGNATURE_ERROR", 400)
            except ValueError as e:
                logger.error(f"❌ Invalid webhook payload: {e}")
                return APIResponse.error("Invalid payload", "PAYLOAD_ERROR", 400)
        elif not STRIPE_WEBHOOK_SECRET:
            # In production, never accept unverified webhooks
            flask_env = os.getenv('FLASK_ENV', 'development')
            if flask_env == 'production':
                logger.error("❌ STRIPE_WEBHOOK_SECRET not configured in production — rejecting webhook")
                return APIResponse.error("Webhook verification not configured", "CONFIG_ERROR", 503)
            # Development fallback - log warning but allow
            import json
            event = json.loads(payload)
            logger.warning("⚠️ STRIPE_WEBHOOK_SECRET not set - webhook signature not verified (dev mode)")
        else:
            # Production: signature header missing
            logger.error("❌ Webhook request missing stripe-signature header")
            return APIResponse.error("Missing webhook signature", "SIGNATURE_MISSING", 400)

        event_type = event.get("type")
        logger.info(f"📡 Processing Stripe webhook event: {event_type}")

        if event_type == "checkout.session.completed":
            session = event.get("data", {}).get("object", {})
            user_id = session.get("metadata", {}).get("user_id")
            purchase_type = session.get("metadata", {}).get("type")

            if user_id:
                if purchase_type == "cbt_module":
                    # Handle CBT module purchase
                    module = session.get("metadata", {}).get("module")
                    if module:
                        # Add to user's purchases
                        user_ref = db.collection("users").document(user_id)  # type: ignore
                        user_doc = user_ref.get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict()
                            purchases = user_data.get("purchases", [])
                            if module not in purchases:
                                purchases.append(module)
                                user_ref.update({
                                    "purchases": purchases,
                                    "updated_at": datetime.now(UTC).isoformat()
                                })
                                logger.info(f"✅ CBT module '{module}' purchased for user: {user_id}")
                else:
                    # Handle subscription
                    plan = session.get("metadata", {}).get("plan", "premium")
                    subscription_data = {
                        "status": "active",
                        "plan": plan,
                        "stripe_customer_id": session.get("customer"),
                        "stripe_subscription_id": session.get("subscription"),
                        "start_date": datetime.now(UTC).isoformat(),
                        "updated_at": datetime.now(UTC).isoformat()
                    }

                    db.collection("users").document(user_id).update({  # type: ignore
                        "subscription": subscription_data
                    })

                    logger.info(f"✅ Subscription activated for user: {user_id} with plan: {plan}")

        elif event_type == "invoice.payment_succeeded":
            # Handle successful payment
            subscription_id = event.get("data", {}).get("object", {}).get("subscription")
            logger.info(f"Payment succeeded for subscription: {subscription_id}")

        elif event_type == "invoice.payment_failed":
            # Handle failed payment - mark subscription as past_due
            invoice = event.get("data", {}).get("object", {})
            subscription_id = invoice.get("subscription")
            customer_id = invoice.get("customer")
            logger.warning(f"Payment failed for subscription: {subscription_id}")

            if customer_id:
                # Find user by customer_id and mark as past_due
                if FieldFilter:
                    users = db.collection("users").where(  # type: ignore
                        filter=FieldFilter("subscription.stripe_customer_id", "==", customer_id)
                    ).stream()
                else:
                    users = db.collection("users").where(  # type: ignore
                        "subscription.stripe_customer_id", "==", customer_id
                    ).stream()

                for user_doc in users:
                    user_id = user_doc.id
                    db.collection("users").document(user_id).update({  # type: ignore
                        "subscription.status": "past_due",
                        "subscription.updated_at": datetime.now(UTC).isoformat()
                    })
                    audit_log("PAYMENT_FAILED", user_id, {"subscriptionId": subscription_id})
                    logger.warning(f"⚠️ Subscription marked past_due for user: {user_id}")
                    break

        elif event_type == "customer.subscription.deleted":
            # Handle subscription cancellation
            subscription = event.get("data", {}).get("object", {})
            customer_id = subscription.get("customer")

            # Find user by customer_id - use FieldFilter fallback
            if FieldFilter:
                users = db.collection("users").where(  # type: ignore
                    filter=FieldFilter("subscription.stripe_customer_id", "==", customer_id)
                ).stream()
            else:
                users = db.collection("users").where(  # type: ignore
                    "subscription.stripe_customer_id", "==", customer_id
                ).stream()

            for user_doc in users:
                user_id = user_doc.id
                db.collection("users").document(user_id).update({  # type: ignore
                    "subscription.status": "canceled",
                    "subscription.end_date": datetime.now(UTC).isoformat(),
                    "subscription.updated_at": datetime.now(UTC).isoformat()
                })
                audit_log("SUBSCRIPTION_CANCELED", user_id, {"customerId": customer_id})
                logger.info(f"✅ Subscription canceled for user: {user_id}")
                break

        return APIResponse.success({"status": "success"}, "Webhook processed")

    except Exception as e:
        logger.exception(f"❌ Webhook processing failed: {e}")
        return APIResponse.error("Webhook processing failed", "WEBHOOK_ERROR", 500)


@subscription_bp.route("/purchase-cbt-module", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def purchase_cbt_module():
    """Create Stripe checkout session for CBT module purchase"""
    logger.info("🔄 Received request to purchase CBT module")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable - STRIPE_SECRET_KEY not configured")
            return APIResponse.error("Payment service is not available", "SERVICE_UNAVAILABLE", 503)

        data = request.get_json(force=True, silent=True) or {}
        logger.debug(f"📥 Request data: {data}")

        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        user_email = sanitize_text(data.get("email", ""), max_length=254)
        module = sanitize_text(data.get("module", ""), max_length=50)

        logger.info(f"👤 Processing CBT module purchase for user_id: {user_id}, email: {user_email}, module: {module}")

        if not user_email or not module:
            logger.warning("❌ Missing required fields: email or module")
            return APIResponse.bad_request("Email and module are required")

        # Create Stripe checkout session for one-time payment
        logger.info(f"💳 Creating Stripe checkout session for CBT module: {module}")
        checkout_session = stripe.checkout.Session.create(  # type: ignore
            payment_method_types=["card"],
            line_items=[
                {
                    "price": STRIPE_PRICE_CBT_MODULE,
                    "quantity": 1,
                },
            ],
            mode="payment",
            success_url=f"{FRONTEND_URL}/dashboard?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/dashboard?canceled=true",
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "module": module,
                "type": "cbt_module"
            }
        )

        audit_log("CBT_MODULE_CHECKOUT", user_id, {"module": module, "sessionId": checkout_session.id})
        logger.info(f"✅ CBT module checkout session created successfully for user: {user_id}, session_id: {checkout_session.id}")

        return APIResponse.success({
            "sessionId": checkout_session.id,
            "url": checkout_session.url
        }, "Checkout session created")

    except Exception as e:
        logger.error(f"❌ Error during CBT module purchase: {e}")
        return APIResponse.error("Payment processing failed", "PAYMENT_ERROR", 400)


@subscription_bp.route("/plans", methods=["GET"])
@rate_limit_by_endpoint
def get_available_plans():
    """Get available subscription plans"""
    try:
        plans = load_subscription_plans()
        return APIResponse.success(plans, "Subscription plans retrieved")
    except Exception as e:
        logger.exception(f"❌ Error retrieving plans: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@subscription_bp.route("/purchases/<user_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_purchases(user_id: str):
    """Get user's purchased items"""
    try:
        user_id = sanitize_text(user_id, max_length=128)
        if not user_id:
            return APIResponse.bad_request("User ID is required")

        # Security: Only allow users to view their own purchases
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        if current_user_id != user_id:
            return APIResponse.forbidden("Cannot view another user's purchases")

        # Get user document
        user_doc = db.collection("users").document(user_id).get()  # type: ignore

        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict()
        purchases = user_data.get("purchases", [])

        return APIResponse.success({"purchases": purchases}, "User purchases retrieved")

    except Exception as e:
        logger.exception(f"❌ Error retrieving purchases for user {user_id}: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@subscription_bp.route("/cancel/<user_id>", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def cancel_subscription(user_id: str):
    """Cancel user's subscription"""
    try:
        user_id = sanitize_text(user_id, max_length=128)

        if not STRIPE_AVAILABLE:
            return APIResponse.error("Payment service is not available", "SERVICE_UNAVAILABLE", 503)

        if not user_id:
            return APIResponse.bad_request("User ID is required")

        # Security: Only allow users to cancel their own subscription
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        if current_user_id != user_id:
            return APIResponse.forbidden("Cannot cancel another user's subscription")

        # Get user subscription
        user_doc = db.collection("users").document(user_id).get()  # type: ignore
        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict()
        subscription = user_data.get("subscription", {})

        if subscription.get("status") != "active":
            return APIResponse.bad_request("No active subscription to cancel")

        stripe_subscription_id = subscription.get("stripe_subscription_id")
        if not stripe_subscription_id:
            return APIResponse.bad_request("Stripe subscription ID is missing")

        # Cancel subscription in Stripe
        try:
            stripe.Subscription.modify(  # type: ignore
                stripe_subscription_id,
                cancel_at_period_end=True
            )
        except Exception as stripe_error:
            logger.error(f"❌ Stripe cancellation error: {stripe_error}")
            return APIResponse.error(f"Cancellation error: {str(stripe_error)}", "STRIPE_ERROR", 400)

        # Update Firestore
        db.collection("users").document(user_id).update({  # type: ignore
            "subscription.status": "canceling",
            "subscription.updated_at": datetime.now(UTC).isoformat()
        })

        audit_log("SUBSCRIPTION_CANCEL_INITIATED", user_id, {"subscriptionId": stripe_subscription_id})
        logger.info(f"✅ Subscription cancellation initiated for user: {user_id}")

        return APIResponse.success({
            "message": "Subscription will be canceled at end of billing period"
        }, "Cancellation initiated")

    except Exception as e:
        logger.exception(f"❌ Database error during subscription cancellation: {e}")
        return APIResponse.error("An internal error occurred during cancellation", "INTERNAL_ERROR", 500)
