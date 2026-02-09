"""
Metrics and monitoring routes for Lugn & Trygg API
Provides Prometheus-compatible metrics and health checks

Critical for:
- Load balancer health checks (Render, AWS, etc.)
- Prometheus/Grafana monitoring
- System resource monitoring
"""

import logging
import os
import time
from datetime import UTC, datetime
from typing import Any

import psutil
from flask import Blueprint, Response, g
from flask import request as flask_request

# Optional Prometheus support
try:
    import prometheus_client as prom
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    prom = None

# Absolute imports (project standard)
from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

# Create blueprint
metrics_bp = Blueprint('metrics', __name__)

# ============================================================================
# Prometheus metrics (only if available)
# ============================================================================

# Initialize metrics as None - will be set if prometheus is available
REQUEST_COUNT = None
REQUEST_LATENCY = None
CPU_USAGE = None
MEMORY_USAGE = None
DISK_USAGE = None
ACTIVE_USERS = None
TOTAL_MOODS = None
TOTAL_MEMORIES = None
HEALTH_CHECK_DURATION = None

if PROMETHEUS_AVAILABLE and prom is not None:
    # HTTP metrics
    REQUEST_COUNT = prom.Counter(
        'http_requests_total',
        'Total HTTP requests',
        ['method', 'endpoint', 'status']
    )
    REQUEST_LATENCY = prom.Histogram(
        'http_request_duration_seconds',
        'HTTP request latency',
        ['method', 'endpoint']
    )

    # System metrics
    CPU_USAGE = prom.Gauge('system_cpu_usage_percent', 'Current CPU usage')
    MEMORY_USAGE = prom.Gauge('system_memory_usage_percent', 'Current memory usage')
    DISK_USAGE = prom.Gauge('system_disk_usage_percent', 'Current disk usage')

    # Business metrics (updated from database)
    ACTIVE_USERS = prom.Gauge('lugn_trygg_active_users', 'Number of active users')
    TOTAL_MOODS = prom.Gauge('lugn_trygg_moods_total', 'Total mood logs in database')
    TOTAL_MEMORIES = prom.Gauge('lugn_trygg_memories_total', 'Total memories in database')

    # Health check duration
    HEALTH_CHECK_DURATION = prom.Histogram('health_check_duration_seconds', 'Health check duration')


# ============================================================================
# OPTIONS Handlers (CORS preflight)
# ============================================================================

