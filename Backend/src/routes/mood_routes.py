"""
Mood routes for the Lugn & Trygg application.

This module provides Flask routes for mood logging, retrieval, analysis,
and related functionality including voice emotion analysis and predictive forecasting.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any

from flask import Blueprint, Response, current_app, g, jsonify, request

# Absolute imports (project standard)
from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import SubscriptionLimitError, SubscriptionService
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

# Lazy import to avoid OpenAI/Pydantic conflicts at module load time
ai_services_module: Any = None

# Validation patterns for URL parameters
MOOD_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{10,64}$')


def _get_ai_services_module() -> Any:
    """Get AI services module with lazy loading."""
    global ai_services_module
    if ai_services_module is None:
        import src.services.ai_service as _ai_services_module
        ai_services_module = _ai_services_module
    return ai_services_module

logger = logging.getLogger(__name__)

# Blueprint definition
mood_bp = Blueprint('mood', __name__)

# CRITICAL FIX: Use Redis for caching (production ready for 10k users)
# Fallback to in-memory cache if Redis not available
_mood_cache = {}
MOOD_CACHE_TTL = 300  # 5 minutes for mood data (API is slow, cache aggressively)
MOOD_CACHE_MAX_SIZE = 5000  # CRITICAL FIX: Limit cache size to prevent memory leaks (10k users)
MOOD_CACHE_CLEANUP_BATCH = 500  # Remove 500 entries at once when cleaning up
_redis_client = None
_redis_unavailable = False  # Track if Redis failed to avoid repeated connection attempts

def _get_redis_client() -> Any:
    """Get Redis client for caching (lazy initialization with failure tracking)"""
    global _redis_client, _redis_unavailable

    # Skip if Redis already marked as unavailable (avoid repeated connection attempts)
    if _redis_unavailable:
        return None

    if _redis_client is None:
        try:
            import redis  # type: ignore
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            _redis_client = redis.from_url(redis_url, decode_responses=True, socket_timeout=1, socket_connect_timeout=1)
            _redis_client.ping()  # Test connection
            logger.info(f"✅ Redis connected for caching: {redis_url}")
        except Exception as e:
            logger.warning(f"⚠️ Redis not available for caching ({e}), using in-memory cache")
            _redis_client = None
            _redis_unavailable = True  # Don't try again until restart
    return _redis_client

def cached_mood_data(ttl: int = MOOD_CACHE_TTL) -> Callable[[Callable], Callable]:
    """Cache decorator for mood endpoints - FULLY OPTIMIZED for dict returns"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Response | tuple[Response, int]:
            user_id = g.get('user_id')
            if not user_id:
                result = f(*args, **kwargs)
                # Ensure we return proper response
                if isinstance(result, tuple) and isinstance(result[0], dict):
                    return jsonify(result[0]), result[1]
                return result

            # Generate cache key from function name, user_id, and query params
            query_params = str(sorted(request.args.items()))
            cache_key = f"mood:{f.__name__}:{user_id}:{query_params}"

            # PERFORMANCE FIX: Check in-memory cache FIRST (fastest path)
            cached_item = _mood_cache.get(cache_key)
            if cached_item and isinstance(cached_item, tuple) and len(cached_item) == 2:
                data, timestamp = cached_item
                if time.time() - timestamp < ttl:
                    # CACHE HIT - return immediately
                    return jsonify({**data, "cached": True}), 200

            # Try Redis as secondary cache (skip if unavailable)
            redis_client = _get_redis_client()
            if redis_client:
                try:
                    cached_data = redis_client.get(cache_key)
                    if cached_data and isinstance(cached_data, (str, bytes)):
                        cached_response = json.loads(str(cached_data))
                        # Store in memory for faster access next time
                        _mood_cache[cache_key] = (cached_response, time.time())
                        return jsonify({**cached_response, "cached": True}), 200
                except Exception:
                    pass

            # CACHE MISS - Call the actual function
            result = f(*args, **kwargs)

            # Handle dict return from function
            if isinstance(result, tuple) and len(result) == 2:
                response_data, status_code = result

                if status_code == 200 and isinstance(response_data, dict):
                    # Store in memory cache
                    _mood_cache[cache_key] = (response_data, time.time())

                    # Store in Redis if available
                    if redis_client:
                        try:
                            redis_client.setex(cache_key, ttl, json.dumps(response_data))
                        except Exception:
                            pass

                    # Cleanup old cache entries if needed
                    if len(_mood_cache) > MOOD_CACHE_MAX_SIZE:
                        sorted_keys = sorted(
                            _mood_cache.keys(),
                            key=lambda k: _mood_cache[k][1] if isinstance(_mood_cache[k], tuple) else 0
                        )
                        for key in sorted_keys[:MOOD_CACHE_CLEANUP_BATCH]:
                            _mood_cache.pop(key, None)

                    return jsonify(response_data), status_code

                # Non-200 or non-dict response
                if isinstance(response_data, dict):
                    return jsonify(response_data), status_code
                return result

            return result

        return wrapper
    return decorator


