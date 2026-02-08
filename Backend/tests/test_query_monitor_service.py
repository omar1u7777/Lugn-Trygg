"""Unit tests for QueryPerformanceMonitor behavior."""

from collections import deque
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from src.services.query_monitor import QueryPerformanceMonitor


def test_monitor_query_records_stats_and_alerts(mocker):
    monitor = QueryPerformanceMonitor(
        alert_thresholds={
            'slow_query_ms': 10,
            'very_slow_query_ms': 20,
            'high_cpu_percent': 999,
            'high_memory_percent': 999,
            'max_concurrent_queries': 999,
        }
    )
    time_values = [100.0, 100.05]

    def fake_time():
        return time_values.pop(0) if time_values else 100.1

    mocker.patch('src.services.query_monitor.time.time', side_effect=fake_time)

    monitor.monitor_query('q1', 'moods', {'filters': []})
    monitor.complete_query('q1', result_count=5)

    assert monitor.query_stats['moods']['total_queries'] == 1
    assert monitor.performance_history
    assert monitor.alerts  # slow query alert recorded


def test_detect_anomalies_flags_outliers(mocker):
    monitor = QueryPerformanceMonitor()
    now = datetime.now(timezone.utc)
    for idx in range(15):
        monitor.performance_history.append({
            'query_id': f'q{idx}',
            'collection': 'moods',
            'execution_time_ms': 50,
            'timestamp': now,
            'query_details': {}
        })
    monitor.performance_history.append({
        'query_id': 'q-outlier',
        'collection': 'moods',
        'execution_time_ms': 5000,
        'timestamp': now,
        'query_details': {}
    })
    mocker.patch.object(monitor, '_create_alert')

    monitor._detect_anomalies()

    assert monitor.anomalies
    monitor._create_alert.assert_called_once()


def test_get_performance_report_compiles_metrics(mocker):
    monitor = QueryPerformanceMonitor()
    monitor.is_monitoring = True
    now = datetime.now(timezone.utc)
    monitor.system_metrics['cpu_percent'] = [{'timestamp': now, 'value': 40.0}]
    monitor.query_stats['moods'] = {
        'total_queries': 2,
        'total_time': 200,
        'avg_time': 100,
        'min_time': 50,
        'max_time': 150,
        'error_count': 0,
        'slow_queries': 1,
        'last_query': now - timedelta(hours=1),
    }
    monitor.performance_history = deque([
        {'query_id': 'q1', 'collection': 'moods', 'execution_time_ms': 80, 'timestamp': now}
    ], maxlen=1000)
    monitor.alerts = [{'type': 'slow', 'resolved': False}]
    mocker.patch.object(monitor, '_generate_recommendations', return_value=[])

    report = monitor.get_performance_report()

    assert report['monitoring_status'] == 'active'
    assert 'cpu_percent' in report['system_metrics']
    assert 'moods' in report['query_performance']
    assert report['summary']['total_queries_monitored'] == 1
