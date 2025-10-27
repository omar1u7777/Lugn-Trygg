"""
Metrics and monitoring routes for Lugn & Trygg API
Provides Prometheus-compatible metrics and health checks
"""

from flask import Blueprint, Response, jsonify
import psutil
import time
from datetime import datetime, timedelta
import prometheus_client as prom
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

# Create blueprint
metrics_bp = Blueprint('metrics', __name__)

# Prometheus metrics
REQUEST_COUNT = prom.Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = prom.Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])
ACTIVE_USERS = prom.Gauge('lugn_trygg_active_users', 'Number of active users')
MOOD_LOGS_TOTAL = prom.Counter('lugn_trygg_mood_logs_total', 'Total mood logs created')
CHATBOT_INTERACTIONS = prom.Counter('lugn_trygg_chatbot_interactions_total', 'Total chatbot interactions')
CRISIS_ALERTS_ACTIVE = prom.Gauge('lugn_trygg_crisis_alerts_active', 'Number of active crisis alerts')
AVERAGE_MOOD_SCORE = prom.Gauge('lugn_trygg_average_mood_score', 'Average mood score across all users')

# System metrics
CPU_USAGE = prom.Gauge('system_cpu_usage_percent', 'Current CPU usage percentage')
MEMORY_USAGE = prom.Gauge('system_memory_usage_percent', 'Current memory usage percentage')
DISK_USAGE = prom.Gauge('system_disk_usage_percent', 'Current disk usage percentage')

# Business metrics
USER_REGISTRATIONS = prom.Counter('lugn_trygg_user_registrations_total', 'Total user registrations')
FEATURE_USAGE = prom.Counter('lugn_trygg_feature_usage_total', 'Feature usage by type', ['feature_type'])
SUBSCRIPTION_EVENTS = prom.Counter('lugn_trygg_subscription_events_total', 'Subscription events', ['event_type'])

# Health check metrics
HEALTH_CHECK_DURATION = prom.Histogram('health_check_duration_seconds', 'Health check duration')

@metrics_bp.route('/health')
def health_check():
    """Basic health check endpoint"""
    start_time = time.time()

    try:
        # Check database connection (simplified)
        # In real implementation, check actual DB connection

        # Check system resources
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        # Update system metrics
        CPU_USAGE.set(cpu_percent)
        MEMORY_USAGE.set(memory.percent)
        DISK_USAGE.set(disk.percent)

        health_data = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'system': {
                'cpu_usage': f"{cpu_percent:.1f}%",
                'memory_usage': f"{memory.percent:.1f}%",
                'disk_usage': f"{disk.percent:.1f}%"
            },
            'services': {
                'database': 'healthy',
                'cache': 'healthy',
                'external_apis': 'healthy'
            }
        }

        duration = time.time() - start_time
        HEALTH_CHECK_DURATION.observe(duration)

        return jsonify(health_data), 200

    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

@metrics_bp.route('/metrics')
def prometheus_metrics():
    """Prometheus metrics endpoint"""
    try:
        # Update dynamic metrics
        _update_business_metrics()

        # Generate latest metrics
        metrics_output = generate_latest()

        return Response(metrics_output, mimetype=CONTENT_TYPE_LATEST)

    except Exception as e:
        return Response(f"# Error generating metrics: {str(e)}", status=500)

@metrics_bp.route('/metrics/business')
def business_metrics():
    """Business-specific metrics in Prometheus format"""
    try:
        _update_business_metrics()

        # Create custom metrics output
        metrics_lines = [
            "# HELP lugn_trygg_business_kpis Business KPIs",
            "# TYPE lugn_trygg_business_kpis gauge",
            f'lugn_trygg_business_kpis{{kpi="active_users"}} {ACTIVE_USERS._value}',
            f'lugn_trygg_business_kpis{{kpi="mood_logs_today"}} {MOOD_LOGS_TOTAL._value}',
            f'lugn_trygg_business_kpis{{kpi="chatbot_interactions"}} {CHATBOT_INTERACTIONS._value}',
            f'lugn_trygg_business_kpis{{kpi="crisis_alerts"}} {CRISIS_ALERTS_ACTIVE._value}',
            f'lugn_trygg_business_kpis{{kpi="average_mood"}} {AVERAGE_MOOD_SCORE._value}',
            ""
        ]

        return Response('\n'.join(metrics_lines), mimetype=CONTENT_TYPE_LATEST)

    except Exception as e:
        return Response(f"# Error generating business metrics: {str(e)}", status=500)

def _update_business_metrics():
    """Update business metrics from database/cache"""
    try:
        # In a real implementation, these would query the actual database
        # For demo purposes, we'll use mock data that changes over time

        import random

        # Simulate active users (between 1000-2000)
        active_count = 1500 + random.randint(-200, 200)
        ACTIVE_USERS.set(active_count)

        # Simulate mood logs (incrementing counter)
        MOOD_LOGS_TOTAL.inc(random.randint(1, 10))

        # Simulate chatbot interactions
        CHATBOT_INTERACTIONS.inc(random.randint(5, 20))

        # Simulate crisis alerts (usually low, occasional spikes)
        crisis_count = random.choices([0, 1, 2, 3], weights=[0.7, 0.2, 0.08, 0.02])[0]
        CRISIS_ALERTS_ACTIVE.set(crisis_count)

        # Simulate average mood score (6.0-8.0 range)
        mood_score = 7.0 + random.uniform(-1.0, 1.0)
        AVERAGE_MOOD_SCORE.set(round(mood_score, 1))

    except Exception as e:
        print(f"Error updating business metrics: {e}")

# Middleware to track requests
def init_metrics_tracking(app):
    """Initialize metrics tracking middleware"""

    @app.before_request
    def track_request_start():
        from flask import request
        request._start_time = time.time()

    @app.after_request
    def track_request_end(response):
        from flask import request

        if hasattr(request, '_start_time'):
            duration = time.time() - request._start_time

            # Track request metrics
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.endpoint or 'unknown',
                status=response.status_code
            ).inc()

            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=request.endpoint or 'unknown'
            ).observe(duration)

        return response

# Analytics event tracking (called from application code)
def track_business_event(event_type: str, properties: dict = None):
    """Track business events for analytics"""
    try:
        if event_type == 'user_registration':
            USER_REGISTRATIONS.inc()
        elif event_type == 'mood_logged':
            MOOD_LOGS_TOTAL.inc()
            if properties and 'mood_score' in properties:
                # Update rolling average (simplified)
                current_avg = AVERAGE_MOOD_SCORE._value
                new_avg = (current_avg + properties['mood_score']) / 2
                AVERAGE_MOOD_SCORE.set(round(new_avg, 1))
        elif event_type == 'chatbot_interaction':
            CHATBOT_INTERACTIONS.inc()
        elif event_type == 'feature_used':
            FEATURE_USAGE.labels(feature_type=properties.get('feature', 'unknown')).inc()
        elif event_type == 'subscription':
            SUBSCRIPTION_EVENTS.labels(event_type=properties.get('event', 'unknown')).inc()
        elif event_type == 'crisis_detected':
            CRISIS_ALERTS_ACTIVE.inc()

    except Exception as e:
        print(f"Error tracking business event: {e}")

# Export metrics for use in other modules
__all__ = [
    'metrics_bp',
    'init_metrics_tracking',
    'track_business_event',
    'REQUEST_COUNT',
    'REQUEST_LATENCY',
    'ACTIVE_USERS',
    'MOOD_LOGS_TOTAL',
    'CHATBOT_INTERACTIONS',
    'CRISIS_ALERTS_ACTIVE',
    'AVERAGE_MOOD_SCORE'
]