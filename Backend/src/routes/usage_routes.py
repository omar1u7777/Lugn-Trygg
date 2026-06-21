import logging

from flask import Blueprint, g

from ..config.subscription_config import load_subscription_plans
from ..firebase_config import db
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.subscription_service import SubscriptionLimitError, SubscriptionService
from ..utils.response_utils import APIResponse

usage_bp = Blueprint("usage", __name__)
logger = logging.getLogger(__name__)


def _get_user_subscription_tier(user_id: str) -> tuple[str, dict]:
    """Return (subscription_tier, user_data) for the given user."""
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()
    if user_doc.exists:
        user_data = user_doc.to_dict() or {}
        return user_data.get("subscription_tier", "free"), user_data
    return "free", {}


def get_subscription_limits(subscription_tier: str) -> dict[str, int]:
    """Get usage limits based on subscription tier."""
    plans = load_subscription_plans()
    plan = plans.get(subscription_tier, plans.get("free", {}))
    limits = plan.get("limits", {})
    return {
        "mood_logs_per_day": limits.get("moodLogsPerDay", 3),
        "chat_messages_per_day": limits.get("chatMessagesPerDay", 10),
    }


@usage_bp.route("/status", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_usage_status():
    """Get current usage and limits for the user."""
    try:
        user_id = g.get("user_id")
        if not user_id:
            return APIResponse.error("User ID not found", "UNAUTHORIZED", 401)

        subscription_tier, _ = _get_user_subscription_tier(user_id)
        limits = get_subscription_limits(subscription_tier)

        # Single source of truth: System A (users/{userId}/usage/daily)
        usage = SubscriptionService.get_daily_usage(user_id)

        return APIResponse.success({
            "mood_logs": usage["mood_logs"],
            "chat_messages": usage["chat_messages"],
            "limits": limits,
            "date": usage["date"],
            "subscription_tier": subscription_tier,
        })
    except Exception as e:
        logger.error(f"Error getting usage status: {e}")
        audit_log("usage_status_error", {"error": str(e)})
        return APIResponse.error("Failed to get usage status", "INTERNAL_ERROR", 500)


@usage_bp.route("/increment/mood", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def increment_mood_log():
    """Increment mood log count (called after successful mood save)."""
    try:
        user_id = g.get("user_id")
        if not user_id:
            return APIResponse.error("User ID not found", "UNAUTHORIZED", 401)

        subscription_tier, _ = _get_user_subscription_tier(user_id)
        limits = get_subscription_limits(subscription_tier)

        # Delegate to System A for atomic, race-safe enforcement
        try:
            result = SubscriptionService.consume_quota(
                user_id,
                "mood_logs",
                {"moodLogsPerDay": limits["mood_logs_per_day"]},
            )
        except SubscriptionLimitError:
            audit_log("mood_limit_reached", {"user_id": user_id, "tier": subscription_tier})
            return APIResponse.error("Daily mood log limit reached", "RATE_LIMIT_EXCEEDED", 429)

        audit_log("mood_log_incremented", {"user_id": user_id, "count": result["mood_logs"]})

        return APIResponse.success({
            "success": True,
            "mood_logs": result["mood_logs"],
            "limit": limits["mood_logs_per_day"],
        })
    except Exception as e:
        logger.error(f"Error incrementing mood log: {e}")
        audit_log("mood_increment_error", {"error": str(e)})
        return APIResponse.error("Failed to increment mood log", "INTERNAL_ERROR", 500)


@usage_bp.route("/increment/chat", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def increment_chat_message():
    """Sync chat message count after a successful stream.

    The actual increment was already performed by chatbot_routes via
    SubscriptionService.consume_quota() before the stream started.
    This endpoint returns the current authoritative count from System A
    so the frontend stays in sync without double-counting.
    """
    try:
        user_id = g.get("user_id")
        if not user_id:
            logger.error("User ID not found in request context")
            return APIResponse.error("User ID not found", "UNAUTHORIZED", 401)

        logger.debug(f"Syncing chat message count for user: {user_id}")

        subscription_tier, user_data = _get_user_subscription_tier(user_id)
        limits = get_subscription_limits(subscription_tier)

        # Read current count from System A — do NOT increment again
        usage = SubscriptionService.get_daily_usage(user_id)

        audit_log("chat_message_synced", {"user_id": user_id, "count": usage["chat_messages"]})

        return APIResponse.success({
            "success": True,
            "chat_messages": usage["chat_messages"],
            "limit": limits["chat_messages_per_day"],
        })
    except RuntimeError as e:
        # Firestore not initialized error
        logger.error(f"Firestore not initialized: {e}")
        audit_log("chat_increment_firestore_error", {"error": str(e), "user_id": user_id if 'user_id' in locals() else 'unknown'})
        return APIResponse.error("Database connection error", "SERVICE_UNAVAILABLE", 503)
    except Exception as e:
        logger.error(f"Error syncing chat message count: {e}", exc_info=True)
        audit_log("chat_increment_error", {"error": str(e), "user_id": user_id if 'user_id' in locals() else 'unknown'})
        return APIResponse.error("Failed to sync chat message count", "INTERNAL_ERROR", 500)
