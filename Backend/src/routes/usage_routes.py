import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

from ..config.subscription_config import load_subscription_plans
from ..firebase_config import db
from ..models.user_usage import UserUsage
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.response_utils import APIResponse

usage_bp = Blueprint("usage", __name__)
logger = logging.getLogger(__name__)


def get_subscription_limits(subscription_tier: str) -> dict[str, int]:
    """Get usage limits based on subscription tier."""
    plans = load_subscription_plans()
    plan = plans.get(subscription_tier, plans.get("free", {}))
    return {
        "mood_logs_per_day": plan.get("features", {}).get("daily_mood_logs", 5),
        "chat_messages_per_day": plan.get("features", {}).get("daily_chat_messages", 10),
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

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        
        # Get usage from Firestore
        usage_ref = db.collection("user_usage").document(f"{user_id}_{today}")
        usage_doc = usage_ref.get()
        
        if usage_doc.exists:
            usage_data = usage_doc.to_dict()
            usage = UserUsage.from_dict(usage_data)
        else:
            usage = UserUsage(user_id=user_id, date=today)
            usage_ref.set(usage.to_dict())
        
        # Get user's subscription tier
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        subscription_tier = "free"
        if user_doc.exists:
            user_data = user_doc.to_dict()
            subscription_tier = user_data.get("subscription_tier", "free")
        
        limits = get_subscription_limits(subscription_tier)
        
        return APIResponse.success({
            "mood_logs": usage.mood_logs,
            "chat_messages": usage.chat_messages,
            "limits": limits,
            "date": usage.date,
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

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        
        # Get usage from Firestore
        usage_ref = db.collection("user_usage").document(f"{user_id}_{today}")
        usage_doc = usage_ref.get()
        
        if usage_doc.exists:
            usage_data = usage_doc.to_dict()
            usage = UserUsage.from_dict(usage_data)
        else:
            usage = UserUsage(user_id=user_id, date=today)
        
        # Get user's subscription tier
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        subscription_tier = "free"
        if user_doc.exists:
            user_data = user_doc.to_dict()
            subscription_tier = user_data.get("subscription_tier", "free")
        
        # Check limit
        limits = get_subscription_limits(subscription_tier)
        if limits["mood_logs_per_day"] != -1 and usage.mood_logs >= limits["mood_logs_per_day"]:
            audit_log("mood_limit_reached", {"user_id": user_id, "tier": subscription_tier})
            return APIResponse.error("Daily mood log limit reached", "RATE_LIMIT_EXCEEDED", 429)
        
        # Increment and save
        usage.increment_mood_log()
        usage_ref.set(usage.to_dict())
        
        audit_log("mood_log_incremented", {"user_id": user_id, "count": usage.mood_logs})
        
        return APIResponse.success({
            "success": True,
            "mood_logs": usage.mood_logs,
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
    """Increment chat message count (called after successful chat message)."""
    try:
        user_id = g.get("user_id")
        if not user_id:
            return APIResponse.error("User ID not found", "UNAUTHORIZED", 401)

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        
        # Get usage from Firestore
        usage_ref = db.collection("user_usage").document(f"{user_id}_{today}")
        usage_doc = usage_ref.get()
        
        if usage_doc.exists:
            usage_data = usage_doc.to_dict()
            usage = UserUsage.from_dict(usage_data)
        else:
            usage = UserUsage(user_id=user_id, date=today)
        
        # Get user's subscription tier
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        subscription_tier = "free"
        if user_doc.exists:
            user_data = user_doc.to_dict()
            subscription_tier = user_data.get("subscription_tier", "free")
        
        # Check limit
        limits = get_subscription_limits(subscription_tier)
        if limits["chat_messages_per_day"] != -1 and usage.chat_messages >= limits["chat_messages_per_day"]:
            audit_log("chat_limit_reached", {"user_id": user_id, "tier": subscription_tier})
            return APIResponse.error("Daily chat message limit reached", "RATE_LIMIT_EXCEEDED", 429)
        
        # Increment and save
        usage.increment_chat_message()
        usage_ref.set(usage.to_dict())
        
        audit_log("chat_message_incremented", {"user_id": user_id, "count": usage.chat_messages})
        
        return APIResponse.success({
            "success": True,
            "chat_messages": usage.chat_messages,
            "limit": limits["chat_messages_per_day"],
        })
    except Exception as e:
        logger.error(f"Error incrementing chat message: {e}")
        audit_log("chat_increment_error", {"error": str(e)})
        return APIResponse.error("Failed to increment chat message", "INTERNAL_ERROR", 500)
