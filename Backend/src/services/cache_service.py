"""
Cache Service - Redis-based caching with fallback

Provides caching functionality with Redis as primary store and
in-memory fallback for development/testing.
"""

from typing import Any, Optional, Dict
import logging
import json
import time
from ..redis_config import get_redis_client
from ..utils.error_handling import handle_service_errors

logger = logging.getLogger(__name__)

class CacheService:
    """Cache service with Redis and in-memory fallback"""

    def __init__(self):
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._redis_client = None
        try:
            self._redis_client = get_redis_client()
        except Exception as e:
            logger.warning(f"Redis not available, using memory cache: {e}")

    @handle_service_errors
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        # Try Redis first
        if self._redis_client:
            try:
                value = self._redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        # Fallback to memory cache
        if key in self._memory_cache:
            entry = self._memory_cache[key]
            if entry['expires'] > time.time():
                return entry['value']
            else:
                # Expired, remove it
                del self._memory_cache[key]

        return None

    @handle_service_errors
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        try:
            expires = time.time() + ttl
            serialized_value = json.dumps(value)

            # Try Redis first
            if self._redis_client:
                try:
                    self._redis_client.setex(key, ttl, serialized_value)
                    return True
                except Exception as e:
                    logger.warning(f"Redis set failed: {e}")

            # Fallback to memory cache
            self._memory_cache[key] = {
                'value': value,
                'expires': expires
            }
            return True
        except Exception as e:
            logger.error(f"Cache set failed for key {key}: {e}")
            return False

    @handle_service_errors
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            deleted = False

            # Try Redis first
            if self._redis_client:
                try:
                    self._redis_client.delete(key)
                    deleted = True
                except Exception as e:
                    logger.warning(f"Redis delete failed: {e}")

            # Also remove from memory cache
            if key in self._memory_cache:
                del self._memory_cache[key]
                deleted = True

            return deleted
        except Exception as e:
            logger.error(f"Cache delete failed for key {key}: {e}")
            return False

    @handle_service_errors
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        # Try Redis first
        if self._redis_client:
            try:
                return bool(self._redis_client.exists(key))
            except Exception as e:
                logger.warning(f"Redis exists failed: {e}")

        # Check memory cache
        if key in self._memory_cache:
            return self._memory_cache[key]['expires'] > time.time()

        return False

    @handle_service_errors
    def clear(self) -> bool:
        """Clear all cache entries"""
        # Try Redis first
        if self._redis_client:
            try:
                self._redis_client.flushdb()
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")

        # Clear memory cache
        self._memory_cache.clear()
        return True

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        stats = {
            'memory_entries': len(self._memory_cache),
            'redis_available': self._redis_client is not None
        }

        if self._redis_client:
            try:
                stats['redis_keys'] = len(self._redis_client.keys('*'))
            except Exception:
                stats['redis_keys'] = 'unknown'

        return stats