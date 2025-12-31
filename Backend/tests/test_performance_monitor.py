"""
Tests for performance monitoring (metrics, timing, caching)
"""

import pytest
import time
from unittest.mock import Mock, patch
from src.utils.performance_monitor import (
    PerformanceMonitor, 
    performance_monitor, 
    Timer, 
    monitor_function,
    CacheService,
    cache_service
)


class TestPerformanceMonitor:
    """Tests for PerformanceMonitor"""

    @pytest.fixture
    def monitor(self):
        """Create a fresh monitor instance"""
        mon = PerformanceMonitor()
        yield mon
        mon.reset_metrics()

    def test_init(self, monitor):
        """Test monitor initialization"""
        assert monitor.metrics == {}
        assert monitor.error_counts == {}
        assert monitor.slow_endpoints == []

    def test_track_request_basic(self, monitor):
        """Test tracking a basic request"""
        monitor.track_request("/api/test", 0.5, 200)
        
        assert "/api/test" in monitor.metrics
        assert len(monitor.metrics["/api/test"]) == 1
        assert monitor.metrics["/api/test"][0] == 0.5

    def test_track_request_multiple(self, monitor):
        """Test tracking multiple requests to same endpoint"""
        monitor.track_request("/api/test", 0.3, 200)
        monitor.track_request("/api/test", 0.5, 200)
        monitor.track_request("/api/test", 0.4, 200)
        
        assert len(monitor.metrics["/api/test"]) == 3

    def test_track_request_different_endpoints(self, monitor):
        """Test tracking requests to different endpoints"""
        monitor.track_request("/api/users", 0.2, 200)
        monitor.track_request("/api/moods", 0.3, 200)
        
        assert "/api/users" in monitor.metrics
        assert "/api/moods" in monitor.metrics

    def test_track_slow_request(self, monitor):
        """Test tracking slow request (>1s)"""
        monitor.track_request("/api/slow", 1.5, 200)
        
        assert len(monitor.slow_endpoints) == 1
        assert monitor.slow_endpoints[0]["endpoint"] == "/api/slow"
        assert monitor.slow_endpoints[0]["duration"] == 1.5
        assert monitor.slow_endpoints[0]["status_code"] == 200
        assert "timestamp" in monitor.slow_endpoints[0]

    def test_track_fast_request_not_in_slow_list(self, monitor):
        """Test fast request is not marked as slow"""
        monitor.track_request("/api/fast", 0.5, 200)
        
        assert len(monitor.slow_endpoints) == 0

    def test_track_error_request(self, monitor):
        """Test tracking error requests (status >= 400)"""
        monitor.track_request("/api/test", 0.2, 404)
        
        error_key = "/api/test_404"
        assert error_key in monitor.error_counts
        assert monitor.error_counts[error_key] == 1

    def test_track_multiple_errors_same_endpoint(self, monitor):
        """Test tracking multiple errors to same endpoint"""
        monitor.track_request("/api/test", 0.2, 500)
        monitor.track_request("/api/test", 0.3, 500)
        monitor.track_request("/api/test", 0.4, 500)
        
        error_key = "/api/test_500"
        assert monitor.error_counts[error_key] == 3

    def test_track_different_error_codes(self, monitor):
        """Test tracking different error codes"""
        monitor.track_request("/api/test", 0.2, 400)
        monitor.track_request("/api/test", 0.3, 404)
        monitor.track_request("/api/test", 0.4, 500)
        
        assert "/api/test_400" in monitor.error_counts
        assert "/api/test_404" in monitor.error_counts
        assert "/api/test_500" in monitor.error_counts

    def test_track_success_not_in_errors(self, monitor):
        """Test successful requests don't appear in error counts"""
        monitor.track_request("/api/test", 0.2, 200)
        monitor.track_request("/api/test", 0.3, 201)
        
        assert len(monitor.error_counts) == 0

    def test_get_metrics_empty(self, monitor):
        """Test getting metrics with no data"""
        metrics = monitor.get_metrics()
        
        assert metrics["endpoints"] == {}
        assert metrics["total_requests"] == 0
        assert metrics["error_counts"] == {}
        assert metrics["slow_requests_count"] == 0

    def test_get_metrics_basic(self, monitor):
        """Test getting basic metrics"""
        monitor.track_request("/api/test", 0.5, 200)
        monitor.track_request("/api/test", 0.6, 200)
        
        metrics = monitor.get_metrics()
        
        assert "/api/test" in metrics["endpoints"]
        assert metrics["endpoints"]["/api/test"]["count"] == 2
        assert metrics["endpoints"]["/api/test"]["avg_duration"] == 0.55
        assert metrics["endpoints"]["/api/test"]["min_duration"] == 0.5
        assert metrics["endpoints"]["/api/test"]["max_duration"] == 0.6
        assert metrics["total_requests"] == 2

    def test_get_metrics_p95(self, monitor):
        """Test p95 percentile calculation"""
        # Track 100 requests with varying durations
        for i in range(100):
            monitor.track_request("/api/test", i * 0.01, 200)
        
        metrics = monitor.get_metrics()
        p95 = metrics["endpoints"]["/api/test"]["p95_duration"]
        
        # P95 should be around 0.95 (95th request out of 100)
        assert 0.9 <= p95 <= 1.0

    def test_get_metrics_multiple_endpoints(self, monitor):
        """Test metrics for multiple endpoints"""
        monitor.track_request("/api/users", 0.2, 200)
        monitor.track_request("/api/moods", 0.3, 200)
        monitor.track_request("/api/users", 0.4, 200)
        
        metrics = monitor.get_metrics()
        
        assert len(metrics["endpoints"]) == 2
        assert metrics["endpoints"]["/api/users"]["count"] == 2
        assert metrics["endpoints"]["/api/moods"]["count"] == 1
        assert metrics["total_requests"] == 3

    def test_get_metrics_with_errors(self, monitor):
        """Test metrics include error counts"""
        monitor.track_request("/api/test", 0.2, 404)
        monitor.track_request("/api/test", 0.3, 500)
        
        metrics = monitor.get_metrics()
        
        assert len(metrics["error_counts"]) == 2
        assert metrics["error_counts"]["/api/test_404"] == 1
        assert metrics["error_counts"]["/api/test_500"] == 1

    def test_get_metrics_slow_requests_limit(self, monitor):
        """Test that slow_requests returns max 10 items"""
        # Track 15 slow requests
        for i in range(15):
            monitor.track_request(f"/api/slow{i}", 1.5, 200)
        
        metrics = monitor.get_metrics()
        
        assert metrics["slow_requests_count"] == 15
        assert len(metrics["slow_requests"]) == 10  # Last 10

    def test_percentile_empty_data(self, monitor):
        """Test percentile calculation with empty data"""
        result = monitor._percentile([], 95)
        assert result == 0.0

    def test_percentile_single_value(self, monitor):
        """Test percentile with single value"""
        result = monitor._percentile([5.0], 95)
        assert result == 5.0

    def test_percentile_calculation(self, monitor):
        """Test percentile calculation"""
        data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        
        p50 = monitor._percentile(data, 50)
        p95 = monitor._percentile(data, 95)
        
        assert 5.0 <= p50 <= 6.0
        assert 9.0 <= p95 <= 10.0

    def test_reset_metrics(self, monitor):
        """Test resetting all metrics"""
        monitor.track_request("/api/test", 0.5, 200)
        monitor.track_request("/api/test", 1.5, 404)
        
        assert len(monitor.metrics) > 0
        assert len(monitor.error_counts) > 0
        assert len(monitor.slow_endpoints) > 0
        
        monitor.reset_metrics()
        
        assert monitor.metrics == {}
        assert monitor.error_counts == {}
        assert monitor.slow_endpoints == []


