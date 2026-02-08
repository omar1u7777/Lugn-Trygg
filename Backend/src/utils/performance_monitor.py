"""
Performance Monitoring Service
Tracks app performance metrics, errors, and optimization opportunities
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
import time

logger = logging.getLogger(__name__)

class PerformanceMonitor:
    """Monitor and track application performance metrics"""

    def __init__(self):
        self.metrics: Dict[str, List[float]] = {}
        self.error_counts: Dict[str, int] = {}
        self.slow_endpoints: List[Dict[str, Any]] = []

    def track_request(self, endpoint: str, duration: float, status_code: int):
        """Track API request performance"""
        if endpoint not in self.metrics:
            self.metrics[endpoint] = []

        self.metrics[endpoint].append(duration)

        # Track slow requests (>1s)
        if duration > 1.0:
            self.slow_endpoints.append({
                "endpoint": endpoint,
                "duration": duration,
                "status_code": status_code,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            logger.warning(f"Slow request: {endpoint} took {duration:.2f}s")

        # Track errors
        if status_code >= 400:
            error_key = f"{endpoint}_{status_code}"
            self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1

    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics summary"""
        summary = {}

        for endpoint, durations in self.metrics.items():
            if durations:
                summary[endpoint] = {
                    "count": len(durations),
                    "avg_duration": sum(durations) / len(durations),
                    "min_duration": min(durations),
                    "max_duration": max(durations),
                    "p95_duration": self._percentile(durations, 95)
                }

        return {
            "endpoints": summary,
            "total_requests": sum(len(d) for d in self.metrics.values()),
            "error_counts": self.error_counts,
            "slow_requests_count": len(self.slow_endpoints),
            "slow_requests": self.slow_endpoints[-10:]  # Last 10 slow requests
        }

    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * (percentile / 100))
        return sorted_data[min(index, len(sorted_data) - 1)]

    def reset_metrics(self):
        """Reset all metrics"""
        self.metrics.clear()
        self.error_counts.clear()
        self.slow_endpoints.clear()
        logger.info("Performance metrics reset")

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

class Timer:
    """Context manager for timing operations"""

    def __init__(self, name: str):
        self.name = name
        self.start_time: float = 0.0
        self.duration: float = 0.0

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        self.duration = time.time() - self.start_time
        if self.duration > 0.5:  # Log if operation takes > 500ms
            logger.info(f"Operation '{self.name}' took {self.duration:.2f}s")

def monitor_function(func):
    """Decorator to monitor function performance"""
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start

            if duration > 1.0:
                logger.warning(f"Function {func.__name__} took {duration:.2f}s")

            return result
        except Exception as e:
            duration = time.time() - start
            logger.error(f"Function {func.__name__} failed after {duration:.2f}s: {str(e)}")
            raise

    return wrapper

class CacheService:
    """Simple in-memory cache for performance optimization"""

    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Any:
        """Get cached value"""
        if key in self.cache:
            cache_entry = self.cache[key]
            # Check if expired (simple 5-minute TTL)
            age = time.time() - cache_entry["timestamp"]
            if age < 300:  # 5 minutes
                logger.debug(f"Cache hit: {key}")
                return cache_entry["value"]
            else:
                logger.debug(f"Cache expired: {key}")
                del self.cache[key]

        logger.debug(f"Cache miss: {key}")
        return None

    def set(self, key: str, value: Any):
        """Set cached value"""
        self.cache[key] = {
            "value": value,
            "timestamp": time.time()
        }
        logger.debug(f"Cache set: {key}")

    def clear(self):
        """Clear all cache"""
        self.cache.clear()
        logger.info("Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_entries = len(self.cache)
        total_size = sum(len(str(v["value"])) for v in self.cache.values())

        return {
            "total_entries": total_entries,
            "estimated_size_bytes": total_size,
            "keys": list(self.cache.keys())
        }

# Global cache instance
cache_service = CacheService()
