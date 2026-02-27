"""
Leaderboard Routes - Real leaderboard and ranking system
Uses Firebase Firestore for user rankings based on XP, streaks, and achievements
"""

import logging
import re
from datetime import UTC, datetime

from flask import Blueprint, request

from src.firebase_config import db
from src.services.auth_service import AuthService

# Absolute imports (project standard)
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

# Validation patterns
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

# Remove url_prefix here - it's set in main.py register_blueprint
leaderboard_bp = Blueprint("leaderboard", __name__)


def _validate_user_id(user_id: str) -> bool:
    """Validate user_id format"""
    return bool(USER_ID_PATTERN.match(user_id)) if user_id else False


def _validate_limit(limit_param: str, default: int = 20, max_val: int = 100) -> int:
    """Validate and sanitize limit parameter"""
    try:
        limit = int(limit_param)
        if limit < 1:
            return default
        return min(limit, max_val)
    except (ValueError, TypeError):
        return default


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


# ============================================================================
# OPTIONS Handlers (CORS preflight)
# ============================================================================

@leaderboard_bp.route('/xp', methods=['OPTIONS'])
@leaderboard_bp.route('/streaks', methods=['OPTIONS'])
@leaderboard_bp.route('/moods', methods=['OPTIONS'])
@leaderboard_bp.route('/weekly-winners', methods=['OPTIONS'])
def leaderboard_options():
    """Handle CORS preflight for leaderboard endpoints"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@leaderboard_bp.route('/user/<user_id>/rank', methods=['OPTIONS'])
def user_rank_options(user_id):
    """Handle CORS preflight for user rank endpoint"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@leaderboard_bp.route('/xp', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_xp_leaderboard():
    """Get top users by XP"""
    try:
        limit = _validate_limit(request.args.get('limit', '20'), default=20, max_val=100)
        timeframe = request.args.get('timeframe', 'all')  # all, weekly, monthly

        # Validate timeframe
        if timeframe not in ['all', 'weekly', 'monthly']:
            timeframe = 'all'

        # Query user_rewards collection sorted by XP (this is where XP is actually stored)
        query = db.collection('user_rewards').order_by('xp', direction='DESCENDING').limit(limit)
        docs = query.stream()

        leaderboard = []
        rank = 1

        for doc in docs:
            user_data = doc.to_dict()

            # Only include users with XP > 0
            xp = user_data.get('xp', 0)
            if xp <= 0:
                continue

            # Get display name from users collection
            user_id = doc.id
            display_name = 'Anonymous'
            try:
                user_doc = db.collection('users').document(user_id).get()
                if user_doc.exists:
                    u = user_doc.to_dict() or {}
                    display_name = _anonymize_username(u.get('display_name') or u.get('email', ''))
            except Exception:
                pass

            leaderboard.append({
                'rank': rank,
                'userId': user_id,
                'displayName': display_name,
                'xp': xp,
                'level': user_data.get('level', 1),
                'badgeCount': len(user_data.get('badges', [])),
                'avatar': '🌟'
            })
            rank += 1

        return APIResponse.success(
            data={
                'leaderboard': leaderboard,
                'timeframe': timeframe,
                'updatedAt': datetime.now(UTC).isoformat()
            },
            message=f'Retrieved {len(leaderboard)} users'
        )

    except Exception as e:
        logger.error(f"Failed to get XP leaderboard: {str(e)}")
        return APIResponse.error('Failed to load leaderboard')


@leaderboard_bp.route('/streaks', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_streak_leaderboard():
    """Get top users by current streak"""
    try:
        limit = _validate_limit(request.args.get('limit', '20'), default=20, max_val=100)

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
                'userId': doc.id,
                'displayName': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                'currentStreak': streak,
                'longestStreak': user_data.get('longest_streak', streak),
                'avatar': user_data.get('avatar_emoji', '🔥')
            })
            rank += 1

        return APIResponse.success(
            data={
                'leaderboard': leaderboard,
                'updatedAt': datetime.now(UTC).isoformat()
            },
            message=f'Retrieved {len(leaderboard)} users'
        )

    except Exception as e:
        logger.error(f"Failed to get streak leaderboard: {str(e)}")
        return APIResponse.error('Failed to load leaderboard')


