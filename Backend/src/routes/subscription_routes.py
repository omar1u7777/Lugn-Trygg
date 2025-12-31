import logging
from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timezone
from firebase_admin.firestore import FieldFilter
from ..firebase_config import db
from ..config import (
    STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY,
    STRIPE_PRICE_PREMIUM,
    STRIPE_PRICE_PREMIUM_YEARLY,
    STRIPE_PRICE_ENTERPRISE,
    STRIPE_PRICE_CBT_MODULE,
)
from ..config.subscription_config import load_subscription_plans
from ..services.subscription_service import SubscriptionService

# Initialize limiter for this module
limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])

# Configure Stripe if available
try:
    import stripe
    if STRIPE_SECRET_KEY:
        stripe.api_key = STRIPE_SECRET_KEY
        STRIPE_AVAILABLE = True
    else:
        STRIPE_AVAILABLE = False
except ImportError:
    stripe = None
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
        plan = data.get("plan", "premium").strip().lower()  # default to premium
        billing_cycle = data.get("billing_cycle", "monthly").strip().lower() or "monthly"

        logger.info(f"👤 Processing checkout for user_id: {user_id}, email: {user_email}, plan: {plan}")

        if not user_id or not user_email:
            logger.warning("❌ Missing required fields: user_id or email")
            return jsonify({"error": "Användar-ID och e-post krävs!"}), 400

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
            return jsonify({"error": "Ogiltig plan vald!"}), 400

        # Create Stripe checkout session
        logger.info(f"💳 Creating Stripe checkout session with price_id: {price_id} for plan: {plan}")
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url=f"http://localhost:3000/dashboard?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url="http://localhost:3000/dashboard?canceled=true",
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "plan": plan,
                "billing_cycle": billing_cycle,
            }
        )
        logger.info(f"✅ Stripe checkout session created successfully for user: {user_id}, session_id: {checkout_session.id}")
        logger.debug(f"🔗 Checkout URL: {checkout_session.url}")
        return jsonify({"sessionId": checkout_session.id, "url": checkout_session.url}), 200

    except Exception as e:
        # Handle all Stripe and other errors
        logger.error(f"❌ Error during checkout session creation for user {user_id if 'user_id' in locals() else 'unknown'}: {e}")
        return jsonify({"error": f"Betalningsfel: {str(e)}"}), 400

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
        payload = SubscriptionService.build_status_payload(user_id, user_data)

        return jsonify(payload), 200

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
            purchase_type = session.get("metadata", {}).get("type")

            if user_id:
                if purchase_type == "cbt_module":
                    # Handle CBT module purchase
                    module = session.get("metadata", {}).get("module")
                    if module:
                        # Add to user's purchases
                        user_ref = db.collection("users").document(user_id)
                        user_doc = user_ref.get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict()
                            purchases = user_data.get("purchases", [])
                            if module not in purchases:
                                purchases.append(module)
                                user_ref.update({
                                    "purchases": purchases,
                                    "updated_at": datetime.now(timezone.utc).isoformat()
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
                        "start_date": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }

                    db.collection("users").document(user_id).update({
                        "subscription": subscription_data
                    })

                    logger.info(f"✅ Subscription activated for user: {user_id} with plan: {plan}")

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

@subscription_bp.route("/purchase-cbt-module", methods=["POST"])
@limiter.limit("5 per minute")
def purchase_cbt_module():
    """Create Stripe checkout session for CBT module purchase"""
    logger.info("🔄 Received request to purchase CBT module")
    try:
        if not STRIPE_AVAILABLE:
            logger.warning("❌ Stripe service unavailable - STRIPE_SECRET_KEY not configured")
            return jsonify({"error": "Betalningstjänst är inte tillgänglig!"}), 503

        data = request.get_json(force=True, silent=True) or {}
        logger.debug(f"📥 Request data: {data}")

        user_id = data.get("user_id", "").strip()
        user_email = data.get("email", "").strip()
        module = data.get("module", "").strip()

        logger.info(f"👤 Processing CBT module purchase for user_id: {user_id}, email: {user_email}, module: {module}")

        if not user_id or not user_email or not module:
            logger.warning("❌ Missing required fields: user_id, email, or module")
            return jsonify({"error": "Användar-ID, e-post och modul krävs!"}), 400

        # Create Stripe checkout session for one-time payment
        logger.info(f"💳 Creating Stripe checkout session for CBT module: {module}")
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": STRIPE_PRICE_CBT_MODULE,
                    "quantity": 1,
                },
            ],
            mode="payment",
            success_url=f"http://localhost:3000/dashboard?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url="http://localhost:3000/dashboard?canceled=true",
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "module": module,
                "type": "cbt_module"
            }
        )

        logger.info(f"✅ CBT module checkout session created successfully for user: {user_id}, session_id: {checkout_session.id}")
        logger.debug(f"🔗 Checkout URL: {checkout_session.url}")
        return jsonify({"sessionId": checkout_session.id, "url": checkout_session.url}), 200

    except Exception as e:
        # Handle all Stripe and other errors
        logger.error(f"❌ Error during CBT module purchase for user {user_id if 'user_id' in locals() else 'unknown'}: {e}")
        return jsonify({"error": f"Betalningsfel: {str(e)}"}), 400

@subscription_bp.route("/plans", methods=["GET"])
def get_available_plans():
    """Get available subscription plans"""
    try:
        plans = load_subscription_plans()
        return jsonify(plans), 200
    except Exception as e:
        logger.exception(f"❌ Error retrieving plans: {e}")
        return jsonify({"error": "Ett internt fel uppstod."}), 500

@subscription_bp.route("/purchases/<user_id>", methods=["GET"])
def get_user_purchases(user_id):
    """Get user's purchased items"""
    try:
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Get user document
        user_doc = db.collection("users").document(user_id).get()

        if not user_doc.exists:
            return jsonify({"error": "Användare hittades inte!"}), 404

        user_data = user_doc.to_dict()
        purchases = user_data.get("purchases", [])

        return jsonify({"purchases": purchases}), 200

    except Exception as e:
        logger.exception(f"❌ Error retrieving purchases for user {user_id}: {e}")
        return jsonify({"error": "Ett internt fel uppstod."}), 500

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
        try:
            stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=True
            )
        except Exception as stripe_error:
            logger.error(f"❌ Stripe cancellation error: {stripe_error}")
            return jsonify({"error": f"Avbokningsfel: {str(stripe_error)}"}), 400

        # Update Firestore
        db.collection("users").document(user_id).update({
            "subscription.status": "canceling",
            "subscription.updated_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"✅ Subscription cancellation initiated for user: {user_id}")
        return jsonify({"message": "Prenumeration kommer att avslutas vid periodens slut."}), 200

    except Exception as e:
        # Handle database errors
        logger.exception(f"❌ Database error during subscription cancellation: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid avbokning."}), 500