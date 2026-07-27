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

if PROMETHEUS_AVAILABLE and prom is not None and os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
    # Defense in depth: gunicorn_config.py creates this directory before the
    # arbiter imports the app, but construct it here too in case this module
    # is ever imported via a different entrypoint — a label-less metric's
    # __init__ opens an mmap file under this path immediately, and a missing
    # directory would crash the whole import (see gunicorn_config.py for the
    # full explanation of why this matters).
    os.makedirs(os.environ["PROMETHEUS_MULTIPROC_DIR"], exist_ok=True)

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

        # Under multi-worker Gunicorn each worker has its own in-process
        # registry, so a scrape would return only ONE worker's numbers at
        # random. When PROMETHEUS_MULTIPROC_DIR is set (see gunicorn_config.py),
        # aggregate across all workers via the MultiProcessCollector.
        if os.getenv("PROMETHEUS_MULTIPROC_DIR"):
            from prometheus_client import CollectorRegistry, multiprocess
            registry = CollectorRegistry()
            multiprocess.MultiProcessCollector(registry)
            metrics_output = generate_latest(registry)
        else:
            metrics_output = generate_latest()
        return Response(metrics_output, mimetype=PROM_CONTENT_TYPE)

    except Exception:
        logger.exception("Error generating metrics")
        return Response("# Error generating metrics\n", status=500)


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
        ]

        # Crisis queue health — the most important patient-safety pipeline signal.
        try:
            from src.services.crisis_task_queue import get_queue_health
            q = get_queue_health()
            counts = q.get("counts", {})
            metrics_lines += [
                "# HELP lugn_trygg_crisis_queue Crisis escalation queue depth by status",
                "# TYPE lugn_trygg_crisis_queue gauge",
                f'lugn_trygg_crisis_queue{{status="pending"}} {counts.get("pending", 0)}',
                f'lugn_trygg_crisis_queue{{status="processing"}} {counts.get("processing", 0)}',
                f'lugn_trygg_crisis_queue{{status="failed"}} {counts.get("failed", 0)}',
                "# HELP lugn_trygg_crisis_oldest_pending_seconds Age of oldest pending crisis task",
                "# TYPE lugn_trygg_crisis_oldest_pending_seconds gauge",
                f'lugn_trygg_crisis_oldest_pending_seconds {q.get("oldest_pending_age_seconds", 0)}',
            ]
        except Exception:
            logger.warning("Crisis queue metrics unavailable", exc_info=True)

        # Degraded-fallback / critical-event counters from telemetry.
        try:
            from src.utils.telemetry import telemetry
            tstats = telemetry.get_stats()
            metrics_lines.append("# HELP lugn_trygg_degradations Degraded-fallback occurrences")
            metrics_lines.append("# TYPE lugn_trygg_degradations counter")
            for key, count in tstats.get("degradations", {}).items():
                safe = key.replace('"', '').replace('\\', '')
                metrics_lines.append(f'lugn_trygg_degradations{{kind="{safe}"}} {count}')
            metrics_lines.append("# HELP lugn_trygg_criticals Critical operational events")
            metrics_lines.append("# TYPE lugn_trygg_criticals counter")
            for key, count in tstats.get("criticals", {}).items():
                safe = key.replace('"', '').replace('\\', '')
                metrics_lines.append(f'lugn_trygg_criticals{{event="{safe}"}} {count}')
        except Exception:
            logger.warning("Telemetry metrics unavailable", exc_info=True)

        metrics_lines.append("")
        return Response('\n'.join(metrics_lines), mimetype=PROM_CONTENT_TYPE)

    except Exception:
        logger.exception("Error generating business metrics")
        return Response("# Error generating business metrics\n", status=500)


# ============================================================================
# Database Stats Functions (replaces mock data)
# ============================================================================

# Cache business stats so a Prometheus scrape never streams the whole DB.
_business_stats_cache: dict[str, Any] = {"value": None, "expires": 0.0}
_BUSINESS_STATS_TTL = 300  # 5 minutes


def _collection_count(collection_name: str) -> int:
    """Count a collection via Firestore's server-side count() aggregation —
    reads a single aggregate result instead of streaming every document."""
    agg = db.collection(collection_name).count()
    result = agg.get()
    # count().get() → list[list[AggregationResult]]; the value is at [0][0].
    try:
        return int(result[0][0].value)
    except (IndexError, TypeError, AttributeError):
        # Some client/mocks return a flat list of AggregationResults.
        try:
            return int(result[0].value)
        except (IndexError, TypeError, AttributeError):
            return 0


def _get_business_stats_from_db() -> dict[str, int]:
    """
    Get real business statistics from Firestore using count() AGGREGATION
    (not document streaming) and a 5-minute cache. The old implementation
    streamed up to 80,000 documents per call for four gauge values.
    """
    import time as _time

    now = _time.time()
    cached = _business_stats_cache.get("value")
    if cached is not None and _business_stats_cache.get("expires", 0) > now:
        return cached

    stats = {
        "total_users": 0,
        "total_moods": 0,
        "total_memories": 0,
        "total_achievements": 0,
    }

    try:
        stats["total_users"] = _collection_count("users")
        stats["total_moods"] = _collection_count("moods")
        stats["total_memories"] = _collection_count("memories")
        stats["total_achievements"] = _collection_count("achievements")
        _business_stats_cache["value"] = stats
        _business_stats_cache["expires"] = now + _BUSINESS_STATS_TTL
    except Exception as e:
        logger.warning(f"Error fetching business stats: {e}")
        # Serve the last known good value rather than a stream fallback.
        if cached is not None:
            return cached

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
