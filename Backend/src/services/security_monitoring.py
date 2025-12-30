"""Security monitoring aggregation helpers for admin dashboards."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, Dict

from .api_key_rotation import get_key_rotation_status
from .privacy_settings_service import privacy_settings_service
from .tamper_detection_service import tamper_detection_service

try:
    from .monitoring_service import monitoring_service
except ImportError:  # pragma: no cover - defensive import
    monitoring_service = None  # type: ignore

logger = logging.getLogger(__name__)


def _serialize_datetimes(payload: Any) -> Any:
    """Recursively convert datetime instances to ISO strings for JSON."""
    if isinstance(payload, datetime):
        return payload.isoformat()
    if isinstance(payload, dict):
        return {key: _serialize_datetimes(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_serialize_datetimes(value) for value in payload]
    return payload


def _get_key_rotation_snapshot() -> Dict[str, Any]:
    try:
        status = get_key_rotation_status()
        return _serialize_datetimes(status)
    except Exception as exc:  # pragma: no cover - logging only
        logger.error("Failed to fetch key rotation status: %s", exc)
        return {"error": "key_rotation_unavailable"}


def _get_system_health() -> Dict[str, Any]:
    service = monitoring_service
    if not service:
        return {"status": "uninitialized", "message": "Monitoring service not started"}

    try:
        health = service.perform_health_check()
        return {
            "status": health.status,
            "message": health.message,
            "checks": health.checks,
            "timestamp": health.timestamp.isoformat(),
        }
    except Exception as exc:  # pragma: no cover - logging only
        logger.error("Security health snapshot failed: %s", exc)
        return {"status": "error", "message": "Health check failed"}


def _get_anonymization_settings() -> Dict[str, Any]:
    try:
        return privacy_settings_service.get_anonymization_summary()
    except Exception as exc:  # pragma: no cover - logging only
        logger.error("Failed to fetch anonymization settings summary: %s", exc)
        return {
            "status": "error",
            "error": "anonymization_summary_failed",
            "generated_at": datetime.now(UTC).isoformat(),
        }


def get_security_metrics() -> Dict[str, Any]:
    """Aggregate key rotation, tamper, and system health metrics."""
    tamper_summary = tamper_detection_service.get_summary()

    metrics: Dict[str, Any] = {
        "generated_at": datetime.now(UTC).isoformat(),
        "threat_level": tamper_summary.get("threat_level", "low"),
        "tamper_summary": tamper_summary,
        "active_alerts": tamper_detection_service.get_active_alerts(),
        "key_rotation": _get_key_rotation_snapshot(),
        "system_health": _get_system_health(),
        "anonymization_settings": _get_anonymization_settings(),
    }

    return metrics


__all__ = ["get_security_metrics"]
