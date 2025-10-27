from flask import Blueprint, request, jsonify
import logging

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)


@users_bp.route('/<user_id>/notification-settings', methods=['GET'])
def get_notification_settings(user_id):
    # Return a basic default schedule
    return jsonify({
        "morningReminder": "08:00",
        "eveningReminder": "20:00",
        "moodCheckInTime": "12:00",
        "enableMoodReminders": True,
        "enableMeditationReminders": False
    }), 200


@users_bp.route('/<user_id>/notification-preferences', methods=['PUT'])
def update_notification_preferences(user_id):
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Updating notification preferences for {user_id}: {data}")
        return jsonify({"message": "Preferences updated"}), 200
    except Exception as e:
        logger.exception(f"Failed to update notification preferences: {e}")
        return jsonify({"error": "Failed to update preferences"}), 500


@users_bp.route('/<user_id>/notification-schedule', methods=['POST'])
def set_notification_schedule(user_id):
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"Saving notification schedule for {user_id}: {data}")
        return jsonify({"message": "Schedule saved"}), 200
    except Exception as e:
        logger.exception(f"Failed to save notification schedule: {e}")
        return jsonify({"error": "Failed to save schedule"}), 500
