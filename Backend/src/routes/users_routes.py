import logging
from datetime import UTC, datetime

from firebase_admin import firestore
from flask import Blueprint, g, request

from ..firebase_config import db
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse
from ..utils.wellness_goals import extract_and_validate_wellness_goals

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)

# Get SERVER_TIMESTAMP from firestore
SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP  # type: ignore


# ============================================================================
# OPTIONS Handlers (CORS Preflight)
# ============================================================================

















# ============================================================================
# User Stats (Aggregated)
# ============================================================================

@users_bp.route('/stats', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_stats():
    """Get aggregated user statistics for profile display."""
    if request.method == 'OPTIONS':
        from flask import Response
        return Response('', status=204)

    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        if db is None:
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Count moods
        try:
            moods_ref = db.collection('users').document(user_id).collection('moods')
            total_moods = moods_ref.count().get()[0][0].value
        except Exception:
            total_moods = 0

        # Count conversations
        try:
            convos_ref = db.collection('users').document(user_id).collection('conversations')
            total_conversations = convos_ref.count().get()[0][0].value
        except Exception:
            total_conversations = 0

        # Count memories
        try:
            memories_ref = db.collection('users').document(user_id).collection('memories')
            total_memories = memories_ref.count().get()[0][0].value
        except Exception:
            total_memories = 0

        # Get user document for account age and last active
        account_age = 0
        last_active_at = None
        try:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict() or {}
                created_at = user_data.get('createdAt') or user_data.get('created_at')
                if created_at:
                    if hasattr(created_at, 'timestamp'):
                        account_age = max(1, int((datetime.now(UTC).timestamp() - created_at.timestamp()) / 86400))
                    elif isinstance(created_at, str):
                        try:
                            parsed = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            account_age = max(1, int((datetime.now(UTC) - parsed).total_seconds() / 86400))
                        except (ValueError, TypeError):
                            pass
                last_active = user_data.get('lastActiveAt') or user_data.get('last_active_at')
                if last_active:
                    if hasattr(last_active, 'isoformat'):
                        last_active_at = last_active.isoformat()
                    elif isinstance(last_active, str):
                        last_active_at = last_active
        except Exception:
            pass

        stats_data = {
            'totalMoods': total_moods,
            'totalConversations': total_conversations,
            'totalMemories': total_memories,
            'accountAge': account_age,
            'lastActiveAt': last_active_at,
            'streakDays': 0,
        }

        return APIResponse.success(data=stats_data, message='User stats retrieved')

    except Exception as e:
        logger.exception(f"Failed to get user stats: {e}")
        return APIResponse.error("Failed to get user statistics", "INTERNAL_ERROR", 500)


# ============================================================================
# User Profile & Preferences
# ============================================================================

@users_bp.route('/profile', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_profile():
    """Return a lightweight user profile for dashboard integrations."""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if getattr(user_doc, 'exists', False) else {}

        email = user_data.get('email', '')
        profile = {
            "userId": user_id,
            "displayName": user_data.get('displayName') or user_data.get('name') or (email.split('@')[0] if email else 'Användare'),
            "email": email,
            "language": user_data.get('language', 'sv'),
            "timezone": user_data.get('timezone', 'Europe/Stockholm'),
            "preferences": user_data.get('preferences', {}),
            "createdAt": user_data.get('createdAt'),
            "updatedAt": user_data.get('updatedAt')
        }

        audit_log(
            event_type="USER_PROFILE_VIEWED",
            user_id=user_id,
            details={"profile_requested": True}
        )

        return APIResponse.success({"profile": profile}, "User profile retrieved")
    except Exception as exc:
        logger.exception(f"Failed to load profile: {exc}")
        return APIResponse.error("Failed to load profile", "INTERNAL_ERROR", 500)


@users_bp.route('/preferences', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_user_preferences():
    """Upsert user preference settings expected by integration tests."""
    payload = request.get_json(silent=True) or {}
    if not payload:
        return APIResponse.bad_request("Preferences payload required")

    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        doc_ref = db.collection('users').document(user_id)  # type: ignore
        doc_ref.set({
            'preferences': payload,
            'updatedAt': SERVER_TIMESTAMP
        }, merge=True)

        audit_log(
            event_type="USER_PREFERENCES_UPDATED",
            user_id=user_id,
            details={"preferences_keys": list(payload.keys())}
        )

        return APIResponse.success({"preferences": payload}, "Preferences updated")
    except Exception as exc:
        logger.exception(f"Failed to update preferences: {exc}")
        return APIResponse.error("Failed to update preferences", "INTERNAL_ERROR", 500)


# ============================================================================
# Notification Settings
# ============================================================================

@users_bp.route('/notification-settings', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_notification_settings():
    """Get notification settings for user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🔔 USERS - GET notification settings for user: {user_id}")

    try:
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()

        defaults = {
            "morningReminder": "08:00",
            "eveningReminder": "20:00",
            "moodCheckInTime": "12:00",
            "enableMoodReminders": True,
            "enableMeditationReminders": False
        }

        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            settings = user_data.get('notification_settings', defaults)
            return APIResponse.success(settings, "Notification settings retrieved")

        return APIResponse.success(defaults, "Notification settings retrieved")
    except Exception as e:
        logger.exception(f"Failed to get notification settings: {e}")
        return APIResponse.error("Failed to get settings", "INTERNAL_ERROR", 500)


@users_bp.route('/notification-preferences', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_notification_preferences():
    """Update notification preferences for user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🔔 USERS - UPDATE notification preferences for user: {user_id}")

    try:
        raw = request.get_json(silent=True) or {}
        # Allowlist: only accept known preference keys with expected types
        allowed_keys = {
            'morningReminder', 'eveningReminder', 'moodCheckInTime',
            'enableMoodReminders', 'enableMeditationReminders',
            'pushEnabled', 'emailEnabled', 'reminderTime'
        }
        data = {k: v for k, v in raw.items() if k in allowed_keys}
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_ref.set({'notification_preferences': data, 'updatedAt': SERVER_TIMESTAMP}, merge=True)
        logger.info("✅ USERS - Notification preferences saved to Firestore")
        return APIResponse.success(data, "Preferences updated")
    except Exception as e:
        logger.exception(f"Failed to update notification preferences: {e}")
        return APIResponse.error("Failed to update preferences", "INTERNAL_ERROR", 500)


@users_bp.route('/notification-schedule', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def set_notification_schedule():
    """Set notification schedule for user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🔔 USERS - SET notification schedule for user: {user_id}")

    try:
        raw = request.get_json(silent=True) or {}
        # Allowlist: only accept known schedule keys with expected types
        allowed_keys = {
            'morningReminder', 'eveningReminder', 'moodCheckInTime',
            'enableMoodReminders', 'enableMeditationReminders',
            'pushEnabled', 'emailEnabled', 'reminderTime'
        }
        data = {k: v for k, v in raw.items() if k in allowed_keys}
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_ref.set({'notification_settings': data, 'updatedAt': SERVER_TIMESTAMP}, merge=True)
        logger.info("✅ USERS - Notification schedule saved to Firestore")
        return APIResponse.success(data, "Schedule saved")
    except Exception as e:
        logger.exception(f"Failed to save notification schedule: {e}")
        return APIResponse.error("Failed to save schedule", "INTERNAL_ERROR", 500)


# ============================================================================
# Wellness Goals
# ============================================================================

@users_bp.route('/wellness-goals', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_wellness_goals():
    """🎯 Get user's wellness goals with step completions"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🎯 USERS - GET wellness goals for user: {user_id}")

    try:
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()

        if not user_doc.exists:
            logger.warning(f"User not found: {user_id}")
            return APIResponse.success({"wellnessGoals": [], "goalStepCompletions": {}}, "Wellness goals retrieved")

        user_data = user_doc.to_dict()
        wellness_goals = user_data.get('wellnessGoals', [])
        goal_step_completions = user_data.get('goalStepCompletions', {})

        audit_log(
            event_type="WELLNESS_GOALS_RETRIEVED",
            user_id=user_id,
            details={"goals_count": len(wellness_goals)}
        )

        logger.info(f"✅ USERS - Wellness goals retrieved: {wellness_goals}")
        return APIResponse.success(
            {"wellnessGoals": wellness_goals, "goalStepCompletions": goal_step_completions},
            "Wellness goals retrieved"
        )
    except Exception as e:
        logger.exception(f"Failed to get wellness goals: {e}")
        return APIResponse.error("Failed to get wellness goals", "INTERNAL_ERROR", 500)


@users_bp.route('/wellness-goals', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def set_wellness_goals():
    """🎯 Set user's wellness goals"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🎯 USERS - SET wellness goals for user: {user_id}")

    try:
        data = request.get_json(silent=True)
        try:
            goals = extract_and_validate_wellness_goals(data, field_name='wellnessGoals')
        except ValueError as validation_error:
            logger.warning(f"Invalid wellnessGoals payload: {validation_error}")
            return APIResponse.bad_request(str(validation_error))

        logger.info(f"📝 Received wellness goals data: {goals}")

        # Check if user exists first
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()

        if not user_doc.exists:
            logger.warning(f"User document not found: {user_id} - creating it")
            # Create user document if it doesn't exist
            user_ref.set({
                'user_id': user_id,
                'wellnessGoals': goals,
                'goalStepCompletions': {},  # Track completed steps per goal
                'createdAt': SERVER_TIMESTAMP,
                'updatedAt': SERVER_TIMESTAMP
            })
        else:
            # Update existing user document
            user_ref.update({
                'wellnessGoals': goals,
                'updatedAt': SERVER_TIMESTAMP
            })

        audit_log(
            event_type="WELLNESS_GOALS_SET",
            user_id=user_id,
            details={"goals": goals, "goals_count": len(goals)}
        )

        logger.info(f"✅ USERS - Wellness goals saved: {goals}")
        return APIResponse.success({"wellnessGoals": goals}, "Wellness goals saved")
    except Exception as e:
        logger.exception(f"❌ Failed to save wellness goals: {e}")
        return APIResponse.error("Failed to save wellness goals", "INTERNAL_ERROR", 500)


@users_bp.route('/wellness-goals/steps', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def complete_goal_step():
    """🎯 Mark a goal step as completed"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🎯 USERS - Complete goal step for user: {user_id}")

    try:
        data = request.get_json(silent=True)
        if not data:
            return APIResponse.bad_request("Invalid JSON")

        goal_id = data.get('goalId')
        step_text = data.get('stepText')
        completed = data.get('completed', True)

        if not goal_id or not step_text:
            return APIResponse.bad_request("goalId and stepText are required")

        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()

        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict()
        goal_step_completions = user_data.get('goalStepCompletions', {})

        # Initialize goal completion tracking if not exists
        if goal_id not in goal_step_completions:
            goal_step_completions[goal_id] = {}

        # Mark step as completed or uncompleted
        if completed:
            goal_step_completions[goal_id][step_text] = {
                'completedAt': datetime.now(UTC).isoformat()
            }
        else:
            goal_step_completions[goal_id].pop(step_text, None)

        user_ref.update({
            'goalStepCompletions': goal_step_completions,
            'updatedAt': SERVER_TIMESTAMP
        })

        logger.info(f"✅ Goal step completion updated: {goal_id} - {step_text}")
        return APIResponse.success(
            {"goalStepCompletions": goal_step_completions},
            "Goal step completion updated"
        )
    except Exception as e:
        logger.exception(f"❌ Failed to update goal step completion: {e}")
        return APIResponse.error("Failed to update goal step completion", "INTERNAL_ERROR", 500)


# ============================================================================
# Journal Entries
# ============================================================================

@users_bp.route('/journal', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_journal_entry():
    """📝 Save a journal entry for the user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"📝 USERS - SAVE journal entry for user: {user_id}")

    try:
        # Parse JSON data
        data = request.get_json(silent=True)
        if not data:
            return APIResponse.bad_request("Invalid JSON in request body")

        # Sanitize content
        content = data.get('content', '').strip()
        sanitized_content = sanitize_text(content, max_length=10000)
        if not sanitized_content:
            return APIResponse.bad_request("Journal content cannot be empty")

        # Create journal entry — field names must match journal_routes.py (snake_case)
        now = datetime.now(UTC)
        journal_entry = {
            'user_id': user_id,
            'content': sanitized_content,
            'mood': data.get('mood'),
            'tags': data.get('tags', []),
            'created_at': now,
            'updated_at': now
        }

        # Save to Firestore — use top-level journal_entries collection (consistent with journal_routes.py reads)
        journal_ref = db.collection('journal_entries').document()  # type: ignore
        journal_ref.set(journal_entry)

        audit_log(
            event_type="JOURNAL_ENTRY_SAVED",
            user_id=user_id,
            details={"entry_id": journal_ref.id, "content_length": len(sanitized_content)}
        )

        logger.info(f"✅ USERS - Journal entry saved for user: {user_id}")

        # AUTO-AWARD XP for journal entry
        try:
            from ..services.rewards_helper import award_xp
            award_xp(user_id, 'journal_entry')
        except Exception as xp_err:
            logger.warning(f"XP award failed (non-blocking): {xp_err}")

        return APIResponse.created({
            "entryId": journal_ref.id
        }, "Journal entry saved")

    except Exception as e:
        logger.exception(f"Failed to save journal entry: {e}")
        return APIResponse.error("Failed to save journal entry", "INTERNAL_ERROR", 500)


@users_bp.route('/journal', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_journal_entries():
    """📝 Get journal entries for the user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"📝 USERS - GET journal entries for user: {user_id}")

    try:
        # Get query parameters
        try:
            limit = min(int(request.args.get('limit', 50)), 100)
            if limit < 1:
                limit = 50
        except (ValueError, TypeError):
            limit = 50

        def _fmt(ts) -> str | None:
            if ts is None:
                return None
            if hasattr(ts, 'isoformat'):
                return ts.isoformat()
            if isinstance(ts, str):
                return ts
            return str(ts)

        # Read from journal_entries (consistent with journal_routes.py and the POST endpoint)
        entries = []
        try:
            try:
                from google.cloud.firestore import FieldFilter
                query = db.collection('journal_entries').where(  # type: ignore
                    filter=FieldFilter('user_id', '==', user_id)
                ).order_by('created_at', direction=firestore.Query.DESCENDING).limit(limit)
            except ImportError:
                query = db.collection('journal_entries').where(  # type: ignore
                    'user_id', '==', user_id
                ).order_by('created_at', direction=firestore.Query.DESCENDING).limit(limit)

            for doc in query.stream():
                d = doc.to_dict() or {}
                entries.append({
                    'id': doc.id,
                    'content': d.get('content', ''),
                    'mood': d.get('mood'),
                    'tags': d.get('tags', []),
                    'createdAt': _fmt(d.get('created_at')),
                    'updatedAt': _fmt(d.get('updated_at')),
                })
        except Exception as qe:
            logger.warning(f"Ordered journal query failed, falling back: {qe}")
            try:
                try:
                    from google.cloud.firestore import FieldFilter
                    fb = db.collection('journal_entries').where(  # type: ignore
                        filter=FieldFilter('user_id', '==', user_id)
                    ).limit(limit)
                except ImportError:
                    fb = db.collection('journal_entries').where(  # type: ignore
                        'user_id', '==', user_id
                    ).limit(limit)
                for doc in fb.stream():
                    d = doc.to_dict() or {}
                    entries.append({
                        'id': doc.id,
                        'content': d.get('content', ''),
                        'mood': d.get('mood'),
                        'tags': d.get('tags', []),
                        'createdAt': _fmt(d.get('created_at')),
                        'updatedAt': _fmt(d.get('updated_at')),
                    })
                entries.sort(key=lambda e: e.get('createdAt') or '', reverse=True)
            except Exception:
                entries = []

        audit_log(
            event_type="JOURNAL_ENTRIES_RETRIEVED",
            user_id=user_id,
            details={"entries_count": len(entries)}
        )

        logger.info(f"✅ USERS - Retrieved {len(entries)} journal entries for user: {user_id}")
        return APIResponse.success({"entries": entries}, f"Retrieved {len(entries)} journal entries")

    except Exception as e:
        logger.exception(f"Failed to get journal entries: {e}")
        return APIResponse.error("Failed to get journal entries", "INTERNAL_ERROR", 500)


# ============================================================================
# Meditation Sessions
# ============================================================================

@users_bp.route('/meditation-sessions', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_meditation_session():
    """🧘 Save a meditation session for the user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🧘 USERS - SAVE meditation session for user: {user_id}")

    try:
        data = request.get_json(silent=True)
        if not data:
            return APIResponse.bad_request("Request body required")

        # Sanitize text fields
        meditation_type = sanitize_text(data.get('type', 'breathing'), max_length=50)
        technique = sanitize_text(data.get('technique', ''), max_length=100) if data.get('technique') else None
        notes = sanitize_text(data.get('notes', ''), max_length=1000) if data.get('notes') else None

        # Create meditation session
        session_data = {
            'user_id': user_id,
            'type': meditation_type,
            'duration': data.get('duration', 0),  # in minutes
            'technique': technique,  # e.g., '4-7-8', 'body-scan', etc.
            'completedCycles': data.get('completedCycles', 0),
            'moodBefore': data.get('moodBefore'),
            'moodAfter': data.get('moodAfter'),
            'notes': notes,
            'createdAt': SERVER_TIMESTAMP
        }

        # Save to Firestore
        session_ref = db.collection('users').document(user_id).collection('meditation_sessions').document()  # type: ignore
        session_ref.set(session_data)

        audit_log(
            event_type="MEDITATION_SESSION_SAVED",
            user_id=user_id,
            details={
                "session_id": session_ref.id,
                "type": meditation_type,
                "duration": data.get('duration', 0)
            }
        )

        logger.info(f"✅ USERS - Meditation session saved for user: {user_id}")
        return APIResponse.created({
            "sessionId": session_ref.id
        }, "Meditation session saved")

    except Exception as e:
        logger.exception(f"Failed to save meditation session: {e}")
        return APIResponse.error("Failed to save meditation session", "INTERNAL_ERROR", 500)


@users_bp.route('/meditation-sessions', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_meditation_sessions():
    """🧘 Get meditation sessions for the user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    logger.info(f"🧘 USERS - GET meditation sessions for user: {user_id}")

    try:
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        start_date_str = request.args.get('startDate')
        end_date_str = request.args.get('endDate')

        # Build query
        sessions_ref = db.collection('users').document(user_id).collection('meditation_sessions')  # type: ignore
        query = sessions_ref.order_by('createdAt', direction=firestore.Query.DESCENDING)  # type: ignore

        # Apply optional date filters
        if start_date_str:
            try:
                start_dt = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                query = query.where('createdAt', '>=', start_dt)  # type: ignore
            except ValueError:
                logger.warning(f"Invalid startDate format: {start_date_str}")

        if end_date_str:
            try:
                end_dt = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                query = query.where('createdAt', '<=', end_dt)  # type: ignore
            except ValueError:
                logger.warning(f"Invalid endDate format: {end_date_str}")

        query = query.limit(limit)  # type: ignore

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

        audit_log(
            event_type="MEDITATION_SESSIONS_RETRIEVED",
            user_id=user_id,
            details={"sessions_count": total_sessions, "total_minutes": total_minutes}
        )

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
        return APIResponse.error("Failed to get meditation sessions", "INTERNAL_ERROR", 500)


# ============================================================================
# Gratitude Challenge
# ============================================================================

@users_bp.route('/gratitude', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_gratitude_data():
    """Get user's gratitude challenge state from Firestore."""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        doc = db.collection('gratitude_challenges').document(user_id).get()
        if not doc.exists:
            return APIResponse.success({'data': None}, 'No gratitude challenge data found')

        data = doc.to_dict() or {}
        return APIResponse.success({'data': data}, 'Gratitude data retrieved')

    except Exception as e:
        logger.error(f"Failed to get gratitude data for {user_id}: {e}")
        return APIResponse.error("Failed to retrieve gratitude data")


@users_bp.route('/gratitude', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_gratitude_data():
    """Save user's gratitude challenge state to Firestore."""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    raw = request.get_json(force=True, silent=True) or {}

    allowed_keys = {'entries', 'currentDay', 'startDate', 'lastUpdated', 'completed'}
    data = {k: v for k, v in raw.items() if k in allowed_keys}

    if not data:
        return APIResponse.bad_request("No valid gratitude data provided")

    current_day = data.get('currentDay')
    if current_day is not None and (not isinstance(current_day, int) or not 1 <= current_day <= 8):
        return APIResponse.bad_request("currentDay must be between 1 and 8")

    try:
        db.collection('gratitude_challenges').document(user_id).set(data, merge=True)
        audit_log(
            event_type="GRATITUDE_DATA_SAVED",
            user_id=user_id,
            details={"currentDay": current_day, "completed": data.get('completed', False)}
        )
        return APIResponse.success({'saved': True}, 'Gratitude data saved')

    except Exception as e:
        logger.error(f"Failed to save gratitude data for {user_id}: {e}")
        return APIResponse.error("Failed to save gratitude data")


@users_bp.route('/gratitude', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_gratitude_data():
    """Delete user's gratitude challenge state (on cancel)."""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        db.collection('gratitude_challenges').document(user_id).delete()
        audit_log(
            event_type="GRATITUDE_DATA_DELETED",
            user_id=user_id,
            details={"reason": "user_cancelled"}
        )
        return APIResponse.success({'deleted': True}, 'Gratitude data cleared')

    except Exception as e:
        logger.error(f"Failed to delete gratitude data for {user_id}: {e}")
        return APIResponse.error("Failed to clear gratitude data")
