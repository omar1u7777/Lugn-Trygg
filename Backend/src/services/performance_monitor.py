"""
Performance Monitor - Real-time performance monitoring and metrics

Tracks application performance, database queries, API response times,
and system health metrics for optimization and alerting.
"""

import time
import logging
import threading
from typing import Dict, Any, List, Optional
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import statistics

logger = logging.getLogger(__name__)

class PerformanceMonitor:
    """Performance monitoring service with metrics collection and alerting"""

    def __init__(self, metrics_retention_hours: int = 24):
        self.metrics_retention_hours = metrics_retention_hours
        self._metrics: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._alerts: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._cleanup_thread = None
        self._running = False

        # Performance thresholds
        self.thresholds = {
            'db_query_time': 1.0,  # seconds
            'api_response_time': 2.0,  # seconds
            'cache_hit_ratio': 0.8,  # 80%
            'error_rate': 0.05,  # 5%
            'memory_usage': 0.9,  # 90%
        }

        # Start cleanup thread
        self._start_cleanup_thread()

    def __del__(self):
        """Cleanup on destruction"""
        self._stop_cleanup_thread()

    async def record_metric(self, metric_name: str, value: float, tags: Optional[Dict[str, Any]] = None):
        """
        Record a performance metric

        Args:
            metric_name: Name of the metric (e.g., 'db_query', 'api_response')
            value: Metric value (duration, count, etc.)
            tags: Additional metadata tags
        """
        with self._lock:
            metric_data = {
                'timestamp': datetime.now(timezone.utc),
                'value': value,
                'tags': tags or {}
            }

            self._metrics[metric_name].append(metric_data)

            # Check thresholds and create alerts
            await self._check_thresholds(metric_name, value, tags)

    def get_metrics(self, metric_name: str, hours: int = 1) -> List[Dict[str, Any]]:
        """
        Get metrics for a specific metric name within time range

        Args:
            metric_name: Name of the metric
            hours: Number of hours to look back

        Returns:
            List of metric data points
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        with self._lock:
            return [
                metric for metric in self._metrics[metric_name]
                if metric['timestamp'] > cutoff_time
            ]

    def get_metric_stats(self, metric_name: str, hours: int = 1) -> Dict[str, Any]:
        """
        Get statistical summary of a metric

        Args:
            metric_name: Name of the metric
            hours: Number of hours to look back

        Returns:
            Dictionary with count, mean, median, min, max, p95, p99
        """
        metrics = self.get_metrics(metric_name, hours)

        if not metrics:
            return {
                'count': 0,
                'mean': 0,
                'median': 0,
                'min': 0,
                'max': 0,
                'p95': 0,
                'p99': 0
            }

        values = [m['value'] for m in metrics]

        return {
            'count': len(values),
            'mean': statistics.mean(values),
            'median': statistics.median(values),
            'min': min(values),
            'max': max(values),
            'p95': statistics.quantiles(values, n=20)[18] if len(values) >= 20 else max(values),
            'p99': statistics.quantiles(values, n=100)[98] if len(values) >= 100 else max(values)
        }

    def get_system_health(self) -> Dict[str, Any]:
        """
        Get overall system health metrics

        Returns:
            Dictionary with various health indicators
        """
        health_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'status': 'healthy',
            'metrics': {},
            'alerts': []
        }

        # Database performance
        db_stats = self.get_metric_stats('db_query', hours=1)
        health_data['metrics']['database'] = {
            'avg_query_time': db_stats['mean'],
            'query_count': db_stats['count'],
            'slow_queries': len([m for m in self.get_metrics('db_query', 1) if m['value'] > 1.0])
        }

        # API performance
        api_stats = self.get_metric_stats('api_response', hours=1)
        health_data['metrics']['api'] = {
            'avg_response_time': api_stats['mean'],
            'request_count': api_stats['count'],
            'slow_requests': len([m for m in self.get_metrics('api_response', 1) if m['value'] > 2.0])
        }

        # Cache performance
        cache_hits = len(self.get_metrics('cache_hit', 1))
        cache_misses = len(self.get_metrics('cache_miss', 1))
        total_cache_requests = cache_hits + cache_misses
        hit_ratio = cache_hits / total_cache_requests if total_cache_requests > 0 else 0

        health_data['metrics']['cache'] = {
            'hit_ratio': hit_ratio,
            'total_requests': total_cache_requests
        }

        # Error rates
        total_requests = len(self.get_metrics('api_response', 1))
        errors = len(self.get_metrics('api_error', 1))
        error_rate = errors / total_requests if total_requests > 0 else 0

        health_data['metrics']['errors'] = {
            'error_rate': error_rate,
            'total_errors': errors
        }

        # Check overall health
        issues = []

        if db_stats['mean'] > self.thresholds['db_query_time']:
            issues.append(f"High database query time: {db_stats['mean']:.2f}s")

        if api_stats['mean'] > self.thresholds['api_response_time']:
            issues.append(f"High API response time: {api_stats['mean']:.2f}s")

        if hit_ratio < self.thresholds['cache_hit_ratio']:
            issues.append(f"Low cache hit ratio: {hit_ratio:.2%}")

        if error_rate > self.thresholds['error_rate']:
            issues.append(f"High error rate: {error_rate:.2%}")

        if issues:
            health_data['status'] = 'warning' if len(issues) < 3 else 'critical'
            health_data['issues'] = issues

        # Add recent alerts
        with self._lock:
            recent_alerts = [
                alert for alert in self._alerts
                if alert['timestamp'] > datetime.now(timezone.utc) - timedelta(hours=1)
            ]
            health_data['alerts'] = recent_alerts

        return health_data

    def get_performance_report(self, hours: int = 24) -> Dict[str, Any]:
        """
        Generate comprehensive performance report

        Args:
            hours: Number of hours to include in report

        Returns:
            Dictionary with performance analysis
        """
        report = {
            'period_hours': hours,
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'metrics': {},
            'recommendations': []
        }

        # Analyze each metric type
        metric_types = ['db_query', 'api_response', 'cache_hit', 'api_error']

        for metric_type in metric_types:
            stats = self.get_metric_stats(metric_type, hours)
            report['metrics'][metric_type] = stats

            # Generate recommendations based on performance
            if metric_type == 'db_query' and stats['p95'] > 1.0:
                report['recommendations'].append({
                    'type': 'database',
                    'priority': 'high',
                    'message': f"95th percentile DB query time ({stats['p95']:.2f}s) exceeds threshold",
                    'suggestion': "Consider adding database indexes or query optimization"
                })

            elif metric_type == 'api_response' and stats['p95'] > 2.0:
                report['recommendations'].append({
                    'type': 'api',
                    'priority': 'high',
                    'message': f"95th percentile API response time ({stats['p95']:.2f}s) exceeds threshold",
                    'suggestion': "Implement response caching or optimize API endpoints"
                })

        # Cache performance analysis
        cache_hits = len(self.get_metrics('cache_hit', hours))
        cache_misses = len(self.get_metrics('cache_miss', hours))
        if cache_hits + cache_misses > 0:
            hit_ratio = cache_hits / (cache_hits + cache_misses)
            if hit_ratio < 0.7:
                report['recommendations'].append({
                    'type': 'cache',
                    'priority': 'medium',
                    'message': f"Cache hit ratio ({hit_ratio:.1%}) is below optimal",
                    'suggestion': "Review cache TTL settings and cache key strategies"
                })

        return report

    async def _check_thresholds(self, metric_name: str, value: float, tags: Optional[Dict[str, Any]]):
        """
        Check if metric value exceeds thresholds and create alerts
        """
        threshold_key = None

        if metric_name == 'db_query' and value > self.thresholds['db_query_time']:
            threshold_key = 'db_query_time'
        elif metric_name == 'api_response' and value > self.thresholds['api_response_time']:
            threshold_key = 'api_response_time'

        if threshold_key:
            alert = {
                'timestamp': datetime.now(timezone.utc),
                'metric': metric_name,
                'value': value,
                'threshold': self.thresholds[threshold_key],
                'tags': tags or {},
                'message': f"{metric_name} exceeded threshold: {value} > {self.thresholds[threshold_key]}"
            }

            with self._lock:
                self._alerts.append(alert)

            # Keep only recent alerts
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.metrics_retention_hours)
            self._alerts = [a for a in self._alerts if a['timestamp'] > cutoff_time]

            logger.warning(f"Performance alert: {alert['message']}")

    def _start_cleanup_thread(self):
        """Start background thread to clean up old metrics"""
        self._running = True
        self._cleanup_thread = threading.Thread(target=self._cleanup_worker, daemon=True)
        self._cleanup_thread.start()

    def _stop_cleanup_thread(self):
        """Stop cleanup thread"""
        self._running = False
        if self._cleanup_thread:
            self._cleanup_thread.join(timeout=5)

    def _cleanup_worker(self):
        """Background worker to clean up old metrics"""
        while self._running:
            try:
                time.sleep(3600)  # Clean up every hour

                cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.metrics_retention_hours)

                with self._lock:
                    for metric_name in self._metrics:
                        self._metrics[metric_name] = [
                            metric for metric in self._metrics[metric_name]
                            if metric['timestamp'] > cutoff_time
                        ]

            except Exception as e:
                logger.error(f"Error in cleanup worker: {e}")
                time.sleep(60)  # Wait before retrying