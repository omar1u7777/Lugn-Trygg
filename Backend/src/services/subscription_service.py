"""Subscription plan + usage helpers shared across routes."""
from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta
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
    _GLOBAL_TRIAL_START_CACHE: datetime | None = None

    @staticmethod
    def _parse_bool_env(var_name: str, default: bool = False) -> bool:
        value = os.getenv(var_name, "").strip().lower()
        if not value:
            return default
        return value in {"1", "true", "yes", "on"}

    @classmethod
    def _global_trial_window(cls) -> tuple[datetime, datetime] | None:
        """Return active global trial window config if enabled."""
        if not cls._parse_bool_env("GLOBAL_FREE_PREMIUM_ENABLED", default=False):
            return None

        days_raw = os.getenv("GLOBAL_FREE_PREMIUM_DAYS", "14").strip()
        try:
            trial_days = max(1, int(days_raw))
        except ValueError:
            logger.warning("Invalid GLOBAL_FREE_PREMIUM_DAYS '%s', defaulting to 14", days_raw)
            trial_days = 14

        start_raw = os.getenv("GLOBAL_FREE_PREMIUM_START", "").strip()
        if start_raw:
            try:
                start_dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=UTC)
                else:
                    start_dt = start_dt.astimezone(UTC)
            except ValueError:
                logger.warning("Invalid GLOBAL_FREE_PREMIUM_START '%s'; disabling global trial", start_raw)
                return None
        else:
            # If no explicit start is provided, start countdown from first active process request.
            if cls._GLOBAL_TRIAL_START_CACHE is None:
                cls._GLOBAL_TRIAL_START_CACHE = datetime.now(UTC)
                logger.info(
                    "GLOBAL_FREE_PREMIUM_START missing; starting global trial from %s",
                    cls._GLOBAL_TRIAL_START_CACHE.isoformat(),
                )
            start_dt = cls._GLOBAL_TRIAL_START_CACHE

        end_dt = start_dt + timedelta(days=trial_days)
        return start_dt, end_dt

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        if isinstance(value, datetime):
            dt = value
        else:
            text = str(value).strip()
            if not text:
                return None
            try:
                dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                return None

        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)

    @classmethod
    def _new_user_trial_end(cls, user_data: dict[str, Any]) -> datetime | None:
        """Return per-user trial end timestamp if enabled and applicable."""
        if not cls._parse_bool_env("GLOBAL_NEW_USER_PREMIUM_ENABLED", default=True):
            return None

        days_raw = os.getenv("GLOBAL_NEW_USER_PREMIUM_DAYS", "14").strip()
        try:
            trial_days = max(1, int(days_raw))
        except ValueError:
            logger.warning("Invalid GLOBAL_NEW_USER_PREMIUM_DAYS '%s', defaulting to 14", days_raw)
            trial_days = 14

        created_at = cls._parse_datetime(user_data.get("created_at"))
        if created_at is None:
            return None
        return created_at + timedelta(days=trial_days)

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

        trial_active = False
        trial_end_iso: str | None = None
        trial_window = cls._global_trial_window()
        if plan_key == "free" and trial_window is not None:
            start_dt, end_dt = trial_window
            now = datetime.now(UTC)
            if start_dt <= now < end_dt:
                trial_active = True
                trial_end_iso = end_dt.isoformat()
                plan_key = "premium"
                status = "global_trial"
                plan_meta = plans.get("premium", plan_meta)

        # Per-user trial for newly registered users (default ON unless explicitly disabled).
        if plan_key == "free" and not trial_active:
            new_user_trial_end = cls._new_user_trial_end(user_data)
            if new_user_trial_end is not None and datetime.now(UTC) < new_user_trial_end:
                trial_active = True
                trial_end_iso = new_user_trial_end.isoformat()
                plan_key = "premium"
                status = "new_user_trial"
                plan_meta = plans.get("premium", plan_meta)

        subscription_payload = dict(subscription)
        if trial_active:
            subscription_payload.update(
                {
                    "status": status,
                    "plan": "premium",
                    "global_trial": True,
                    "trial_ends_at": trial_end_iso,
                    "expires_at": trial_end_iso,
                }
            )

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
            "is_trial": plan_key == "trial" or status == "trial" or trial_active,
            "expires_at": trial_end_iso or subscription.get("end_date") or subscription.get("expires_at"),
            "trial_ends_at": trial_end_iso
            or subscription.get("trial_end_date")
            or subscription.get("trial_ends_at"),
            "subscription": subscription_payload,
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
