"""
Peer Support Chat Routes - Anonymous community chat system
Real implementation with Firebase Firestore for message storage
"""

import logging
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import sanitize_text
from src.utils.response_utils import APIResponse

peer_chat_bp = Blueprint("peer_chat", __name__, url_prefix="/api/v1/peer-chat")
logger = logging.getLogger(__name__)


@peer_chat_bp.route('/rooms', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/join', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/leave', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/messages', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/send', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/typing', methods=['OPTIONS'])
@peer_chat_bp.route('/room/<room_id>/presence', methods=['OPTIONS'])
@peer_chat_bp.route('/message/<message_id>/like', methods=['OPTIONS'])
@peer_chat_bp.route('/message/<message_id>/report', methods=['OPTIONS'])
def handle_options(room_id: str | None = None, message_id: str | None = None):
    """Handle CORS preflight requests."""
    return APIResponse.success()


# Chat room definitions
CHAT_ROOMS = {
    'anxiety': {
        'id': 'anxiety',
        'name': 'Ångest & Oro',
        'name_en': 'Anxiety Support',
        'description': 'Dela dina erfarenheter med ångest och hitta stöd',
        'description_en': 'Share your experiences with anxiety and find support',
        'category': 'anxiety',
        'color': '#FFB74D',
        'icon': '😰'
    },
    'depression': {
        'id': 'depression',
        'name': 'Depression Stöd',
        'name_en': 'Depression Support',
        'description': 'Ett tryggt utrymme att prata om depression',
        'description_en': 'A safe space to talk about depression',
        'category': 'depression',
        'color': '#64B5F6',
        'icon': '💙'
    },
    'stress': {
        'id': 'stress',
        'name': 'Stresshantering',
        'name_en': 'Stress Management',
        'description': 'Tips och stöd för att hantera stress',
        'description_en': 'Tips and support for managing stress',
        'category': 'stress',
        'color': '#81C784',
        'icon': '😤'
    },
    'general': {
        'id': 'general',
        'name': 'Allmänt Välmående',
        'name_en': 'General Wellness',
        'description': 'Allmänna diskussioner om mental hälsa',
        'description_en': 'General mental health discussions',
        'category': 'general',
        'color': '#BA68C8',
        'icon': '💜'
    },
    'recovery': {
        'id': 'recovery',
        'name': 'Återhämtningsresa',
        'name_en': 'Recovery Journey',
        'description': 'Dela dina framsteg och milstolpar',
        'description_en': 'Share your recovery progress and milestones',
        'category': 'recovery',
        'color': '#4DB6AC',
        'icon': '🌱'
    },
    'sleep': {
        'id': 'sleep',
        'name': 'Sömn & Vila',
        'name_en': 'Sleep & Rest',
        'description': 'Diskutera sömnproblem och hitta lösningar',
        'description_en': 'Discuss sleep issues and find solutions',
        'category': 'sleep',
        'color': '#7986CB',
        'icon': '😴'
    }
}

# Banned words list for moderation (basic filter)
BANNED_WORDS = [
    # Add actual banned words - keeping minimal for demo
]


def _generate_anonymous_name():
    """Generate a random anonymous username."""
    adjectives = [
        'Lugn', 'Trygg', 'Modig', 'Stark', 'Varm', 'Snäll', 'Glad',
        'Hoppfull', 'Tålmodig', 'Kreativ', 'Positiv', 'Fridfull'
    ]
    nouns = [
        'Själ', 'Hjärta', 'Ande', 'Vän', 'Resenär', 'Drömmare',
        'Lyssnare', 'Berättare', 'Sökare', 'Vandare'
    ]
    number = secrets.randbelow(900) + 100
    return f"{secrets.choice(adjectives)}{secrets.choice(nouns)}{number}"


def _generate_avatar():
    """Generate a random avatar emoji."""
    avatars = ['🌟', '💙', '💜', '💚', '🌸', '🌺', '🦋', '🌈', '✨', '🌻', '🍀', '🌙']
    return secrets.choice(avatars)


def _moderate_message(message: str) -> tuple[bool, str]:
    """
    Basic content moderation.
    Returns (is_safe, reason).
    """
    # Check for banned words
    lower_message = message.lower()
    for word in BANNED_WORDS:
        if word.lower() in lower_message:
            return False, "Message contains inappropriate content"

    # Check for personal information patterns
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\d{10}\b'

    if re.search(email_pattern, message):
        return False, "Please do not share email addresses for privacy"

    if re.search(phone_pattern, message):
        return False, "Please do not share phone numbers for privacy"

    # Check message length
    if len(message) > 1000:
        return False, "Message is too long (max 1000 characters)"

    if len(message.strip()) < 2:
        return False, "Message is too short"

    return True, ""


@peer_chat_bp.route('/rooms', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_rooms():
    """Get all available chat rooms with member counts."""
    try:
        rooms_with_counts = []

        for room_id, room in CHAT_ROOMS.items():
            room_data: dict[str, Any] = dict(room)

            # Get active member count (users active in last 5 minutes)
            member_count = 0
            if db is not None:
                try:
                    five_min_ago = datetime.now(UTC) - timedelta(minutes=5)
                    active_docs = db.collection('peer_chat_presence').where(
                        'room_id', '==', room_id
                    ).where(
                        'last_seen', '>=', five_min_ago.isoformat()
                    ).stream()
                    member_count = len(list(active_docs))
                except Exception:
                    # Compound query may fail if composite index doesn't exist
                    member_count = 0

            room_data['memberCount'] = member_count
            rooms_with_counts.append(room_data)

        return APIResponse.success({
            'rooms': rooms_with_counts
        }, "Chat rooms retrieved")

    except Exception as e:
        logger.exception(f"Error getting rooms: {e}")
        return APIResponse.error("Failed to fetch chat rooms", "FETCH_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/join', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def join_room(room_id: str):
    """Join a chat room and get initial messages."""
    try:
        if room_id not in CHAT_ROOMS:
            return APIResponse.not_found("Room not found")

        user_id = g.user_id

        # Generate anonymous identity for this session
        anonymous_name = _generate_anonymous_name()
        avatar = _generate_avatar()
        session_id = str(uuid.uuid4())

        # Record presence
        if db is not None:
            db.collection('peer_chat_presence').document(session_id).set({
                'user_id': user_id,
                'session_id': session_id,
                'room_id': room_id,
                'anonymous_name': anonymous_name,
                'avatar': avatar,
                'joined_at': datetime.now(UTC).isoformat(),
                'last_seen': datetime.now(UTC).isoformat()
            })

        # Get recent messages (last 50)
        messages = []
        if db is not None:
            docs = db.collection('peer_chat_messages').where(
                'room_id', '==', room_id
            ).order_by('timestamp', direction='DESCENDING').limit(50).stream()

            for doc in docs:
                msg_data = doc.to_dict() or {}
                msg_data['id'] = doc.id
                messages.append(msg_data)

            # Reverse to get chronological order
            messages.reverse()

        logger.info(f"💬 User joined room {room_id} as {anonymous_name}")

        return APIResponse.success({
            'sessionId': session_id,
            'anonymousName': anonymous_name,
            'avatar': avatar,
            'room': CHAT_ROOMS[room_id],
            'messages': messages
        }, "Connected to room")

    except Exception as e:
        logger.exception(f"Error joining room: {e}")
        return APIResponse.error("Failed to connect to room", "JOIN_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/leave', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def leave_room(room_id: str):
    """Leave a chat room."""
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')

        if not session_id:
            return APIResponse.bad_request("session_id is required", "SESSION_ID_REQUIRED")

        if db is not None:
            db.collection('peer_chat_presence').document(session_id).delete()

        logger.info(f"🚪 Session {session_id[:8]} left room {room_id}")

        return APIResponse.success({
            'left': True
        }, "Left the room")

    except Exception as e:
        logger.exception(f"Error leaving room: {e}")
        return APIResponse.error("Failed to leave room", "LEAVE_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/messages', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_messages(room_id: str):
    """Get messages for a room (polling endpoint)."""
    try:
        if room_id not in CHAT_ROOMS:
            return APIResponse.not_found("Room not found")

        # Get last_message_id for incremental updates
        last_message_id = request.args.get('after')
        limit = min(int(request.args.get('limit', 20)), 50)  # Cap at 50
        session_id = request.args.get('session_id')

        messages = []

        if db is not None:
            # Update presence
            if session_id:
                try:
                    db.collection('peer_chat_presence').document(session_id).update({
                        'last_seen': datetime.now(UTC).isoformat()
                    })
                except Exception:
                    pass  # Ignore if session doesn't exist

            # Query messages
            query = db.collection('peer_chat_messages').where(
                'room_id', '==', room_id
            ).order_by('timestamp', direction='DESCENDING').limit(limit)

            docs = query.stream()

            for doc in docs:
                msg_data = doc.to_dict() or {}
                msg_data['id'] = doc.id

                # Skip messages before last_message_id if provided
                if last_message_id and msg_data['id'] == last_message_id:
                    break

                messages.append(msg_data)

            messages.reverse()

        return APIResponse.success({
            'messages': messages,
            'timestamp': datetime.now(UTC).isoformat()
        }, "Messages retrieved")

    except Exception as e:
        logger.exception(f"Error getting messages: {e}")
        return APIResponse.error("Failed to fetch messages", "FETCH_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/send', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def send_message(room_id: str):
    """Send a message to a room."""
    try:
        if room_id not in CHAT_ROOMS:
            return APIResponse.not_found("Room not found")

        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')
        message_text = sanitize_text(data.get('message', '').strip(), max_length=1000)
        anonymous_name = data.get('anonymous_name')
        avatar = data.get('avatar')

        if not session_id:
            return APIResponse.bad_request("session_id is required", "SESSION_ID_REQUIRED")

        if not message_text:
            return APIResponse.bad_request("Message cannot be empty", "EMPTY_MESSAGE")

        # Moderate message
        is_safe, reason = _moderate_message(message_text)
        if not is_safe:
            return APIResponse.bad_request(reason, "MODERATION_FAILED")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Verify session exists
        presence_doc = db.collection('peer_chat_presence').document(session_id).get()
        if not presence_doc.exists:
            return APIResponse.forbidden("Invalid session. Please rejoin the room.")

        presence_data = presence_doc.to_dict() or {}
        anonymous_name = presence_data.get('anonymous_name', anonymous_name)
        avatar = presence_data.get('avatar', avatar)

        # Create message
        message_id = str(uuid.uuid4())
        message_data = {
            'id': message_id,
            'room_id': room_id,
            'session_id': session_id,
            'anonymous_name': anonymous_name or 'Anonym',
            'avatar': avatar or '🌟',
            'message': message_text,
            'timestamp': datetime.now(UTC).isoformat(),
            'likes': 0,
            'liked_by': [],
            'reported': False
        }

        db.collection('peer_chat_messages').document(message_id).set(message_data)

        # Update presence
        db.collection('peer_chat_presence').document(session_id).update({
            'last_seen': datetime.now(UTC).isoformat()
        })

        logger.info(f"💬 Message sent in {room_id} by {anonymous_name}")

        return APIResponse.success({
            'message': message_data
        }, "Message sent")

    except Exception as e:
        logger.exception(f"Error sending message: {e}")
        return APIResponse.error("Failed to send message", "SEND_ERROR", 500)


@peer_chat_bp.route('/message/<message_id>/like', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def like_message(message_id: str):
    """Like a message."""
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')

        if not session_id:
            return APIResponse.bad_request("session_id is required", "SESSION_ID_REQUIRED")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        msg_ref = db.collection('peer_chat_messages').document(message_id)
        msg_doc = msg_ref.get()

        if not msg_doc.exists:
            return APIResponse.not_found("Message not found")

        msg_data = msg_doc.to_dict() or {}
        liked_by = msg_data.get('liked_by', [])

        if session_id in liked_by:
            # Unlike
            liked_by.remove(session_id)
            action = 'unliked'
        else:
            # Like
            liked_by.append(session_id)
            action = 'liked'

        msg_ref.update({
            'likes': len(liked_by),
            'liked_by': liked_by
        })

        return APIResponse.success({
            'action': action,
            'likes': len(liked_by)
        }, "Liked" if action == 'liked' else "Unliked")

    except Exception as e:
        logger.exception(f"Error liking message: {e}")
        return APIResponse.error("Failed to like message", "LIKE_ERROR", 500)


@peer_chat_bp.route('/message/<message_id>/report', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def report_message(message_id: str):
    """Report a message for moderation."""
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')
        reason = sanitize_text(data.get('reason', 'Inappropriate content'), max_length=500)

        if not session_id:
            return APIResponse.bad_request("session_id is required", "SESSION_ID_REQUIRED")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        msg_ref = db.collection('peer_chat_messages').document(message_id)
        msg_doc = msg_ref.get()

        if not msg_doc.exists:
            return APIResponse.not_found("Message not found")

        # Mark as reported
        msg_ref.update({
            'reported': True,
            'report_reason': reason,
            'reported_by': session_id,
            'reported_at': datetime.now(UTC).isoformat()
        })

        # Create moderation log
        db.collection('peer_chat_reports').add({
            'message_id': message_id,
            'reported_by': session_id,
            'reason': reason,
            'timestamp': datetime.now(UTC).isoformat(),
            'status': 'pending'
        })

        logger.warning(f"⚠️ Message {message_id} reported: {reason}")
        audit_log('peer_chat_report', session_id, {'message_id': message_id, 'reason': reason})

        return APIResponse.success({
            'reported': True
        }, "Message reported for review")

    except Exception as e:
        logger.exception(f"Error reporting message: {e}")
        return APIResponse.error("Failed to report message", "REPORT_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/typing', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_typing(room_id: str):
    """Update typing indicator."""
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')
        is_typing = bool(data.get('is_typing', False))

        if not session_id:
            return APIResponse.bad_request("session_id is required", "SESSION_ID_REQUIRED")

        if db is not None:
            try:
                db.collection('peer_chat_presence').document(session_id).update({
                    'is_typing': is_typing,
                    'last_seen': datetime.now(UTC).isoformat()
                })
            except Exception:
                pass  # Ignore if session doesn't exist

        return APIResponse.success({
            'typing': is_typing
        })

    except Exception as e:
        logger.exception(f"Error updating typing: {e}")
        return APIResponse.error("Failed to update typing status", "TYPING_ERROR", 500)


@peer_chat_bp.route('/room/<room_id>/presence', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_room_presence(room_id: str):
    """Get active users in a room."""
    try:
        if room_id not in CHAT_ROOMS:
            return APIResponse.not_found("Room not found")

        active_users = []
        typing_users = []

        if db is not None:
            five_min_ago = datetime.now(UTC) - timedelta(minutes=5)
            docs = db.collection('peer_chat_presence').where(
                'room_id', '==', room_id
            ).where(
                'last_seen', '>=', five_min_ago.isoformat()
            ).stream()

            for doc in docs:
                user_data = doc.to_dict() or {}
                active_users.append({
                    'anonymousName': user_data.get('anonymous_name'),
                    'avatar': user_data.get('avatar')
                })

                if user_data.get('is_typing'):
                    typing_users.append(user_data.get('anonymous_name'))

        return APIResponse.success({
            'activeCount': len(active_users),
            'activeUsers': active_users[:20],  # Limit to 20 for display
            'typingUsers': typing_users
        }, "Presence status retrieved")

    except Exception as e:
        logger.exception(f"Error getting room presence: {e}")
        return APIResponse.error("Failed to fetch presence status", "PRESENCE_ERROR", 500)
