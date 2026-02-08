"""Tamper detection and intrusion monitoring service"""

from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, UTC
from threading import Lock
from typing import Any, Deque, Dict, List, Optional

from .audit_service import audit_service

logger = logging.getLogger(__name__)


@dataclass
class TamperEvent:
    """Structured security event representation"""

    event_type: str
    severity: str
    message: str
    metadata: Dict[str, Any]
    created_at: datetime
    risk_score: float

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        return data


class SecurityTamperService:
    """Centralized tamper detection and security event tracker"""

    def __init__(self, max_events: int = 200):
        self._events: Deque[TamperEvent] = deque(maxlen=max_events)
        self._lock = Lock()
        self._severity_weight = {
            "low": 1,
            "medium": 5,
            "high": 15,
            "critical": 35,
        }
        self._retention_hours = 48

    def record_event(
        self,
        event_type: str,
        message: str,
        severity: str = "low",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TamperEvent:
        """Store tamper event and forward to audit log if needed"""

        severity_key = severity.lower()
        risk_score = float(self._severity_weight.get(severity_key, 1))

        event = TamperEvent(
            event_type=event_type,
            severity=severity_key,
            message=message,
            metadata=metadata or {},
            created_at=datetime.now(UTC),
            risk_score=risk_score,
        )

        with self._lock:
            self._purge_expired_events()
            self._events.appendleft(event)

        if severity_key in {"high", "critical"}:
            try:
                audit_service.log_event(
                    event_type=f"SECURITY_{event_type.upper()}",
                    user_id=metadata.get("user_id", "system") if metadata else "system",
                    details={
                        "severity": severity_key,
                        "message": message,
                        "metadata": metadata or {},
                    },
                )
            except Exception as audit_error:
                logger.error("Failed to persist tamper event to audit log: %s", audit_error)

        logger.warning("Tamper event detected: %s - %s", event_type, message)
        return event

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return the newest tamper events"""
        with self._lock:
            return [evt.to_dict() for evt in list(self._events)[:limit]]

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Return high-severity alerts from last hour"""
        cutoff = datetime.now(UTC) - timedelta(hours=1)
        with self._lock:
            return [
                evt.to_dict()
                for evt in self._events
                if evt.created_at >= cutoff and evt.severity in {"high", "critical"}
            ]

    def get_threat_level(self) -> str:
        """Translate rolling risk score into qualitative threat level"""
        risk = self._rolling_risk_score(window_minutes=30)
        if risk >= 75:
            return "critical"
        if risk >= 40:
            return "high"
        if risk >= 15:
            return "elevated"
        return "low"

    def get_summary(self) -> Dict[str, Any]:
        """Aggregate summary for dashboards"""
        with self._lock:
            total = len(self._events)
            if total == 0:
                return {
                    "total_events": 0,
                    "threat_level": "low",
                    "last_event": None,
                    "high_severity_last_24h": 0,
                }

            last_event = self._events[0].to_dict()
            high_severity = sum(1 for evt in self._events if evt.severity in {"high", "critical"})

        return {
            "total_events": total,
            "threat_level": self.get_threat_level(),
            "last_event": last_event,
            "high_severity_last_24h": high_severity,
        }

    def _rolling_risk_score(self, window_minutes: int) -> float:
        cutoff = datetime.now(UTC) - timedelta(minutes=window_minutes)
        with self._lock:
            return sum(evt.risk_score for evt in self._events if evt.created_at >= cutoff)

    def _purge_expired_events(self):
        cutoff = datetime.now(UTC) - timedelta(hours=self._retention_hours)
        while self._events and self._events[-1].created_at < cutoff:
            self._events.pop()


tamper_detection_service = SecurityTamperService()
