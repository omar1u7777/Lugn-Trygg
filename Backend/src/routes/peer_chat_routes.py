"""
Peer Support Chat Routes - Anonymous community chat system
Real implementation with Firebase Firestore for message storage
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timedelta, timezone
import uuid
import re

peer_chat_bp = Blueprint("peer_chat", __name__, url_prefix="/api/peer-chat")


def _get_db():
    """Get Firestore database reference"""
    try:
        from ..firebase_config import db
        return db
    except Exception:
        return None


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
    """Generate a random anonymous username"""
    import random
    adjectives = [
        'Lugn', 'Trygg', 'Modig', 'Stark', 'Varm', 'Snäll', 'Glad', 
        'Hoppfull', 'Tålmodig', 'Kreativ', 'Positiv', 'Fridfull'
    ]
    nouns = [
        'Själ', 'Hjärta', 'Ande', 'Vän', 'Resenär', 'Drömmare',
        'Lyssnare', 'Berättare', 'Sökare', 'Vandare'
    ]
    number = random.randint(100, 999)
    return f"{random.choice(adjectives)}{random.choice(nouns)}{number}"


def _generate_avatar():
    """Generate a random avatar emoji"""
    import random
    avatars = ['🌟', '💙', '💜', '💚', '🌸', '🌺', '🦋', '🌈', '✨', '🌻', '🍀', '🌙']
    return random.choice(avatars)


def _moderate_message(message: str) -> tuple[bool, str]:
    """
    Basic content moderation
    Returns (is_safe, reason)
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
        return False, "Please don't share email addresses for privacy"
    
    if re.search(phone_pattern, message):
        return False, "Please don't share phone numbers for privacy"
    
    # Check message length
    if len(message) > 1000:
        return False, "Message is too long (max 1000 characters)"
    
    if len(message.strip()) < 2:
        return False, "Message is too short"
    
    return True, ""


