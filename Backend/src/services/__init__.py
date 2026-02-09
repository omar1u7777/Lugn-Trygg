"""
Service Layer for Lugn & Trygg Backend
"""

from typing import Any, Protocol


class IAuditService(Protocol):
    """Audit service interface for type hints"""
    def log_event(self, event_type: str, user_id: str, details: dict[str, Any]) -> None: ...
