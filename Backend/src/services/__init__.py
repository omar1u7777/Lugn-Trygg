"""
Service Layer - Dependency Injection and Service Management

This module provides a clean service layer with dependency injection,
proper abstractions, and testability.
"""

from typing import Protocol, Optional, Any, Dict, List
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)

# Service Interfaces (Protocols)
class IAuthService(Protocol):
    """Authentication service interface"""
    def register_user(self, email: str, password: str) -> Any: ...
    def login_user(self, email: str, password: str) -> tuple: ...
    def verify_token(self, token: str) -> tuple: ...
    def jwt_required(self, f) -> Any: ...

class IDatabaseService(Protocol):
    """Database service interface"""
    def get_collection(self, name: str) -> Any: ...
    def get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]: ...
    def create_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool: ...
    def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool: ...
    def delete_document(self, collection: str, doc_id: str) -> bool: ...
    def query_documents(self, collection: str, filters: Optional[List[tuple]] = None,
                       limit: Optional[int] = None, order_by: Optional[str] = None) -> List[Dict[str, Any]]: ...

class ICacheService(Protocol):
    """Cache service interface"""
    def get(self, key: str) -> Optional[Any]: ...
    def set(self, key: str, value: Any, ttl: int = 300) -> bool: ...
    def delete(self, key: str) -> bool: ...
    def exists(self, key: str) -> bool: ...

class IAuditService(Protocol):
    """Audit service interface"""
    def log_event(self, event_type: str, user_id: str, details: Dict[str, Any]) -> None: ...

# Dependency Injection Container
class ServiceContainer:
    """Centralized service container for dependency injection"""

    def __init__(self):
        self._services: Dict[str, Any] = {}
        self._singletons: Dict[str, Any] = {}

    def register(self, interface: type, implementation: Any, singleton: bool = True):
        """Register a service implementation"""
        service_name = interface.__name__
        if singleton:
            self._singletons[service_name] = implementation
        else:
            self._services[service_name] = implementation
        logger.info(f"Registered service: {service_name}")

    def resolve(self, interface: type) -> Any:
        """Resolve a service by interface"""
        service_name = interface.__name__

        # Check singletons first
        if service_name in self._singletons:
            return self._singletons[service_name]

        # Check regular services
        if service_name in self._services:
            return self._services[service_name]

        raise ValueError(f"Service not registered: {service_name}")

    def has_service(self, interface: type) -> bool:
        """Check if a service is registered"""
        service_name = interface.__name__
        return service_name in self._services or service_name in self._singletons

# Global service container instance
service_container = ServiceContainer()

# Service factory functions for easy access
def get_auth_service() -> IAuthService:
    return service_container.resolve(IAuthService)

def get_database_service() -> IDatabaseService:
    return service_container.resolve(IDatabaseService)

def get_cache_service() -> ICacheService:
    return service_container.resolve(ICacheService)

def get_audit_service() -> IAuditService:
    return service_container.resolve(IAuditService)

def initialize_services():
    """Initialize all services with default implementations"""
    try:
        # Import concrete implementations only when needed
        from .auth_service_v2 import AuthService
        from .database_service import DatabaseService
        from .cache_service import CacheService
        from .audit_service import AuditService

        # Create services in dependency order
        db_service = DatabaseService()
        cache_service = CacheService()
        audit_service = AuditService()

        # Auth service depends on the others
        auth_service = AuthService(db_service, cache_service, audit_service)

        service_container.register(IAuthService, auth_service)
        service_container.register(IDatabaseService, db_service)
        service_container.register(ICacheService, cache_service)
        service_container.register(IAuditService, audit_service)
        logger.info("All services initialized with dependency injection")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        return False