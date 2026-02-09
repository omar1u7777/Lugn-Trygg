"""Utilities for aggregating privacy/anonymization settings across the user base."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from ..firebase_config import db

logger = logging.getLogger(__name__)

DEFAULT_PRIVACY_SETTINGS: dict[str, Any] = {
    "encryptLocalStorage": True,
    "dataRetentionDays": 365,
    "autoDeleteOldData": False,
    "allowAnalytics": True,
    "shareAnonymizedData": False,
}


class PrivacySettingsService:
    """Service responsible for summarizing anonymization-related preferences."""

    def __init__(self, cache_ttl_seconds: int = 300):
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cached_summary: dict[str, Any] | None = None
        self._cache_expires_at: datetime | None = None

    def get_anonymization_summary(self) -> dict[str, Any]:
        """Return aggregated anonymization settings for admin monitoring."""
        now = datetime.now(UTC)
        if self._cached_summary and self._cache_expires_at and now < self._cache_expires_at:
            return self._cached_summary

        if db is None:  # pragma: no cover - environment misconfiguration
            logger.warning("Privacy settings summary requested before Firestore init")
            summary = self._build_error_summary("firestore_uninitialized", now)
            self._cache(summary, now)
            return summary

        totals = {
            "users": 0,
            "share_enabled": 0,
            "analytics_opt_in": 0,
            "auto_delete_enabled": 0,
            "defaults_applied": 0,
        }
        retention_distribution: dict[str, int] = {}
        oldest_update: datetime | None = None
        newest_update: datetime | None = None

        try:
            users_ref = db.collection("users")
            for doc in users_ref.stream():
                totals["users"] += 1
                user_data = doc.to_dict() or {}
                privacy_settings = user_data.get("privacy_settings") or {}

                if not privacy_settings:
                    totals["defaults_applied"] += 1

                share_anonymized = bool(privacy_settings.get("shareAnonymizedData"))
                allow_analytics = bool(privacy_settings.get("allowAnalytics", DEFAULT_PRIVACY_SETTINGS["allowAnalytics"]))
                auto_delete = bool(privacy_settings.get("autoDeleteOldData"))
                retention_days = int(privacy_settings.get("dataRetentionDays", DEFAULT_PRIVACY_SETTINGS["dataRetentionDays"]))

                if share_anonymized:
                    totals["share_enabled"] += 1
                if allow_analytics:
                    totals["analytics_opt_in"] += 1
                if auto_delete:
                    totals["auto_delete_enabled"] += 1

                bucket = str(retention_days)
                retention_distribution[bucket] = retention_distribution.get(bucket, 0) + 1

                last_update = _parse_datetime(
                    privacy_settings.get("updated_at")
                    or privacy_settings.get("updatedAt")
                    or user_data.get("updated_at")
                )
                if last_update:
                    if oldest_update is None or last_update < oldest_update:
                        oldest_update = last_update
                    if newest_update is None or last_update > newest_update:
                        newest_update = last_update
        except Exception as exc:  # pragma: no cover - depends on external service
            logger.error("Failed to aggregate privacy settings: %s", exc)
            summary = self._build_error_summary("firestore_query_failed", now)
            self._cache(summary, now, ttl_seconds=60)
            return summary

        summary = {
            "status": "ok",
            "generated_at": now.isoformat(),
            "total_users": totals["users"],
            "defaults_applied": totals["defaults_applied"],
            "anonymization_preferences": {
                "share_anonymized_data": self._build_preference_snapshot(
                    totals["share_enabled"], totals["users"]
                ),
                "allow_analytics": self._build_preference_snapshot(
                    totals["analytics_opt_in"], totals["users"]
                ),
                "auto_delete_old_data": self._build_preference_snapshot(
                    totals["auto_delete_enabled"], totals["users"]
                ),
            },
            "retention_distribution": retention_distribution,
            "last_update_window": {
                "oldest": oldest_update.isoformat() if oldest_update else None,
                "newest": newest_update.isoformat() if newest_update else None,
            },
        }

        self._cache(summary, now)
        return summary

    def _build_preference_snapshot(self, enabled: int, total: int) -> dict[str, Any]:
        disabled = max(total - enabled, 0)
        return {
            "enabled": enabled,
            "disabled": disabled,
            "enabled_ratio": self._safe_ratio(enabled, total),
        }

    def _cache(self, summary: dict[str, Any], now: datetime, ttl_seconds: int | None = None) -> None:
        ttl = timedelta(seconds=ttl_seconds or self._cache_ttl_seconds)
        self._cached_summary = summary
        self._cache_expires_at = now + ttl

    @staticmethod
    def _safe_ratio(part: int, whole: int) -> float:
        if whole <= 0:
            return 0.0
        return round(part / whole, 4)

    @staticmethod
    def _build_error_summary(error: str, now: datetime) -> dict[str, Any]:
        return {
            "status": "error",
            "error": error,
            "generated_at": now.isoformat(),
            "total_users": 0,
            "defaults_applied": 0,
            "anonymization_preferences": {},
            "retention_distribution": {},
            "last_update_window": {"oldest": None, "newest": None},
        }


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            logger.debug("Invalid datetime string in privacy settings: %s", value)
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


privacy_settings_service = PrivacySettingsService()

__all__ = ["privacy_settings_service", "PrivacySettingsService"]
