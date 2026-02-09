"""
Health Check & Monitoring Endpoints
Critical for production monitoring and load balancer health checks
"""
import asyncio
import logging
import os
from datetime import UTC, datetime

import psutil
from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.health_check_service import health_check_service, run_health_checks
from src.services.monitoring_service import get_monitoring_service
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

health_bp = Blueprint('health', __name__)

@health_bp.route('/', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def health_check():
    """
    Basic health check - always returns 200 if server is running
    Used by load balancers for liveness probe
    """
    if request.method == 'OPTIONS':
        return '', 204

    return APIResponse.success(
        data={
            'status': 'healthy',
            'timestamp': datetime.now(UTC).isoformat(),
            'service': 'Lugn & Trygg API'
        },
        message='Health check passed'
    )

@health_bp.route('/ready', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def readiness_check():
    """
    Readiness check - verifies all dependencies are working
    Used by Kubernetes/load balancers for readiness probe
    """
    if request.method == 'OPTIONS':
        return '', 204

    checks = {
        'server': True,
        'firebase': False,
        'timestamp': datetime.now(UTC).isoformat()
    }

    # Check Firebase connection
    try:
        if db is not None:
            # Try a simple query to verify connection
            db.collection('_health_check').limit(1).get()
            checks['firebase'] = True
    except Exception as e:
        checks['firebaseError'] = str(e)

    # Overall readiness
    is_ready = all([checks['server'], checks['firebase']])

    if is_ready:
        return APIResponse.success(
            data={'status': 'ready', 'checks': checks},
            message='All systems ready'
        )
    else:
        return APIResponse.error(
            message='System not ready',
            error_code='NOT_READY',
            status_code=503,
            details={'status': 'notReady', 'checks': checks}
        )

@health_bp.route('/live', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def liveness_check():
    """
    Liveness check - server is alive and can handle requests
    Returns 200 if process is running
    """
    if request.method == 'OPTIONS':
        return '', 204

    return APIResponse.success(
        data={
            'status': 'alive',
            'pid': os.getpid(),
            'timestamp': datetime.now(UTC).isoformat()
        },
        message='Server is alive'
    )

@health_bp.route('/metrics', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def metrics():
    """
    System metrics endpoint - for monitoring dashboards
    Returns CPU, memory, and process information
    REQUIRES AUTHENTICATION - exposes sensitive system information
    """
    if request.method == 'OPTIONS':
        return '', 204

    # Check if user is admin (metrics should only be accessible to admins)
    user_id = g.user_id
    try:
        user_doc = db.collection("users").document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get("role") == "admin" or user_data.get("is_admin", False)
            if not is_admin:
                logger.warning(f"Non-admin user {user_id} attempted to access /metrics")
                return APIResponse.forbidden('Admin access required')
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return APIResponse.error('Authorization check failed')

    try:
        # Use monitoring_service if available, fallback to direct psutil
        monitoring_service = get_monitoring_service()

        if monitoring_service:
            # Get comprehensive metrics from monitoring service
            system_metrics = monitoring_service.get_system_metrics()
            app_metrics = monitoring_service.get_application_metrics()

            return APIResponse.success(
                data={
                    'timestamp': system_metrics.timestamp.isoformat(),
                    'system': {
                        'cpuPercent': system_metrics.cpu_usage,
                        'cpuCount': psutil.cpu_count(),
                        'memoryPercent': system_metrics.memory_usage,
                        'diskPercent': system_metrics.disk_usage,
                    },
                    'process': {
                        'pid': os.getpid(),
                        'memoryRssMb': psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024,
                        'memoryVmsMb': psutil.Process(os.getpid()).memory_info().vms / 1024 / 1024,
                        'cpuPercent': psutil.Process(os.getpid()).cpu_percent(),
                        'numThreads': psutil.Process(os.getpid()).num_threads(),
                        'openFiles': len(psutil.Process(os.getpid()).open_files()),
                    },
                    'app': {
                        'name': 'Lugn & Trygg Backend',
                        'version': '1.0.0',
                        'environment': os.getenv('FLASK_ENV', 'development')
                    },
                    'application': {
                        'activeUsers': app_metrics.active_users,
                        'totalRequests': app_metrics.total_requests,
                        'errorRate': app_metrics.error_rate,
                        'avgResponseTime': app_metrics.avg_response_time,
                        'databaseConnections': app_metrics.database_connections,
                        'cacheHitRate': app_metrics.cache_hit_rate
                    }
                },
                message='System metrics retrieved from monitoring service'
            )
        else:
            # Fallback to direct psutil if monitoring service not initialized
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()

            return APIResponse.success(
                data={
                    'timestamp': datetime.now(UTC).isoformat(),
                    'system': {
                        'cpuPercent': psutil.cpu_percent(interval=0.1),
                        'cpuCount': psutil.cpu_count(),
                        'memoryPercent': psutil.virtual_memory().percent,
                        'diskPercent': psutil.disk_usage('/').percent,
                    },
                    'process': {
                        'pid': os.getpid(),
                        'memoryRssMb': memory_info.rss / 1024 / 1024,
                        'memoryVmsMb': memory_info.vms / 1024 / 1024,
                        'cpuPercent': process.cpu_percent(),
                        'numThreads': process.num_threads(),
                        'openFiles': len(process.open_files()),
                    },
                    'app': {
                        'name': 'Lugn & Trygg Backend',
                        'version': '1.0.0',
                        'environment': os.getenv('FLASK_ENV', 'development')
                    }
                },
                message='System metrics retrieved (monitoring service not initialized)'
            )
    except Exception as e:
        return APIResponse.error(
            message='Failed to collect metrics',
            error_code='METRICS_ERROR',
            details={'error': str(e)}
        )

@health_bp.route('/db', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def database_health():
    """
    Database-specific health check
    Verifies Firestore connectivity and performance
    REQUIRES AUTHENTICATION - performs write operations
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        start_time = datetime.now(UTC)

        # Test read operation
        test_collection = db.collection('_health_check')
        test_collection.limit(1).get()

        # Test write operation
        test_doc = test_collection.document('test')
        test_doc.set({
            'last_check': datetime.now(UTC).isoformat(),
            'status': 'ok'
        })

        end_time = datetime.now(UTC)
        latency_ms = (end_time - start_time).total_seconds() * 1000

        return APIResponse.success(
            data={
                'status': 'healthy',
                'database': 'firestore',
                'latencyMs': round(latency_ms, 2),
                'timestamp': datetime.now(UTC).isoformat()
            },
            message='Database is healthy'
        )

    except Exception as e:
        return APIResponse.error(
            message='Database health check failed',
            error_code='DB_UNHEALTHY',
            status_code=503,
            details={
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now(UTC).isoformat()
            }
        )

@health_bp.route('/advanced', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def advanced_health_check():
    """
    Advanced comprehensive health check using health_check_service
    Returns detailed system analysis, trends, and recommendations
    REQUIRES AUTHENTICATION - exposes detailed system information
    """
    if request.method == 'OPTIONS':
        return '', 204

    # Check if user is admin
    user_id = g.user_id
    try:
        user_doc = db.collection("users").document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get("role") == "admin" or user_data.get("is_admin", False)
            if not is_admin:
                logger.warning(f"Non-admin user {user_id} attempted to access /health/advanced")
                return APIResponse.forbidden('Admin access required')
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return APIResponse.error('Authorization check failed')

    try:
        # Register Firebase health check
        def check_firebase():
            try:
                db.collection('_health_check').limit(1).get()
                return {'connectivity': True, 'status': 'connected'}
            except Exception as e:
                return {'connectivity': False, 'error': str(e)}

        health_check_service.register_database_check(check_firebase)

        # Run comprehensive health checks (async)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            report = loop.run_until_complete(run_health_checks())
        finally:
            loop.close()

        return APIResponse.success(
            data=report,
            message='Advanced health check completed'
        )
    except Exception as e:
        logger.error(f"Advanced health check failed: {e}")
        return APIResponse.error(
            message='Advanced health check failed',
            error_code='HEALTH_CHECK_ERROR',
            details={'error': str(e)}
        )
