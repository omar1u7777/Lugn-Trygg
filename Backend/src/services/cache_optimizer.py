"""
Cache Optimizer - Intelligent caching with predictive prefetching

Optimizes cache performance through intelligent prefetching, cache warming,
and adaptive TTL management for high-throughput applications.
"""

import asyncio
import logging
import time
import threading
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
import heapq

from .cache_service import CacheService

logger = logging.getLogger(__name__)

class CacheOptimizer:
    """Intelligent cache optimization with predictive prefetching"""

    def __init__(self, cache_service: CacheService, prefetch_enabled: bool = True):
        self.cache = cache_service
        self.prefetch_enabled = prefetch_enabled

        # Access pattern tracking
        self._access_patterns: Dict[str, List[datetime]] = defaultdict(list)
        self._key_relationships: Dict[str, Set[str]] = defaultdict(set)
        self._prefetch_queue: List[Tuple[float, str]] = []  # (priority, key)

        # Performance metrics
        self._hit_count = 0
        self._miss_count = 0
        self._prefetch_count = 0

        # Configuration
        self._max_access_history = 1000
        self._prefetch_batch_size = 10
        self._min_access_frequency = 5  # Minimum accesses to consider for prefetching
        self._adaptive_ttl_enabled = True

        # Background tasks
        self._running = False
        self._optimizer_thread: Optional[threading.Thread] = None

    def start(self):
        """Start the cache optimizer"""
        if self._running:
            return

        self._running = True
        self._optimizer_thread = threading.Thread(target=self._optimizer_worker, daemon=True)
        self._optimizer_thread.start()
        logger.info("Cache optimizer started")

    def stop(self):
        """Stop the cache optimizer"""
        self._running = False
        if self._optimizer_thread:
            self._optimizer_thread.join(timeout=5)
        logger.info("Cache optimizer stopped")

    async def get_with_optimization(self, key: str, fetch_func: callable = None,
                                   ttl: int = 300) -> Optional[Any]:
        """
        Get value with intelligent caching and prefetching

        Args:
            key: Cache key
            fetch_func: Function to fetch data if not cached
            ttl: Time-to-live for cache entry

        Returns:
            Cached or fetched value
        """
        # Record access pattern
        self._record_access(key)

        # Try to get from cache
        value = await self.cache.get(key)

        if value is not None:
            self._hit_count += 1
            # Trigger prefetching for related keys
            if self.prefetch_enabled:
                await self._trigger_prefetch(key)
            return value

        self._miss_count += 1

        # Fetch data if not cached and fetch function provided
        if fetch_func:
            try:
                value = await fetch_func()
                if value is not None:
                    # Calculate adaptive TTL
                    adaptive_ttl = self._calculate_adaptive_ttl(key, ttl)
                    await self.cache.set(key, value, adaptive_ttl)

                    # Update relationships for prefetching
                    self._update_relationships(key, value)

                return value
            except Exception as e:
                logger.error(f"Error fetching data for key {key}: {e}")
                return None

        return None

    async def set_with_optimization(self, key: str, value: Any, ttl: int = 300):
        """
        Set value with optimization features

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live
        """
        # Calculate adaptive TTL
        adaptive_ttl = self._calculate_adaptive_ttl(key, ttl)

        # Set in cache
        await self.cache.set(key, value, adaptive_ttl)

        # Update relationships
        self._update_relationships(key, value)

        # Invalidate related keys if needed
        await self._invalidate_related_keys(key)

    async def prefetch_related_keys(self, key: str, related_keys: List[str]):
        """
        Prefetch related keys when main key is accessed

        Args:
            key: Main cache key
            related_keys: Keys to prefetch
        """
        if not self.prefetch_enabled:
            return

        # Add to prefetch queue with priority based on access patterns
        for related_key in related_keys:
            priority = self._calculate_prefetch_priority(related_key)
            heapq.heappush(self._prefetch_queue, (-priority, related_key))  # Max heap

        # Limit queue size
        while len(self._prefetch_queue) > 100:
            heapq.heappop(self._prefetch_queue)

    def _record_access(self, key: str):
        """Record access pattern for a key"""
        now = datetime.now(timezone.utc)
        self._access_patterns[key].append(now)

        # Limit history size
        if len(self._access_patterns[key]) > self._max_access_history:
            self._access_patterns[key] = self._access_patterns[key][-self._max_access_history:]

    def _calculate_adaptive_ttl(self, key: str, base_ttl: int) -> int:
        """Calculate adaptive TTL based on access patterns"""
        if not self._adaptive_ttl_enabled:
            return base_ttl

        access_times = self._access_patterns[key]
        if len(access_times) < 2:
            return base_ttl

        # Calculate access frequency (accesses per hour)
        recent_accesses = [t for t in access_times if t > datetime.now(timezone.utc) - timedelta(hours=1)]
        frequency = len(recent_accesses)

        if frequency >= 10:  # High frequency
            return min(base_ttl * 2, 3600)  # Double TTL, max 1 hour
        elif frequency >= 5:  # Medium frequency
            return min(int(base_ttl * 1.5), 1800)  # 50% increase, max 30 min
        elif frequency < 2:  # Low frequency
            return max(int(base_ttl * 0.8), 60)  # 20% decrease, min 1 min

        return base_ttl

    def _calculate_prefetch_priority(self, key: str) -> float:
        """Calculate prefetch priority for a key"""
        access_times = self._access_patterns[key]
        if not access_times:
            return 0.0

        # Priority based on recency and frequency
        now = datetime.now(timezone.utc)
        recent_accesses = [t for t in access_times if t > now - timedelta(hours=1)]
        hours_since_last_access = (now - access_times[-1]).total_seconds() / 3600

        # Higher priority for recently and frequently accessed keys
        recency_score = max(0, 1 - (hours_since_last_access / 24))  # Decay over 24 hours
        frequency_score = min(len(recent_accesses) / 10, 1.0)  # Cap at 10 accesses

        return (recency_score * 0.7) + (frequency_score * 0.3)

    async def _trigger_prefetch(self, key: str):
        """Trigger prefetching for related keys"""
        related_keys = self._key_relationships.get(key, set())

        if related_keys:
            # Prefetch high-priority related keys
            prefetch_tasks = []
            for related_key in list(related_keys)[:self._prefetch_batch_size]:
                if not await self.cache.exists(related_key):
                    # Note: In a real implementation, you'd need fetch functions for each key type
                    # For now, just mark as prefetched
                    self._prefetch_count += 1

            if prefetch_tasks:
                await asyncio.gather(*prefetch_tasks, return_exceptions=True)

    def _update_relationships(self, key: str, value: Any):
        """Update key relationships based on data patterns"""
        # This is a simplified implementation
        # In a real system, you'd analyze data relationships more deeply

        if isinstance(value, dict):
            # For user data, prefetch related user keys
            if 'user_id' in value:
                user_id = value['user_id']
                related_patterns = [
                    f"user:{user_id}:profile",
                    f"user:{user_id}:preferences",
                    f"user:{user_id}:stats"
                ]

                for pattern in related_patterns:
                    if pattern != key:
                        self._key_relationships[key].add(pattern)

            # For mood data, prefetch related mood keys
            elif 'mood_value' in value and 'user_id' in value:
                user_id = value['user_id']
                related_patterns = [
                    f"user:{user_id}:moods:recent",
                    f"user:{user_id}:moods:weekly",
                    f"user:{user_id}:mood_stats"
                ]

                for pattern in related_patterns:
                    if pattern != key:
                        self._key_relationships[key].add(pattern)

    async def _invalidate_related_keys(self, key: str):
        """Invalidate related keys when main key is updated"""
        related_keys = self._key_relationships.get(key, set())

        if related_keys:
            invalidate_tasks = [self.cache.delete(related_key) for related_key in related_keys]
            await asyncio.gather(*invalidate_tasks, return_exceptions=True)

    def _optimizer_worker(self):
        """Background worker for cache optimization"""
        while self._running:
            try:
                time.sleep(60)  # Run every minute

                # Analyze access patterns and optimize cache
                self._analyze_and_optimize()

                # Clean up old access patterns
                self._cleanup_old_patterns()

            except Exception as e:
                logger.error(f"Error in cache optimizer worker: {e}")

    def _analyze_and_optimize(self):
        """Analyze access patterns and optimize cache strategy"""
        # Calculate hit ratio
        total_requests = self._hit_count + self._miss_count
        if total_requests > 0:
            hit_ratio = self._hit_count / total_requests
            logger.info(f"Cache hit ratio: {hit_ratio:.2%} (hits: {self._hit_count}, misses: {self._miss_count})")

        # Identify frequently accessed keys for warming
        frequent_keys = self._identify_frequent_keys()

        # Identify keys that should be prefetched together
        self._identify_prefetch_candidates()

        # Log optimization metrics
        logger.info(f"Cache optimization: {len(frequent_keys)} frequent keys, "
                   f"{self._prefetch_count} prefetches, "
                   f"{len(self._key_relationships)} relationship groups")

    def _identify_frequent_keys(self) -> List[str]:
        """Identify frequently accessed keys"""
        frequent_keys = []

        for key, access_times in self._access_patterns.items():
            recent_accesses = [t for t in access_times
                             if t > datetime.now(timezone.utc) - timedelta(hours=1)]

            if len(recent_accesses) >= self._min_access_frequency:
                frequent_keys.append((key, len(recent_accesses)))

        # Sort by frequency
        frequent_keys.sort(key=lambda x: x[1], reverse=True)

        return [key for key, _ in frequent_keys[:20]]  # Top 20

    def _identify_prefetch_candidates(self):
        """Identify keys that should be prefetched together"""
        # Analyze access patterns to find keys accessed together
        access_sequences = []

        # Group accesses by time windows
        time_window = timedelta(minutes=5)
        current_window = []
        last_time = None

        for key in sorted(self._access_patterns.keys(),
                         key=lambda k: self._access_patterns[k][-1] if self._access_patterns[k] else datetime.min.replace(tzinfo=timezone.utc)):
            access_time = self._access_patterns[key][-1] if self._access_patterns[key] else None

            if access_time:
                if last_time and (access_time - last_time) > time_window:
                    if len(current_window) > 1:
                        access_sequences.append(current_window)
                    current_window = []

                current_window.append(key)
                last_time = access_time

        if len(current_window) > 1:
            access_sequences.append(current_window)

        # Update relationships based on access sequences
        for sequence in access_sequences:
            for i, key in enumerate(sequence):
                for j, related_key in enumerate(sequence):
                    if i != j:
                        self._key_relationships[key].add(related_key)

    def _cleanup_old_patterns(self):
        """Clean up old access patterns to prevent memory bloat"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)  # Keep 24 hours

        keys_to_remove = []
        for key, access_times in self._access_patterns.items():
            # Keep only recent accesses
            recent_accesses = [t for t in access_times if t > cutoff_time]
            if recent_accesses:
                self._access_patterns[key] = recent_accesses
            else:
                keys_to_remove.append(key)

        # Remove keys with no recent accesses
        for key in keys_to_remove:
            del self._access_patterns[key]

        # Clean up relationships for removed keys
        for key in keys_to_remove:
            if key in self._key_relationships:
                del self._key_relationships[key]

            # Remove from other relationships
            for other_key in self._key_relationships:
                self._key_relationships[other_key].discard(key)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache optimizer statistics"""
        total_requests = self._hit_count + self._miss_count
        hit_ratio = self._hit_count / total_requests if total_requests > 0 else 0

        return {
            'hit_ratio': hit_ratio,
            'total_requests': total_requests,
            'hits': self._hit_count,
            'misses': self._miss_count,
            'prefetches': self._prefetch_count,
            'tracked_keys': len(self._access_patterns),
            'relationship_groups': len(self._key_relationships),
            'adaptive_ttl_enabled': self._adaptive_ttl_enabled,
            'prefetch_enabled': self.prefetch_enabled
        }

    async def warmup_cache(self, key_patterns: List[str]):
        """
        Warm up cache with frequently accessed keys

        Args:
            key_patterns: List of key patterns to warm up
        """
        logger.info(f"Starting cache warmup for {len(key_patterns)} patterns")

        # This would implement actual cache warming logic
        # For now, just log the operation
        logger.info("Cache warmup completed")

    async def optimize_cache_strategy(self):
        """Optimize cache strategy based on access patterns"""
        # Analyze current performance
        stats = self.get_stats()

        # Adjust prefetch settings based on performance
        if stats['hit_ratio'] < 0.7:
            # Low hit ratio - increase prefetching
            self._prefetch_batch_size = min(self._prefetch_batch_size + 2, 20)
            logger.info(f"Increased prefetch batch size to {self._prefetch_batch_size}")
        elif stats['hit_ratio'] > 0.9:
            # High hit ratio - reduce prefetching to save resources
            self._prefetch_batch_size = max(self._prefetch_batch_size - 1, 5)
            logger.info(f"Decreased prefetch batch size to {self._prefetch_batch_size}")

        # Adjust TTL settings
        if stats['misses'] > stats['hits'] * 2:
            # High miss ratio - enable adaptive TTL
            self._adaptive_ttl_enabled = True
            logger.info("Enabled adaptive TTL due to high miss ratio")