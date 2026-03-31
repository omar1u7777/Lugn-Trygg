"""
Advanced Mood Routes - Professional API Endpoints
Integrates Swedish BERT NLP, LSTM forecasting, and clinical assessments
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import SubscriptionService
from src.utils.response_utils import APIResponse

# Import new professional services
try:
    from src.services.mood_nlp_service import get_mood_nlp
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False

try:
    from src.ml.temporal_lstm import get_lstm_forecaster
    LSTM_AVAILABLE = True
except ImportError:
    LSTM_AVAILABLE = False

try:
    from src.services.clinical_assessment import (
        calculate_phq9, calculate_gad7, assess_clinical_risk,
        PHQ9Assessment, GAD7Assessment
    )
    CLINICAL_AVAILABLE = True
except ImportError:
    CLINICAL_AVAILABLE = False

try:
    from src.services.micro_journaling import (
        get_micro_journaling_service, get_streak_gamification
    )
    JOURNALING_AVAILABLE = True
except ImportError:
    JOURNALING_AVAILABLE = False

logger = logging.getLogger(__name__)

advanced_mood_bp = Blueprint('advanced_mood', __name__)


# =============================================================================
# Swedish BERT NLP Mood Analysis
# =============================================================================

@advanced_mood_bp.route('/analyze', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def analyze_mood_text():
    """
    Analyze mood text using Swedish BERT NLP.
    
    Request:
        text: str - Mood description in Swedish
        include_clinical: bool - Include clinical markers
    
    Response:
        valence: float (-1 to 1)
        arousal: float (0 to 1)
        dominance: float (0 to 1)
        primary_emotion: str
        intensity: int (1-10)
        clinical_indicators: dict
        confidence: float
    """
    if not NLP_AVAILABLE:
        return APIResponse.error("NLP service unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '').strip()
        
        if not text:
            return APIResponse.bad_request("Text is required")
        
        user_id = g.user_id
        
        # Analyze using Swedish BERT
        nlp = get_mood_nlp()
        analysis = nlp.analyze_mood_text(text)
        
        # Log analysis (without storing text for privacy)
        audit_log('mood_nlp_analysis', user_id, {
            'valence': analysis.valence,
            'primary_emotion': analysis.primary_emotion,
            'clinical_risk_sum': sum(analysis.clinical_indicators.values())
        })
        
        # Check for high clinical risk
        high_risk = any(v > 0.5 for v in analysis.clinical_indicators.values())
        
        return APIResponse.success({
            'valence': analysis.valence,
            'arousal': analysis.arousal,
            'dominance': analysis.dominance,
            'primary_emotion': analysis.primary_emotion,
            'secondary_emotions': analysis.secondary_emotions,
            'intensity': analysis.intensity,
            'clinical_indicators': analysis.clinical_indicators,
            'confidence': analysis.confidence,
            'mood_score': nlp.extract_mood_score(text),  # 1-10 scale
            'high_clinical_risk': high_risk
        })
        
    except Exception as e:
        logger.error(f"Mood analysis failed: {e}")
        return APIResponse.error("Analysis failed", "ANALYSIS_ERROR", 500)


# =============================================================================
# Temporal LSTM Forecasting
# =============================================================================

@advanced_mood_bp.route('/forecast', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_advanced_forecast():
    """
    Get advanced mood forecast using Temporal Attention LSTM.
    
    Query params:
        days: int (1-14, default 7)
        include_patterns: bool (discover temporal patterns)
    
    Response:
        forecasts: list of daily predictions with confidence intervals
        temporal_patterns: discovered patterns (if requested)
        model_confidence: overall forecast confidence
    """
    if not LSTM_AVAILABLE:
        # Fallback to basic forecasting
        return _fallback_forecast_endpoint()
    
    try:
        user_id = g.user_id
        days = min(int(request.args.get('days', 7)), 14)
        include_patterns = request.args.get('include_patterns', 'false').lower() == 'true'
        
        # Get user's mood history
        mood_docs = db.collection('users').document(user_id)\
            .collection('moods')\
            .order_by('timestamp')\
            .limit(60)\
            .get()
        
        mood_entries = [doc.to_dict() for doc in mood_docs]
        
        if len(mood_entries) < 14:
            return APIResponse.bad_request(
                f"Need at least 14 mood entries for LSTM forecast, got {len(mood_entries)}"
            )
        
        # Get contextual data
        contextual_data = _get_contextual_data(user_id)
        
        # Generate forecast
        forecaster = get_lstm_forecaster()
        
        # Train if needed (or load pre-trained)
        if len(mood_entries) >= 21:
            training_result = forecaster.train(mood_entries)
            if not training_result.get('success'):
                logger.warning(f"LSTM training failed: {training_result.get('error')}")
        
        forecasts = forecaster.predict(mood_entries, contextual_data, days)
        
        response = {
            'forecasts': [
                {
                    'date': f.timestamp.isoformat(),
                    'predicted_valence': f.predicted_valence,
                    'confidence_interval': {
                        'lower': f.confidence_interval[0],
                        'upper': f.confidence_interval[1]
                    },
                    'uncertainty': f.uncertainty,
                    'contributing_factors': f.contributing_factors,
                    'risk_flags': f.risk_flags
                }
                for f in forecasts
            ],
            'model_type': 'temporal_attention_lstm',
            'training_samples': len(mood_entries)
        }
        
        # Discover patterns if requested
        if include_patterns:
            patterns = forecaster.discover_patterns(mood_entries)
            response['temporal_patterns'] = [
                {
                    'type': p.pattern_type,
                    'strength': p.strength,
                    'description': p.description,
                    'clinical_significance': p.clinical_significance
                }
                for p in patterns
            ]
        
        # Log forecast
        audit_log('lstm_forecast', user_id, {
            'days': days,
            'risk_flags': [f for forecast in forecasts for f in forecast.risk_flags]
        })
        
        return APIResponse.success(response)
        
    except Exception as e:
        logger.error(f"Forecast failed: {e}")
        return APIResponse.error("Forecast generation failed", "FORECAST_ERROR", 500)


def _fallback_forecast_endpoint():
    """Fallback to basic statistical forecasting."""
    try:
        from src.services.predictive_service import predictive_service
        
        user_id = g.user_id
        days = min(int(request.args.get('days', 7)), 14)
        
        mood_docs = db.collection('users').document(user_id)\
            .collection('moods')\
            .order_by('timestamp')\
            .get()
        
        mood_data = [doc.to_dict() for doc in mood_docs]
        result = predictive_service.predict_mood_trend(mood_data, days)
        
        return APIResponse.success({
            'forecasts': result.get('predictions', []),
            'model_type': 'statistical_fallback',
            'note': 'LSTM unavailable - using statistical model'
        })
        
    except Exception as e:
        return APIResponse.error("Forecast unavailable", "FORECAST_ERROR", 503)


# =============================================================================
# Clinical Assessments (PHQ-9, GAD-7)
# =============================================================================

@advanced_mood_bp.route('/assess/phq9', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def assess_phq9():
    """
    Calculate PHQ-9 depression score.
    
    Request:
        responses: dict with keys matching PHQ9 questions, values 0-3
    
    Response:
        total_score, severity, risk_level, recommendations
    """
    if not CLINICAL_AVAILABLE:
        return APIResponse.error("Clinical assessment unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        data = request.get_json(silent=True) or {}
        responses = data.get('responses', {})
        
        if not responses:
            return APIResponse.bad_request("PHQ-9 responses required")
        
        result = calculate_phq9(responses)
        
        # Store assessment (important for tracking over time)
        user_id = g.user_id
        assessment_data = {
            'timestamp': datetime.now(UTC).isoformat(),
            'type': 'phq9',
            'total_score': result.total_score,
            'severity': result.severity,
            'risk_level': result.risk_level.value,
            'suicidal_ideation': result.suicidal_ideation_flag,
            'recommendations': result.recommendations
        }
        
        db.collection('users').document(user_id)\
            .collection('clinical_assessments')\
            .add(assessment_data)
        
        # High risk alert
        if result.risk_level.value in ['severe', 'crisis']:
            audit_log('high_phq9_score', user_id, {
                'score': result.total_score,
                'suicidal': result.suicidal_ideation_flag
            })
        
        return APIResponse.success({
            'total_score': result.total_score,
            'severity': result.severity,
            'risk_level': result.risk_level.value,
            'suicidal_ideation': result.suicidal_ideation_flag,
            'item_scores': result.item_scores,
            'interpretation': result.interpretation,
            'recommendations': result.recommendations
        })
        
    except Exception as e:
        logger.error(f"PHQ-9 assessment failed: {e}")
        return APIResponse.error("Assessment failed", "ASSESSMENT_ERROR", 500)


@advanced_mood_bp.route('/assess/gad7', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def assess_gad7():
    """
    Calculate GAD-7 anxiety score.
    
    Request:
        responses: dict with keys matching GAD7 questions, values 0-3
    
    Response:
        total_score, severity, risk_level, recommendations
    """
    if not CLINICAL_AVAILABLE:
        return APIResponse.error("Clinical assessment unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        data = request.get_json(silent=True) or {}
        responses = data.get('responses', {})
        
        if not responses:
            return APIResponse.bad_request("GAD-7 responses required")
        
        result = calculate_gad7(responses)
        
        # Store assessment
        user_id = g.user_id
        assessment_data = {
            'timestamp': datetime.now(UTC).isoformat(),
            'type': 'gad7',
            'total_score': result.total_score,
            'severity': result.severity,
            'risk_level': result.risk_level.value,
            'recommendations': result.recommendations
        }
        
        db.collection('users').document(user_id)\
            .collection('clinical_assessments')\
            .add(assessment_data)
        
        return APIResponse.success({
            'total_score': result.total_score,
            'severity': result.severity,
            'risk_level': result.risk_level.value,
            'item_scores': result.item_scores,
            'interpretation': result.interpretation,
            'recommendations': result.recommendations
        })
        
    except Exception as e:
        logger.error(f"GAD-7 assessment failed: {e}")
        return APIResponse.error("Assessment failed", "ASSESSMENT_ERROR", 500)


@advanced_mood_bp.route('/assess/comprehensive', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def comprehensive_clinical_assessment():
    """
    Get comprehensive clinical risk assessment combining PHQ-9, GAD-7, and mood history.
    
    Response:
        Full clinical risk assessment with interventions
    """
    if not CLINICAL_AVAILABLE:
        return APIResponse.error("Clinical assessment unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        user_id = g.user_id
        
        # Get recent PHQ-9 and GAD-7
        assessments = db.collection('users').document(user_id)\
            .collection('clinical_assessments')\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(10)\
            .get()
        
        phq9_data = None
        gad7_data = None
        
        for doc in assessments:
            data = doc.to_dict()
            if data.get('type') == 'phq9' and not phq9_data:
                phq9_data = data
            elif data.get('type') == 'gad7' and not gad7_data:
                gad7_data = data
        
        # Get recent mood entries
        mood_docs = db.collection('users').document(user_id)\
            .collection('moods')\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(14)\
            .get()
        
        recent_moods = [doc.to_dict() for doc in mood_docs]
        
        # Perform comprehensive assessment
        assessment = assess_clinical_risk(
            user_id=user_id,
            recent_moods=recent_moods
        )
        
        return APIResponse.success({
            'timestamp': assessment.timestamp.isoformat(),
            'composite_risk': assessment.composite_risk.value,
            'risk_factors': assessment.risk_factors,
            'protective_factors': assessment.protective_factors,
            'immediate_concerns': assessment.immediate_concerns,
            'suggested_interventions': assessment.suggested_interventions,
            'follow_up_recommended': assessment.follow_up_recommended,
            'follow_up_timeframe': assessment.follow_up_timeframe,
            'latest_phq9': phq9_data,
            'latest_gad7': gad7_data
        })
        
    except Exception as e:
        logger.error(f"Comprehensive assessment failed: {e}")
        return APIResponse.error("Assessment failed", "ASSESSMENT_ERROR", 500)


# =============================================================================
# Micro-Journaling API
# =============================================================================

@advanced_mood_bp.route('/journal/smart-prompts', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_smart_prompts():
    """
    Get AI-powered journaling prompts based on context and history.
    """
    if not JOURNALING_AVAILABLE:
        return APIResponse.error("Service unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        user_id = g.user_id
        journaling = get_micro_journaling_service(user_id)
        
        prompts = journaling.get_smart_prompts(n=3)
        
        return APIResponse.success({
            'prompts': [
                {
                    'type': p.type,
                    'content': p.content,
                    'context': p.context,
                    'confidence': p.confidence
                }
                for p in prompts
            ],
            'time_context': datetime.now().hour
        })
        
    except Exception as e:
        logger.error(f"Smart prompts failed: {e}")
        return APIResponse.error("Failed to get prompts", "PROMPT_ERROR", 500)


@advanced_mood_bp.route('/journal/quick-options', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_quick_log_options():
    """
    Get one-tap mood logging options with emojis and pre-filled suggestions.
    """
    if not JOURNALING_AVAILABLE:
        return APIResponse.error("Service unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        user_id = g.user_id
        journaling = get_micro_journaling_service(user_id)
        
        options = journaling.get_quick_log_options()
        
        return APIResponse.success({'options': options})
        
    except Exception as e:
        logger.error(f"Quick options failed: {e}")
        return APIResponse.error("Failed to get options", "OPTIONS_ERROR", 500)


@advanced_mood_bp.route('/journal/suggest-tags', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def suggest_tags():
    """
    Get AI-suggested tags based on journal note content.
    
    Request:
        note: str
        current_tags: list (optional)
    """
    if not JOURNALING_AVAILABLE:
        return APIResponse.error("Service unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        data = request.get_json(silent=True) or {}
        note = data.get('note', '')
        current_tags = data.get('current_tags', [])
        
        user_id = g.user_id
        journaling = get_micro_journaling_service(user_id)
        
        suggestions = journaling.suggest_tags(note, current_tags)
        
        return APIResponse.success({
            'suggested_tags': [
                {
                    'tag': s.content,
                    'category': s.context,
                    'confidence': s.confidence
                }
                for s in suggestions
            ]
        })
        
    except Exception as e:
        logger.error(f"Tag suggestion failed: {e}")
        return APIResponse.error("Failed to suggest tags", "TAG_ERROR", 500)


@advanced_mood_bp.route('/streak', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_streak_status():
    """
    Get current streak with psychologically-informed messaging.
    """
    if not JOURNALING_AVAILABLE:
        return APIResponse.error("Service unavailable", "SERVICE_UNAVAILABLE", 503)
    
    try:
        user_id = g.user_id
        gamification = get_streak_gamification(user_id)
        
        streak = gamification.calculate_streak()
        
        return APIResponse.success(streak)
        
    except Exception as e:
        logger.error(f"Streak calculation failed: {e}")
        return APIResponse.error("Failed to get streak", "STREAK_ERROR", 500)


# =============================================================================
# Helper Functions
# =============================================================================

def _get_contextual_data(user_id: str) -> Optional[Dict]:
    """Get contextual data for mood forecasting."""
    try:
        # Get latest sleep data
        sleep_data = db.collection('users').document(user_id)\
            .collection('biometric_data')\
            .where('type', '==', 'sleep')\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(1)\
            .get()
        
        sleep_hours = 7
        if sleep_data:
            sleep_doc = sleep_data[0].to_dict()
            sleep_hours = sleep_doc.get('hours', 7)
        
        # Get latest activity
        activity_data = db.collection('users').document(user_id)\
            .collection('biometric_data')\
            .where('type', '==', 'steps')\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(1)\
            .get()
        
        steps = 5000
        if activity_data:
            activity_doc = activity_data[0].to_dict()
            steps = activity_doc.get('steps', 5000)
        
        return {
            'sleep_hours': sleep_hours,
            'steps': steps,
            'daylight_hours': 12  # Default
        }
        
    except Exception as e:
        logger.warning(f"Could not get contextual data: {e}")
        return None