class TestGlobalPerformanceMonitor:
    """Tests for global performance_monitor instance"""

    def test_global_instance_exists(self):
        """Test global instance exists"""
        assert performance_monitor is not None
        assert isinstance(performance_monitor, PerformanceMonitor)

    def test_global_instance_singleton(self):
        """Test global instance is singleton"""
        from src.utils.performance_monitor import performance_monitor as pm1
        from src.utils.performance_monitor import performance_monitor as pm2
        
        assert pm1 is pm2


class TestTimer:
    """Tests for Timer context manager"""

    def test_timer_basic(self):
        """Test basic timer functionality"""
        with Timer("test_operation") as timer:
            time.sleep(0.01)
        
        assert timer.duration is not None
        assert timer.duration >= 0.01
        assert timer.name == "test_operation"

    def test_timer_duration_recorded(self):
        """Test timer records duration"""
        with Timer("test") as timer:
            pass
        
        assert timer.duration >= 0
        assert isinstance(timer.duration, float)

    def test_timer_can_be_reused(self):
        """Test timer can be used multiple times"""
        timer1 = Timer("op1")
        with timer1:
            pass
        
        timer2 = Timer("op2")
        with timer2:
            pass
        
        assert timer1.duration is not None
        assert timer2.duration is not None


class TestMonitorFunction:
    """Tests for monitor_function decorator"""

    def test_monitor_function_success(self):
        """Test monitoring successful function"""
        @monitor_function
        def test_func():
            return "success"
        
        result = test_func()
        assert result == "success"

    def test_monitor_function_with_args(self):
        """Test monitoring function with arguments"""
        @monitor_function
        def add(a, b):
            return a + b
        
        result = add(2, 3)
        assert result == 5

    def test_monitor_function_with_kwargs(self):
        """Test monitoring function with keyword arguments"""
        @monitor_function
        def greet(name, greeting="Hello"):
            return f"{greeting}, {name}"
        
        result = greet(name="World", greeting="Hi")
        assert result == "Hi, World"

    def test_monitor_function_exception(self):
        """Test monitoring function that raises exception"""
        @monitor_function
        def failing_func():
            raise ValueError("Test error")
        
        with pytest.raises(ValueError, match="Test error"):
            failing_func()

    def test_monitor_function_preserves_return_value(self):
        """Test decorator preserves return value"""
        @monitor_function
        def calculate():
            return 42
        
        assert calculate() == 42