@leaderboard_bp.route('/moods', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_mood_leaderboard():
    """Get top users by mood log count"""
    try:
        limit = _validate_limit(request.args.get('limit', '20'), default=20, max_val=100)

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
                'userId': doc.id,
                'displayName': _anonymize_username(user_data.get('display_name') or user_data.get('email', '')),
                'moodCount': mood_count,
                'averageMood': round(user_data.get('average_mood', 5), 1),
                'avatar': user_data.get('avatar_emoji', '📊')
            })
            rank += 1

        return APIResponse.success(
            data={
                'leaderboard': leaderboard,
                'updatedAt': datetime.now(UTC).isoformat()
            },
            message=f'Retrieved {len(leaderboard)} users'
        )

    except Exception as e:
        logger.error(f"Failed to get mood leaderboard: {str(e)}")
        return APIResponse.error('Failed to load leaderboard')


# Support both /user/<user_id>/rank AND /user/<user_id> for frontend compatibility
@leaderboard_bp.route('/user/<user_id>/rank', methods=['GET'])
@leaderboard_bp.route('/user/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_rank(user_id: str):
    """Get a specific user's rank in various categories"""
    # Validate user_id
    user_id_clean = input_sanitizer.sanitize(user_id) if user_id else ''
    if not _validate_user_id(user_id_clean):
        logger.warning(f"Invalid user_id format attempted: {user_id[:50] if user_id else 'None'}")
        return APIResponse.bad_request('Invalid user ID format')

    try:
        # Get user data from both users and user_rewards collections
        user_doc = db.collection('users').document(user_id_clean).get()
        rewards_doc = db.collection('user_rewards').document(user_id_clean).get()

        if not user_doc.exists and not rewards_doc.exists:
            return APIResponse.not_found('User not found')

        user_data = user_doc.to_dict() if user_doc.exists else {}
        rewards_data = rewards_doc.to_dict() if rewards_doc.exists else {}

        # XP comes from user_rewards, streaks/moods from users
        user_xp = rewards_data.get('xp', 0)
        user_streak = user_data.get('current_streak', 0)
        user_moods = user_data.get('mood_count', 0)

        # Calculate XP rank from user_rewards collection
        xp_rank_query = db.collection('user_rewards').where('xp', '>', user_xp).stream()
        xp_rank = len(list(xp_rank_query)) + 1

        # Calculate streak rank from users collection
        streak_rank_query = db.collection('users').where('current_streak', '>', user_streak).stream()
        streak_rank = len(list(streak_rank_query)) + 1

        # Calculate mood count rank from users collection
        mood_rank_query = db.collection('users').where('mood_count', '>', user_moods).stream()
        mood_rank = len(list(mood_rank_query)) + 1

        # Get total user count for percentile
        total_users = len(list(db.collection('users').select([]).stream()))

        return APIResponse.success(
            data={
                'userId': user_id_clean,
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
                'totalUsers': total_users
            },
            message='User rankings retrieved'
        )

    except Exception as e:
        logger.error(f"Failed to get user rank: {str(e)}")
        return APIResponse.error('Failed to load user rankings')


@leaderboard_bp.route('/weekly-winners', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_weekly_winners():
    """Get last week's top performers"""
    try:
        from datetime import timedelta

        # Calculate last week's date range
        today = datetime.now(UTC)
        last_week_start = today - timedelta(days=today.weekday() + 7)
        last_week_end = last_week_start + timedelta(days=6)

        # For now, just return current top performers
        # Query user_rewards collection (where XP is actually stored), not users.total_xp
        xp_query = db.collection('user_rewards').order_by('xp', direction='DESCENDING').limit(3)
        xp_winners = []

        for doc in xp_query.stream():
            user_data = doc.to_dict()
            if user_data.get('xp', 0) > 0:
                # Get display name from users collection
                display_name = 'Anonymous'
                try:
                    user_doc = db.collection('users').document(doc.id).get()
                    if user_doc.exists:
                        u = user_doc.to_dict() or {}
                        display_name = _anonymize_username(u.get('display_name') or u.get('email', ''))
                except Exception:
                    pass
                xp_winners.append({
                    'displayName': display_name,
                    'xp': user_data.get('xp', 0),
                    'avatar': user_data.get('avatar_emoji', '🏆')
                })

        return APIResponse.success(
            data={
                'weekStart': last_week_start.isoformat(),
                'weekEnd': last_week_end.isoformat(),
                'winners': {
                    'xp': xp_winners[:3] if xp_winners else []
                }
            },
            message='Weekly winners retrieved'
        )

    except Exception as e:
        logger.error(f"Failed to get weekly winners: {str(e)}")
        return APIResponse.error('Failed to load weekly winners')
