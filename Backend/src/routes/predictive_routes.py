"""
Predictive Analytics Routes for Lugn & Trygg
API endpoints for mood prediction and trend analysis
"""

from flask import Blueprint, request, g
from src.services.auth_service import AuthService
from src.services.predictive_service import predictive_service
from src.services.audit_service import audit_log
from src.services.rate_limiting import rate_limit_by_endpoint
from src.firebase_config import db
from src.utils.response_utils import APIResponse
import logging
from datetime import datetime, timedelta, timezone

try:
    from google.cloud.firestore import FieldFilter
except ImportError:
    FieldFilter = None

try:
    from src.services.ai_service import ai_services
except ImportError:
    ai_services = None

logger = logging.getLogger(__name__)

predictive_bp = Blueprint('predictive', __name__)


@predictive_bp.route('/train', methods=['OPTIONS'])
@predictive_bp.route('/predict', methods=['OPTIONS'])
@predictive_bp.route('/crisis-check', methods=['OPTIONS'])
@predictive_bp.route('/insights', methods=['OPTIONS'])
@predictive_bp.route('/trends', methods=['OPTIONS'])
@predictive_bp.route('/mood-forecast', methods=['OPTIONS'])
def handle_options():
    """Handle CORS preflight requests."""
    return APIResponse.success()


def safe_timestamp_str(ts):
    """Convert timestamp to ISO string safely, handling both datetime and string."""
    if ts is None:
        return ''
    if hasattr(ts, 'isoformat'):
        return ts.isoformat()
    return str(ts)


def extract_mood_entries(mood_docs):
    """Extract mood entries from Firestore documents to list of dicts."""
    mood_entries = []
    for doc in mood_docs:
        mood_data = doc.to_dict() or {}
        ts = mood_data.get('timestamp', '')
        mood_entries.append({
            'timestamp': safe_timestamp_str(ts),
            'mood_text': mood_data.get('mood_text', ''),
            'sentiment_score': mood_data.get('score', 0)
        })
    return mood_entries


