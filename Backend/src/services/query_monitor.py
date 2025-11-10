"""
Advanced Query Performance Monitoring Service
Real-time monitoring, alerting, and optimization of database queries
"""

import time
import threading
import psutil
from typing import Dict, List, Optional, Any, Tuple, Callable
from collections import defaultdict, deque
from datetime import datetime, timedelta
import logging
import json
from firebase_admin import firestore
from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded

logger = logging.getLogger(__name__)

class QueryPerformanceMonitor:
    """Monitors and analyzes database query performance in real-time"""

    def __init__(self, db=None, alert_thresholds: Dict[str, float] = None):
        self._db = db  # Lazy initialization - don't call firestore.client() immediately
        self.is_monitoring = False
        self.monitor_thread = None

        # Performance thresholds
        self.alert_thresholds = alert_thresholds or {
            'slow_query_ms': 1000,      # Alert on queries > 1s
            'very_slow_query_ms': 5000, # Critical alert > 5s
            'high_cpu_percent': 80.0,   # Alert on CPU > 80%
            'high_memory_percent': 85.0, # Alert on memory > 85%
            'max_concurrent_queries': 50, # Alert on too many concurrent queries
        }

        # Monitoring data structures
        self.query_stats: Dict[str, Dict] = {}
        self.active_queries: Dict[str, Dict] = {}
        self.performance_history: deque = deque(maxlen=1000)
        self.alerts: List[Dict] = []
        self.system_metrics: Dict[str, List] = defaultdict(list)

        # Query patterns and anomalies
        self.query_patterns: Dict[str, Dict] = {}
        self.anomalies: List[Dict] = []

        # Callbacks for alerts
        self.alert_callbacks: List[Callable] = []
    
    @property
    def db(self):
        """Lazy initialize Firestore client"""
        if self._db is None:
            self._db = firestore.client()
        return self._db

    def start_monitoring(self):
        """Start the performance monitoring system"""
        if self.is_monitoring:
            return

        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()

        logger.info("🚀 Query performance monitoring started")

    def stop_monitoring(self):
        """Stop the performance monitoring system"""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("⏹️ Query performance monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                # Collect system metrics
                self._collect_system_metrics()

                # Check for slow queries
                self._check_slow_queries()

                # Detect anomalies
                self._detect_anomalies()

                # Clean up old data
                self._cleanup_old_data()

                # Sleep for monitoring interval (5 seconds)
                time.sleep(5)

            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                time.sleep(10)  # Wait longer on error

    def _collect_system_metrics(self):
        """Collect system performance metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.system_metrics['cpu_percent'].append({
                'timestamp': datetime.utcnow(),
                'value': cpu_percent
            })

            # Memory usage
            memory = psutil.virtual_memory()
            self.system_metrics['memory_percent'].append({
                'timestamp': datetime.utcnow(),
                'value': memory.percent
            })

            # Disk I/O (if available)
            try:
                disk_io = psutil.disk_io_counters()
                if disk_io:
                    self.system_metrics['disk_read_bytes'].append({
                        'timestamp': datetime.utcnow(),
                        'value': disk_io.read_bytes
                    })
                    self.system_metrics['disk_write_bytes'].append({
                        'timestamp': datetime.utcnow(),
                        'value': disk_io.write_bytes
                    })
            except:
                pass

            # Network I/O (if available)
            try:
                net_io = psutil.net_io_counters()
                if net_io:
                    self.system_metrics['network_bytes_sent'].append({
                        'timestamp': datetime.utcnow(),
                        'value': net_io.bytes_sent
                    })
                    self.system_metrics['network_bytes_recv'].append({
                        'timestamp': datetime.utcnow(),
                        'value': net_io.bytes_recv
                    })
            except:
                pass

            # Check thresholds and alert if needed
            self._check_system_thresholds(cpu_percent, memory.percent)

        except Exception as e:
            logger.warning(f"System metrics collection error: {e}")

    def _check_system_thresholds(self, cpu_percent: float, memory_percent: float):
        """Check system metrics against thresholds"""
        now = datetime.utcnow()

        if cpu_percent > self.alert_thresholds['high_cpu_percent']:
            self._create_alert('high_cpu', f'CPU usage at {cpu_percent:.1f}%', 'warning')

        if memory_percent > self.alert_thresholds['high_memory_percent']:
            self._create_alert('high_memory', f'Memory usage at {memory_percent:.1f}%', 'critical')

        # Check concurrent queries
        concurrent_queries = len(self.active_queries)
        if concurrent_queries > self.alert_thresholds['max_concurrent_queries']:
            self._create_alert('high_concurrency',
                             f'{concurrent_queries} concurrent queries', 'warning')

    def monitor_query(self, query_id: str, collection: str, query_details: Dict[str, Any]):
        """Start monitoring a query execution"""
        self.active_queries[query_id] = {
            'collection': collection,
            'query_details': query_details,
            'start_time': time.time(),
            'thread_id': threading.get_ident(),
            'start_timestamp': datetime.utcnow()
        }

    def complete_query(self, query_id: str, result_count: int = 0, error: Optional[str] = None):
        """Complete monitoring of a query execution"""
        if query_id not in self.active_queries:
            return

        query_info = self.active_queries.pop(query_id)
        execution_time = time.time() - query_info['start_time']
        execution_time_ms = execution_time * 1000

        # Create performance record
        performance_record = {
            'query_id': query_id,
            'collection': query_info['collection'],
            'execution_time_ms': execution_time_ms,
            'result_count': result_count,
            'error': error,
            'timestamp': datetime.utcnow(),
            'query_details': query_info['query_details'],
            'thread_id': query_info['thread_id']
        }

        # Store in history
        self.performance_history.append(performance_record)

        # Update query statistics
        self._update_query_stats(query_info['collection'], performance_record)

        # Check for alerts
        self._check_query_alerts(performance_record)

        # Log performance
        if execution_time_ms > 100:  # Log queries slower than 100ms
            logger.info(f"Query {query_id} completed in {execution_time_ms:.2f}ms "
                       f"({result_count} results)")

    def _update_query_stats(self, collection: str, record: Dict):
        """Update query statistics for a collection"""
        if collection not in self.query_stats:
            self.query_stats[collection] = {
                'total_queries': 0,
                'total_time': 0,
                'avg_time': 0,
                'min_time': float('inf'),
                'max_time': 0,
                'error_count': 0,
                'slow_queries': 0,
                'last_query': None
            }

        stats = self.query_stats[collection]
        stats['total_queries'] += 1
        stats['total_time'] += record['execution_time_ms']
        stats['avg_time'] = stats['total_time'] / stats['total_queries']
        stats['min_time'] = min(stats['min_time'], record['execution_time_ms'])
        stats['max_time'] = max(stats['max_time'], record['execution_time_ms'])
        stats['last_query'] = record['timestamp']

        if record['error']:
            stats['error_count'] += 1

        if record['execution_time_ms'] > self.alert_thresholds['slow_query_ms']:
            stats['slow_queries'] += 1

    def _check_query_alerts(self, record: Dict):
        """Check query performance and create alerts if needed"""
        execution_time = record['execution_time_ms']

        if execution_time > self.alert_thresholds['very_slow_query_ms']:
            self._create_alert('very_slow_query',
                             f"Query took {execution_time:.0f}ms on {record['collection']}",
                             'critical')
        elif execution_time > self.alert_thresholds['slow_query_ms']:
            self._create_alert('slow_query',
                             f"Query took {execution_time:.0f}ms on {record['collection']}",
                             'warning')

    def _check_slow_queries(self):
        """Check for queries that have been running too long"""
        now = time.time()
        timeout_threshold = 30  # 30 seconds

        for query_id, query_info in list(self.active_queries.items()):
            elapsed = now - query_info['start_time']
            if elapsed > timeout_threshold:
                self._create_alert('query_timeout',
                                 f"Query {query_id} running for {elapsed:.0f}s on {query_info['collection']}",
                                 'critical')

                # Remove from active queries (it's probably stuck)
                del self.active_queries[query_id]

    def _detect_anomalies(self):
        """Detect performance anomalies using statistical analysis"""
        if len(self.performance_history) < 10:
            return  # Need minimum data for anomaly detection

        # Get recent performance data (last 50 queries)
        recent_queries = list(self.performance_history)[-50:]
        execution_times = [q['execution_time_ms'] for q in recent_queries]

        if not execution_times:
            return

        # Calculate statistics
        avg_time = sum(execution_times) / len(execution_times)
        std_dev = (sum((x - avg_time) ** 2 for x in execution_times) / len(execution_times)) ** 0.5

        # Check for anomalies (3 standard deviations from mean)
        threshold = avg_time + (3 * std_dev)

        for query in recent_queries[-5:]:  # Check last 5 queries
            if query['execution_time_ms'] > threshold and query['execution_time_ms'] > 1000:
                anomaly = {
                    'type': 'performance_anomaly',
                    'query_id': query['query_id'],
                    'execution_time_ms': query['execution_time_ms'],
                    'average_time': avg_time,
                    'threshold': threshold,
                    'collection': query['collection'],
                    'timestamp': query['timestamp']
                }
                self.anomalies.append(anomaly)
                self._create_alert('performance_anomaly',
                                 f"Anomalous query performance: {query['execution_time_ms']:.0f}ms "
                                 f"(avg: {avg_time:.0f}ms)",
                                 'warning')

                # Keep only last 100 anomalies
                if len(self.anomalies) > 100:
                    self.anomalies.pop(0)

    def _cleanup_old_data(self):
        """Clean up old monitoring data"""
        cutoff_time = datetime.utcnow() - timedelta(hours=24)

        # Clean old alerts (keep last 100)
        if len(self.alerts) > 100:
            self.alerts = self.alerts[-100:]

        # Clean old system metrics (keep last 1000 points per metric)
        for metric_name in self.system_metrics:
            metrics = self.system_metrics[metric_name]
            # Keep only metrics from last 24 hours
            recent_metrics = [m for m in metrics if m['timestamp'] > cutoff_time]
            self.system_metrics[metric_name] = recent_metrics[-1000:]  # Max 1000 points

    def _create_alert(self, alert_type: str, message: str, severity: str):
        """Create a performance alert"""
        alert = {
            'id': f"{alert_type}_{int(time.time())}",
            'type': alert_type,
            'message': message,
            'severity': severity,
            'timestamp': datetime.utcnow(),
            'resolved': False
        }

        self.alerts.append(alert)
        logger.warning(f"🚨 Performance Alert [{severity.upper()}]: {message}")

        # Trigger callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")

    def add_alert_callback(self, callback: Callable):
        """Add a callback function for alerts"""
        self.alert_callbacks.append(callback)

    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        report = {
            'monitoring_status': 'active' if self.is_monitoring else 'inactive',
            'summary': {
                'total_queries_monitored': len(self.performance_history),
                'active_queries': len(self.active_queries),
                'total_alerts': len(self.alerts),
                'unresolved_alerts': len([a for a in self.alerts if not a['resolved']]),
                'anomalies_detected': len(self.anomalies)
            },
            'system_metrics': {},
            'query_performance': {},
            'alerts': self.alerts[-10:],  # Last 10 alerts
            'recommendations': []
        }

        # System metrics summary
        for metric_name, metrics in self.system_metrics.items():
            if metrics:
                values = [m['value'] for m in metrics]
                report['system_metrics'][metric_name] = {
                    'current': values[-1] if values else 0,
                    'average': sum(values) / len(values) if values else 0,
                    'max': max(values) if values else 0,
                    'min': min(values) if values else 0,
                    'samples': len(values)
                }

        # Query performance by collection
        for collection, stats in self.query_stats.items():
            report['query_performance'][collection] = {
                'total_queries': stats['total_queries'],
                'avg_response_time': stats['avg_time'],
                'slow_queries': stats['slow_queries'],
                'error_rate': (stats['error_count'] / stats['total_queries']) * 100 if stats['total_queries'] > 0 else 0,
                'throughput': stats['total_queries'] / ((datetime.utcnow() - stats['last_query']).total_seconds() / 3600) if stats['last_query'] else 0
            }

        # Generate recommendations
        report['recommendations'] = self._generate_recommendations()

        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []

        # Check for slow collections
        slow_collections = []
        for collection, stats in self.query_stats.items():
            if stats['avg_time'] > 1000:  # > 1 second average
                slow_collections.append(f"{collection} ({stats['avg_time']:.0f}ms avg)")

        if slow_collections:
            recommendations.append(f"Optimize slow collections: {', '.join(slow_collections)}")

        # Check error rates
        high_error_collections = []
        for collection, stats in self.query_stats.items():
            error_rate = (stats['error_count'] / stats['total_queries']) * 100 if stats['total_queries'] > 0 else 0
            if error_rate > 5:  # > 5% error rate
                high_error_collections.append(f"{collection} ({error_rate:.1f}%)")

        if high_error_collections:
            recommendations.append(f"Investigate high error rates: {', '.join(high_error_collections)}")

        # System resource recommendations
        system_metrics = report.get('system_metrics', {})
        cpu_avg = system_metrics.get('cpu_percent', {}).get('average', 0)
        memory_avg = system_metrics.get('memory_percent', {}).get('average', 0)

        if cpu_avg > 70:
            recommendations.append(f"High CPU usage ({cpu_avg:.1f}% avg) - consider scaling")

        if memory_avg > 80:
            recommendations.append(f"High memory usage ({memory_avg:.1f}% avg) - monitor for leaks")

        # Alert-based recommendations
        unresolved_alerts = len([a for a in self.alerts if not a['resolved']])
        if unresolved_alerts > 5:
            recommendations.append(f"Address {unresolved_alerts} unresolved performance alerts")

        if not recommendations:
            recommendations.append("Performance is within acceptable parameters")
            recommendations.append("Continue monitoring for optimization opportunities")

        return recommendations

    def export_performance_data(self, filename: str = None) -> str:
        """Export performance data for analysis"""
        if not filename:
            filename = f"performance_report_{int(time.time())}.json"

        data = {
            'export_timestamp': datetime.utcnow().isoformat(),
            'performance_report': self.get_performance_report(),
            'raw_history': list(self.performance_history),
            'system_metrics': dict(self.system_metrics),
            'query_stats': self.query_stats
        }

        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(f"📊 Performance data exported to {filename}")
        return filename

# Global monitor instance (lazy initialization)
query_monitor = None

def _get_query_monitor():
    """Lazy initialization of query monitor"""
    global query_monitor
    if query_monitor is None:
        query_monitor = QueryPerformanceMonitor()
    return query_monitor

def monitor_query(collection: str = None):
    """Decorator to monitor query performance"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Generate query ID
            query_id = f"{func.__name__}_{threading.get_ident()}_{int(time.time()*1000)}"

            # Extract collection from function name or parameter
            query_collection = collection
            if not query_collection and 'collection' in kwargs:
                query_collection = kwargs['collection']
            elif not query_collection and len(args) > 0 and isinstance(args[0], str):
                query_collection = args[0]

            # Monitor query start
            query_details = {
                'function': func.__name__,
                'args_count': len(args),
                'kwargs_keys': list(kwargs.keys())
            }

            monitor = _get_query_monitor()
            monitor.monitor_query(query_id, query_collection or 'unknown', query_details)

            try:
                # Execute the query
                result = func(*args, **kwargs)

                # Determine result count
                result_count = 0
                if hasattr(result, '__len__'):
                    try:
                        result_count = len(result)
                    except:
                        result_count = 0

                # Complete monitoring
                monitor.complete_query(query_id, result_count)

                return result

            except Exception as e:
                # Complete monitoring with error
                monitor.complete_query(query_id, error=str(e))
                raise

        return wrapper
    return decorator

__all__ = [
    'QueryPerformanceMonitor',
    'query_monitor',
    'monitor_query'
]