@peer_chat_bp.route('/rooms', methods=['GET'])
def get_rooms():
    """Get all available chat rooms with member counts"""
    try:
        db = _get_db()
        rooms_with_counts = []
        
        for room_id, room in CHAT_ROOMS.items():
            room_data = dict(room)
            
            # Get active member count (users active in last 5 minutes)
            if db:
                five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
                active_docs = db.collection('peer_chat_presence').where(
                    'room_id', '==', room_id
                ).where(
                    'last_seen', '>=', five_min_ago.isoformat()
                ).stream()
                room_data['member_count'] = len(list(active_docs))
            else:
                room_data['member_count'] = 0
            
            rooms_with_counts.append(room_data)
        
        return jsonify({
            'success': True,
            'rooms': rooms_with_counts
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/join', methods=['POST'])
def join_room(room_id: str):
    """Join a chat room and get initial messages"""
    try:
        if room_id not in CHAT_ROOMS:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        data = request.get_json() or {}
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        db = _get_db()
        
        # Generate anonymous identity for this session
        anonymous_name = _generate_anonymous_name()
        avatar = _generate_avatar()
        session_id = str(uuid.uuid4())
        
        # Record presence
        if db:
            db.collection('peer_chat_presence').document(session_id).set({
                'user_id': user_id,
                'session_id': session_id,
                'room_id': room_id,
                'anonymous_name': anonymous_name,
                'avatar': avatar,
                'joined_at': datetime.now(timezone.utc).isoformat(),
                'last_seen': datetime.now(timezone.utc).isoformat()
            })
        
        # Get recent messages (last 50)
        messages = []
        if db:
            docs = db.collection('peer_chat_messages').where(
                'room_id', '==', room_id
            ).order_by('timestamp', direction='DESCENDING').limit(50).stream()
            
            for doc in docs:
                msg_data = doc.to_dict()
                msg_data['id'] = doc.id
                messages.append(msg_data)
            
            # Reverse to get chronological order
            messages.reverse()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'anonymous_name': anonymous_name,
            'avatar': avatar,
            'room': CHAT_ROOMS[room_id],
            'messages': messages
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/leave', methods=['POST'])
def leave_room(room_id: str):
    """Leave a chat room"""
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'session_id is required'
            }), 400
        
        db = _get_db()
        if db:
            db.collection('peer_chat_presence').document(session_id).delete()
        
        return jsonify({
            'success': True,
            'message': 'Left room successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/messages', methods=['GET'])
def get_messages(room_id: str):
    """Get messages for a room (polling endpoint)"""
    try:
        if room_id not in CHAT_ROOMS:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        # Get last_message_id for incremental updates
        last_message_id = request.args.get('after')
        limit = int(request.args.get('limit', 20))
        session_id = request.args.get('session_id')
        
        db = _get_db()
        messages = []
        
        if db:
            # Update presence
            if session_id:
                db.collection('peer_chat_presence').document(session_id).update({
                    'last_seen': datetime.now(timezone.utc).isoformat()
                })
            
            # Query messages
            query = db.collection('peer_chat_messages').where(
                'room_id', '==', room_id
            ).order_by('timestamp', direction='DESCENDING').limit(limit)
            
            docs = query.stream()
            
            for doc in docs:
                msg_data = doc.to_dict()
                msg_data['id'] = doc.id
                
                # Skip messages before last_message_id if provided
                if last_message_id and msg_data['id'] == last_message_id:
                    break
                    
                messages.append(msg_data)
            
            messages.reverse()
        
        return jsonify({
            'success': True,
            'messages': messages,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/send', methods=['POST'])
def send_message(room_id: str):
    """Send a message to a room"""
    try:
        if room_id not in CHAT_ROOMS:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        data = request.get_json() or {}
        session_id = data.get('session_id')
        message_text = data.get('message', '').strip()
        anonymous_name = data.get('anonymous_name')
        avatar = data.get('avatar')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'session_id is required'
            }), 400
        
        if not message_text:
            return jsonify({
                'success': False,
                'error': 'Message cannot be empty'
            }), 400
        
        # Moderate message
        is_safe, reason = _moderate_message(message_text)
        if not is_safe:
            return jsonify({
                'success': False,
                'error': reason,
                'moderation_failed': True
            }), 400
        
        db = _get_db()
        
        # Verify session exists
        if db:
            presence_doc = db.collection('peer_chat_presence').document(session_id).get()
            if not presence_doc.exists:
                return jsonify({
                    'success': False,
                    'error': 'Invalid session. Please rejoin the room.'
                }), 401
            
            presence_data = presence_doc.to_dict()
            anonymous_name = presence_data.get('anonymous_name', anonymous_name)
            avatar = presence_data.get('avatar', avatar)
        
        # Create message
        message_id = str(uuid.uuid4())
        message_data = {
            'id': message_id,
            'room_id': room_id,
            'session_id': session_id,
            'anonymous_name': anonymous_name or 'Anonymous',
            'avatar': avatar or '🌟',
            'message': message_text,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'likes': 0,
            'liked_by': [],
            'reported': False
        }
        
        if db:
            db.collection('peer_chat_messages').document(message_id).set(message_data)
            
            # Update presence
            db.collection('peer_chat_presence').document(session_id).update({
                'last_seen': datetime.now(timezone.utc).isoformat()
            })
        
        return jsonify({
            'success': True,
            'message': message_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/message/<message_id>/like', methods=['POST'])
def like_message(message_id: str):
    """Like a message"""
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'session_id is required'
            }), 400
        
        db = _get_db()
        
        if db:
            msg_ref = db.collection('peer_chat_messages').document(message_id)
            msg_doc = msg_ref.get()
            
            if not msg_doc.exists:
                return jsonify({
                    'success': False,
                    'error': 'Message not found'
                }), 404
            
            msg_data = msg_doc.to_dict()
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
            
            return jsonify({
                'success': True,
                'action': action,
                'likes': len(liked_by)
            })
        
        return jsonify({
            'success': False,
            'error': 'Database not available'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/message/<message_id>/report', methods=['POST'])
def report_message(message_id: str):
    """Report a message for moderation"""
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id')
        reason = data.get('reason', 'Inappropriate content')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'session_id is required'
            }), 400
        
        db = _get_db()
        
        if db:
            msg_ref = db.collection('peer_chat_messages').document(message_id)
            msg_doc = msg_ref.get()
            
            if not msg_doc.exists:
                return jsonify({
                    'success': False,
                    'error': 'Message not found'
                }), 404
            
            # Mark as reported
            msg_ref.update({
                'reported': True,
                'report_reason': reason,
                'reported_by': session_id,
                'reported_at': datetime.now(timezone.utc).isoformat()
            })
            
            # Create moderation log
            db.collection('peer_chat_reports').add({
                'message_id': message_id,
                'reported_by': session_id,
                'reason': reason,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': 'pending'
            })
            
            return jsonify({
                'success': True,
                'message': 'Message reported for review'
            })
        
        return jsonify({
            'success': False,
            'error': 'Database not available'
        }), 500
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/typing', methods=['POST'])
def update_typing(room_id: str):
    """Update typing indicator"""
    try:
        data = request.get_json() or {}
        session_id = data.get('session_id')
        is_typing = data.get('is_typing', False)
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'session_id is required'
            }), 400
        
        db = _get_db()
        
        if db:
            db.collection('peer_chat_presence').document(session_id).update({
                'is_typing': is_typing,
                'last_seen': datetime.now(timezone.utc).isoformat()
            })
        
        return jsonify({
            'success': True
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@peer_chat_bp.route('/room/<room_id>/presence', methods=['GET'])
def get_room_presence(room_id: str):
    """Get active users in a room"""
    try:
        if room_id not in CHAT_ROOMS:
            return jsonify({
                'success': False,
                'error': 'Room not found'
            }), 404
        
        db = _get_db()
        active_users = []
        typing_users = []
        
        if db:
            five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
            docs = db.collection('peer_chat_presence').where(
                'room_id', '==', room_id
            ).where(
                'last_seen', '>=', five_min_ago.isoformat()
            ).stream()
            
            for doc in docs:
                user_data = doc.to_dict()
                active_users.append({
                    'anonymous_name': user_data.get('anonymous_name'),
                    'avatar': user_data.get('avatar')
                })
                
                if user_data.get('is_typing'):
                    typing_users.append(user_data.get('anonymous_name'))
        
        return jsonify({
            'success': True,
            'active_count': len(active_users),
            'active_users': active_users[:20],  # Limit to 20 for display
            'typing_users': typing_users
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
