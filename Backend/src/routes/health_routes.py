"""
Health Check & Monitoring Endpoints
Critical for production monitoring and load balancer health checks
"""
from flask import Blueprint, jsonify
from datetime import datetime, timezone
import psutil
import os
from src.firebase_config import db, _firebase_initialized

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Basic health check - always returns 200 if server is running
    Used by load balancers for liveness probe
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'service': 'Lugn & Trygg API'
    }), 200

@health_bp.route('/health/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check - verifies all dependencies are working
    Used by Kubernetes/load balancers for readiness probe
    """
    checks = {
        'server': True,
        'firebase': False,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    
    # Check Firebase connection
    try:
        if _firebase_initialized() and db is not None:
            # Try a simple query to verify connection
            db.collection('_health_check').limit(1).get()
            checks['firebase'] = True
    except Exception as e:
        checks['firebase_error'] = str(e)
    
    # Overall readiness
    is_ready = all([checks['server'], checks['firebase']])
    
    if is_ready:
        return jsonify({
            'status': 'ready',
            'checks': checks
        }), 200
    else:
        return jsonify({
            'status': 'not_ready',
            'checks': checks
        }), 503

@health_bp.route('/health/live', methods=['GET'])
def liveness_check():
    """
    Liveness check - server is alive and can handle requests
    Returns 200 if process is running
    """
    return jsonify({
        'status': 'alive',
        'pid': os.getpid(),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200

@health_bp.route('/metrics', methods=['GET'])
def metrics():
    """
    System metrics endpoint - for monitoring dashboards
    Returns CPU, memory, and process information
    """
    try:
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        return jsonify({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'system': {
                'cpu_percent': psutil.cpu_percent(interval=0.1),
                'cpu_count': psutil.cpu_count(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
            },
            'process': {
                'pid': os.getpid(),
                'memory_rss_mb': memory_info.rss / 1024 / 1024,
                'memory_vms_mb': memory_info.vms / 1024 / 1024,
                'cpu_percent': process.cpu_percent(),
                'num_threads': process.num_threads(),
                'open_files': len(process.open_files()),
            },
            'app': {
                'name': 'Lugn & Trygg Backend',
                'version': '1.0.0',
                'environment': os.getenv('FLASK_ENV', 'development')
            }
        }), 200
    except Exception as e:
        return jsonify({
            'error': 'Failed to collect metrics',
            'message': str(e)
        }), 500

@health_bp.route('/health/db', methods=['GET'])
def database_health():
    """
    Database-specific health check
    Verifies Firestore connectivity and performance
    """
    try:
        start_time = datetime.now(timezone.utc)
        
        # Test read operation
        test_collection = db.collection('_health_check')
        docs = test_collection.limit(1).get()
        
        # Test write operation
        test_doc = test_collection.document('test')
        test_doc.set({
            'last_check': datetime.now(timezone.utc).isoformat(),
            'status': 'ok'
        })
        
        end_time = datetime.now(timezone.utc)
        latency_ms = (end_time - start_time).total_seconds() * 1000
        
        return jsonify({
            'status': 'healthy',
            'database': 'firestore',
            'latency_ms': round(latency_ms, 2),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 503
