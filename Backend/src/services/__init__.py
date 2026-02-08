"""
Service Layer for Lugn & Trygg Backend
"""

from typing import Protocol, Any, Dict


class IAuditService(Protocol):
    """Audit service interface for type hints"""
    def log_event(self, event_type: str, user_id: str, details: Dict[str, Any]) -> None: ...