@predictive_bp.route('/train', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def train_predictive_model():
    """Train predictive model for user's mood data."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get user's mood entries from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_data = extract_mood_entries(mood_docs)

        # Train model
        result = predictive_service.train_predictive_model(mood_data)

        if result.get('success'):
            # Log successful training
            audit_log('model_training', user_id, {
                'model_type': result.get('model_info', {}).get('type', 'unknown'),
                'performance': result.get('performance', {}),
                'training_samples': result.get('performance', {}).get('training_samples', 0)
            })

            return APIResponse.success(result, "Predictive model trained successfully")
        else:
            return APIResponse.bad_request(
                result.get('error', 'Could not train model'),
                "TRAINING_FAILED"
            )

    except Exception as e:
        logger.error(f"Error training predictive model: {str(e)}")
        return APIResponse.error("Internal server error during model training", "TRAINING_ERROR", 500)

@predictive_bp.route('/predict', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_mood_predictions():
    """Get mood predictions for upcoming days."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        days_ahead = int(request.args.get('days', 7))

        # Validate days parameter
        if days_ahead < 1 or days_ahead > 30:
            return APIResponse.bad_request("Days must be between 1-30", "INVALID_DAYS")

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get user's mood entries from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_data = extract_mood_entries(mood_docs)

        # Generate predictions
        result = predictive_service.predict_mood_trend(mood_data, days_ahead)

        if result.get('success'):
            # Log prediction request
            audit_log('mood_prediction', user_id, {
                'days_predicted': days_ahead,
                'predictions_count': len(result.get('predictions', []))
            })

            return APIResponse.success(
                result,
                f"Mood predictions for {days_ahead} days ahead"
            )
        else:
            return APIResponse.bad_request(
                result.get('error', 'Could not generate predictions'),
                "PREDICTION_FAILED"
            )

    except ValueError:
        return APIResponse.bad_request("Invalid value for days", "INVALID_DAYS")
    except Exception as e:
        logger.error(f"Error getting mood predictions: {str(e)}")
        return APIResponse.error("Internal server error during prediction", "PREDICTION_ERROR", 500)

@predictive_bp.route('/crisis-check', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def check_crisis_risk():
    """Check for potential crisis situations based on mood patterns."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get recent mood entries (last 30 days) from Firestore
        thirty_days_ago_dt = datetime.now(timezone.utc) - timedelta(days=30)
        mood_ref = db.collection('users').document(user_id).collection('moods')
        
        if FieldFilter is not None:
            mood_docs = list(mood_ref.where(filter=FieldFilter('timestamp', '>=', thirty_days_ago_dt))
                .order_by('timestamp', direction='DESCENDING')
                .limit(50)
                .stream())
        else:
            # Fallback without FieldFilter
            mood_docs = list(mood_ref.where('timestamp', '>=', thirty_days_ago_dt)
                .order_by('timestamp', direction='DESCENDING')
                .limit(50)
                .stream())

        mood_data = extract_mood_entries(mood_docs)

        # Analyze crisis risk
        result = predictive_service.detect_crisis_risk(mood_data)

        # Log crisis check (sensitive operation)
        audit_log('crisis_risk_check', user_id, {
            'risk_level': result.get('risk_level', 'unknown'),
            'confidence': result.get('confidence', 0),
            'indicators_count': len(result.get('indicators', []))
        })

        # If high risk, this should trigger additional monitoring/alerts
        if result.get('risk_level') == 'high':
            logger.warning(f"⚠️ High crisis risk detected for user {user_id[:8]}")

        return APIResponse.success(result, "Crisis risk analysis completed")

    except Exception as e:
        logger.error(f"Error checking crisis risk: {str(e)}")
        return APIResponse.error("Internal server error during crisis analysis", "CRISIS_CHECK_ERROR", 500)

@predictive_bp.route('/insights', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_personal_insights():
    """Get personalized insights based on mood patterns and predictions."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get user's mood entries for analysis from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_data = extract_mood_entries(mood_docs)

        if len(mood_data) < 7:
            return APIResponse.bad_request(
                "Need at least 7 mood entries for personal insights",
                "INSUFFICIENT_DATA"
            )

        # Generate insights - using trend prediction as base
        try:
            trend_result = predictive_service.predict_mood_trend(mood_data, 7)
            crisis_result = predictive_service.detect_crisis_risk(mood_data)
            
            # Calculate average sentiment
            avg_score = sum(m.get('sentiment_score', 0) for m in mood_data) / len(mood_data)
            
            insights = {
                'overallMood': 'positive' if avg_score > 0.5 else 'negative' if avg_score < -0.5 else 'neutral',
                'averageScore': round(avg_score, 2),
                'dataPoints': len(mood_data),
                'trendPrediction': trend_result.get('predictions', []),
                'riskAssessment': crisis_result.get('risk_level', 'unknown'),
                'insights': [
                    {'type': 'trend', 'message': 'Your mood trend shows stable patterns' if avg_score > 0 else 'Your mood may need extra attention'},
                    {'type': 'recommendation', 'message': 'Continue with your daily habits' if avg_score > 0 else 'Try mindfulness or exercise'}
                ]
            }
        except Exception as insight_error:
            logger.warning(f"Insights generation fallback: {insight_error}")
            insights = {
                'overallMood': 'neutral',
                'dataPoints': len(mood_data),
                'insights': [{'type': 'info', 'message': 'Continue logging mood for better insights'}]
            }

        # Log insights generation
        audit_log('personal_insights', user_id, {
            'insights_count': len(insights.get('insights', [])),
            'data_points': len(mood_data)
        })

        return APIResponse.success(insights, "Personal insights generated")

    except Exception as e:
        logger.error(f"Error generating personal insights: {str(e)}")
        return APIResponse.error("Internal server error during insights generation", "INSIGHTS_ERROR", 500)

@predictive_bp.route('/trends', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_mood_trends():
    """Get detailed mood trend analysis."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        period = request.args.get('period', '30d')  # 7d, 30d, 90d, 1y

        # Parse period
        period_days = {'7d': 7, '30d': 30, '90d': 90, '1y': 365}
        days = period_days.get(period, 30)

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get mood entries for period from Firestore
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        mood_ref = db.collection('users').document(user_id).collection('moods')
        
        if FieldFilter is not None:
            mood_docs = list(mood_ref.where(filter=FieldFilter('timestamp', '>=', start_date))
                .order_by('timestamp')
                .stream())
        else:
            # Fallback without FieldFilter
            mood_docs = list(mood_ref.where('timestamp', '>=', start_date)
                .order_by('timestamp')
                .stream())

        mood_data = extract_mood_entries(mood_docs)

        # Analyze trends using predict_mood_trend
        if len(mood_data) > 0:
            avg_score = sum(m.get('sentiment_score', 0) for m in mood_data) / len(mood_data)
            
            # Determine trend direction based on recent vs older data
            if len(mood_data) >= 7:
                recent_avg = sum(m.get('sentiment_score', 0) for m in mood_data[-7:]) / 7
                older_avg = sum(m.get('sentiment_score', 0) for m in mood_data[:-7]) / max(len(mood_data) - 7, 1)
                if recent_avg > older_avg + 0.1:
                    trend_direction = 'improving'
                elif recent_avg < older_avg - 0.1:
                    trend_direction = 'declining'
                else:
                    trend_direction = 'stable'
            else:
                trend_direction = 'stable'
            
            trends = {
                'period': period,
                'daysAnalyzed': days,
                'dataPoints': len(mood_data),
                'averageScore': round(avg_score, 2),
                'trendDirection': trend_direction,
                'moodCategory': 'positive' if avg_score > 0.3 else 'negative' if avg_score < -0.3 else 'neutral'
            }
        else:
            trends = {
                'period': period,
                'daysAnalyzed': days,
                'dataPoints': 0,
                'averageScore': 0,
                'trendDirection': 'unknown',
                'moodCategory': 'unknown'
            }

        return APIResponse.success(trends, f"Mood trends for the last {period}")

    except Exception as e:
        logger.error(f"Error getting mood trends: {str(e)}")
        return APIResponse.error("Internal server error during trend analysis", "TRENDS_ERROR", 500)

@predictive_bp.route('/mood-forecast', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def mood_forecast():
    """Get mood forecast for specified days ahead."""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        data = request.get_json(force=True, silent=True) or {}

        days_ahead = data.get("days", 7)
        if not isinstance(days_ahead, int) or days_ahead < 1 or days_ahead > 30:
            days_ahead = 7

        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)

        # Get user's mood entries from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').limit(100).stream())

        mood_data = extract_mood_entries(mood_docs)

        # Generate forecast using sklearn ML model
        if ai_services is None:
            return APIResponse.error("AI services unavailable", "AI_UNAVAILABLE", 503)

        try:
            forecast_result = ai_services.predictive_mood_forecasting_sklearn(
                mood_history=mood_data,
                days_ahead=days_ahead
            )
        except Exception:
            # Fallback to basic analytics
            forecast_result = ai_services.predictive_mood_analytics(mood_data, days_ahead)

        # Save forecast to database for tracking
        timestamp = datetime.now(timezone.utc).isoformat()
        forecast_ref = db.collection("users").document(user_id).collection("forecasts")

        forecast_ref.document(f"forecast_{timestamp}").set({
            "forecastSummary": {
                "trend": forecast_result.get("forecast", {}).get("trend", "unknown"),
                "average": forecast_result.get("forecast", {}).get("average_forecast", 0),
                "confidence": forecast_result.get("confidence", 0)
            },
            "daysAhead": days_ahead,
            "modelUsed": forecast_result.get("model_info", {}).get("algorithm", "fallback") if 'model_info' in forecast_result else "fallback",
            "dataPointsUsed": len(mood_data),
            "generatedAt": timestamp
        })

        return APIResponse.success({
            "forecast": forecast_result.get("forecast", {}),
            "modelInfo": forecast_result.get("model_info", {}),
            "currentAnalysis": forecast_result.get("current_analysis", {}),
            "confidence": forecast_result.get("confidence", 0.0),
            "dataPointsUsed": len(mood_data),
            "forecastPeriodDays": days_ahead,
            "generatedAt": timestamp
        }, "Forecast generated successfully")

    except Exception as e:
        logger.error(f"Error in mood forecast: {str(e)}")
        return APIResponse.error("Internal server error during forecast generation", "FORECAST_ERROR", 500)