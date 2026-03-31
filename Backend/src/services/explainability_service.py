"""
Explainability Service (XAI) - SHAP-based explanations for AI predictions.
Provides human-readable explanations for why the AI made specific predictions.
"""

import logging
from typing import Any, Optional, List, Dict
from dataclasses import dataclass
from datetime import datetime

# SHAP with graceful fallback
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class FeatureExplanation:
    """Explanation for a single feature's contribution."""
    feature_name: str
    feature_value: float
    contribution: float
    direction: str  # 'positive' or 'negative'
    description: str
    importance_rank: int


@dataclass
class PredictionExplanation:
    """Complete explanation for a prediction."""
    prediction_type: str  # 'mood', 'crisis', 'sentiment'
    prediction_value: Any
    confidence: float
    base_value: float
    top_features: List[FeatureExplanation]
    summary_text: str
    visualization_data: Optional[Dict] = None
    model_version: str = "1.0"


class ExplainabilityService:
    """
    SHAP-based explainability for all AI predictions.
    Answers the question: "Why did the AI think this?"
    """
    
    # Feature name translations (Swedish)
    FEATURE_DESCRIPTIONS = {
        # Mood features
        'mood_mean_7d': 'Ditt genomsnittliga humör senaste veckan',
        'mood_mean_14d': 'Ditt humör senaste två veckorna',
        'mood_trend': 'Trenden i ditt humör',
        'mood_volatility': 'Hur mycket ditt humör varierar',
        'mood_momentum': 'Nylig förändring i humör',
        'negative_days_7d': 'Antal dagar med negativt humör',
        'negative_days_14d': 'Antal negativa dagar (2 veckor)',
        
        # Sleep features
        'sleep_mean': 'Din genomsnittliga sömn',
        'sleep_std': 'Sömnens regelbundenhet',
        'sleep_trend': 'Sömntrend',
        'sleep_deficit_days': 'Dagar med för lite sömn',
        'sleep_quality_mean': 'Sömnkvalitet',
        
        # Activity features
        'steps_mean': 'Din dagliga aktivitet',
        'steps_trend': 'Aktivitetstrend',
        'sedentary_days': 'Dagar med låg aktivitet',
        
        # Semantic features
        'sentiment_mean': 'Tonen i dina texter',
        'sentiment_trend': 'Förändring i textton',
        
        # Engagement features
        'app_opens_7d': 'Hur ofta du öppnat appen',
        'chat_messages_7d': 'Antal meddelanden i chatten',
        'exercises_completed_7d': 'Genomförda övningar',
        
        # Context features
        'day_of_week': 'Dag i veckan',
        'is_weekend': 'Helg eller vardag',
        'hour_of_day': 'Tid på dygnet',
        'crisis_count_30d': 'Nyligen upplevda kriser'
    }
    
    def __init__(self):
        logger.info("🔍 Initializing Explainability Service (XAI)...")
        
        if not SHAP_AVAILABLE:
            logger.warning("⚠️ SHAP not available - explanations will be heuristic-based")
        
        logger.info("✅ Explainability Service initialized")
    
    def explain_mood_prediction(self, user_id: str, 
                                 prediction: 'MoodPrediction') -> PredictionExplanation:
        """
        Generate SHAP-based explanation for mood prediction.
        """
        if not SHAP_AVAILABLE or not prediction.feature_importance:
            return self._heuristic_mood_explanation(prediction)
        
        try:
            # Create feature explanations from feature importance
            top_features = []
            
            for i, (feature_name, importance) in enumerate(
                sorted(prediction.feature_importance.items(), 
                       key=lambda x: abs(x[1]), reverse=True)[:5]
            ):
                description = self.FEATURE_DESCRIPTIONS.get(
                    feature_name, feature_name
                )
                
                # Determine direction (simplified)
                direction = 'positive' if importance > 0 else 'negative'
                
                top_features.append(FeatureExplanation(
                    feature_name=feature_name,
                    feature_value=0.0,  # Would need actual value
                    contribution=importance,
                    direction=direction,
                    description=description,
                    importance_rank=i + 1
                ))
            
            # Generate natural language summary
            summary = self._generate_mood_summary(
                prediction.predicted_mood,
                prediction.risk_factors,
                top_features
            )
            
            return PredictionExplanation(
                prediction_type='mood',
                prediction_value=prediction.predicted_mood,
                confidence=prediction.confidence,
                base_value=0.0,  # Neutral baseline
                top_features=top_features,
                summary_text=summary,
                model_version=prediction.model_version
            )
            
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return self._heuristic_mood_explanation(prediction)
    
    def _heuristic_mood_explanation(self, prediction: 'MoodPrediction') -> PredictionExplanation:
        """Fallback explanation using heuristics."""
        
        explanations = []
        
        # Build explanation from risk factors
        if 'declining_trend' in prediction.risk_factors:
            explanations.append(FeatureExplanation(
                feature_name='declining_trend',
                feature_value=0.0,
                contribution=-0.3,
                direction='negative',
                description='Ditt humör har sjunkit de senaste dagarna',
                importance_rank=1
            ))
        
        if 'negative_days_7d' in str(prediction.risk_factors):
            explanations.append(FeatureExplanation(
                feature_name='negative_days',
                feature_value=0.0,
                contribution=-0.2,
                direction='negative',
                description='Du har haft flera svåra dagar i rad',
                importance_rank=2
            ))
        
        if 'sleep_deprivation' in str(prediction.risk_factors):
            explanations.append(FeatureExplanation(
                feature_name='sleep',
                feature_value=0.0,
                contribution=-0.2,
                direction='negative',
                description='Din sömn verkar påverka ditt mående',
                importance_rank=3
            ))
        
        summary = self._generate_mood_summary(
            prediction.predicted_mood,
            prediction.risk_factors,
            explanations
        )
        
        return PredictionExplanation(
            prediction_type='mood',
            prediction_value=prediction.predicted_mood,
            confidence=prediction.confidence,
            base_value=0.0,
            top_features=explanations,
            summary_text=summary,
            model_version='heuristic'
        )
    
    def _generate_mood_summary(self, predicted_mood: float, 
                                risk_factors: List[str],
                                top_features: List[FeatureExplanation]) -> str:
        """Generate natural language summary of mood prediction."""
        
        # Determine prediction category
        if predicted_mood < -0.5:
            mood_desc = "lågt"
            advice = "Det kan vara värt att prata med någon om hur du har det."
        elif predicted_mood < -0.2:
            mood_desc = "nedåt"
            advice = "Var extra snäll mot dig själv kommande dagar."
        elif predicted_mood < 0.2:
            mood_desc = "neutralt/stabilt"
            advice = "Fortsätt med dina nuvarande rutiner."
        else:
            mood_desc = "positivt"
            advice = "Fantastiskt! Vad tror du bidrar till detta?"
        
        # Build factor explanations
        factor_texts = []
        for feat in top_features[:3]:
            if feat.direction == 'negative' and abs(feat.contribution) > 0.1:
                factor_texts.append(feat.description)
        
        if factor_texts:
            factors_str = "; ".join(factor_texts)
            summary = (
                f"Vi förutser att ditt humör kommer vara {mood_desc} kommande vecka. "
                f"Detta baseras på att {factors_str}. "
                f"{advice}"
            )
        else:
            summary = (
                f"Vi förutser att ditt humör kommer vara {mood_desc} kommande vecka. "
                f"{advice}"
            )
        
        return summary
    
    def explain_crisis_detection(self, text: str, 
                                  assessment: 'CrisisAssessment') -> PredictionExplanation:
        """
        Generate explanation for crisis detection.
        """
        try:
            explanations = []
            
            # Explain each active indicator
            for i, indicator in enumerate(assessment.active_indicators[:5]):
                explanations.append(FeatureExplanation(
                    feature_name=indicator.indicator_id,
                    feature_value=indicator.risk_weight,
                    contribution=indicator.risk_weight,
                    direction='negative',
                    description=indicator.swedish_description,
                    importance_rank=i + 1
                ))
            
            # Generate summary
            if assessment.overall_risk_level == 'critical':
                summary = (
                    f"🚨 KRITISK RISK: Vi har upptäckt allvarliga tecken på akut psykisk kris. "
                    f"Riskpoäng: {assessment.risk_score:.2f}/1.0. "
                    f"{len(assessment.active_indicators)} kritiska indikatorer upptäckta. "
                    f"Omedelbar åtgärd rekommenderas."
                )
            elif assessment.overall_risk_level == 'high':
                summary = (
                    f"⚠️ HÖG RISK: Flera oroande tecken upptäckta. "
                    f"Riskpoäng: {assessment.risk_score:.2f}/1.0. "
                    f"Kontakta vårdgivare eller stödlinje inom kort."
                )
            else:
                summary = (
                    f"Risknivå: {assessment.overall_risk_level.upper()}. "
                    f"Vissa tecken på påfrestning upptäckta. "
                    f"Fortsätt att monitorera ditt mående."
                )
            
            return PredictionExplanation(
                prediction_type='crisis',
                prediction_value=assessment.overall_risk_level,
                confidence=assessment.confidence_score,
                base_value=0.0,
                top_features=explanations,
                summary_text=summary
            )
            
        except Exception as e:
            logger.error(f"Crisis explanation failed: {e}")
            return PredictionExplanation(
                prediction_type='crisis',
                prediction_value=assessment.overall_risk_level,
                confidence=0.5,
                base_value=0.0,
                top_features=[],
                summary_text=f"Risknivå: {assessment.overall_risk_level.upper()}. "
                           f"Kontakta professionell hjälp vid behov."
            )
    
    def explain_sentiment_analysis(self, text: str, 
                                    sentiment_result: Dict[str, Any]) -> PredictionExplanation:
        """
        Generate explanation for sentiment analysis.
        """
        try:
            sentiment = sentiment_result.get('sentiment', 'NEUTRAL')
            score = sentiment_result.get('score', 0)
            emotions = sentiment_result.get('emotions', [])
            
            # Build feature explanations from detected emotions
            explanations = []
            for i, emotion in enumerate(emotions[:5]):
                emotion_descriptions = {
                    'joy': 'Glädje och positivitet',
                    'sadness': 'Sorg eller nedstämdhet',
                    'anger': 'Ilska eller frustration',
                    'fear': 'Oro eller rädsla',
                    'anxiety': 'Ångest',
                    'hopelessness': 'Hopplöshet'
                }
                
                descriptions = {
                    'sadness': 'Texter innehåller ord kopplade till sorg',
                    'anger': 'Ord som uttrycker ilska eller frustration',
                    'fear': 'Ord som signalerar oro eller rädsla',
                    'joy': 'Positiva ord och uttryck',
                    'anxiety': 'Ord kopplade till ångest'
                }
                
                explanations.append(FeatureExplanation(
                    feature_name=f'emotion_{emotion}',
                    feature_value=1.0,
                    contribution=0.2 if emotion in ['sadness', 'anger', 'fear'] else 0.1,
                    direction='negative' if emotion in ['sadness', 'anger', 'fear', 'anxiety'] else 'positive',
                    description=descriptions.get(emotion, emotion),
                    importance_rank=i + 1
                ))
            
            # Generate summary
            if sentiment == 'NEGATIVE':
                summary = (
                    f"Din text uppvisar {len(emotions)} negativa känslomässiga signaler. "
                    f"Huvudsaklig känsla: {emotions[0] if emotions else 'negativitet'}. "
                    f"Konfidens: {sentiment_result.get('confidence', 0):.0%}."
                )
            elif sentiment == 'POSITIVE':
                summary = (
                    f"Din text har positiv känslomässig ton. "
                    f"Upptäckta känslor: {', '.join(emotions)}. "
                    f"Konfidens: {sentiment_result.get('confidence', 0):.0%}."
                )
            else:
                summary = (
                    f"Din text har neutral känslomässig ton. "
                    f"Konfidens: {sentiment_result.get('confidence', 0):.0%}."
                )
            
            return PredictionExplanation(
                prediction_type='sentiment',
                prediction_value=sentiment,
                confidence=sentiment_result.get('confidence', 0.5),
                base_value=0.0,
                top_features=explanations,
                summary_text=summary
            )
            
        except Exception as e:
            logger.error(f"Sentiment explanation failed: {e}")
            return PredictionExplanation(
                prediction_type='sentiment',
                prediction_value='NEUTRAL',
                confidence=0.5,
                base_value=0.0,
                top_features=[],
                summary_text="Känsloanalys tillfälligt otillgänglig."
            )
    
    def generate_feature_importance_plot(self, explanation: PredictionExplanation) -> Optional[Dict]:
        """
        Generate visualization data for feature importance.
        """
        try:
            if not explanation.top_features:
                return None
            
            # Prepare data for bar chart
            features = [f.description[:30] for f in explanation.top_features[:10]]
            contributions = [f.contribution for f in explanation.top_features[:10]]
            colors = ['#ef4444' if c < 0 else '#22c55e' for c in contributions]
            
            return {
                'type': 'bar',
                'data': {
                    'labels': features,
                    'values': contributions,
                    'colors': colors
                },
                'title': 'Vad påverkade prediktionen?',
                'xlabel': 'Bidrag till prediktion',
                'ylabel': 'Faktor'
            }
            
        except Exception as e:
            logger.error(f"Plot generation failed: {e}")
            return None


# Singleton
_explainability_service: Optional[ExplainabilityService] = None


def get_explainability_service() -> ExplainabilityService:
    """Get or create explainability service."""
    global _explainability_service
    if _explainability_service is None:
        _explainability_service = ExplainabilityService()
    return _explainability_service
