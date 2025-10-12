import logging
from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timezone
from firebase_admin.firestore import FieldFilter
from src.firebase_config import db
from src.config import STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_ID

# Initialize limiter for this module
limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])

# Configure Stripe if available
try:
    if STRIPE_SECRET_KEY:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        STRIPE_AVAILABLE = True
    else:
        STRIPE_AVAILABLE = False
except ImportError:
    STRIPE_AVAILABLE = False

subscription_bp = Blueprint("subscription", __name__)
logger = logging.getLogger(__name__)

@subscription_bp.route("/create-session", methods=["POST"])
@limiter.limit("5 per minute")
def create_checkout_session():
    """Create Stripe checkout session for subscription"""
    logger.info("🔄 Received request to create Stripe checkout session")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable - STRIPE_SECRET_KEY not configured")
            return jsonify({"error": "Betalningstjänst är inte tillgänglig!"}), 503

        data = request.get_json(force=True, silent=True) or {}
        logger.debug(f"📥 Request data: {data}")

        user_id = data.get("user_id", "").strip()
        user_email = data.get("email", "").strip()

        logger.info(f"👤 Processing checkout for user_id: {user_id}, email: {user_email}")

        if not user_id or not user_email:
            logger.warning("❌ Missing required fields: user_id or email")
            return jsonify({"error": "Användar-ID och e-post krävs!"}), 400

        # Create Stripe checkout session
        logger.info(f"💳 Creating Stripe checkout session with price_id: {STRIPE_PRICE_ID}")
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": STRIPE_PRICE_ID,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url=f"http://localhost:3000/dashboard?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url="http://localhost:3000/dashboard?canceled=true",
            customer_email=user_email,
            metadata={
                "user_id": user_id
            }
        )

        logger.info(f"✅ Stripe checkout session created successfully for user: {user_id}, session_id: {checkout_session.id}")
        logger.debug(f"🔗 Checkout URL: {checkout_session.url}")
        return jsonify({"sessionId": checkout_session.id, "url": checkout_session.url}), 200

    except stripe.error.StripeError as e:
        logger.error(f"💳 Stripe API error for user {user_id}: {str(e)}")
        logger.debug(f"Stripe error details: {e.http_body if hasattr(e, 'http_body') else 'No details'}")
        return jsonify({"error": f"Betalningsfel: {str(e)}"}), 400
    except Exception as e:
        logger.exception(f"❌ Unexpected error during checkout session creation for user {user_id}: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid betalningshantering."}), 500

@subscription_bp.route("/status/<user_id>", methods=["GET"])
def get_subscription_status(user_id):
    """Get user's subscription status"""
    try:
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get user document
        user_doc = db.collection("users").document(user_id).get()

        if not user_doc.exists:
            return jsonify({"error": "Användare hittades inte!"}), 404

        user_data = user_doc.to_dict()
        subscription = user_data.get("subscription", {
            "status": "free",
            "plan": "free"
        })

        return jsonify(subscription), 200

    except Exception as e:
        logger.exception(f"❌ Subscription status retrieval failed: {e}")
        return jsonify({"error": "Ett internt fel uppstod."}), 500

@subscription_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhooks for subscription events"""
    logger.info("🔄 Received Stripe webhook")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable for webhook processing")
            return jsonify({"error": "Betalningstjänst är inte tillgänglig!"}), 503

        payload = request.get_data(as_text=True)
        sig_header = request.headers.get("stripe-signature")

        logger.debug(f"📥 Webhook payload length: {len(payload)} bytes")
        logger.debug(f"🔐 Signature header: {sig_header}")

        # Verify webhook signature (in production, use webhook secret)
        # event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)

        # For development, we'll trust the payload
        import json
        event = json.loads(payload)

        event_type = event.get("type")
        logger.info(f"📡 Processing Stripe webhook event: {event_type}")

        if event_type == "checkout.session.completed":
            session = event.get("data", {}).get("object", {})
            user_id = session.get("metadata", {}).get("user_id")

            if user_id:
                # Update user subscription in Firestore
                subscription_data = {
                    "status": "active",
                    "plan": "premium",
                    "stripe_customer_id": session.get("customer"),
                    "stripe_subscription_id": session.get("subscription"),
                    "start_date": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                db.collection("users").document(user_id).update({
                    "subscription": subscription_data
                })

                logger.info(f"✅ Subscription activated for user: {user_id}")

        elif event_type == "invoice.payment_succeeded":
            # Handle successful payment
            subscription_id = event.get("data", {}).get("object", {}).get("subscription")
            logger.info(f"Payment succeeded for subscription: {subscription_id}")

        elif event_type == "invoice.payment_failed":
            # Handle failed payment
            subscription_id = event.get("data", {}).get("object", {}).get("subscription")
            logger.warning(f"Payment failed for subscription: {subscription_id}")

        elif event_type == "customer.subscription.deleted":
            # Handle subscription cancellation
            subscription = event.get("data", {}).get("object", {})
            customer_id = subscription.get("customer")

            # Find user by customer_id
            users = db.collection("users").where(filter=FieldFilter("subscription.stripe_customer_id", "==", customer_id)).stream()
            for user_doc in users:
                user_id = user_doc.id
                db.collection("users").document(user_id).update({
                    "subscription.status": "canceled",
                    "subscription.end_date": datetime.now(timezone.utc).isoformat(),
                    "subscription.updated_at": datetime.now(timezone.utc).isoformat()
                })
                logger.info(f"✅ Subscription canceled for user: {user_id}")
                break

        return jsonify({"status": "success"}), 200

    except Exception as e:
        logger.exception(f"❌ Webhook processing failed: {e}")
        return jsonify({"error": "Webhook processing failed"}), 500

@subscription_bp.route("/cancel/<user_id>", methods=["POST"])
def cancel_subscription(user_id):
    """Cancel user's subscription"""
    try:
        if not STRIPE_AVAILABLE:
            return jsonify({"error": "Betalningstjänst är inte tillgänglig!"}), 503

        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get user subscription
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return jsonify({"error": "Användare hittades inte!"}), 404

        user_data = user_doc.to_dict()
        subscription = user_data.get("subscription", {})

        if subscription.get("status") != "active":
            return jsonify({"error": "Ingen aktiv prenumeration att avbryta!"}), 400

        stripe_subscription_id = subscription.get("stripe_subscription_id")
        if not stripe_subscription_id:
            return jsonify({"error": "Stripe prenumerations-ID saknas!"}), 400

        # Cancel subscription in Stripe
        stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )

        # Update Firestore
        db.collection("users").document(user_id).update({
            "subscription.status": "canceling",
            "subscription.updated_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"✅ Subscription cancellation initiated for user: {user_id}")
        return jsonify({"message": "Prenumeration kommer att avslutas vid periodens slut."}), 200

    except stripe.error.StripeError as e:
        logger.error(f"Stripe cancellation error: {str(e)}")
        return jsonify({"error": f"Avbokningsfel: {str(e)}"}), 400
    except Exception as e:
        logger.exception(f"❌ Subscription cancellation failed: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid avbokning."}), 500