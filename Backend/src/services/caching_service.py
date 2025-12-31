"""
Caching service for Lugn & Trygg backend.
Provides Redis-based caching decorators and utilities for high-performance data caching.
"""

import json
import hashlib
import logging
from functools import wraps
from typing import Any, Optional, Callable, Dict, Union, overload
import redis

from ..redis_config import get_redis_client
from ..config import config

logger = logging.getLogger(__name__)


class CacheService:
    """Service for Redis-based caching operations."""

    @staticmethod
    def _get_cache_key(prefix: str, *args, **kwargs) -> str:
        """Generate a unique cache key from function arguments."""
        # Create a string representation of all arguments
        key_parts = [str(arg) for arg in args]
        key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))

        # Create hash of the key parts for consistent length
        key_string = "|".join(key_parts)
        key_hash = hashlib.sha256(key_string.encode()).hexdigest()[:16]

        return f"{prefix}:{key_hash}"

    @staticmethod
    def _serialize_value(value: Any) -> str:
        """Serialize value for Redis storage."""
        if isinstance(value, (dict, list)):
            return json.dumps(value, default=str)
        return str(value)

    @staticmethod
    def _deserialize_value(value: str, return_type: type = dict) -> Any:
        """Deserialize value from Redis storage."""
        try:
            if return_type in (dict, list):
                return json.loads(value)
            return value
        except (json.JSONDecodeError, TypeError):
            return value

    @staticmethod
    def get_cached_value(key: str, return_type: type = dict) -> Optional[Any]:
        """Get a value from cache."""
        redis_client = get_redis_client()
        if not redis_client:
            return None

        try:
            value = redis_client.get(key)
            if value:
                return CacheService._deserialize_value(value, return_type)
        except redis.RedisError as e:
            logger.warning(f"Redis get error for key {key}: {e}")

        return None

    @staticmethod
    def set_cached_value(key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a value in cache with optional TTL."""
        redis_client = get_redis_client()
        if not redis_client:
            return False

        try:
            serialized_value = CacheService._serialize_value(value)
            if ttl:
                redis_client.setex(key, ttl, serialized_value)
            else:
                redis_client.set(key, serialized_value)
            return True
        except redis.RedisError as e:
            logger.warning(f"Redis set error for key {key}: {e}")
            return False

    @staticmethod
    def delete_cached_value(key: str) -> bool:
        """Delete a value from cache."""
        redis_client = get_redis_client()
        if not redis_client:
            return False

        try:
            redis_client.delete(key)
            return True
        except redis.RedisError as e:
            logger.warning(f"Redis delete error for key {key}: {e}")
            return False

    @staticmethod
    def invalidate_pattern(pattern: str) -> int:
        """Invalidate all keys matching a pattern."""
        redis_client = get_redis_client()
        if not redis_client:
            return 0

        try:
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
                return len(keys)
        except redis.RedisError as e:
            logger.warning(f"Redis pattern invalidation error for {pattern}: {e}")

        return 0


def cache_response(ttl: Optional[int] = None, key_prefix: str = "api") -> Callable:
    """
    Decorator to cache API responses.

    Args:
        ttl: Time to live in seconds (uses config default if None)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = CacheService._get_cache_key(
                f"{key_prefix}:{func.__name__}", *args, **kwargs
            )

            # Try to get cached result
            cached_result = CacheService.get_cached_value(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result

            # Execute function and cache result
            result = func(*args, **kwargs)

            # Cache the result
            cache_ttl = ttl or config.CACHE_API_RESPONSE_TIMEOUT
            if CacheService.set_cached_value(cache_key, result, cache_ttl):
                logger.debug(f"Cached result for {cache_key} with TTL {cache_ttl}")

            return result

        return wrapper
    return decorator


def cache_user_data(ttl: Optional[int] = None, key_prefix: str = "user") -> Callable:
    """
    Decorator to cache user-specific data.

    Args:
        ttl: Time to live in seconds (uses config default if None)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract user_id from arguments (usually first arg after self)
            user_id = None
            if args and len(args) > 1:  # Skip 'self' argument
                user_id = args[1]
            elif 'user_id' in kwargs:
                user_id = kwargs['user_id']

            if not user_id:
                # If no user_id, execute without caching
                return func(*args, **kwargs)

            # Generate cache key
            cache_key = CacheService._get_cache_key(
                f"{key_prefix}:{func.__name__}:{user_id}", *args, **kwargs
            )

            # Try to get cached result
            cached_result = CacheService.get_cached_value(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for user {user_id}: {cache_key}")
                return cached_result

            # Execute function and cache result
            result = func(*args, **kwargs)

            # Cache the result
            cache_ttl = ttl or config.CACHE_USER_DATA_TIMEOUT
            if CacheService.set_cached_value(cache_key, result, cache_ttl):
                logger.debug(f"Cached user data for {user_id}: {cache_key} with TTL {cache_ttl}")

            return result

        return wrapper
    return decorator


def invalidate_cache(pattern: str) -> Callable:
    """
    Decorator to invalidate cache patterns after function execution.

    Args:
        pattern: Redis key pattern to invalidate
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Execute the function first
            result = func(*args, **kwargs)

            # Invalidate cache patterns
            try:
                invalidated_count = CacheService.invalidate_pattern(pattern)
                if invalidated_count > 0:
                    logger.debug(f"Invalidated {invalidated_count} cache keys matching {pattern}")
            except Exception as e:
                logger.warning(f"Cache invalidation failed for pattern {pattern}: {e}")

            return result

        return wrapper
    return decorator


def cache_firestore_query(ttl: Optional[int] = None, key_prefix: str = "firestore") -> Callable:
    """
    Decorator to cache Firestore query results.

    Args:
        ttl: Time to live in seconds (uses config default if None)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from query parameters
            cache_key = CacheService._get_cache_key(
                f"{key_prefix}:{func.__name__}", *args, **kwargs
            )

            # Try to get cached result
            cached_result = CacheService.get_cached_value(cache_key, return_type=list)
            if cached_result is not None:
                logger.debug(f"Cache hit for Firestore query {cache_key}")
                return cached_result

            # Execute query and cache result
            result = func(*args, **kwargs)

            # Only cache if result is not empty
            if result:
                cache_ttl = ttl or config.CACHE_DEFAULT_TIMEOUT
                if CacheService.set_cached_value(cache_key, result, cache_ttl):
                    logger.debug(f"Cached Firestore query result: {cache_key} with TTL {cache_ttl}")

            return result

        return wrapper
    return decorator


# Utility functions for manual cache management
def clear_user_cache(user_id: str) -> int:
    """Clear all cached data for a specific user."""
    pattern = f"*:*:{user_id}*"
    return CacheService.invalidate_pattern(pattern)


def clear_api_cache(endpoint: str = "*") -> int:
    """Clear cached API responses for an endpoint."""
    pattern = f"api:{endpoint}*"
    return CacheService.invalidate_pattern(pattern)


def get_cache_stats() -> Dict[str, Any]:
    """Get Redis cache statistics."""
    redis_client = get_redis_client()
    if not redis_client:
        return {"status": "disconnected"}

    try:
        info = redis_client.info()
        return {
            "status": "connected",
            "used_memory": info.get("used_memory_human", "unknown"),
            "connected_clients": info.get("connected_clients", 0),
            "total_keys": sum(redis_client.dbsize() for _ in range(16)),  # Check all DBs
        }
    except redis.RedisError:
        return {"status": "error"}