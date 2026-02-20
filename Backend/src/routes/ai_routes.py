import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import SubscriptionService
from src.utils.response_utils import APIResponse

ALLOWED_LOCALES = {'sv', 'en', 'no'}

ai_bp = Blueprint("ai", __name__)
logger = logging.getLogger(__name__)


def _get_db():
    try:
        return db
    except Exception:
        return None


def _check_premium_access(user_id: str):
    """Check if user has premium access for AI features. Returns error response or None."""
    try:
        db_handle = _get_db()
        if db_handle:
            user_doc = db_handle.collection('users').document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            plan_ctx = SubscriptionService.get_plan_context(user_data)
            if not plan_ctx.get('is_premium') and not plan_ctx.get('is_trial'):
                return APIResponse.error(
                    "AI stories and forecasts require a premium subscription",
                    "PREMIUM_REQUIRED",
                    403,
                    {"requiredPlan": "premium"}
                )
    except Exception as e:
        logger.warning("Failed to check premium access: %s", e)
    return None

# 🔹 Generate Personalized Therapeutic Story
@ai_bp.route("/story", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def generate_therapeutic_story():
    """Generate a personalized therapeutic story based on user's mood data"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error("Database unavailable", "SERVICE_UNAVAILABLE", 503)

        logger.info("📖 Therapeutic story generation requested")
        data = request.get_json(force=True, silent=True) or {}

        # Use user_id from JWT only (not from body - security)
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            logger.error("❌ Missing user_id in story request")
            return APIResponse.bad_request("User ID required")

        # Sanitize and validate locale
        locale = data.get("locale", "sv")
        if locale not in ALLOWED_LOCALES:
            locale = "sv"  # Fallback to Swedish

        # Check premium access for AI features
        premium_error = _check_premium_access(user_id)
        if premium_error:
            return premium_error

        # Get user's mood history from database
        mood_ref = db_handle.collection("users").document(user_id).collection("moods")
        mood_docs = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(50).stream())

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

        logger.info(f"📊 Retrieved {len(mood_history)} mood entries for story generation")

        # Generate personalized story
        from src.services.ai_service import ai_services

        try:
            story_result = ai_services.generate_personalized_therapeutic_story(
                user_mood_data=mood_history,
                locale=locale
            )
            logger.info(f"✅ Story generated successfully for user {user_id}")
        except Exception as story_error:
            logger.warning(f"⚠️ Story generation failed, using fallback: {str(story_error)}")
            story_result = ai_services._fallback_therapeutic_story(mood_history, locale)

        # Save story generation to database for tracking
        timestamp = datetime.now(UTC).isoformat()
        story_ref = db_handle.collection("users").document(user_id).collection("stories")

        story_ref.document(f"story_{timestamp}").set({
            "story_content": story_result["story"][:500],  # Store preview
            "locale": locale,
            "mood_data_points": len(mood_history),
            "ai_generated": story_result.get("ai_generated", False),
            "model_used": story_result.get("model_used", "unknown"),
            "confidence": story_result.get("confidence", 0.0),
            "generated_at": timestamp
        })

        # Audit log successful story generation
        audit_log(
            event_type="ai_story_generated",
            user_id=user_id,
            details={
                "locale": locale,
                "mood_data_points": len(mood_history),
                "ai_generated": story_result.get("ai_generated", False)
            }
        )

        return APIResponse.success({
            "story": story_result["story"],
            "locale": locale,
            "moodSummary": story_result.get("mood_summary", {}),
            "aiGenerated": story_result.get("ai_generated", False),
            "modelUsed": story_result.get("model_used", "unknown"),
            "confidence": story_result.get("confidence", 0.0),
            "wordCount": story_result.get("word_count", 0),
            "generatedAt": timestamp
        }, "Therapeutic story generated successfully")

    except Exception as e:
        logger.exception(f"🔥 Fel vid berättelsegenerering: {e}")
        return APIResponse.error("Failed to generate therapeutic story", "STORY_GENERATION_ERROR", 500)

# 🔹 Predictive Mood Forecasting (POST version for AI endpoint)
@ai_bp.route("/forecast", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def generate_ai_mood_forecast():
    """Generate predictive mood forecast using ML models via POST request"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error("Database unavailable", "SERVICE_UNAVAILABLE", 503)

        logger.info("🔮 Mood forecasting requested")
        data = request.get_json(force=True, silent=True) or {}

        # Use user_id from JWT only (not from body - security)
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            logger.error("❌ Missing user_id in forecast request")
            return APIResponse.bad_request("User ID required")

        # Validate and clamp days_ahead
        days_ahead = data.get("days_ahead", 7)
        try:
            days_ahead = int(days_ahead)
        except (ValueError, TypeError):
            days_ahead = 7
        days_ahead = max(1, min(days_ahead, 30))  # Clamp 1-30

        use_sklearn = data.get("use_sklearn", True)  # Default to sklearn model

        # Check premium access for AI features
        premium_error = _check_premium_access(user_id)
        if premium_error:
            return premium_error

        # Get user's mood history from database
        mood_ref = db_handle.collection("users").document(user_id).collection("moods")
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

        # Generate forecast using sklearn ML model
        from src.services.ai_service import ai_services

        try:
            if use_sklearn:
                forecast_result = ai_services.predictive_mood_forecasting_sklearn(
                    mood_history=mood_history,
                    days_ahead=days_ahead
                )
                logger.info(f"✅ ML-based forecast generated successfully for user {user_id}")
            else:
                # Fallback to existing method
                forecast_result = ai_services.predictive_mood_analytics(
                    mood_history=mood_history,
                    days_ahead=days_ahead
                )
                logger.info(f"✅ Fallback forecast generated for user {user_id}")
        except Exception as forecast_error:
            logger.warning(f"⚠️ Forecast generation failed, using basic analytics: {str(forecast_error)}")
            forecast_result = ai_services.predictive_mood_analytics(mood_history, days_ahead)

        # Save forecast to database for tracking
        timestamp = datetime.now(UTC).isoformat()
        forecast_ref = db_handle.collection("users").document(user_id).collection("forecasts")

        forecast_ref.document(f"forecast_{timestamp}").set({
            "forecast_summary": {
                "trend": forecast_result.get("forecast", {}).get("trend", "unknown"),
                "average": forecast_result.get("forecast", {}).get("average_forecast", 0),
                "confidence": forecast_result.get("confidence", 0)
            },
            "days_ahead": days_ahead,
            "model_used": forecast_result.get("model_info", {}).get("algorithm", "unknown") if use_sklearn else "fallback",
            "data_points_used": len(mood_history),
            "risk_factors": forecast_result.get("risk_factors", []),
            "generated_at": timestamp
        })

        # Audit log successful forecast generation
        audit_log(
            event_type="ai_forecast_generated",
            user_id=user_id,
            details={
                "days_ahead": days_ahead,
                "data_points_used": len(mood_history),
                "use_sklearn": use_sklearn
            }
        )

        return APIResponse.success({
            "forecast": forecast_result.get("forecast", {}),
            "modelInfo": forecast_result.get("model_info", {}),
            "currentAnalysis": forecast_result.get("current_analysis", {}),
            "riskFactors": forecast_result.get("risk_factors", []),
            "recommendations": forecast_result.get("recommendations", []),
            "confidence": forecast_result.get("confidence", 0.0),
            "dataPointsUsed": len(mood_history),
            "forecastPeriodDays": days_ahead,
            "generatedAt": timestamp
        }, "Mood forecast generated successfully")

    except Exception as e:
        logger.exception(f"🔥 Fel vid prognosgenerering: {e}")
        return APIResponse.error("Failed to generate mood forecast", "FORECAST_GENERATION_ERROR", 500)

# 🔹 Get User's Story History
@ai_bp.route("/stories", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_story_history():
    """Get user's generated therapeutic stories history"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error("Database unavailable", "SERVICE_UNAVAILABLE", 503)

        # Get user_id from JWT (set by jwt_required decorator)
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return APIResponse.bad_request("User ID required")

        # Get story history
        story_ref = db_handle.collection("users").document(user_id).collection("stories")
        story_docs = list(story_ref.order_by("generated_at", direction="DESCENDING").limit(20).stream())

        stories = []
        for doc in story_docs:
            story_data = doc.to_dict()
            stories.append({
                "id": doc.id,
                "storyPreview": story_data.get("story_content", ""),
                "locale": story_data.get("locale", "sv"),
                "moodDataPoints": story_data.get("mood_data_points", 0),
                "aiGenerated": story_data.get("ai_generated", False),
                "modelUsed": story_data.get("model_used", "unknown"),
                "confidence": story_data.get("confidence", 0.0),
                "generatedAt": story_data.get("generated_at", "")
            })

        return APIResponse.success({"stories": stories}, f"Retrieved {len(stories)} stories")

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av berättelsehistorik: {e}")
        return APIResponse.error("Failed to retrieve story history", "STORY_HISTORY_ERROR", 500)

# 🔹 Get User's Forecast History
@ai_bp.route("/forecasts", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_forecast_history():
    """Get user's mood forecast history"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error("Database unavailable", "SERVICE_UNAVAILABLE", 503)

        # Get user_id from JWT (set by jwt_required decorator)
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return APIResponse.bad_request("User ID required")

        # Get forecast history
        forecast_ref = db_handle.collection("users").document(user_id).collection("forecasts")
        forecast_docs = list(forecast_ref.order_by("generated_at", direction="DESCENDING").limit(20).stream())

        forecasts = []
        for doc in forecast_docs:
            forecast_data = doc.to_dict()
            forecasts.append({
                "id": doc.id,
                "forecastSummary": forecast_data.get("forecast_summary", {}),
                "daysAhead": forecast_data.get("days_ahead", 7),
                "modelUsed": forecast_data.get("model_used", "unknown"),
                "dataPointsUsed": forecast_data.get("data_points_used", 0),
                "riskFactors": forecast_data.get("risk_factors", []),
                "generatedAt": forecast_data.get("generated_at", "")
            })

        return APIResponse.success({"forecasts": forecasts}, f"Retrieved {len(forecasts)} forecasts")

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av prognoshistorik: {e}")
        return APIResponse.error("Failed to retrieve forecast history", "FORECAST_HISTORY_ERROR", 500)