class TestCacheService:
    """Tests for CacheService"""

    @pytest.fixture
    def cache(self):
        """Create fresh cache instance"""
        c = CacheService()
        yield c
        c.clear()

    def test_init(self, cache):
        """Test cache initialization"""
        assert cache.cache == {}

    def test_set_and_get(self, cache):
        """Test setting and getting cached value"""
        cache.set("test_key", "test_value")
        result = cache.get("test_key")
        
        assert result == "test_value"

    def test_get_nonexistent_key(self, cache):
        """Test getting non-existent key returns None"""
        result = cache.get("nonexistent")
        assert result is None

    def test_cache_different_types(self, cache):
        """Test caching different value types"""
        cache.set("string", "value")
        cache.set("number", 42)
        cache.set("list", [1, 2, 3])
        cache.set("dict", {"key": "value"})
        
        assert cache.get("string") == "value"
        assert cache.get("number") == 42
        assert cache.get("list") == [1, 2, 3]
        assert cache.get("dict") == {"key": "value"}

    def test_cache_overwrite(self, cache):
        """Test overwriting cached value"""
        cache.set("key", "old_value")
        cache.set("key", "new_value")
        
        assert cache.get("key") == "new_value"

    @patch('time.time')
    def test_cache_expiration(self, mock_time, cache):
        """Test cache expiration (5 minute TTL)"""
        # Set time to 0
        mock_time.return_value = 0
        cache.set("key", "value")
        
        # Get immediately - should hit
        mock_time.return_value = 1
        assert cache.get("key") == "value"
        
        # Get after 6 minutes - should expire
        mock_time.return_value = 360  # 6 minutes
        assert cache.get("key") is None

    @patch('time.time')
    def test_cache_not_expired(self, mock_time, cache):
        """Test cache not expired within TTL"""
        # Set at time 0
        mock_time.return_value = 0
        cache.set("key", "value")
        
        # Get after 4 minutes - should still be valid
        mock_time.return_value = 240  # 4 minutes
        assert cache.get("key") == "value"

    def test_clear_cache(self, cache):
        """Test clearing all cache"""
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        assert len(cache.cache) == 2
        
        cache.clear()
        
        assert cache.cache == {}
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_get_stats_empty(self, cache):
        """Test stats for empty cache"""
        stats = cache.get_stats()
        
        assert stats["total_entries"] == 0
        assert stats["estimated_size_bytes"] == 0
        assert stats["keys"] == []

    def test_get_stats_with_data(self, cache):
        """Test stats with cached data"""
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        stats = cache.get_stats()
        
        assert stats["total_entries"] == 2
        assert stats["estimated_size_bytes"] > 0
        assert "key1" in stats["keys"]
        assert "key2" in stats["keys"]

    def test_cache_multiple_keys(self, cache):
        """Test caching multiple keys"""
        for i in range(10):
            cache.set(f"key{i}", f"value{i}")
        
        stats = cache.get_stats()
        assert stats["total_entries"] == 10

    def test_cache_complex_objects(self, cache):
        """Test caching complex objects"""
        complex_obj = {
            "users": [
                {"id": 1, "name": "User1"},
                {"id": 2, "name": "User2"}
            ],
            "metadata": {"count": 2}
        }
        
        cache.set("complex", complex_obj)
        result = cache.get("complex")
        
        assert result == complex_obj
        assert result["users"][0]["name"] == "User1"


class TestGlobalCacheService:
    """Tests for global cache_service instance"""

    def test_global_cache_exists(self):
        """Test global cache instance exists"""
        assert cache_service is not None
        assert isinstance(cache_service, CacheService)

    def test_global_cache_singleton(self):
        """Test global cache is singleton"""
        from src.utils.performance_monitor import cache_service as cs1
        from src.utils.performance_monitor import cache_service as cs2
        
        assert cs1 is cs2
