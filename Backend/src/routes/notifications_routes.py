import logging
from datetime import UTC, datetime, time

from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import sanitize_text
from src.utils.response_utils import APIResponse

notifications_bp = Blueprint('notifications', __name__)
logger = logging.getLogger(__name__)


@notifications_bp.route('/fcm-token', methods=['OPTIONS'])
@notifications_bp.route('/send-reminder', methods=['OPTIONS'])
@notifications_bp.route('/schedule-daily', methods=['OPTIONS'])
@notifications_bp.route('/disable-all', methods=['OPTIONS'])
@notifications_bp.route('/settings', methods=['OPTIONS'])
def handle_options():
    """Handle CORS preflight requests."""
    return APIResponse.success()


@notifications_bp.route('/fcm-token', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_fcm_token():
    """Save FCM push notification token for user."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        data = request.get_json(silent=True) or {}
        token = data.get('fcmToken')

        if not token:
            return APIResponse.bad_request("FCM token is missing", "MISSING_TOKEN")

        # Sanitize token
        token = sanitize_text(token, max_length=500)

        # Save FCM token to Firestore
        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'fcmToken': token,
            'fcmTokenUpdated': datetime.now(UTC)
        }, merge=True)

        logger.info(f"✅ FCM token saved for user: {user_id[:8]}...")
        audit_log("fcm_token_saved", user_id, {"token_prefix": token[:20] + "..."})

        return APIResponse.success({
            "tokenSaved": True
        }, "Token saved successfully")

    except Exception as e:
        logger.exception(f"❌ Failed to save FCM token: {e}")
        return APIResponse.error("Failed to save token", "SAVE_ERROR", 500)


@notifications_bp.route('/send-reminder', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def send_reminder():
    """Send a push notification reminder to user."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        data = request.get_json(silent=True) or {}
        message = sanitize_text(data.get('message', 'Reminder from Lugn & Trygg'), max_length=500)
        notification_type = sanitize_text(data.get('type', 'daily'), max_length=50)

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Get user's FCM token
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict() or {}
        fcm_token = user_data.get('fcmToken')

        if not fcm_token:
            logger.warning(f"⚠️ No FCM token for user: {user_id[:8]}")
            return APIResponse.success({
                "sent": False,
                "reason": "no_token"
            }, "No FCM token available - user needs to enable notifications")

        # Create notification message
        notification_message = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title="🔔 Lugn & Trygg Reminder",
                body=message
            ),
            data={
                'type': notification_type,
                'userId': user_id,
                'timestamp': str(datetime.now(UTC).timestamp())
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
            'sentAt': datetime.now(UTC),
            'status': 'sent'
        })

        audit_log("notification_sent", user_id, {"type": notification_type})

        return APIResponse.success({
            "sent": True,
            "notificationId": response
        }, "Reminder sent successfully")

    except FirebaseError as e:
        logger.error(f"❌ FCM API error: {e}")
        return APIResponse.error("Failed to send notification via FCM", "FCM_ERROR", 500)
    except Exception as e:
        logger.exception(f"❌ Failed to send reminder: {e}")
        return APIResponse.error("Failed to send reminder", "SEND_ERROR", 500)


@notifications_bp.route('/schedule-daily', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def schedule_daily():
    """Schedule daily reminder notifications."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        data = request.get_json(silent=True) or {}
        enabled = bool(data.get('enabled', True))
        reminder_time = sanitize_text(data.get('time', '09:00'), max_length=10)

        # Validate time format
        try:
            time.fromisoformat(reminder_time)
        except ValueError:
            return APIResponse.bad_request("Invalid time format. Use HH:MM", "INVALID_TIME")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Save notification settings to Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'dailyRemindersEnabled': enabled,
            'reminderTime': reminder_time,
            'notificationSettingsUpdated': datetime.now(UTC)
        }, merge=True)

        status_message = "Daily notifications enabled" if enabled else "Daily notifications disabled"
        logger.info(f"✅ {status_message} for user: {user_id[:8]} at {reminder_time}")
        audit_log("daily_notifications_scheduled", user_id, {"enabled": enabled, "time": reminder_time})

        return APIResponse.success({
            "enabled": enabled,
            "time": reminder_time
        }, status_message)

    except Exception as e:
        logger.exception(f"❌ Failed to schedule daily notifications: {e}")
        return APIResponse.error("Failed to schedule notifications", "SCHEDULE_ERROR", 500)


@notifications_bp.route('/disable-all', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def disable_all():
    """Disable all notifications and remove FCM token."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Disable all notifications and remove FCM token
        user_ref = db.collection('users').document(user_id)
        user_ref.set({
            'dailyRemindersEnabled': False,
            'fcmToken': None,
            'notificationSettingsUpdated': datetime.now(UTC)
        }, merge=True)

        logger.info(f"✅ All notifications disabled for user: {user_id[:8]}")
        audit_log("notifications_disabled", user_id, {})

        return APIResponse.success({
            "allDisabled": True
        }, "All notifications disabled")

    except Exception as e:
        logger.exception(f"❌ Failed to disable notifications: {e}")
        return APIResponse.error("Failed to disable notifications", "DISABLE_ERROR", 500)


@notifications_bp.route('/settings', methods=['GET', 'POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def notification_settings():
    """Get or update notification settings."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        if request.method == 'GET':
            # Get current settings
            if user_doc.exists:
                user_data = user_doc.to_dict() or {}
                settings = {
                    'dailyRemindersEnabled': user_data.get('dailyRemindersEnabled', False),
                    'reminderTime': user_data.get('reminderTime', '09:00'),
                    'hasFcmToken': bool(user_data.get('fcmToken')),
                    'lastReminderSent': user_data.get('lastReminderSent')
                }
            else:
                settings = {
                    'dailyRemindersEnabled': False,
                    'reminderTime': '09:00',
                    'hasFcmToken': False,
                    'lastReminderSent': None
                }

            return APIResponse.success({
                "settings": settings
            }, "Notification settings retrieved")

        elif request.method == 'POST':
            # Update settings
            data = request.get_json(silent=True) or {}
            enabled = data.get('dailyRemindersEnabled')
            reminder_time = data.get('reminderTime')

            update_data: dict = {
                'notificationSettingsUpdated': datetime.now(UTC)
            }

            if enabled is not None:
                update_data['dailyRemindersEnabled'] = bool(enabled)
            if reminder_time:
                reminder_time = sanitize_text(reminder_time, max_length=10)
                # Validate time format
                try:
                    time.fromisoformat(reminder_time)
                    update_data['reminderTime'] = reminder_time
                except ValueError:
                    return APIResponse.bad_request("Invalid time format. Use HH:MM", "INVALID_TIME")

            user_ref.set(update_data, merge=True)

            logger.info(f"✅ Notification settings updated for user: {user_id[:8]}")
            audit_log("notification_settings_updated", user_id, update_data)

            return APIResponse.success({
                "updated": True
            }, "Notification settings updated")

        return APIResponse.bad_request("Invalid method", "INVALID_METHOD")

    except Exception as e:
        logger.exception(f"❌ Failed to handle notification settings: {e}")
        return APIResponse.error("Failed to handle notification settings", "SETTINGS_ERROR", 500)
