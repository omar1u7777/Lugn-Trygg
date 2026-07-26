"""Structured operational telemetry.

The alerting proxy that distinguishes a DEGRADED FALLBACK STATE from normal
execution. Any code path that silently swaps a production dependency (OpenAI,
Google NLP, Firestore, Twilio, …) for a local heuristic MUST report it here so
operators can see that a clinical feature is running in degraded mode instead
of believing it is fully operational.

Design constraints:
- Never raises: telemetry must not be able to break the feature it observes.
- Structured: every event carries machine-parseable fields for log pipelines.
- Sentry-aware: critical events are forwarded to Sentry when the SDK is active.
- Thread-safe counters expose degradation stats to health endpoints.
"""

import logging
import threading
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("telemetry")


class TelemetryLogger:
    """Central alerting proxy for degradation and critical operational events."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._degradation_counts: dict[str, int] = {}
        self._critical_counts: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Emission API
    # ------------------------------------------------------------------

    def degraded(self, feature: str, reason: str, **fields: Any) -> None:
        """Report that `feature` served a DEGRADED FALLBACK instead of its
        primary implementation (e.g. keyword sentiment instead of OpenAI).

        Emitted at ERROR level: a degraded clinical feature is an operational
        incident, not an informational footnote.
        """
        key = f"{feature}:{reason}"
        with self._lock:
            self._degradation_counts[key] = self._degradation_counts.get(key, 0) + 1
            count = self._degradation_counts[key]

        try:
            logger.error(
                "DEGRADED_FALLBACK feature=%s reason=%s occurrence=%d fields=%s",
                feature, reason, count, self._safe_fields(fields),
            )
        except Exception:  # pragma: no cover - logging must never break callers
            pass

    def critical(self, event: str, message: str, **fields: Any) -> None:
        """Report an operator-actionable critical event (lost crisis task,
        scheduler failure, exhausted retries). Forwarded to Sentry when active.
        """
        with self._lock:
            self._critical_counts[event] = self._critical_counts.get(event, 0) + 1

        safe = self._safe_fields(fields)
        try:
            logger.critical("TELEMETRY_CRITICAL event=%s message=%s fields=%s", event, message, safe)
        except Exception:  # pragma: no cover
            pass

        # Best-effort Sentry forwarding — never let monitoring break the app.
        # Uses the sentry_sdk 2.x API (is_initialized / new_scope); falls back
        # to the 1.x Hub API only if the modern surface is unavailable.
        try:
            import sentry_sdk
            if hasattr(sentry_sdk, "is_initialized"):
                if sentry_sdk.is_initialized():
                    with sentry_sdk.new_scope() as scope:
                        scope.set_tag("telemetry_event", event)
                        for k, v in safe.items():
                            scope.set_extra(k, v)
                        sentry_sdk.capture_message(f"[{event}] {message}", level="fatal")
            else:  # pragma: no cover - legacy sentry_sdk 1.x path
                if sentry_sdk.Hub.current.client is not None:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("telemetry_event", event)
                        for k, v in safe.items():
                            scope.set_extra(k, v)
                        sentry_sdk.capture_message(f"[{event}] {message}", level="fatal")
        except Exception:
            pass

    def event(self, event: str, message: str, **fields: Any) -> None:
        """Informational structured event (lease acquired, task completed…)."""
        try:
            logger.info("TELEMETRY_EVENT event=%s message=%s fields=%s", event, message, self._safe_fields(fields))
        except Exception:  # pragma: no cover
            pass

    # ------------------------------------------------------------------
    # Introspection (health endpoints / tests)
    # ------------------------------------------------------------------

    def get_stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "degradations": dict(self._degradation_counts),
                "criticals": dict(self._critical_counts),
                "generated_at": datetime.now(UTC).isoformat(),
            }

    def reset(self) -> None:
        """Test helper — clear counters."""
        with self._lock:
            self._degradation_counts.clear()
            self._critical_counts.clear()

    @staticmethod
    def _safe_fields(fields: dict[str, Any]) -> dict[str, str]:
        """Stringify + truncate field values so telemetry can never leak large
        payloads or crash on unserializable objects."""
        safe: dict[str, str] = {}
        for key, value in fields.items():
            try:
                safe[str(key)[:64]] = str(value)[:300]
            except Exception:
                safe[str(key)[:64]] = f"<unprintable {type(value).__name__}>"
        return safe


# Process-wide singleton
telemetry = TelemetryLogger()
