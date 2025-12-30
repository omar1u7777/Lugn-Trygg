"""
Leaderboard Routes - Real leaderboard and ranking system
Uses Firebase Firestore for user rankings based on XP, streaks, and achievements
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timedelta, timezone

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/api/leaderboard")


def _get_db():
    """Get Firestore database reference"""
    try:
        from ..firebase_config import db
        return db
    except Exception:
        return None


def _anonymize_username(email_or_name: str) -> str:
    """Create anonymous display name from email or name"""
    if not email_or_name:
        return "Anonymous"
    
    # If it's an email, use the part before @
    if "@" in email_or_name:
        name = email_or_name.split("@")[0]
    else:
        name = email_or_name
    
    # Anonymize: show first 2 chars + *** + last char
    if len(name) > 3:
        return f"{name[:2]}***{name[-1]}"
    return f"{name[0]}***"


@leaderboard_bp.route('/xp', methods=['GET'])
def get_xp_leaderboard():
    """Get top users by XP"""
    try:
        limit = int(request.args.get('limit', 20))
        timeframe = request.args.get('timeframe', 'all')  # all, weekly, monthly
        
        db = _get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Query users collection sorted by XP
        query = db.collection('users').order_by('total_xp', direction='DESCENDING').limit(limit)
        docs = query.stream()
        
        leaderboard = []
        rank = 1
        
        for doc in docs:
            user_data = doc.to_dict()
            
            # Only include users with XP > 0
            xp = user_data.get('total_xp', 0)
            if xp <= 0:
                continue
            
            leaderboard.append({
                'rank': rank,
                'user_id': doc.id,
                'display_name': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                'xp': xp,
                'level': user_data.get('level', 1),
                'badge_count': len(user_data.get('badges', [])),
                'avatar': user_data.get('avatar_emoji', '🌟')
            })
            rank += 1
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard,
            'timeframe': timeframe,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@leaderboard_bp.route('/streaks', methods=['GET'])
def get_streak_leaderboard():
    """Get top users by current streak"""
    try:
        limit = int(request.args.get('limit', 20))
        
        db = _get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Query users sorted by current streak
        query = db.collection('users').order_by('current_streak', direction='DESCENDING').limit(limit)
        docs = query.stream()
        
        leaderboard = []
        rank = 1
        
        for doc in docs:
            user_data = doc.to_dict()
            
            streak = user_data.get('current_streak', 0)
            if streak <= 0:
                continue
            
            leaderboard.append({
                'rank': rank,
                'user_id': doc.id,
                'display_name': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                'current_streak': streak,
                'longest_streak': user_data.get('longest_streak', streak),
                'avatar': user_data.get('avatar_emoji', '🔥')
            })
            rank += 1
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@leaderboard_bp.route('/moods', methods=['GET'])
def get_mood_leaderboard():
    """Get top users by mood log count"""
    try:
        limit = int(request.args.get('limit', 20))
        
        db = _get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Query users sorted by mood count
        query = db.collection('users').order_by('mood_count', direction='DESCENDING').limit(limit)
        docs = query.stream()
        
        leaderboard = []
        rank = 1
        
        for doc in docs:
            user_data = doc.to_dict()
            
            mood_count = user_data.get('mood_count', 0)
            if mood_count <= 0:
                continue
            
            leaderboard.append({
                'rank': rank,
                'user_id': doc.id,
                'display_name': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                'mood_count': mood_count,
                'average_mood': round(user_data.get('average_mood', 5), 1),
                'avatar': user_data.get('avatar_emoji', '📊')
            })
            rank += 1
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@leaderboard_bp.route('/user/<user_id>/rank', methods=['GET'])
def get_user_rank(user_id: str):
    """Get a specific user's rank in various categories"""
    try:
        db = _get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Get user data
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        user_data = user_doc.to_dict()
        user_xp = user_data.get('total_xp', 0)
        user_streak = user_data.get('current_streak', 0)
        user_moods = user_data.get('mood_count', 0)
        
        # Calculate XP rank (count users with more XP)
        xp_rank_query = db.collection('users').where('total_xp', '>', user_xp).stream()
        xp_rank = len(list(xp_rank_query)) + 1
        
        # Calculate streak rank
        streak_rank_query = db.collection('users').where('current_streak', '>', user_streak).stream()
        streak_rank = len(list(streak_rank_query)) + 1
        
        # Calculate mood count rank
        mood_rank_query = db.collection('users').where('mood_count', '>', user_moods).stream()
        mood_rank = len(list(mood_rank_query)) + 1
        
        # Get total user count for percentile
        total_users = len(list(db.collection('users').stream()))
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'rankings': {
                'xp': {
                    'rank': xp_rank,
                    'value': user_xp,
                    'percentile': round((1 - xp_rank / max(total_users, 1)) * 100, 1)
                },
                'streak': {
                    'rank': streak_rank,
                    'value': user_streak,
                    'percentile': round((1 - streak_rank / max(total_users, 1)) * 100, 1)
                },
                'moods': {
                    'rank': mood_rank,
                    'value': user_moods,
                    'percentile': round((1 - mood_rank / max(total_users, 1)) * 100, 1)
                }
            },
            'total_users': total_users
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@leaderboard_bp.route('/weekly-winners', methods=['GET'])
def get_weekly_winners():
    """Get last week's top performers"""
    try:
        db = _get_db()
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Calculate last week's date range
        today = datetime.now(timezone.utc)
        last_week_start = today - timedelta(days=today.weekday() + 7)
        last_week_end = last_week_start + timedelta(days=6)
        
        # For now, just return current top performers
        # In production, you'd track weekly stats separately
        xp_query = db.collection('users').order_by('total_xp', direction='DESCENDING').limit(3)
        xp_winners = []
        
        for doc in xp_query.stream():
            user_data = doc.to_dict()
            if user_data.get('total_xp', 0) > 0:
                xp_winners.append({
                    'display_name': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                    'xp': user_data.get('total_xp', 0),
                    'avatar': user_data.get('avatar_emoji', '🏆')
                })
        
        return jsonify({
            'success': True,
            'week_start': last_week_start.isoformat(),
            'week_end': last_week_end.isoformat(),
            'winners': {
                'xp': xp_winners[:3] if xp_winners else []
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
