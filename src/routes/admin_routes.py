from flask import Blueprint, jsonify, request
import logging
from src.utils.performance_monitor import performance_monitor

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)


@admin_bp.route('/performance-metrics', methods=['GET', 'OPTIONS'])
def get_performance_metrics():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        metrics = performance_monitor.get_metrics() if hasattr(performance_monitor, 'get_metrics') else {
            "endpoints": {},
            "total_requests": 0,
            "error_counts": {},
            "slow_requests_count": 0
        }
        return jsonify(metrics), 200
    except Exception as e:
        logger.exception(f"Failed to get performance metrics: {e}")
        return jsonify({"error": "Failed to get performance metrics"}), 500
