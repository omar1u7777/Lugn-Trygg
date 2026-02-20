"""Subscription plan + usage helpers shared across routes."""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Literal

from ..config.subscription_config import load_subscription_plans
from ..firebase_config import db

logger = logging.getLogger(__name__)

UsageType = Literal["mood_logs", "chat_messages"]

USAGE_COLLECTION = "usage"
USAGE_DOC_ID = "daily"

PLAN_LIMIT_MAP: dict[UsageType, str] = {
    "mood_logs": "moodLogsPerDay",
    "chat_messages": "chatMessagesPerDay",
}


class SubscriptionLimitError(Exception):
    """Raised when a user consumes more than their allowed quota."""

    def __init__(self, usage_type: UsageType, limit_value: int):
        self.usage_type = usage_type
        self.limit_value = limit_value
        super().__init__(f"Daily limit reached for {usage_type}")


class SubscriptionService:
    PREMIUM_TIERS = ("premium", "enterprise")

    @staticmethod
    def _today() -> str:
        return datetime.now(UTC).strftime("%Y-%m-%d")

    @staticmethod
    def _get_usage_ref(user_id: str):
        if db is None:
            raise RuntimeError("Firestore database client is not initialized")
        return (
            db.collection("users")
            .document(user_id)
            .collection(USAGE_COLLECTION)
            .document(USAGE_DOC_ID)
        )

    @staticmethod
    def _normalize_plan(plan_key: str | None) -> str:
        candidate = (plan_key or "free").strip().lower()
        plans = load_subscription_plans()
        if candidate in plans:
            return candidate
        return "free"

    @classmethod
    def is_premium_plan(cls, plan_key: str) -> bool:
        return plan_key in cls.PREMIUM_TIERS

    @classmethod
    def get_plan_context(cls, user_data: dict[str, Any] | None) -> dict[str, Any]:
        user_data = user_data or {}
        subscription = user_data.get("subscription", {}) or {}
        plan_key = cls._normalize_plan(subscription.get("plan"))
        plans = load_subscription_plans()
        plan_meta = plans.get(plan_key, plans.get("free", {}))
        status = subscription.get("status", "free")

        return {
            "plan": plan_key,
            "status": status,
            "limits": plan_meta.get("limits", {}),
            "features": plan_meta.get("features", {}),
            "name": plan_meta.get("name"),
            "price": plan_meta.get("price"),
            "currency": plan_meta.get("currency"),
            "interval": plan_meta.get("interval"),
            "is_premium": cls.is_premium_plan(plan_key),
            "is_trial": plan_key == "trial" or status == "trial",
            "expires_at": subscription.get("end_date") or subscription.get("expires_at"),
            "trial_ends_at": subscription.get("trial_end_date")
            or subscription.get("trial_ends_at"),
            "subscription": subscription,
        }

    @classmethod
    def get_daily_usage(cls, user_id: str) -> dict[str, Any]:
        today = cls._today()
        try:
            usage_ref = cls._get_usage_ref(user_id)
            snapshot = usage_ref.get()
            if snapshot and snapshot.exists:
                data = snapshot.to_dict() or {}
                if data.get("date") == today:
                    return {
                        "date": today,
                        "mood_logs": int(data.get("mood_logs", 0)),
                        "chat_messages": int(data.get("chat_messages", 0)),
                    }
        except Exception as exc:  # pragma: no cover - logging only
            logger.warning("Failed to read subscription usage: %s", exc)

        # Reset doc if outdated or missing
        reset_payload = {
            "date": today,
            "mood_logs": 0,
            "chat_messages": 0,
        }
        try:
            usage_ref = cls._get_usage_ref(user_id)
            usage_ref.set(reset_payload, merge=False)
        except Exception as exc:  # pragma: no cover - logging only
            logger.warning("Failed to reset subscription usage: %s", exc)
        return reset_payload

    @classmethod
    def consume_quota(
        cls,
        user_id: str,
        usage_type: UsageType,
        plan_limits: dict[str, Any],
    ) -> dict[str, Any]:
        limit_field = PLAN_LIMIT_MAP[usage_type]
        limit_value = int(plan_limits.get(limit_field, 0))

        # Unlimited plans never consume quota
        if limit_value == -1:
            return {
                **cls.get_daily_usage(user_id),
                "limit": limit_value,
            }

        today = cls._today()
        usage_ref = cls._get_usage_ref(user_id)

        # Use a Firestore transaction to prevent TOCTOU race condition
        from google.cloud.firestore import transactional as _transactional

        @_transactional
        def _consume_in_transaction(transaction: Any) -> dict[str, Any]:
            snapshot = usage_ref.get(transaction=transaction)
            data = snapshot.to_dict() if snapshot and snapshot.exists else None

            if not data or data.get("date") != today:
                data = {
                    "date": today,
                    "mood_logs": 0,
                    "chat_messages": 0,
                }

            current_value = int(data.get(usage_type, 0))
            if current_value >= limit_value:
                raise SubscriptionLimitError(usage_type, limit_value)

            data[usage_type] = current_value + 1
            transaction.set(usage_ref, data)

            return {
                "date": data.get("date", today),
                "mood_logs": int(data.get("mood_logs", 0)),
                "chat_messages": int(data.get("chat_messages", 0)),
                "limit": limit_value,
            }

        try:
            if db is None:
                raise RuntimeError("Firestore database client is not initialized")
            transaction = db.transaction()
            return _consume_in_transaction(transaction)
        except SubscriptionLimitError:
            raise
        except Exception as exc:
            logger.warning("Transaction failed for quota consumption: %s", exc)
            # Fallback to non-transactional for resilience
            try:
                snapshot = usage_ref.get()
                data = snapshot.to_dict() if snapshot and snapshot.exists else None
                if not data or data.get("date") != today:
                    data = {"date": today, "mood_logs": 0, "chat_messages": 0}
                current_value = int(data.get(usage_type, 0))
                if current_value >= limit_value:
                    raise SubscriptionLimitError(usage_type, limit_value)
                data[usage_type] = current_value + 1
                usage_ref.set(data, merge=False)
                return {
                    "date": data.get("date", today),
                    "mood_logs": int(data.get("mood_logs", 0)),
                    "chat_messages": int(data.get("chat_messages", 0)),
                    "limit": limit_value,
                }
            except SubscriptionLimitError:
                raise
            except Exception as fallback_exc:
                logger.warning("Fallback quota write failed: %s", fallback_exc)
                return {"date": today, "mood_logs": 0, "chat_messages": 0, "limit": limit_value}

    @classmethod
    def build_status_payload(cls, user_id: str, user_data: dict[str, Any] | None) -> dict[str, Any]:
        context = cls.get_plan_context(user_data)
        usage_raw = cls.get_daily_usage(user_id)
        # Transform usage keys to camelCase for frontend
        usage = {
            "date": usage_raw.get("date"),
            "moodLogs": usage_raw.get("mood_logs", 0),
            "chatMessages": usage_raw.get("chat_messages", 0),
        }
        return {
            "plan": context["plan"],
            "status": context["status"],
            "isPremium": context["is_premium"],
            "isTrial": context["is_trial"],
            "expiresAt": context["expires_at"],
            "trialEndsAt": context["trial_ends_at"],
            "limits": context["limits"],
            "features": context["features"],
            "usage": usage,
            "subscription": context["subscription"],
            "name": context["name"],
            "price": context["price"],
            "currency": context["currency"],
            "interval": context["interval"],
        }
