"""
Dashboard Routes
Provides batched dashboard data endpoints for frontend efficiency
"""

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, g, make_response, request

from ..config import COOKIE_SAMESITE, COOKIE_SECURE
from ..firebase_config import db
from ..middleware.csrf_middleware import CSRF_COOKIE_NAME, CSRF_TTL_SECONDS
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import input_sanitizer
from ..utils.response_utils import APIResponse

# Validate user_id format: Firebase UID is alphanumeric 28 chars
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

# Local timezone for day/week boundary calculations (streaks, weekly progress).
# Mood timestamps are stored in UTC; converting to local time ensures a mood
# logged just after local midnight counts toward the correct day.
LOCAL_TZ = ZoneInfo("Europe/Stockholm")


def _parse_to_utc_datetime(timestamp: Any) -> datetime | None:
    """Normalize a Firestore/ISO/epoch timestamp to a timezone-aware UTC datetime."""
    if timestamp is None:
        return None
    try:
        # Firestore Timestamp / datetime exposing timestamp()
        if hasattr(timestamp, 'timestamp') and not isinstance(timestamp, str):
            return datetime.fromtimestamp(timestamp.timestamp(), tz=UTC)
        if isinstance(timestamp, datetime):
            return timestamp.astimezone(UTC) if timestamp.tzinfo else timestamp.replace(tzinfo=UTC)
        if isinstance(timestamp, str):
            parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        if isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp, tz=UTC)
    except (ValueError, TypeError, OSError) as exc:
        logger.debug(f"⚠️ Failed to parse timestamp {timestamp!r}: {exc}")
    return None


def _to_local_date(timestamp: Any):
    """Convert a timestamp to a local-timezone date (for day-boundary logic)."""
    parsed = _parse_to_utc_datetime(timestamp)
    return parsed.astimezone(LOCAL_TZ).date() if parsed else None


dashboard_bp = Blueprint('dashboard', __name__)

def _preflight_response():
    """Return a typed 204 No Content response for OPTIONS preflight requests."""
    return make_response('', 204)

logger = logging.getLogger(__name__)


