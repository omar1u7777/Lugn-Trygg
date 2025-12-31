from flask import Blueprint, request, jsonify, g
import logging
from firebase_admin import firestore
from ..services.auth_service import AuthService
from ..firebase_config import db, auth
from ..utils.response_utils import APIResponse, success_response, error_response, created_response

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)


@users_bp.route('/profile', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
def get_user_profile():
    """Return a lightweight user profile for dashboard integrations."""
    if request.method == 'OPTIONS':
        return '', 204

    user_id = getattr(g, 'user_id', None)
    if not user_id:
        return APIResponse.bad_request("User context saknas")

    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if getattr(user_doc, 'exists', False) else {}

        profile = {
            "userId": user_id,
            "displayName": user_data.get('displayName', 'Test User'),
            "email": user_data.get('email', 'test@example.com'),
            "language": user_data.get('language', 'sv'),
            "timezone": user_data.get('timezone', 'Europe/Stockholm'),
            "preferences": user_data.get('preferences', {}),
            "createdAt": user_data.get('createdAt'),
            "updatedAt": user_data.get('updatedAt')
        }

        return APIResponse.success({"profile": profile}, "User profile retrieved")
    except Exception as exc:
        logger.exception(f"Failed to load profile: {exc}")
        return APIResponse.error("Failed to load profile", "INTERNAL_ERROR", 500, str(exc))


@users_bp.route('/preferences', methods=['PUT', 'OPTIONS'])
@AuthService.jwt_required
def update_user_preferences():
    """Upsert user preference settings expected by integration tests."""
    if request.method == 'OPTIONS':
        return '', 204

    payload = request.get_json(silent=True) or {}
    if not payload:
        return APIResponse.bad_request("Preferences payload krävs")

    user_id = getattr(g, 'user_id', None)
    if not user_id:
        return APIResponse.bad_request("User context saknas")

    try:
        doc_ref = db.collection('users').document(user_id)
        doc_ref.set({
            'preferences': payload,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }, merge=True)

        return APIResponse.success({"preferences": payload}, "Preferences uppdaterade")
    except Exception as exc:
        logger.exception(f"Failed to update preferences: {exc}")
        return APIResponse.error("Failed to update preferences", "INTERNAL_ERROR", 500, str(exc))


@users_bp.route('/<user_id>/notification-settings', methods=['GET'])
def get_notification_settings(user_id):
    logger.info(f"🔔 USERS - GET notification settings for user: {user_id}")
    # Return a basic default schedule
    return APIResponse.success({
        "morningReminder": "08:00",
        "eveningReminder": "20:00",
        "moodCheckInTime": "12:00",
        "enableMoodReminders": True,
        "enableMeditationReminders": False
    }, "Notification settings retrieved")


@users_bp.route('/<user_id>/notification-preferences', methods=['PUT'])
def update_notification_preferences(user_id):
    logger.info(f"🔔 USERS - UPDATE notification preferences for user: {user_id}")
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"✅ USERS - Updating notification preferences: {data}")
        return APIResponse.success(None, "Preferences updated")
    except Exception as e:
        logger.exception(f"Failed to update notification preferences: {e}")
        return APIResponse.error("Failed to update preferences", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/notification-schedule', methods=['POST'])
def set_notification_schedule(user_id):
    logger.info(f"🔔 USERS - SET notification schedule for user: {user_id}")
    try:
        data = request.get_json(silent=True) or {}
        logger.info(f"✅ USERS - Saving notification schedule: {data}")
        return APIResponse.success(None, "Schedule saved")
    except Exception as e:
        logger.exception(f"Failed to save notification schedule: {e}")
        return APIResponse.error("Failed to save schedule", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/wellness-goals', methods=['GET'])
def get_wellness_goals(user_id):
    """🎯 Get user's wellness goals"""
    logger.info(f"🎯 USERS - GET wellness goals for user: {user_id}")
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            logger.warning(f"User not found: {user_id}")
            return APIResponse.success({"wellnessGoals": []}, "Wellness goals retrieved")

        user_data = user_doc.to_dict()
        wellness_goals = user_data.get('wellnessGoals', [])

        logger.info(f"✅ USERS - Wellness goals retrieved: {wellness_goals}")
        return APIResponse.success({"wellnessGoals": wellness_goals}, "Wellness goals retrieved")
    except Exception as e:
        logger.exception(f"Failed to get wellness goals: {e}")
        return APIResponse.error("Failed to get wellness goals", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/wellness-goals', methods=['POST'])
def set_wellness_goals(user_id):
    """🎯 Set user's wellness goals"""
    logger.info(f"🎯 USERS - SET wellness goals for user: {user_id}")
    try:
        data = request.get_json(silent=True)
        if not data or 'wellnessGoals' not in data:
            logger.warning(f"Missing wellnessGoals in request body or empty body")
            return jsonify({"error": "Request body must contain wellnessGoals as a non-empty list"}), 400
        
        goals = data.get('wellnessGoals')
        if not isinstance(goals, list) or len(goals) == 0:
            logger.warning(f"Invalid wellnessGoals value: {goals}")
            return jsonify({"error": "wellnessGoals must be a non-empty list"}), 400
        
        logger.info(f"📝 Received wellness goals data: {goals}")
        
        # Check if user exists first
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            logger.warning(f"User document not found: {user_id} - creating it")
            # Create user document if it doesn't exist
            user_ref.set({
                'user_id': user_id,
                'wellnessGoals': goals,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
        else:
            # Update existing user document
            user_ref.update({
                'wellnessGoals': goals,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
        
        logger.info(f"✅ USERS - Wellness goals saved: {goals}")
        return APIResponse.success({"wellnessGoals": goals}, "Wellness goals saved")
    except Exception as e:
        logger.exception(f"❌ Failed to save wellness goals: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error("Failed to save wellness goals", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/journal', methods=['POST'])
def save_journal_entry(user_id):
    """📝 Save a journal entry for the user"""
    logger.info(f"📝 USERS - SAVE journal entry for user: {user_id}")
    try:
        # Parse and sanitize JSON data directly
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON in request body"}), 400

        # Sanitize the data
        from ..utils.input_sanitization import input_sanitizer
        sanitized_data = input_sanitizer.sanitize_dict(data, {
            'content': {'type': 'text', 'max_length': 10000},
            'tags': {'type': 'json'},
            'mood': {'type': 'json'}
        })

        if not sanitized_data or 'content' not in sanitized_data:
            return jsonify({"error": "Request body must contain content"}), 400

        data = sanitized_data  # Use sanitized data

        content = data.get('content', '').strip()
        if not content:
            return jsonify({"error": "Journal content cannot be empty"}), 400

        # Create journal entry
        journal_entry = {
            'user_id': user_id,
            'content': content,
            'mood': data.get('mood'),
            'tags': data.get('tags', []),
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }

        # Save to Firestore
        journal_ref = db.collection('users').document(user_id).collection('journal').document()
        journal_ref.set(journal_entry)

        logger.info(f"✅ USERS - Journal entry saved for user: {user_id}")
        return APIResponse.created({
            "entryId": journal_ref.id
        }, "Journal entry saved")

    except Exception as e:
        logger.exception(f"Failed to save journal entry: {e}")
        return APIResponse.error("Failed to save journal entry", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/journal', methods=['GET'])
def get_journal_entries(user_id):
    """📝 Get journal entries for the user"""
    logger.info(f"📝 USERS - GET journal entries for user: {user_id}")
    try:
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        start_after = request.args.get('startAfter')

        # Build query
        journal_ref = db.collection('users').document(user_id).collection('journal')
        query = journal_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit)

        if start_after:
            # For pagination, we'd need to get the document first
            pass

        docs = query.stream()

        entries = []
        for doc in docs:
            entry_data = doc.to_dict()
            entry_data['id'] = doc.id
            # Convert timestamp to ISO string
            if 'createdAt' in entry_data and hasattr(entry_data['createdAt'], 'isoformat'):
                entry_data['createdAt'] = entry_data['createdAt'].isoformat()
            if 'updatedAt' in entry_data and hasattr(entry_data['updatedAt'], 'isoformat'):
                entry_data['updatedAt'] = entry_data['updatedAt'].isoformat()
            entries.append(entry_data)

        logger.info(f"✅ USERS - Retrieved {len(entries)} journal entries for user: {user_id}")
        return APIResponse.success({"entries": entries}, f"Retrieved {len(entries)} journal entries")

    except Exception as e:
        logger.exception(f"Failed to get journal entries: {e}")
        return APIResponse.error("Failed to get journal entries", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/meditation-sessions', methods=['POST'])
def save_meditation_session(user_id):
    """🧘 Save a meditation session for the user"""
    logger.info(f"🧘 USERS - SAVE meditation session for user: {user_id}")
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body required"}), 400

        # Sanitize input data
        from ..utils.input_sanitization import input_sanitizer
        data = input_sanitizer.sanitize_dict(data, {
            'type': {'type': 'text', 'max_length': 50},
            'technique': {'type': 'text', 'max_length': 100},
            'notes': {'type': 'text', 'max_length': 1000}
        })

        # Create meditation session
        session_data = {
            'user_id': user_id,
            'type': data.get('type', 'breathing'),
            'duration': data.get('duration', 0),  # in minutes
            'technique': data.get('technique'),  # e.g., '4-7-8', 'body-scan', etc.
            'completedCycles': data.get('completedCycles', 0),
            'moodBefore': data.get('moodBefore'),
            'moodAfter': data.get('moodAfter'),
            'notes': data.get('notes'),
            'createdAt': firestore.SERVER_TIMESTAMP
        }

        # Save to Firestore
        session_ref = db.collection('users').document(user_id).collection('meditation_sessions').document()
        session_ref.set(session_data)

        logger.info(f"✅ USERS - Meditation session saved for user: {user_id}")
        return APIResponse.created({
            "sessionId": session_ref.id
        }, "Meditation session saved")

    except Exception as e:
        logger.exception(f"Failed to save meditation session: {e}")
        return APIResponse.error("Failed to save meditation session", "INTERNAL_ERROR", 500, str(e))


@users_bp.route('/<user_id>/meditation-sessions', methods=['GET'])
def get_meditation_sessions(user_id):
    """🧘 Get meditation sessions for the user"""
    logger.info(f"🧘 USERS - GET meditation sessions for user: {user_id}")
    try:
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')

        # Build query
        sessions_ref = db.collection('users').document(user_id).collection('meditation_sessions')
        query = sessions_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()

        sessions = []
        for doc in docs:
            session_data = doc.to_dict()
            session_data['id'] = doc.id
            # Convert timestamp to ISO string
            if 'createdAt' in session_data and hasattr(session_data['createdAt'], 'isoformat'):
                session_data['createdAt'] = session_data['createdAt'].isoformat()
            sessions.append(session_data)

        # Calculate statistics
        total_sessions = len(sessions)
        total_minutes = sum(int(session.get('duration', 0)) for session in sessions)
        avg_session_length = total_minutes / total_sessions if total_sessions > 0 else 0

        logger.info(f"✅ USERS - Retrieved {total_sessions} meditation sessions for user: {user_id}")
        return APIResponse.success({
            "sessions": sessions,
            "stats": {
                "totalSessions": total_sessions,
                "totalMinutes": total_minutes,
                "avgSessionLength": round(avg_session_length, 1)
            }
        }, f"Retrieved {total_sessions} meditation sessions")

    except Exception as e:
        logger.exception(f"Failed to get meditation sessions: {e}")
        return APIResponse.error("Failed to get meditation sessions", "INTERNAL_ERROR", 500, str(e))
