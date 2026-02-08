"""
Dashboard Routes
Provides batched dashboard data endpoints for frontend efficiency
"""

from flask import Blueprint, request, jsonify, g
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.audit_service import audit_log
from ..firebase_config import db
from ..utils.input_sanitization import input_sanitizer
from ..utils.response_utils import APIResponse
from datetime import datetime, timezone, timedelta
import logging
import re
from typing import Dict, List, Any

# Validate user_id format: Firebase UID is alphanumeric 28 chars
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

dashboard_bp = Blueprint('dashboard', __name__)
logger = logging.getLogger(__name__)


@dashboard_bp.route('/csrf-token', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def get_csrf_token():
    """
    Generate a CSRF token for the frontend.
    Note: For stateless JWT auth, CSRF is less critical but we provide it for compatibility.
    """
    if request.method == 'OPTIONS':
        return '', 204

    import secrets
    token = secrets.token_urlsafe(32)

    return APIResponse.success(
        data={'csrfToken': token},
        message='CSRF token generated'
    )


def _get_score_from_mood_text(mood_text: str) -> str:
    """Infer score from mood text (Swedish keywords)"""
    mood_text = mood_text.lower() if mood_text else ''
    
    # Very positive moods (8-10)
    if any(word in mood_text for word in ['fantastisk', 'underbar', 'lycklig', 'euforisk', 'strålande']):
        return "9/10"
    if any(word in mood_text for word in ['glad', 'nöjd', 'bra', 'positiv', 'energisk', 'spännande']):
        return "8/10"
    
    # Moderately positive (6-7)
    if any(word in mood_text for word in ['okej', 'lugn', 'avslappnad', 'stabil']):
        return "7/10"
    
    # Neutral (5)
    if any(word in mood_text for word in ['neutral', 'så där', 'varken', 'medel']):
        return "5/10"
    
    # Negative moods (2-4)
    if any(word in mood_text for word in ['trött', 'uttråkad', 'irriterad', 'stressad']):
        return "4/10"
    if any(word in mood_text for word in ['ledsen', 'orolig', 'nervös', 'ängslig']):
        return "3/10"
    if any(word in mood_text for word in ['arg', 'frustrerad', 'deprimerad', 'hopplös']):
        return "2/10"
    
    # Default to neutral if no match
    return "5/10"

# In-memory cache for dashboard data (5 minute TTL)
_dashboard_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_MAX_SIZE = 1000  # Max entries before cleanup
_last_cleanup = 0.0


def _cleanup_expired_cache() -> None:
    """Remove expired cache entries to prevent memory leak"""
    global _last_cleanup
    now = datetime.now(timezone.utc).timestamp()
    
    # Only cleanup every 60 seconds to avoid overhead
    if now - _last_cleanup < 60:
        return
    
    _last_cleanup = now
    expired_keys = [
        key for key, data in _dashboard_cache.items()
        if now - data.get('_cached_at', 0) >= CACHE_TTL_SECONDS
    ]
    
    for key in expired_keys:
        del _dashboard_cache[key]
    
    # If still too large, remove oldest entries
    if len(_dashboard_cache) > CACHE_MAX_SIZE:
        sorted_keys = sorted(
            _dashboard_cache.keys(),
            key=lambda k: _dashboard_cache[k].get('_cached_at', 0)
        )
        for key in sorted_keys[:len(_dashboard_cache) - CACHE_MAX_SIZE]:
            del _dashboard_cache[key]
    
    if expired_keys:
        logger.debug(f"🧹 Cache cleanup: removed {len(expired_keys)} expired entries")


def _get_cached_data(user_id: str) -> Dict[str, Any] | None:
    """Get cached dashboard data if still valid"""
    _cleanup_expired_cache()  # Cleanup on read
    
    if user_id in _dashboard_cache:
        cached = _dashboard_cache[user_id]
        if datetime.now(timezone.utc).timestamp() - cached.get('_cached_at', 0) < CACHE_TTL_SECONDS:
            return cached
        else:
            # Remove expired entry
            del _dashboard_cache[user_id]
    return None


def _set_cached_data(user_id: str, data: Dict[str, Any]) -> None:
    """Cache dashboard data"""
    data['_cached_at'] = datetime.now(timezone.utc).timestamp()
    _dashboard_cache[user_id] = data


@dashboard_bp.route('/<user_id>/summary', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_dashboard_summary(user_id: str):
    """
    Get complete dashboard summary in one API call.
    Replaces multiple getMoods, getWeeklyAnalysis, getChatHistory calls.
    Backend caches for 5 minutes for optimal performance.
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Validate user_id format
        user_id = input_sanitizer.sanitize(user_id, content_type='text', max_length=128)
        if not user_id or not USER_ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        # Verify user owns this data
        if g.user_id != user_id:
            logger.warning(f"❌ Dashboard - Unauthorized access attempt")
            audit_log('unauthorized_dashboard_access', g.user_id, {
                'attempted_user_id': user_id,
                'endpoint': 'summary'
            })
            return APIResponse.forbidden('Unauthorized access')

        # Check for force refresh
        force_refresh = request.args.get('forceRefresh', 'false').lower() == 'true'

        # Check cache first
        if not force_refresh:
            cached_data = _get_cached_data(user_id)
            if cached_data:
                logger.info(f"📊 Dashboard - Cache hit for user: {user_id[:8]}...")
                cached_data['cached'] = True
                return APIResponse.success(data=cached_data, message='Dashboard summary retrieved (cached)')

        start_time = datetime.now(timezone.utc)

        # Check database availability
        if db is None:
            logger.error("❌ Dashboard - Database unavailable")
            return APIResponse.error('Database unavailable', error_code='SERVICE_UNAVAILABLE', status_code=503)

        # Fetch user data
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        wellness_goals = []
        if user_doc.exists:
            user_data = user_doc.to_dict()
            wellness_goals = user_data.get('wellnessGoals', [])

        # Fetch mood data (last 30 days)
        # CRITICAL FIX: Moods are stored in user subcollection, not root collection
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        try:
            # Correct path: users/{user_id}/moods (subcollection)
            moods_ref = db.collection('users').document(user_id).collection('moods').order_by('timestamp', direction='DESCENDING').limit(100)
            mood_docs = list(moods_ref.stream())
            logger.info(f"📊 Dashboard - Found {len(mood_docs)} moods for user {user_id[:8]}...")
        except Exception as e:
            logger.warning(f"⚠️ Mood query failed: {e}")
            mood_docs = []

        total_moods = len(mood_docs)
        
        # Calculate average mood and weekly progress
        average_mood = 0
        weekly_progress = 0
        week_start = datetime.now(timezone.utc) - timedelta(days=7)
        
        mood_scores = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            # CRITICAL FIX: Get score from user input (1-10 scale), not sentiment score
            score = mood_data.get('score')
            sentiment_score = mood_data.get('sentiment_score')
            
            # Determine the best score to use
            final_score = None
            
            # Check if we have a valid user score (1-10, not 0)
            if score is not None:
                try:
                    score_val = float(score)
                    if 1 <= score_val <= 10:
                        # Valid user score
                        final_score = score_val
                    elif score_val == 0:
                        # Score is 0 means not set - try sentiment
                        if sentiment_score is not None:
                            try:
                                sent_val = float(sentiment_score)
                                if -1 <= sent_val <= 1:
                                    final_score = round((sent_val + 1) * 4.5 + 1, 1)
                            except (ValueError, TypeError):
                                pass
                        # Fallback to mood text inference
                        if final_score is None:
                            mood_text = mood_data.get('mood_text', '').lower()
                            inferred = _get_score_from_mood_text(mood_text)
                            if inferred != "N/A":
                                final_score = float(inferred.replace('/10', ''))
                    elif -1 <= score_val <= 1:
                        # This is actually a sentiment score in wrong field
                        final_score = round((score_val + 1) * 4.5 + 1, 1)
                except (ValueError, TypeError):
                    pass
            
            # If still no score, try sentiment_score directly
            if final_score is None and sentiment_score is not None:
                try:
                    sent_val = float(sentiment_score)
                    if -1 <= sent_val <= 1:
                        final_score = round((sent_val + 1) * 4.5 + 1, 1)
                except (ValueError, TypeError):
                    pass
            
            # Add to scores if valid
            if final_score is not None:
                final_score = max(1, min(10, final_score))  # Clamp to 1-10
                mood_scores.append(final_score)
            
            # Check if mood is from this week
            timestamp = mood_data.get('timestamp')
            if timestamp:
                try:
                    if hasattr(timestamp, 'timestamp'):
                        mood_time = datetime.fromtimestamp(timestamp.timestamp(), tz=timezone.utc)
                    elif isinstance(timestamp, str):
                        mood_time = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                    else:
                        mood_time = timestamp if hasattr(timestamp, 'date') else None
                    
                    if mood_time and mood_time >= week_start:
                        weekly_progress += 1
                except Exception as e:
                    logger.debug(f"⚠️ Failed to parse timestamp: {e}")
        
        if mood_scores:
            average_mood = round(sum(mood_scores) / len(mood_scores), 1)

        # Fetch chat history count
        # CRITICAL FIX: Chats are stored in user subcollection as 'conversations'
        try:
            chats_ref = db.collection('users').document(user_id).collection('conversations').limit(100)
            chat_docs = list(chats_ref.stream())
            # Count all chat sessions (not just AI prefix - conversations can have different formats)
            total_chats = len(chat_docs)
            logger.info(f"📊 Dashboard - Found {total_chats} chat sessions for user {user_id[:8]}...")
        except Exception as e:
            logger.warning(f"⚠️ Chat query failed: {e}")
            total_chats = 0

        # Calculate streak days - count consecutive days with mood logs
        streak_days = 0
        if mood_docs:
            logged_dates = set()
            for doc in mood_docs:
                mood_data = doc.to_dict()
                timestamp = mood_data.get('timestamp')
                if timestamp:
                    try:
                        if hasattr(timestamp, 'date'):
                            mood_date = timestamp.date()
                        elif hasattr(timestamp, 'timestamp'):
                            mood_date = datetime.fromtimestamp(timestamp.timestamp(), tz=timezone.utc).date()
                        elif isinstance(timestamp, str):
                            mood_date = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).date()
                        else:
                            continue
                        logged_dates.add(mood_date)
                    except Exception:
                        continue
            
            # Count consecutive days - start from today or yesterday
            # (if user logged yesterday but not today yet, still count the streak)
            today = datetime.now(timezone.utc).date()
            yesterday = today - timedelta(days=1)
            
            # Start from today if logged today, otherwise start from yesterday
            if today in logged_dates:
                current_date = today
            elif yesterday in logged_dates:
                current_date = yesterday
            else:
                current_date = None
            
            # Count consecutive days backwards
            if current_date:
                while current_date in logged_dates:
                    streak_days += 1
                    current_date -= timedelta(days=1)
            
            logger.info(f"📊 Dashboard - Streak: {streak_days} days, logged dates: {len(logged_dates)}")

        # Build recent activity
        recent_activity = []
        for doc in mood_docs[:5]:
            mood_data = doc.to_dict()
            timestamp = mood_data.get('timestamp')
            if hasattr(timestamp, 'isoformat'):
                timestamp_str = timestamp.isoformat()
            elif hasattr(timestamp, 'timestamp'):
                timestamp_str = datetime.fromtimestamp(timestamp.timestamp(), tz=timezone.utc).isoformat()
            else:
                timestamp_str = str(timestamp)
            
            # CRITICAL FIX: Get score properly
            # 'score' is user's 1-10 input, 'sentiment_score' is AI analysis (-1 to 1)
            raw_score = mood_data.get('score')
            sentiment_score = mood_data.get('sentiment_score')
            
            # Determine the best score to display
            score_display = "N/A"
            
            # Check if we have a valid user score (1-10 range, not 0)
            if raw_score is not None:
                try:
                    score_val = float(raw_score)
                    # Valid user score is 1-10 (0 means no score was set)
                    if 1 <= score_val <= 10:
                        # Format nicely (no decimals if whole number)
                        if score_val == int(score_val):
                            score_display = f"{int(score_val)}/10"
                        else:
                            score_display = f"{score_val:.1f}/10"
                    elif score_val == 0 and sentiment_score is not None:
                        # Score is 0, but we have sentiment - use sentiment
                        try:
                            sent_val = float(sentiment_score)
                            # Convert from -1 to 1 range to 1-10
                            converted = round((sent_val + 1) * 4.5 + 1, 1)
                            converted = max(1, min(10, converted))
                            if converted == int(converted):
                                score_display = f"{int(converted)}/10"
                            else:
                                score_display = f"{converted:.1f}/10"
                        except (ValueError, TypeError):
                            # Try mood_text as fallback
                            mood_text = mood_data.get('mood_text', '').lower()
                            score_display = _get_score_from_mood_text(mood_text)
                    elif -1 <= score_val <= 1:
                        # This is actually a sentiment score stored in wrong field
                        converted = round((score_val + 1) * 4.5 + 1, 1)
                        converted = max(1, min(10, converted))
                        if converted == int(converted):
                            score_display = f"{int(converted)}/10"
                        else:
                            score_display = f"{converted:.1f}/10"
                except (ValueError, TypeError):
                    pass
            
            # If still N/A, try sentiment_score
            if score_display == "N/A" and sentiment_score is not None:
                try:
                    sent_val = float(sentiment_score)
                    if -1 <= sent_val <= 1:
                        converted = round((sent_val + 1) * 4.5 + 1, 1)
                        converted = max(1, min(10, converted))
                        if converted == int(converted):
                            score_display = f"{int(converted)}/10"
                        else:
                            score_display = f"{converted:.1f}/10"
                except (ValueError, TypeError):
                    pass
            
            # Last resort: try to infer from mood_text
            if score_display == "N/A":
                mood_text = mood_data.get('mood_text', '').lower()
                score_display = _get_score_from_mood_text(mood_text)
            
            recent_activity.append({
                'id': doc.id,
                'type': 'mood',
                'timestamp': timestamp_str,
                'description': f"Humör loggat: {score_display}"
            })

        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        summary = {
            'totalMoods': total_moods,
            'totalChats': total_chats,
            'averageMood': average_mood,
            'streakDays': streak_days,
            'weeklyGoal': 7,
            'weeklyProgress': weekly_progress,
            'wellnessGoals': wellness_goals,
            'recentActivity': recent_activity,
            'cached': False,
            'responseTime': round(response_time, 2)
        }

        # Cache the result
        _set_cached_data(user_id, summary.copy())

        logger.info(f"✅ Dashboard summary for {user_id[:8]}: {total_moods} moods, {total_chats} chats, {response_time:.0f}ms")
        return APIResponse.success(data=summary, message='Dashboard summary retrieved')

    except Exception as e:
        logger.exception(f"❌ Failed to get dashboard summary: {e}")
        return APIResponse.error('Failed to load dashboard summary')


@dashboard_bp.route('/<user_id>/quick-stats', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_quick_stats(user_id: str):
    """
    Get quick stats for real-time updates (1 minute cache).
    Ultra-fast endpoint for dashboard refresh.
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Validate user_id format
        user_id = input_sanitizer.sanitize(user_id, content_type='text', max_length=128)
        if not user_id or not USER_ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        # Verify user owns this data
        if g.user_id != user_id:
            audit_log('unauthorized_dashboard_access', g.user_id, {
                'attempted_user_id': user_id,
                'endpoint': 'quick-stats'
            })
            return APIResponse.forbidden('Unauthorized access')

        # Check database availability
        if db is None:
            logger.error("❌ Quick stats - Database unavailable")
            return APIResponse.error('Database unavailable', error_code='SERVICE_UNAVAILABLE', status_code=503)

        # Quick count queries - CRITICAL FIX: Use correct subcollection paths
        try:
            # Correct path: users/{user_id}/moods (subcollection)
            moods_ref = db.collection('users').document(user_id).collection('moods').limit(1000)
            total_moods = len(list(moods_ref.stream()))
        except Exception as e:
            logger.warning(f"⚠️ Quick stats mood query failed: {e}")
            total_moods = 0

        try:
            # Correct path: users/{user_id}/conversations (subcollection)
            chats_ref = db.collection('users').document(user_id).collection('conversations').limit(1000)
            total_chats = len(list(chats_ref.stream()))
        except Exception as e:
            logger.warning(f"⚠️ Quick stats chat query failed: {e}")
            total_chats = 0

        return APIResponse.success(
            data={
                'totalMoods': total_moods,
                'totalChats': total_chats,
                'cached': False
            },
            message='Quick stats retrieved'
        )

    except Exception as e:
        logger.exception(f"❌ Failed to get quick stats: {e}")
        return APIResponse.error('Failed to load quick stats')


@dashboard_bp.route('', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_dashboard_legacy():
    """Legacy /api/dashboard endpoint that proxies to the user-specific summary."""
    if request.method == 'OPTIONS':
        return '', 204

    if not getattr(g, 'user_id', None):
        return APIResponse.bad_request('User context missing')

    # Reuse the rich summary endpoint with the authenticated user id
    return get_dashboard_summary(g.user_id)


@dashboard_bp.route('/stats', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_dashboard_legacy_stats():
    """Legacy /api/dashboard/stats endpoint forwarding to quick stats."""
    if request.method == 'OPTIONS':
        return '', 204

    if not getattr(g, 'user_id', None):
        return APIResponse.bad_request('User context missing')

    return get_quick_stats(g.user_id)