@dashboard_bp.route('/csrf-token', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def get_csrf_token():
    """
    Generate and persist CSRF token for double-submit cookie validation.
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    csrf_middleware = current_app.extensions.get('csrf_middleware')
    if csrf_middleware is not None:
        token = csrf_middleware.generate_token()
    else:
        import secrets
        token = secrets.token_urlsafe(32)

    response_tuple = APIResponse.success(
        data={'csrfToken': token},
        message='CSRF token generated'
    )
    response = make_response(response_tuple[0], response_tuple[1])
    response.set_cookie(
        CSRF_COOKIE_NAME,
        token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=CSRF_TTL_SECONDS,
        path='/',
    )
    return response


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
_dashboard_cache: dict[str, dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes
CACHE_MAX_SIZE = 1000  # Max entries before cleanup
_last_cleanup = 0.0


def _cleanup_expired_cache() -> None:
    """Remove expired cache entries to prevent memory leak"""
    global _last_cleanup
    now = datetime.now(UTC).timestamp()

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


def _get_cached_data(user_id: str) -> dict[str, Any] | None:
    """Get cached dashboard data if still valid"""
    _cleanup_expired_cache()  # Cleanup on read

    if user_id in _dashboard_cache:
        cached = _dashboard_cache[user_id]
        if datetime.now(UTC).timestamp() - cached.get('_cached_at', 0) < CACHE_TTL_SECONDS:
            return cached
        else:
            # Remove expired entry
            del _dashboard_cache[user_id]
    return None


def _set_cached_data(user_id: str, data: dict[str, Any]) -> None:
    """Cache dashboard data"""
    data['_cached_at'] = datetime.now(UTC).timestamp()
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
        return _preflight_response()

    try:
        # Validate user_id format
        user_id = input_sanitizer.sanitize(user_id, content_type='text', max_length=128)
        if not user_id or not USER_ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        # Verify user owns this data
        if g.user_id != user_id:
            logger.warning("❌ Dashboard - Unauthorized access attempt")
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
                # Strip internal cache metadata before returning to the client
                response_payload = {k: v for k, v in cached_data.items() if k != '_cached_at'}
                response_payload['cached'] = True
                return APIResponse.success(data=response_payload, message='Dashboard summary retrieved (cached)')

        start_time = datetime.now(UTC)

        # Check database availability
        if db is None:
            logger.error("❌ Dashboard - Database unavailable")
            return APIResponse.error('Database unavailable', error_code='SERVICE_UNAVAILABLE', status_code=503)

        # Fetch user data
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        wellness_goals = []
        goal_step_completions = {}
        if user_doc.exists:
            user_data = user_doc.to_dict()
            wellness_goals = user_data.get('wellnessGoals', [])
            goal_step_completions = user_data.get('goalStepCompletions', {})
            # Validate wellness_goals is a list
            if not isinstance(wellness_goals, list):
                logger.warning(f"⚠️ wellness_goals is not a list: {type(wellness_goals)}")
                wellness_goals = []
            # Validate goal_step_completions is a dict
            if not isinstance(goal_step_completions, dict):
                logger.warning(f"⚠️ goal_step_completions is not a dict: {type(goal_step_completions)}")
                goal_step_completions = {}

        # Fetch mood data (last 30 days)
        # CRITICAL FIX: Moods are stored in user subcollection, not root collection
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
        # Calendar week (Monday 00:00 local time) so "denna vecka" matches the UI label.
        now_local = datetime.now(LOCAL_TZ)
        local_week_start = (now_local - timedelta(days=now_local.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_start = local_week_start.astimezone(UTC)

        mood_scores = []
        scored_samples: list[tuple[datetime, float]] = []
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

            # Parse timestamp once (UTC-aware) for weekly window + sparkline samples
            mood_time = _parse_to_utc_datetime(mood_data.get('timestamp'))

            # Add to scores if valid
            if final_score is not None:
                final_score = max(1, min(10, final_score))  # Clamp to 1-10
                mood_scores.append(final_score)
                if mood_time is not None:
                    scored_samples.append((mood_time, final_score))

            # Check if mood is from the current calendar week (local time)
            if mood_time and mood_time >= week_start:
                weekly_progress += 1

        if mood_scores:
            average_mood = round(sum(mood_scores) / len(mood_scores), 1)

        # Build chronological mood samples for the dashboard sparkline so the
        # trend line and the average are derived from the same dataset.
        scored_samples.sort(key=lambda item: item[0])
        mood_trend_samples = [round(score, 1) for _, score in scored_samples[-14:]] if scored_samples else []

        # Fetch chat history count
        # CRITICAL FIX: Chats are stored in user subcollection as 'conversations'
        chat_docs = []
        try:
            chats_ref = db.collection('users').document(user_id).collection('conversations').limit(100)
            chat_docs = list(chats_ref.stream())
            # Count all chat sessions (not just AI prefix - conversations can have different formats)
            total_chats = len(chat_docs)
            logger.info(f"📊 Dashboard - Found {total_chats} chat sessions for user {user_id[:8]}...")
        except Exception as e:
            logger.warning(f"⚠️ Chat query failed: {e}")
            total_chats = 0
            chat_docs = []

        # Count chats from this calendar week (local time)
        weekly_chats = 0
        for doc in chat_docs:
            chat_data = doc.to_dict()
            chat_time = _parse_to_utc_datetime(chat_data.get('timestamp') or chat_data.get('createdAt'))
            if chat_time and chat_time >= week_start:
                weekly_chats += 1

        # Calculate streak days - count consecutive days with mood logs
        streak_days = 0
        if mood_docs:
            logged_dates = set()
            for doc in mood_docs:
                mood_data = doc.to_dict()
                # Use local-timezone date so day boundaries match the user's clock
                mood_date = _to_local_date(mood_data.get('timestamp'))
                if mood_date is not None:
                    logged_dates.add(mood_date)

            # Count consecutive days - start from today or yesterday
            # (if user logged yesterday but not today yet, still count the streak)
            today = datetime.now(LOCAL_TZ).date()
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

            # Calculate longest streak from all logged dates
            longest_streak = 0
            if logged_dates:
                sorted_dates = sorted(logged_dates)
                temp_streak = 1
                for i in range(1, len(sorted_dates)):
                    if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                        temp_streak += 1
                    else:
                        longest_streak = max(longest_streak, temp_streak)
                        temp_streak = 1
                longest_streak = max(longest_streak, temp_streak)
        else:
            longest_streak = 0

        # Build recent activity
        recent_activity = []
        for doc in mood_docs[:5]:
            mood_data = doc.to_dict()
            timestamp = mood_data.get('timestamp')
            if hasattr(timestamp, 'isoformat'):
                timestamp_str = timestamp.isoformat()
            elif hasattr(timestamp, 'timestamp'):
                timestamp_str = datetime.fromtimestamp(timestamp.timestamp(), tz=UTC).isoformat()
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

            # Use mood_text for user-friendly description
            mood_text = mood_data.get('mood_text', 'Kände mig')
            if not isinstance(mood_text, str):
                mood_text = 'Kände mig'

            recent_activity.append({
                'id': doc.id,
                'type': 'mood',
                'timestamp': timestamp_str,
                'description': mood_text
            })

        # Add recent chat sessions to activity so the general timeline isn't empty
        for doc in chat_docs[:3]:
            chat_data = doc.to_dict()
            timestamp = chat_data.get('timestamp')
            if timestamp:
                try:
                    if hasattr(timestamp, 'isoformat'):
                        timestamp_str = timestamp.isoformat()
                    elif hasattr(timestamp, 'timestamp'):
                        timestamp_str = datetime.fromtimestamp(timestamp.timestamp(), tz=UTC).isoformat()
                    elif isinstance(timestamp, str):
                        timestamp_str = timestamp
                    else:
                        timestamp_str = str(timestamp)
                except Exception as e:
                    logger.debug(f"⚠️ Failed to parse chat timestamp: {e}")
                    continue
            else:
                # Skip chat entries without timestamp
                continue

            title = chat_data.get('title', 'Chat session')
            if not isinstance(title, str):
                title = 'Chat session'

            recent_activity.append({
                'id': doc.id,
                'type': 'chat',
                'timestamp': timestamp_str,
                'description': title
            })

        # Sort by timestamp descending so most recent appears first.
        # Parse each timestamp to a comparable UTC datetime so mixed formats
        # (mood isoformat with offset vs. chat raw strings) order correctly.
        epoch = datetime.min.replace(tzinfo=UTC)
        valid_activity = [
            a for a in recent_activity
            if a.get('timestamp') and a['timestamp'] not in ('', 'None', 'null')
        ]
        valid_activity.sort(
            key=lambda x: _parse_to_utc_datetime(x.get('timestamp')) or epoch,
            reverse=True,
        )
        recent_activity = valid_activity

        # Fetch meditation sessions for weekly progress and achievements
        meditation_count = 0
        weekly_meditations = 0
        try:
            med_ref = db.collection('users').document(user_id).collection('meditation_sessions').limit(200)
            med_docs = list(med_ref.stream())
            meditation_count = len(med_docs)
            for doc in med_docs:
                med_data = doc.to_dict()
                med_time = _parse_to_utc_datetime(med_data.get('createdAt') or med_data.get('timestamp'))
                if med_time and med_time >= week_start:
                    weekly_meditations += 1
        except Exception as e:
            logger.warning(f"⚠️ Meditation query failed: {e}")

        # Expand weekly_progress to include all wellness activities this week
        weekly_progress = weekly_progress + weekly_chats + weekly_meditations

        # Calculate real achievements count based on actual milestones
        achievements_count = 0
        # Mood milestones
        if total_moods >= 1:
            achievements_count += 1
        if total_moods >= 10:
            achievements_count += 1
        if total_moods >= 50:
            achievements_count += 1
        if total_moods >= 100:
            achievements_count += 1
        # Streak milestones
        if streak_days >= 3:
            achievements_count += 1
        if streak_days >= 7:
            achievements_count += 1
        if streak_days >= 14:
            achievements_count += 1
        if streak_days >= 30:
            achievements_count += 1
        # Chat milestones
        if total_chats >= 1:
            achievements_count += 1
        if total_chats >= 10:
            achievements_count += 1
        # Meditation milestones
        if meditation_count >= 1:
            achievements_count += 1
        if meditation_count >= 10:
            achievements_count += 1

        response_time = (datetime.now(UTC) - start_time).total_seconds() * 1000

        summary = {
            'totalMoods': total_moods,
            'totalChats': total_chats,
            'averageMood': average_mood,
            'streakDays': streak_days,
            'weeklyGoal': user_data.get('weeklyGoal', 7) if user_doc.exists else 7,
            'weeklyProgress': weekly_progress,
            'wellnessGoals': wellness_goals,
            'goalStepCompletions': goal_step_completions,
            'recentActivity': recent_activity,
            'moodTrendSamples': mood_trend_samples,
            'longestStreak': longest_streak,
            'weeklyChats': weekly_chats,
            'achievementsCount': achievements_count,
            'totalMeditations': meditation_count,
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
        return _preflight_response()

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

        # Check short-lived cache first (60s TTL for quick stats)
        cache_key = f"quick_stats:{user_id}"
        if cache_key in _dashboard_cache:
            cached = _dashboard_cache[cache_key]
            if datetime.now(UTC).timestamp() - cached.get('_cached_at', 0) < 60:
                cached_copy = {k: v for k, v in cached.items() if k != '_cached_at'}
                cached_copy['cached'] = True
                return APIResponse.success(data=cached_copy, message='Quick stats retrieved (cached)')
            else:
                del _dashboard_cache[cache_key]

        # Check database availability
        if db is None:
            logger.error("❌ Quick stats - Database unavailable")
            return APIResponse.error('Database unavailable', error_code='SERVICE_UNAVAILABLE', status_code=503)

        # Quick count queries - CRITICAL FIX: Use correct subcollection paths
        # Fallback to streaming if count() aggregate is not available
        total_moods = 0
        try:
            # Try count() aggregate first (more efficient)
            moods_ref = db.collection('users').document(user_id).collection('moods')
            total_moods = moods_ref.count().get()[0][0].value
        except Exception as e:
            logger.warning(f"⚠️ Quick stats mood count failed (aggregate), trying fallback: {e}")
            try:
                # Fallback: stream and count
                moods_ref = db.collection('users').document(user_id).collection('moods').limit(1000)
                total_moods = len(list(moods_ref.stream()))
            except Exception as e2:
                logger.warning(f"⚠️ Quick stats mood count fallback failed: {e2}")
                total_moods = 0

        total_chats = 0
        try:
            # Try count() aggregate first (more efficient)
            chats_ref = db.collection('users').document(user_id).collection('conversations')
            total_chats = chats_ref.count().get()[0][0].value
        except Exception as e:
            logger.warning(f"⚠️ Quick stats chat count failed (aggregate), trying fallback: {e}")
            try:
                # Fallback: stream and count
                chats_ref = db.collection('users').document(user_id).collection('conversations').limit(1000)
                total_chats = len(list(chats_ref.stream()))
            except Exception as e2:
                logger.warning(f"⚠️ Quick stats chat count fallback failed: {e2}")
                total_chats = 0

        stats_data = {
            'totalMoods': total_moods,
            'totalChats': total_chats,
            'cached': False
        }

        # Cache for 60 seconds
        _dashboard_cache[cache_key] = {**stats_data, '_cached_at': datetime.now(UTC).timestamp()}

        return APIResponse.success(
            data=stats_data,
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
        return _preflight_response()

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
        return _preflight_response()

    if not getattr(g, 'user_id', None):
        return APIResponse.bad_request('User context missing')

    return get_quick_stats(g.user_id)


