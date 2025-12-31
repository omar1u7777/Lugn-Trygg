from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timezone
from src.services.auth_service import AuthService
from src.utils.offline_service import offline_sync_service

sync_bp = Blueprint('sync', __name__)
logger = logging.getLogger(__name__)


@sync_bp.route('/status', methods=['GET', 'OPTIONS'])
def sync_status():
    # Allow CORS preflight without auth
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Require auth for actual GET
        # Use decorator to enforce auth without applying it to OPTIONS
        @AuthService.jwt_required
        def _handle():
            user_id = request.args.get('user_id') or getattr(request, 'user_id', None)
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            # Compute simple status from in-memory queue
            user_items = [item for item in offline_sync_service.sync_queue if item.get('user_id') == user_id]
            status = {
                "pending_count": len(user_items),
                "synced_count": 0,  # We don't persist history here; will be returned on /now
                "failed_count": 0,
                "last_sync": None
            }
            return jsonify(status), 200

        return _handle()
    except Exception as e:
        logger.exception(f"Failed to get sync status: {e}")
        return jsonify({"error": "Failed to get sync status"}), 500


@sync_bp.route('/now', methods=['POST', 'OPTIONS'])
def sync_now():
    # Allow CORS preflight without auth
    if request.method == 'OPTIONS':
        return '', 204
    try:
        @AuthService.jwt_required
        def _handle():
            data = request.get_json(silent=True) or {}
            user_id = data.get('user_id') or getattr(request, 'user_id', None)
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            result = offline_sync_service.sync_pending_data(user_id)

            # Normalize response shape to match frontend expectations
            response = {
                "pending_count": 0,
                "synced_count": result.get('synced_count', 0),
                "failed_count": result.get('failed_count', 0),
                "last_sync": result.get('timestamp')
            }
            return jsonify(response), 200

        return _handle()
    except Exception as e:
        logger.exception(f"Failed to perform sync: {e}")
        return jsonify({"error": "Failed to perform sync"}), 500


@sync_bp.route('/health', methods=['POST', 'OPTIONS'])
def sync_health_metrics():
    """Accept lightweight health metrics payloads used by integration tests."""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        @AuthService.jwt_required
        def _handle():
            data = request.get_json(silent=True) or {}
            user_id = data.get('user_id') or getattr(request, 'user_id', None)
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            metrics = {
                "user_id": user_id,
                "steps": data.get('steps', 0),
                "heart_rate": data.get('heart_rate'),
                "sleep_hours": data.get('sleep_hours'),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }

            offline_sync_service.queue_for_sync(user_id, 'health_metrics', metrics, operation='create')

            return jsonify({
                "status": "queued",
                "metrics": metrics,
                "queue_size": len(offline_sync_service.sync_queue)
            }), 200

        return _handle()
    except Exception as e:
        logger.exception(f"Failed to sync health metrics: {e}")
        return jsonify({"error": "Failed to sync health metrics"}), 500