@metrics_bp.route('/health', methods=['OPTIONS'])
@metrics_bp.route('/metrics', methods=['OPTIONS'])
@metrics_bp.route('/metrics/business', methods=['OPTIONS'])
@metrics_bp.route('/ready', methods=['OPTIONS'])
@metrics_bp.route('/live', methods=['OPTIONS'])
def metrics_options():
    """Handle CORS preflight for metrics endpoints"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


# ============================================================================
# Health Check Endpoints (CRITICAL for deployment)
# ============================================================================

@metrics_bp.route('/health', methods=['GET'])
@rate_limit_by_endpoint
def health_check():
    """
    Basic health check endpoint for load balancers.
    Returns 200 if service is healthy, 503 if unhealthy.
    """
    start_time = time.time()

    try:
        # Check system resources (non-blocking)
        cpu_percent = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()

        # Try to get disk usage (may fail in some containers)
        try:
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
        except Exception:
            disk_percent = 0.0

        # Update Prometheus metrics if available
        if PROMETHEUS_AVAILABLE and CPU_USAGE is not None:
            CPU_USAGE.set(cpu_percent)
        if PROMETHEUS_AVAILABLE and MEMORY_USAGE is not None:
            MEMORY_USAGE.set(memory.percent)
        if PROMETHEUS_AVAILABLE and DISK_USAGE is not None:
            DISK_USAGE.set(disk_percent)

        # Check database connectivity
        db_status = "healthy"
        try:
            # Simple Firestore ping - just check if we can access a collection
            db.collection("_health_check").limit(1).get()
        except Exception as db_error:
            logger.warning(f"Database health check failed: {db_error}")
            db_status = "degraded"

        health_data = {
            'status': 'healthy' if db_status == 'healthy' else 'degraded',
            'timestamp': datetime.now(UTC).isoformat(),
            'version': os.getenv('APP_VERSION', '1.0.0'),
            'system': {
                'cpuUsage': f"{cpu_percent:.1f}%",
                'memoryUsage': f"{memory.percent:.1f}%",
                'diskUsage': f"{disk_percent:.1f}%"
            },
            'services': {
                'database': db_status,
                'api': 'healthy'
            }
        }

        duration = time.time() - start_time
        if PROMETHEUS_AVAILABLE and HEALTH_CHECK_DURATION is not None:
            HEALTH_CHECK_DURATION.observe(duration)

        if db_status == 'healthy':
            return APIResponse.success(data=health_data, message='Service healthy')
        else:
            return APIResponse.error('Service degraded', status_code=503)

    except Exception as e:
        logger.exception(f"Health check failed: {e}")
        return APIResponse.error('Health check failed', status_code=503)


@metrics_bp.route('/ready', methods=['GET'])
@rate_limit_by_endpoint
def readiness_check():
    """
    Kubernetes-style readiness probe.
    Returns 200 if service is ready to accept traffic.
    """
    try:
        # Check if database is accessible
        db.collection("_health_check").limit(1).get()
        return APIResponse.success(
            data={'status': 'ready', 'timestamp': datetime.now(UTC).isoformat()},
            message='Service ready'
        )
    except Exception as e:
        logger.warning(f"Readiness check failed: {e}")
        return APIResponse.error('Service not ready', status_code=503)


@metrics_bp.route('/live', methods=['GET'])
@rate_limit_by_endpoint
def liveness_check():
    """
    Kubernetes-style liveness probe.
    Returns 200 if service is alive (minimal check).
    """
    return APIResponse.success(
        data={'status': 'alive', 'timestamp': datetime.now(UTC).isoformat()},
        message='Service alive'
    )


# ============================================================================
# Prometheus Metrics Endpoint
# ============================================================================

@metrics_bp.route('/metrics', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def prometheus_metrics():
    """
    Prometheus metrics endpoint.
    Requires prometheus-client to be installed.

    Security: Consider adding authentication for production.
    """
    if not PROMETHEUS_AVAILABLE:
        return Response(
            "# Prometheus client not installed\n# pip install prometheus-client\n",
            mimetype='text/plain',
            status=501
        )

    try:
        # Import here to ensure it's available
        from prometheus_client import CONTENT_TYPE_LATEST as PROM_CONTENT_TYPE
        from prometheus_client import generate_latest

        # Update business metrics from database
        _update_business_metrics_from_db()

        # Generate latest metrics
        metrics_output = generate_latest()
        return Response(metrics_output, mimetype=PROM_CONTENT_TYPE)

    except Exception as e:
        logger.exception(f"Error generating metrics: {e}")
        return Response(f"# Error generating metrics: {str(e)}\n", status=500)


@metrics_bp.route('/metrics/business', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def business_metrics():
    """
    Business-specific metrics in Prometheus format.
    Returns key business KPIs from database.
    """
    if not PROMETHEUS_AVAILABLE:
        return Response("# Prometheus not available\n", mimetype='text/plain', status=501)

    try:
        from prometheus_client import CONTENT_TYPE_LATEST as PROM_CONTENT_TYPE

        # Get fresh data from database
        stats = _get_business_stats_from_db()

        # Create custom metrics output
        metrics_lines = [
            "# HELP lugn_trygg_business_kpis Business KPIs from database",
            "# TYPE lugn_trygg_business_kpis gauge",
            f'lugn_trygg_business_kpis{{kpi="total_users"}} {stats.get("total_users", 0)}',
            f'lugn_trygg_business_kpis{{kpi="total_moods"}} {stats.get("total_moods", 0)}',
            f'lugn_trygg_business_kpis{{kpi="total_memories"}} {stats.get("total_memories", 0)}',
            f'lugn_trygg_business_kpis{{kpi="total_achievements"}} {stats.get("total_achievements", 0)}',
            ""
        ]

        return Response('\n'.join(metrics_lines), mimetype=PROM_CONTENT_TYPE)

    except Exception as e:
        logger.exception(f"Error generating business metrics: {e}")
        return Response(f"# Error: {str(e)}\n", status=500)


# ============================================================================
# Database Stats Functions (replaces mock data)
# ============================================================================

def _get_business_stats_from_db() -> dict[str, int]:
    """
    Get real business statistics from Firestore.
    Uses collection counts for accurate metrics.
    """
    stats = {
        "total_users": 0,
        "total_moods": 0,
        "total_memories": 0,
        "total_achievements": 0
    }

    try:
        # Count users (limit query to avoid timeout)
        users_count = len(list(db.collection("users").limit(10000).stream()))
        stats["total_users"] = users_count

        # Count moods
        moods_count = len(list(db.collection("moods").limit(50000).stream()))
        stats["total_moods"] = moods_count

        # Count memories
        memories_count = len(list(db.collection("memories").limit(10000).stream()))
        stats["total_memories"] = memories_count

        # Count achievements
        achievements_count = len(list(db.collection("achievements").limit(10000).stream()))
        stats["total_achievements"] = achievements_count

    except Exception as e:
        logger.warning(f"Error fetching business stats: {e}")

    return stats


def _update_business_metrics_from_db():
    """Update Prometheus gauges with real data from database"""
    if not PROMETHEUS_AVAILABLE:
        return

    try:
        stats = _get_business_stats_from_db()
        if ACTIVE_USERS is not None:
            ACTIVE_USERS.set(stats.get("total_users", 0))
        if TOTAL_MOODS is not None:
            TOTAL_MOODS.set(stats.get("total_moods", 0))
        if TOTAL_MEMORIES is not None:
            TOTAL_MEMORIES.set(stats.get("total_memories", 0))
    except Exception as e:
        logger.warning(f"Error updating Prometheus metrics: {e}")


# ============================================================================
# Request Tracking Middleware
# ============================================================================

def init_metrics_tracking(app):
    """
    Initialize metrics tracking middleware.
    Call this in main.py after creating the Flask app.

    Usage:
        from src.routes.metrics_routes import init_metrics_tracking
        init_metrics_tracking(app)
    """
    if not PROMETHEUS_AVAILABLE:
        logger.info("Prometheus not available, skipping metrics tracking")
        return


    @app.before_request
    def track_request_start():
        g._start_time = time.time()

    @app.after_request
    def track_request_end(response):
        start_time = getattr(g, '_start_time', None)
        if start_time is not None:
            duration = time.time() - start_time

            # Track request metrics
            if REQUEST_COUNT is not None:
                REQUEST_COUNT.labels(
                    method=flask_request.method,
                    endpoint=flask_request.endpoint or 'unknown',
                    status=response.status_code
                ).inc()

            if REQUEST_LATENCY is not None:
                REQUEST_LATENCY.labels(
                    method=flask_request.method,
                    endpoint=flask_request.endpoint or 'unknown'
                ).observe(duration)

        return response

    logger.info("✅ Prometheus metrics tracking initialized")


# ============================================================================
# Event Tracking (for use in other modules)
# ============================================================================

def track_business_event(event_type: str, properties: dict[str, Any] | None = None):
    """
    Track business events for analytics.
    Call this from other modules when important events occur.

    Usage:
        from src.routes.metrics_routes import track_business_event
        track_business_event('user_registration', {'source': 'google'})
    """
    if not PROMETHEUS_AVAILABLE:
        return

    try:
        # Log event for debugging
        logger.debug(f"Business event: {event_type} - {properties}")

        # Note: For real-time counters, you'd increment specific metrics here
        # The current implementation refreshes from database on each /metrics call

    except Exception as e:
        logger.warning(f"Error tracking business event: {e}")


# ============================================================================
# Exports
# ============================================================================

__all__ = [
    'metrics_bp',
    'init_metrics_tracking',
    'track_business_event',
]