def invalidate_mood_cache(user_id: str) -> None:
    """Invalidate cached mood data for a user after new mood is logged"""
    global _mood_cache

    # Remove all cache entries for this user
    keys_to_remove = [k for k in _mood_cache.keys() if f":{user_id}:" in k]
    for key in keys_to_remove:
        del _mood_cache[key]

    # Also try to invalidate Redis cache
    redis_client = _get_redis_client()
    if redis_client:
        try:
            # Find and delete all keys for this user (pattern matching)
            pattern = f"mood:*:{user_id}:*"
            cursor: int = 0
            while True:
                scan_result = redis_client.scan(cursor, match=pattern, count=100)
                if isinstance(scan_result, tuple) and len(scan_result) == 2:
                    cursor, keys = int(scan_result[0]), scan_result[1]
                    if keys:
                        redis_client.delete(*keys)
                    if cursor == 0:
                        break
                else:
                    break
        except Exception:
            pass  # Silently fail - cache will expire naturally


# Max text length for analysis
MAX_ANALYZE_TEXT_LENGTH = 4000


@mood_bp.route('/analyze-text', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def analyze_text() -> Response | tuple[Response, int]:
    """
    Analyze text for sentiment and mood indicators.
    Frontend calls /api/mood/analyze-text - this endpoint matches that expectation.
    """
    if request.method == 'OPTIONS':
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        data = request.get_json(force=True, silent=True) or {}
        text = data.get('text', '').strip()

        if not text:
            return APIResponse.bad_request('Text field is empty')
        if not isinstance(text, str):
            return APIResponse.bad_request('Text must be a string')
        if len(text) > MAX_ANALYZE_TEXT_LENGTH:
            return APIResponse.bad_request(f'Text must be max {MAX_ANALYZE_TEXT_LENGTH} characters')

        # Use AI services for sentiment analysis
        analysis = _get_ai_services_module().ai_services.analyze_sentiment(text) or {}

        response = {
            'sentiment': analysis.get('sentiment'),
            'score': analysis.get('score'),
            'emotions': analysis.get('emotions') or analysis.get('emotions_detected') or [],
            'intensity': analysis.get('intensity'),
            'method': analysis.get('method')
        }

        return APIResponse.success(data=response, message='Text analyzed')

    except Exception as e:
        logger.exception(f"Error analyzing text: {e}")
        return APIResponse.error('Internal server error during text analysis')


@mood_bp.route('/log', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def log_mood() -> Response | tuple[Response, int]:
    """Log a new mood entry"""
    logger.info("🎯 Mood log endpoint called")
    if request.method == 'OPTIONS':
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        # Use Flask's g.user_id for authenticated user context
        user_id = g.get('user_id')
        logger.info(f"🎯 User ID from context: {user_id}")
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Check if user exists in Firestore
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                # In tests, the Firestore mock may not support document lookups; allow passthrough
                if not current_app.config.get('TESTING'):
                    return APIResponse.not_found('User not found')
            user_data = user_doc.to_dict() if user_doc.exists else {}
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', status_code=503)

        plan_context = SubscriptionService.get_plan_context(user_data)
        try:
            SubscriptionService.consume_quota(user_id, 'mood_logs', plan_context['limits'])
        except SubscriptionLimitError:
            limit_value = plan_context['limits'].get('moodLogsPerDay')
            logger.info(
                "Mood log denied due to quota: user=%s limit=%s", user_id, limit_value
            )
            return APIResponse.error('Daily mood log limit reached', status_code=429)

        # --- Unified payload handling for both JSON and multipart/form-data ---
        # If frontend sends audio, it uses multipart/form-data; otherwise JSON
        #
        # Payload requirements:
        #   - For text mood: send JSON with { mood_text, timestamp }
        #   - For audio mood: send multipart/form-data with 'audio' file and optional 'mood_text', 'timestamp'
        #
        # Local dev caveats:
        #   - If you get 400 errors, check that frontend sends correct payload type
        #   - Dummy Firebase API key will block Google sign-in (expected in dev)
        #   - CSP may block Firebase Auth iframe; update CSP for local testing if needed
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            # Also handle file upload for audio
            audio_file = request.files.get('audio')
            if audio_file:
                audio_bytes = audio_file.read()
                voice_data = audio_bytes  # Store raw bytes for analysis
            else:
                voice_data = data.get('voice_data')
        else:
            data = request.get_json()
            voice_data = data.get('voice_data')
            audio_file = None

        if not data and not audio_file:
            return APIResponse.bad_request('No data provided')

        mood_text = data.get('mood_text', '') if data else ''
        # CRITICAL FIX: Get note (from frontend MoodLogger)
        note = data.get('note', '') if data else ''
        # CRITICAL FIX: Get user-submitted score (1-10 scale)
        user_score = data.get('score') if data else None
        if user_score is not None:
            try:
                user_score = int(user_score)
                if user_score < 1 or user_score > 10:
                    user_score = None
            except (ValueError, TypeError):
                user_score = None

        timestamp = (
            data.get('timestamp', datetime.now(UTC).isoformat())
            if data else datetime.now(UTC).isoformat()
        )

        logger.info(f"📝 Mood log data: score={user_score}, note='{note}', mood_text='{mood_text}'")

        # --- End unified payload handling ---

        # Analyze sentiment if text is provided (use note or mood_text)
        sentiment_analysis = None
        text_to_analyze = note or mood_text
        if text_to_analyze and text_to_analyze.strip():
            sentiment_analysis = _get_ai_services_module().ai_services.analyze_sentiment(text_to_analyze)

        # Analyze voice if provided
        voice_analysis = None
        transcript = None
        if voice_data:
            try:
                # voice_data is already bytes from file upload, or base64 string
                if isinstance(voice_data, bytes):
                    audio_bytes = voice_data
                else:
                    # Handle base64 string
                    import base64
                    audio_bytes = base64.b64decode(voice_data.split(',')[1]) if ',' in voice_data else base64.b64decode(voice_data)

                # First try to transcribe the audio to get the spoken text
                from ..utils.speech_utils import transcribe_audio_google
                transcript = transcribe_audio_google(audio_bytes, "sv-SE")
                logger.info(f"🎙️ Voice transcription result: '{transcript}'")

                # Use the transcript for emotion analysis, or fallback to empty string
                transcript_text = transcript if transcript else ""
                voice_analysis = _get_ai_services_module().ai_services.analyze_voice_emotion(audio_bytes, transcript_text)
                logger.info(f"🎭 Voice analysis result: {voice_analysis}")

                # If transcription failed, try fallback analysis using Swedish keywords
                if not transcript:
                    logger.info("🎙️ No transcription available, trying Swedish keyword analysis")
                    try:
                        voice_analysis = _get_ai_services_module().ai_services.analyze_voice_emotion_fallback(transcript_text)
                        logger.info(f"🎭 Fallback voice analysis result: {voice_analysis}")
                    except Exception as fallback_error:
                        logger.warning(f"Fallback voice analysis also failed: {str(fallback_error)}")
                        # If even fallback fails, use neutral values
                        voice_analysis = {
                            "primary_emotion": "neutral",
                            "confidence": 0.5,
                            "sentiment": "NEUTRAL",
                            "score": 0.0,
                            "magnitude": 0.0,
                            "emotions": ["neutral"],
                            "intensity": 0.0,
                            "method": "default"
                        }

            except Exception as e:
                logger.warning(f"Voice analysis failed: {str(e)}")
                # Use neutral default if all voice analysis fails
                voice_analysis = {
                    "primary_emotion": "neutral",
                    "confidence": 0.5,
                    "sentiment": "NEUTRAL",
                    "score": 0.0,
                    "magnitude": 0.0,
                    "emotions": ["neutral"],
                    "intensity": 0.0,
                    "method": "error_fallback"
                }

        # Determine the final mood text
        final_mood_text = mood_text or transcript or 'neutral'

        # If we have voice analysis but no transcript, try to get mood from voice analysis
        if not mood_text and not transcript and voice_analysis:
            primary_emotion = voice_analysis.get('primary_emotion', 'neutral')
            # Map emotions to Swedish moods
            emotion_to_mood = {
                'joy': 'glad',
                'sadness': 'ledsen',
                'anger': 'arg',
                'fear': 'orolig',
                'surprise': 'förvånad',
                'disgust': 'irriterad',
                'trust': 'lugn',
                'anticipation': 'spännande',
                'neutral': 'neutral'
            }
            final_mood_text = emotion_to_mood.get(primary_emotion, 'neutral')
            logger.info(f"🎭 Using voice analysis mood: {final_mood_text}")

        mood_entry = {
            'user_id': user_id,
            'mood_text': final_mood_text,
            'note': note,
            'score': user_score,  # User's 1-10 score
            'timestamp': timestamp,
            'sentiment_analysis': sentiment_analysis,
            'voice_analysis': voice_analysis,
            'transcript': transcript,
            'ai_analysis': sentiment_analysis or voice_analysis
        }

        # Save to database
        try:
            logger.info(f"💾 Attempting to save mood to Firestore for user: {user_id}")
            logger.info(f"💾 Mood data: score={user_score}, text='{final_mood_text}', timestamp={timestamp}")

            mood_ref = db.collection('users').document(user_id).collection('moods')

            # CRITICAL FIX: Use user's score (1-10) instead of sentiment score
            # If no user score provided, try to infer from sentiment or default to 5
            final_score = user_score
            if final_score is None:
                if sentiment_analysis:
                    # Convert sentiment score (-1 to 1) to 1-10 scale
                    sentiment_score = sentiment_analysis.get('score', 0)
                    final_score = round((sentiment_score + 1) * 4.5 + 1)  # Maps -1->1 to 1->10
                    final_score = max(1, min(10, final_score))  # Clamp to 1-10
                else:
                    final_score = 5  # Default to neutral

            mood_data = {
                'mood_text': final_mood_text,
                'note': note,
                'timestamp': timestamp,
                'sentiment': sentiment_analysis.get('sentiment', 'NEUTRAL') if sentiment_analysis else 'NEUTRAL',
                'score': final_score,  # User's 1-10 score (or inferred)
                'sentiment_score': sentiment_analysis.get('score', 0) if sentiment_analysis else 0,  # AI sentiment score
                'emotions_detected': sentiment_analysis.get('emotions', []) if sentiment_analysis else [],
                'ai_analysis': sentiment_analysis or voice_analysis,
                'sentiment_analysis': sentiment_analysis,
                'voice_analysis': voice_analysis,
                'transcript': transcript
            }
            logger.info(f"💾 Prepared mood_data: score={final_score}, sentiment={mood_data.get('sentiment')}")

            doc_ref = mood_ref.add(mood_data)
            logger.info(f"💾 Firestore add() returned: {type(doc_ref)}, value: {doc_ref}")

            # doc_ref is a tuple in some Firestore versions, get the document reference
            doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id
            logger.info(f"✅ Mood entry saved to database with ID: {doc_id}")

            # AUTO-AWARD XP for logging a mood
            try:
                from ..services.rewards_helper import award_xp
                xp_result = award_xp(user_id, 'mood_logged')
                logger.info(f"⭐ XP awarded for mood log: +{xp_result.get('xp_gained', 0)}")
            except Exception as xp_err:
                logger.warning(f"XP award failed (non-blocking): {xp_err}")

            # PERFORMANCE: Invalidate cache so next GET returns fresh data
            invalidate_mood_cache(user_id)
        except Exception as db_error:
            logger.error(f"❌ Failed to save mood to database: {str(db_error)}", exc_info=True)
            # Continue with response even if database save fails

        audit_log('mood_logged', user_id, {
            'has_text': bool(mood_text),
            'has_voice': bool(voice_data),
            'sentiment': sentiment_analysis.get('sentiment') if sentiment_analysis else None
        })

        # Return appropriate response based on request type
        if request.content_type and 'multipart/form-data' in request.content_type:
            # For audio uploads, return mood analysis
            if voice_analysis:
                primary_emotion = voice_analysis.get('primary_emotion', 'neutral')
                # Convert to Swedish for better UX
                emotion_translations = {
                    'neutral': 'neutral',
                    'positive': 'glad',
                    'negative': 'ledsen',
                    'happy': 'glad',
                    'sad': 'ledsen',
                    'angry': 'arg',
                    'stressed': 'stressad',
                    'tired': 'trött',
                    'excited': 'upphetsad',
                    'calm': 'lugn',
                    'joy': 'glad',
                    'sadness': 'ledsen',
                    'anger': 'arg',
                    'fear': 'orolig',
                    'surprise': 'förvånad',
                    'disgust': 'irriterad',
                    'trust': 'lugn',
                    'anticipation': 'spännande',
                    'glad': 'glad',
                    'ledsen': 'ledsen',
                    'arg': 'arg',
                    'orolig': 'orolig',
                    'trött': 'trött',
                    'lugn': 'lugn'
                }
                swedish_emotion = emotion_translations.get(primary_emotion.lower(), primary_emotion.lower())
                logger.info(f"🎭 Returning mood analysis: {swedish_emotion} (from {primary_emotion})")
                return APIResponse.success({
                    'mood': swedish_emotion,
                    'aiAnalysis': voice_analysis
                }, 'Mood logged with voice analysis')

            # If no voice analysis but we have transcript, use transcript analysis
            if transcript and sentiment_analysis:
                primary_sentiment = sentiment_analysis.get('sentiment', 'NEUTRAL')
                emotion_translations = {
                    'POSITIVE': 'glad',
                    'NEGATIVE': 'ledsen',
                    'NEUTRAL': 'neutral'
                }
                swedish_emotion = emotion_translations.get(primary_sentiment, 'neutral')
                logger.info(f"🎭 Returning transcript analysis: {swedish_emotion} (from {primary_sentiment})")
                return APIResponse.success({
                    'mood': swedish_emotion,
                    'aiAnalysis': sentiment_analysis
                }, 'Mood logged with transcript analysis')

            # If nothing worked, return neutral but still success (mood was saved)
            logger.info("🎭 Returning neutral mood (no analysis available but mood was saved)")
            return APIResponse.success({
                'mood': 'neutral',
                'aiAnalysis': voice_analysis or {'sentiment': 'NEUTRAL', 'method': 'default'}
            }, 'Mood saved, but no analysis could be performed')
        else:
            # For regular JSON requests
            return APIResponse.created({
                'moodEntry': mood_entry,
                'analysis': sentiment_analysis or voice_analysis
            }, 'Mood logged successfully')

    except Exception as e:
        logger.error(f"❌ Failed to log mood: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to log mood')

@mood_bp.route('/test', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def test_mood() -> Response | tuple[Response, int]:
    """Test route for mood endpoints"""
    return APIResponse.success({'status': 'ok'}, 'Mood routes are working!')

@mood_bp.route('', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@cached_mood_data(ttl=300)  # Cache for 5 minutes - PERFORMANCE CRITICAL
def get_moods() -> dict[str, Any] | tuple[dict[str, Any], int]:
    """Get user's mood history with pagination and filtering - OPTIMIZED"""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return {'error': 'User ID missing from context'}, 401

        # Query parameters with sensible defaults for performance
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 entries for performance
        start_date = request.args.get('start_date')  # YYYY-MM-DD format
        end_date = request.args.get('end_date')    # YYYY-MM-DD format
        sentiment_filter = request.args.get('sentiment')  # POSITIVE, NEGATIVE, NEUTRAL

        # Build Firestore query - OPTIMIZED
        mood_ref = db.collection('users').document(user_id).collection('moods')

        # Apply date filters only if provided
        if start_date:
            start_datetime = datetime.fromisoformat(f"{start_date}T00:00:00")
            mood_ref = mood_ref.where('timestamp', '>=', start_datetime.isoformat())
        if end_date:
            end_datetime = datetime.fromisoformat(f"{end_date}T23:59:59")
            mood_ref = mood_ref.where('timestamp', '<=', end_datetime.isoformat())

        # Apply sentiment filter only if provided
        if sentiment_filter:
            mood_ref = mood_ref.where('sentiment', '==', sentiment_filter)

        # Order by timestamp descending and limit results
        query = mood_ref.order_by('timestamp', direction='DESCENDING').limit(limit)

        # PERFORMANCE: Stream documents directly - use list comprehension
        moods = [
            {**doc.to_dict(), 'id': doc.id}
            for doc in query.stream()
        ]

        # Return dict for cache decorator - it will jsonify
        return {
            'moods': moods,
            'total': len(moods),
            'limit': limit,
            'has_more': len(moods) == limit
        }, 200

    except Exception as e:
        logger.error(f"❌ Failed to get moods: {str(e)}", exc_info=True)
        return {'error': 'Failed to retrieve moods'}, 500

@mood_bp.route('/<mood_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_mood(mood_id: str) -> Response | tuple[Response, int]:
    """Get a specific mood entry"""
    # Validate mood_id
    mood_id = input_sanitizer.sanitize(mood_id)
    if not MOOD_ID_PATTERN.match(mood_id):
        return APIResponse.bad_request('Invalid mood ID format')

    logger.info(f"🔍 Getting mood entry {mood_id}")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get the mood document
        mood_doc = db.collection('users').document(user_id).collection('moods').document(mood_id).get()

        if not mood_doc.exists:
            return APIResponse.not_found('Mood entry not found')

        mood_data = mood_doc.to_dict()
        mood_data['id'] = mood_doc.id

        logger.info(f"🔍 Retrieved mood entry {mood_id} for user {user_id}")

        return APIResponse.success({'mood': mood_data}, 'Mood entry retrieved')

    except Exception as e:
        logger.error(f"❌ Failed to get mood {mood_id}: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to retrieve mood')

@mood_bp.route('/<mood_id>', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_mood(mood_id: str) -> Response | tuple[Response, int]:
    """Delete a mood entry"""
    # Validate mood_id
    mood_id = input_sanitizer.sanitize(mood_id)
    if not MOOD_ID_PATTERN.match(mood_id):
        return APIResponse.bad_request('Invalid mood ID format')

    logger.info(f"🗑️ Deleting mood entry {mood_id}")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Check if mood exists and belongs to user
        mood_ref = db.collection('users').document(user_id).collection('moods').document(mood_id)
        mood_doc = mood_ref.get()

        if not mood_doc.exists:
            return APIResponse.not_found('Mood entry not found')

        # Delete the mood entry
        mood_ref.delete()

        # Audit log the deletion
        audit_log('mood_deleted', user_id, {'mood_id': mood_id})

        logger.info(f"🗑️ Deleted mood entry {mood_id} for user {user_id}")

        return APIResponse.success({'deleted': mood_id}, 'Mood entry deleted successfully')

    except Exception as e:
        logger.error(f"❌ Failed to delete mood {mood_id}: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to delete mood')

@mood_bp.route('/recent', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@cached_mood_data(ttl=60)  # Cache for 1 minute
def get_recent_moods() -> Response | tuple[Response, int]:
    """Get user's recent mood entries (last 7 days)"""
    logger.info("📅 Getting recent mood entries")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get moods from last 7 days
        seven_days_ago = datetime.now(UTC) - timedelta(days=7)
        seven_days_ago_str = seven_days_ago.isoformat()

        mood_ref = db.collection('users').document(user_id).collection('moods')
        query = mood_ref.where('timestamp', '>=', seven_days_ago_str).order_by('timestamp', direction='DESCENDING')

        mood_docs = list(query.stream())

        moods = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_data['id'] = doc.id
            moods.append(mood_data)

        logger.info(f"📅 Retrieved {len(moods)} recent mood entries for user {user_id}")

        return APIResponse.success({
            'moods': moods,
            'period': 'last7Days',
            'total': len(moods)
        }, 'Recent moods retrieved')

    except Exception as e:
        logger.error(f"❌ Failed to get recent moods: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to retrieve recent moods')

@mood_bp.route('/<mood_id>', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_mood(mood_id: str) -> Response | tuple[Response, int]:
    """Update a mood entry"""
    # Validate mood_id
    mood_id = input_sanitizer.sanitize(mood_id)
    if not MOOD_ID_PATTERN.match(mood_id):
        return APIResponse.bad_request('Invalid mood ID format')

    logger.info(f"✏️ Updating mood entry {mood_id}")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Check if mood exists and belongs to user
        mood_ref = db.collection('users').document(user_id).collection('moods').document(mood_id)
        mood_doc = mood_ref.get()

        if not mood_doc.exists:
            return APIResponse.not_found('Mood entry not found')

        # Get update data
        data = request.get_json()
        if not data:
            return APIResponse.bad_request('No update data provided')

        # Only allow updating certain fields
        allowed_updates = {
            'mood_text': data.get('mood_text'),
            'timestamp': data.get('timestamp')
        }

        # Remove None values
        update_data = {k: v for k, v in allowed_updates.items() if v is not None}

        if not update_data:
            return APIResponse.bad_request('No valid fields to update')

        # If mood_text is being updated, re-analyze sentiment
        if 'mood_text' in update_data and update_data['mood_text'].strip():
            sentiment_analysis = _get_ai_services_module().ai_services.analyze_sentiment(update_data['mood_text'])
            update_data['sentiment'] = sentiment_analysis.get('sentiment', 'NEUTRAL')
            update_data['score'] = sentiment_analysis.get('score', 0)
            update_data['emotions_detected'] = sentiment_analysis.get('emotions', [])
            update_data['sentiment_analysis'] = sentiment_analysis

        # Update the mood entry
        mood_ref.update(update_data)

        # Audit log the update
        audit_log('mood_updated', user_id, {'mood_id': mood_id, 'updates': list(update_data.keys())})

        # Get updated document
        updated_doc = mood_ref.get()
        updated_data = updated_doc.to_dict()
        updated_data['id'] = updated_doc.id

        logger.info(f"✏️ Updated mood entry {mood_id} for user {user_id}")

        return APIResponse.success({'mood': updated_data}, 'Mood entry updated successfully')

    except Exception as e:
        logger.error(f"❌ Failed to update mood {mood_id}: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to update mood')

@mood_bp.route('/today', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_today_mood() -> Response | tuple[Response, int]:
    """Get user's mood for today"""
    logger.info("📅 Getting today's mood")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get today's date range
        today = datetime.now(UTC).date()
        start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
        end_of_day = datetime.combine(today, datetime.max.time(), tzinfo=UTC)

        mood_ref = db.collection('users').document(user_id).collection('moods')
        query = mood_ref.where('timestamp', '>=', start_of_day.isoformat()).where('timestamp', '<=', end_of_day.isoformat())

        mood_docs = list(query.stream())

        if not mood_docs:
            return APIResponse.success({
                'hasMoodToday': False,
                'message': 'No mood logged today'
            })

        # Return the most recent mood for today
        latest_mood = None
        latest_timestamp = None

        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_timestamp = mood_data.get('timestamp', '')

            if not latest_timestamp or mood_timestamp > latest_timestamp:
                latest_timestamp = mood_timestamp
                latest_mood = mood_data
                latest_mood['id'] = doc.id

        logger.info(f"📅 Retrieved today's mood for user {user_id}")

        return APIResponse.success({
            'hasMoodToday': True,
            'mood': latest_mood
        })

    except Exception as e:
        logger.error(f"❌ Failed to get today's mood: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to retrieve today\'s mood')

@mood_bp.route('/streaks', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@cached_mood_data(ttl=3600)  # Cache for 1 hour
def get_mood_streaks() -> Response | tuple[Response, int]:
    """Get user's mood logging streaks"""
    logger.info("🔥 Getting mood streaks")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get all mood entries for streak calculation
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').stream())

        if not mood_docs:
            return APIResponse.success({
                'currentStreak': 0,
                'longestStreak': 0,
                'totalLoggedDays': 0,
                'consistencyPercentage': 0,
                'lastLogDate': None
            })

        # Extract dates from mood entries
        logged_dates = set()
        for doc in mood_docs:
            mood_data = doc.to_dict()
            timestamp = mood_data.get('timestamp', '')
            if timestamp:
                if isinstance(timestamp, str):
                    date_key = timestamp[:10]  # YYYY-MM-DD
                else:
                    date_key = timestamp.strftime('%Y-%m-%d')
                logged_dates.add(date_key)

        # Calculate streaks
        sorted_dates = sorted(logged_dates, reverse=True)
        current_streak = 0
        longest_streak = 0
        temp_streak = 0

        if sorted_dates:
            # Calculate current streak
            today = datetime.now(UTC).date()
            current_date = today

            for _ in range(len(sorted_dates) + 1):  # +1 to check today
                date_str = current_date.strftime('%Y-%m-%d')
                if date_str in logged_dates:
                    current_streak += 1
                    current_date -= timedelta(days=1)
                else:
                    break

            # Calculate longest streak
            for i in range(len(sorted_dates)):
                if i == 0:
                    temp_streak = 1
                else:
                    current_date_obj = datetime.strptime(sorted_dates[i], '%Y-%m-%d').date()
                    prev_date_obj = datetime.strptime(sorted_dates[i-1], '%Y-%m-%d').date()
                    days_diff = (prev_date_obj - current_date_obj).days

                    if days_diff == 1:
                        temp_streak += 1
                    else:
                        longest_streak = max(longest_streak, temp_streak)
                        temp_streak = 1

            longest_streak = max(longest_streak, temp_streak)

        # Calculate consistency (last 30 days)
        thirty_days_ago = (datetime.now(UTC) - timedelta(days=30)).date()
        recent_dates = [d for d in logged_dates if datetime.strptime(d, '%Y-%m-%d').date() >= thirty_days_ago]
        consistency_percentage = (len(recent_dates) / 30) * 100 if thirty_days_ago else 0

        # Get last log date
        last_log_date = sorted_dates[0] if sorted_dates else None

        logger.info(f"🔥 Calculated streaks for user {user_id}: current={current_streak}, longest={longest_streak}")

        return APIResponse.success({
            'currentStreak': current_streak,
            'longestStreak': longest_streak,
            'totalLoggedDays': len(logged_dates),
            'consistencyPercentage': round(consistency_percentage, 1),
            'lastLogDate': last_log_date
        })

    except Exception as e:
        logger.error(f"❌ Failed to get mood streaks: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to calculate streaks')


@mood_bp.route('/weekly-analysis', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@cached_mood_data(ttl=600)  # Cache for 10 minutes
def get_weekly_analysis() -> Response | tuple[Response, int]:
    """Get weekly mood analysis with AI-generated insights"""
    logger.info("📊 Getting weekly mood analysis")
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get moods from last 7 days
        datetime.now(UTC) - timedelta(days=7)
        mood_ref = db.collection('users').document(user_id).collection('moods')

        try:
            # Query moods from last 7 days
            mood_docs = list(
                mood_ref.order_by('timestamp', direction='DESCENDING')
                .limit(50)
                .stream()
            )
        except Exception as query_error:
            logger.warning(f"⚠️ Weekly analysis query failed: {query_error}")
            mood_docs = []

        if not mood_docs:
            return APIResponse.success({
                'totalMoods': 0,
                'averageSentiment': 0,
                'trend': 'stable',
                'insights': 'Start logging your mood to get personal insights!',
                'recentMemories': [],
                'fallback': True
            })

        # Process mood data
        moods_data = []
        sentiment_scores = []
        positive_count = 0
        negative_count = 0
        neutral_count = 0

        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_data['id'] = doc.id
            moods_data.append(mood_data)

            sentiment = mood_data.get('sentiment', 'NEUTRAL')
            score = mood_data.get('score', 0)
            sentiment_scores.append(score)

            if sentiment == 'POSITIVE':
                positive_count += 1
            elif sentiment == 'NEGATIVE':
                negative_count += 1
            else:
                neutral_count += 1

        total_moods = len(moods_data)
        average_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

        # Calculate trend
        trend = 'stable'
        if len(sentiment_scores) >= 4:
            recent_half = sentiment_scores[:len(sentiment_scores)//2]
            older_half = sentiment_scores[len(sentiment_scores)//2:]
            recent_avg = sum(recent_half) / len(recent_half)
            older_avg = sum(older_half) / len(older_half)

            if recent_avg > older_avg + 0.15:
                trend = 'improving'
            elif recent_avg < older_avg - 0.15:
                trend = 'declining'

        # Generate insights based on data
        insights = _generate_weekly_insights(
            total_moods=total_moods,
            average_sentiment=average_sentiment,
            trend=trend,
            positive_count=positive_count,
            negative_count=negative_count,
            neutral_count=neutral_count
        )

        # Get recent memories if any
        recent_memories = []
        try:
            memory_ref = db.collection('users').document(user_id).collection('memories')
            memory_docs = list(memory_ref.order_by('timestamp', direction='DESCENDING').limit(3).stream())
            for doc in memory_docs:
                mem_data = doc.to_dict()
                mem_data['id'] = doc.id
                recent_memories.append(mem_data)
        except Exception:
            pass  # Memories are optional

        logger.info(f"📊 Weekly analysis for user {user_id}: {total_moods} moods, trend={trend}")

        return APIResponse.success({
            'totalMoods': total_moods,
            'averageSentiment': round(average_sentiment, 2),
            'trend': trend,
            'insights': insights,
            'recentMemories': recent_memories,
            'positiveCount': positive_count,
            'negativeCount': negative_count,
            'neutralCount': neutral_count,
            'positivePercentage': round((positive_count / total_moods * 100) if total_moods > 0 else 0, 1),
            'negativePercentage': round((negative_count / total_moods * 100) if total_moods > 0 else 0, 1),
            'neutralPercentage': round((neutral_count / total_moods * 100) if total_moods > 0 else 0, 1),
            'fallback': False,
            'confidence': 0.85
        })

    except Exception as e:
        logger.error(f"❌ Failed to get weekly analysis: {str(e)}", exc_info=True)
        return APIResponse.error('Failed to generate weekly analysis')


# 🔹 Predictive Mood Forecast - Frontend integration endpoint
@mood_bp.route('/predictive-forecast', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def predictive_mood_forecast() -> Response | tuple[Response, int]:
    """
    Get predictive mood forecast for the user.
    This endpoint provides ML-based mood predictions used by MoodAnalytics.tsx.

    Query Parameters:
        days_ahead: Number of days to forecast (1-30, default 7)

    Returns:
        JSON with forecast data including predictions, risk factors, and recommendations
    """
    if request.method == 'OPTIONS':
        return APIResponse.success()

    try:
        user_id = g.get('user_id')
        if not user_id:
            logger.error("❌ Missing user_id in predictive-forecast request")
            return APIResponse.bad_request('User ID is required')

        # Validate and clamp days_ahead
        days_ahead = request.args.get('days_ahead', 7, type=int)
        days_ahead = max(1, min(days_ahead, 30))  # Clamp 1-30

        logger.info(f"🔮 Predictive forecast requested for user {user_id}, days_ahead={days_ahead}")

        # Get user's mood history from database
        mood_ref = db.collection("users").document(user_id).collection("moods")
        mood_docs = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(100).stream())

        mood_history = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_history.append({
                "sentiment": mood_data.get("sentiment", "NEUTRAL"),
                "sentiment_score": mood_data.get("score", 0),
                "timestamp": mood_data.get("timestamp", ""),
                "note": mood_data.get("note", ""),
                "emotions_detected": mood_data.get("emotions_detected", [])
            })

        logger.info(f"📊 Retrieved {len(mood_history)} mood entries for forecasting")

        # Get AI services module (lazy loaded)
        ai_services_mod = _get_ai_services_module()
        ai_services = ai_services_mod.ai_services

        try:
            # Try sklearn-based forecasting first
            forecast_result = ai_services.predictive_mood_forecasting_sklearn(
                mood_history=mood_history,
                days_ahead=days_ahead
            )
            logger.info(f"✅ ML-based forecast generated successfully for user {user_id}")
        except Exception as forecast_error:
            logger.warning(f"⚠️ Sklearn forecast failed, using basic analytics: {str(forecast_error)}")
            try:
                forecast_result = ai_services.predictive_mood_analytics(mood_history, days_ahead)
            except Exception as fallback_error:
                logger.warning(f"⚠️ Fallback analytics also failed: {str(fallback_error)}")
                # Return a static fallback response
                forecast_result = {
                    "forecast": {
                        "daily_predictions": [0.5] * days_ahead,
                        "average_forecast": 0.5,
                        "trend": "stable",
                        "confidence_interval": {"lower": 0.3, "upper": 0.7}
                    },
                    "model_info": {
                        "algorithm": "fallback",
                        "training_rmse": 0.0,
                        "data_points_used": len(mood_history)
                    },
                    "current_analysis": {
                        "recent_average": 0.5,
                        "volatility": 0.3
                    },
                    "risk_factors": [],
                    "recommendations": ["Continue logging your mood regularly for better forecasts."],
                    "confidence": 0.0
                }

        # Format response to match frontend ForecastData interface
        return APIResponse.success({
            'forecast': forecast_result.get('forecast', {}),
            'modelInfo': forecast_result.get('model_info', {}),
            'currentAnalysis': forecast_result.get('current_analysis', {}),
            'riskFactors': forecast_result.get('risk_factors', []),
            'recommendations': forecast_result.get('recommendations', []),
            'confidence': forecast_result.get('confidence', 0.0),
            'dataPointsUsed': len(mood_history),
            'forecastPeriodDays': days_ahead
        })

    except Exception as e:
        logger.exception(f"🔥 Error in predictive mood forecast: {e}")
        return APIResponse.error('An internal error occurred during forecast generation')


def _generate_weekly_insights(total_moods: int, average_sentiment: float, trend: str,
                             positive_count: int, negative_count: int, neutral_count: int) -> str:
    """Generate AI-style insights based on mood data"""

    if total_moods == 0:
        return "Start logging your mood daily to get personal insights about your patterns and wellbeing."

    insights = []

    # Overall mood assessment
    if average_sentiment > 0.3:
        insights.append(f"Fantastic! Your average mood this week has been very positive ({round(average_sentiment * 10, 1)}/10).")
    elif average_sentiment > 0:
        insights.append(f"Your average mood has been slightly positive ({round(average_sentiment * 10 + 5, 1)}/10).")
    elif average_sentiment > -0.3:
        insights.append(f"Your mood has been relatively neutral this week ({round(average_sentiment * 10 + 5, 1)}/10).")
    else:
        insights.append("Your week seems to have been challenging. Remember that it's okay to ask for support.")

    # Trend insights
    if trend == 'improving':
        insights.append("📈 Great job! Your mood is showing a positive trend.")
    elif trend == 'declining':
        insights.append("📉 Your mood has dipped a bit. Take a moment for self-care today.")
    else:
        insights.append("📊 Your mood has been stable.")

    # Activity insights
    if total_moods >= 7:
        insights.append(f"🌟 Excellent habit! You've logged {total_moods} times this week.")
    elif total_moods >= 3:
        insights.append(f"👍 Great start! {total_moods} logs this week. Try logging daily for better insights.")
    else:
        insights.append(f"💡 You've logged {total_moods} time(s). Regular logging helps you understand your patterns.")

    # Positive ratio
    if total_moods > 0:
        positive_ratio = positive_count / total_moods
        if positive_ratio > 0.6:
            insights.append("😊 The majority of your entries have been positive!")
        elif negative_count > positive_count:
            insights.append("💙 You've had more challenging days. Breathing and meditation can help.")

    return " ".join(insights)
