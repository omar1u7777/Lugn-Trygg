from flask import Blueprint, request, jsonify, g
import logging
from datetime import datetime, time, timezone
from firebase_admin import messaging
from ..services.auth_service import AuthService
from ..firebase_config import db

notifications_bp = Blueprint('notifications', __name__)
logger = logging.getLogger(__name__)


@notifications_bp.route('/fcm-token', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def save_fcm_token():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get user from JWT token
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        data = request.get_json(silent=True) or {}
        token = data.get('fcmToken')
        if not token:
            return jsonify({"error": "Missing fcmToken"}), 400

        # Save FCM token to Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'fcmToken': token,
            'fcmTokenUpdated': datetime.now(timezone.utc)
        }, merge=True)

        logger.info(f"✅ FCM token saved for user: {user_id[:8]}...")
        return jsonify({
            "message": "Token saved successfully",
            "success": True
        }), 200

    except Exception as e:
        logger.exception(f"❌ Failed to save FCM token: {e}")
        return jsonify({"error": "Failed to save token"}), 500


@notifications_bp.route('/send-reminder', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def send_reminder():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get user from JWT token
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        data = request.get_json(silent=True) or {}
        message = data.get('message', 'Påminnelse från Lugn & Trygg')
        notification_type = data.get('type', 'daily')

        # Get user's FCM token
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404

        user_data = user_doc.to_dict()
        fcm_token = user_data.get('fcmToken')

        if not fcm_token:
            logger.warning(f"⚠️ No FCM token for user: {user_id[:8]}")
            return jsonify({
                "message": "No FCM token available - user needs to enable notifications",
                "success": False
            }), 200

        # Create notification message
        notification_message = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title="🔔 Lugn & Trygg Påminnelse",
                body=message
            ),
            data={
                'type': notification_type,
                'userId': user_id,
                'timestamp': str(datetime.now(timezone.utc).timestamp())
            }
        )

        # Send the message
        response = messaging.send(notification_message)

        # Log successful notification
        logger.info(f"✅ Reminder sent to user {user_id[:8]}: {response}")

        # Store notification history
        notifications_ref = db.collection('notifications').document()
        notifications_ref.set({
            'userId': user_id,
            'type': notification_type,
            'message': message,
            'fcmResponse': response,
            'sentAt': datetime.now(timezone.utc),
            'status': 'sent'
        })

        return jsonify({
            "message": "Reminder sent successfully",
            "notificationId": response,
            "success": True
        }), 200

    except messaging.ApiCallError as e:
        logger.error(f"❌ FCM API error: {e}")
        return jsonify({"error": "Failed to send notification via FCM"}), 500
    except Exception as e:
        logger.exception(f"❌ Failed to send reminder: {e}")
        return jsonify({"error": "Failed to send reminder"}), 500


@notifications_bp.route('/schedule-daily', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def schedule_daily():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get user from JWT token
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        data = request.get_json(silent=True) or {}
        enabled = data.get('enabled', True)
        reminder_time = data.get('time', '09:00')

        # Validate time format
        try:
            time.fromisoformat(reminder_time)
        except ValueError:
            return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

        # Save notification settings to Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'dailyRemindersEnabled': enabled,
            'reminderTime': reminder_time,
            'notificationSettingsUpdated': datetime.now(timezone.utc)
        }, merge=True)

        status_message = "Daily notifications enabled" if enabled else "Daily notifications disabled"
        logger.info(f"✅ {status_message} for user: {user_id[:8]} at {reminder_time}")

        return jsonify({
            "message": status_message,
            "enabled": enabled,
            "time": reminder_time,
            "success": True
        }), 200

    except Exception as e:
        logger.exception(f"❌ Failed to schedule daily notifications: {e}")
        return jsonify({"error": "Failed to schedule notifications"}), 500


@notifications_bp.route('/disable-all', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def disable_all():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get user from JWT token
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        # Disable all notifications and remove FCM token
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'dailyRemindersEnabled': False,
            'fcmToken': None,
            'notificationSettingsUpdated': datetime.now(timezone.utc)
        }, merge=True)

        logger.info(f"✅ All notifications disabled for user: {user_id[:8]}")

        return jsonify({
            "message": "All notifications disabled successfully",
            "success": True
        }), 200

    except Exception as e:
        logger.exception(f"❌ Failed to disable notifications: {e}")
        return jsonify({"error": "Failed to disable notifications"}), 500


@notifications_bp.route('/settings', methods=['GET', 'POST', 'OPTIONS'])
@AuthService.jwt_required
def notification_settings():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get user from JWT token
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        if request.method == 'GET':
            # Get current settings
            if user_doc.exists:
                user_data = user_doc.to_dict()
                settings = {
                    'dailyRemindersEnabled': user_data.get('dailyRemindersEnabled', False),
                    'reminderTime': user_data.get('reminderTime', '09:00'),
                    'fcmToken': bool(user_data.get('fcmToken')),
                    'lastReminderSent': user_data.get('lastReminderSent')
                }
            else:
                settings = {
                    'dailyRemindersEnabled': False,
                    'reminderTime': '09:00',
                    'fcmToken': False,
                    'lastReminderSent': None
                }

            return jsonify({
                "settings": settings,
                "success": True
            }), 200

        elif request.method == 'POST':
            # Update settings
            data = request.get_json(silent=True) or {}
            enabled = data.get('dailyRemindersEnabled')
            reminder_time = data.get('reminderTime')

            update_data = {
                'notificationSettingsUpdated': datetime.now(timezone.utc)
            }

            if enabled is not None:
                update_data['dailyRemindersEnabled'] = enabled
            if reminder_time:
                # Validate time format
                try:
                    time.fromisoformat(reminder_time)
                    update_data['reminderTime'] = reminder_time
                except ValueError:
                    return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

            user_ref.set(update_data, merge=True)

            logger.info(f"✅ Notification settings updated for user: {user_id[:8]}")

            return jsonify({
                "message": "Notification settings updated successfully",
                "success": True
            }), 200

    except Exception as e:
        logger.exception(f"❌ Failed to handle notification settings: {e}")
        return jsonify({"error": "Failed to handle notification settings"}), 500
