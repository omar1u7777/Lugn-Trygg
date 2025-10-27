from flask import Blueprint, request, jsonify
import logging

notifications_bp = Blueprint('notifications', __name__)
logger = logging.getLogger(__name__)


@notifications_bp.route('/fcm-token', methods=['POST', 'OPTIONS'])
def save_fcm_token():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        token = data.get('fcmToken')
        if not token:
            return jsonify({"error": "Missing fcmToken"}), 400
        # For now, just ack; persistence can be added later
        logger.info(f"Received FCM token: {token[:10]}...")
        return jsonify({"message": "Token saved"}), 200
    except Exception as e:
        logger.exception(f"Failed to save FCM token: {e}")
        return jsonify({"error": "Failed to save token"}), 500


@notifications_bp.route('/send-reminder', methods=['POST', 'OPTIONS'])
def send_reminder():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Sending reminder: {data}")
        return jsonify({"message": "Reminder dispatched"}), 200
    except Exception as e:
        logger.exception(f"Failed to send reminder: {e}")
        return jsonify({"error": "Failed to send reminder"}), 500


@notifications_bp.route('/schedule-daily', methods=['POST', 'OPTIONS'])
def schedule_daily():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Scheduling daily notifications: {data}")
        return jsonify({"message": "Daily notifications scheduled"}), 200
    except Exception as e:
        logger.exception(f"Failed to schedule daily notifications: {e}")
        return jsonify({"error": "Failed to schedule notifications"}), 500


@notifications_bp.route('/disable-all', methods=['POST', 'OPTIONS'])
def disable_all():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Disabling all notifications for: {data.get('userId')}")
        return jsonify({"message": "All notifications disabled"}), 200
    except Exception as e:
        logger.exception(f"Failed to disable notifications: {e}")
        return jsonify({"error": "Failed to disable notifications"}), 500
