"""
ML Mood Prediction Service - Random Forest + LSTM ensemble for mood forecasting.
Replaces np.polyfit() with sophisticated ML models.
"""

import logging
import numpy as np
from typing import Any, Optional, List, Dict, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import pickle
import os

# ML libraries with graceful fallback
try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.optimizers import Adam
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

from ..config.firebase_config import db

logger = logging.getLogger(__name__)


@dataclass
class MoodPrediction:
    """A mood prediction with metadata."""
    predicted_mood: float  # -1.0 to 1.0
    confidence: float  # 0.0 to 1.0
    prediction_date: datetime
    feature_importance: Dict[str, float]
    risk_factors: List[str]
    recommendations: List[str]
    model_version: str


@dataclass
class PredictionMetrics:
    """Model performance metrics."""
    mae: float
    rmse: float
    mape: float
    r2: float
    confidence_calibration: float


class FeatureEngineer:
    """
    Feature engineering for mood prediction.
    Creates ML features from user data including mood history, sleep, activity, etc.
    """
    
    def __init__(self):
        logger.info("🔧 Initializing Feature Engineer...")
    
    def engineer_features(self, user_id: str, days_history: int = 30) -> Optional[np.ndarray]:
        """
        Create feature vector for mood prediction.
        
        Features extracted:
        - Mood statistics (mean, std, trend)
        - Sleep patterns (hours, consistency)
        - Activity levels (steps, app usage)
        - Semantic sentiment trends
        - Temporal features (day of week, season)
        - Biometric data (if available)
        """
        try:
            features = {}
            
            # 1. Mood features
            mood_data = self._get_mood_history(user_id, days=days_history)
            if len(mood_data) < 7:
                logger.warning(f"Insufficient mood data for user {user_id[:8]}...")
                return None
            
            # Mood statistics
            mood_scores = np.array([m.get('score', 0) for m in mood_data])
            features['mood_mean_7d'] = np.mean(mood_scores[-7:])
            features['mood_mean_14d'] = np.mean(mood_scores[-14:]) if len(mood_scores) >= 14 else features['mood_mean_7d']
            features['mood_mean_30d'] = np.mean(mood_scores)
            features['mood_std_7d'] = np.std(mood_scores[-7:])
            features['mood_volatility'] = np.std(mood_scores)
            
            # Mood trend (linear regression)
            x = np.arange(len(mood_scores))
            features['mood_trend'] = np.polyfit(x, mood_scores, 1)[0]
            
            # Recent momentum (last 3 days vs previous 3)
            if len(mood_scores) >= 6:
                recent = np.mean(mood_scores[-3:])
                previous = np.mean(mood_scores[-6:-3])
                features['mood_momentum'] = recent - previous
            else:
                features['mood_momentum'] = 0.0
            
            # Min/max extremes
            features['mood_min_7d'] = np.min(mood_scores[-7:])
            features['mood_max_7d'] = np.max(mood_scores[-7:])
            
            # Count of negative days
            features['negative_days_7d'] = np.sum(mood_scores[-7:] < -0.3)
            features['negative_days_14d'] = np.sum(mood_scores[-14:] < -0.3) if len(mood_scores) >= 14 else features['negative_days_7d']
            
            # 2. Sleep features (from wearables or user input)
            sleep_data = self._get_sleep_data(user_id, days=14)
            if sleep_data:
                sleep_hours = np.array([s.get('hours', 0) for s in sleep_data])
                features['sleep_mean'] = np.mean(sleep_hours)
                features['sleep_std'] = np.std(sleep_hours)
                features['sleep_trend'] = np.polyfit(np.arange(len(sleep_hours)), sleep_hours, 1)[0] if len(sleep_hours) > 1 else 0
                features['sleep_deficit_days'] = np.sum(sleep_hours < 6)
                features['sleep_quality_mean'] = np.mean([s.get('quality', 5) for s in sleep_data])
            else:
                # Default values if no sleep data
                features['sleep_mean'] = 7.0
                features['sleep_std'] = 1.0
                features['sleep_trend'] = 0.0
                features['sleep_deficit_days'] = 0
                features['sleep_quality_mean'] = 5.0
            
            # 3. Activity features
            activity_data = self._get_activity_data(user_id, days=14)
            if activity_data:
                steps = np.array([a.get('steps', 0) for a in activity_data])
                features['steps_mean'] = np.mean(steps)
                features['steps_std'] = np.std(steps)
                features['steps_trend'] = np.polyfit(np.arange(len(steps)), steps, 1)[0] if len(steps) > 1 else 0
                features['sedentary_days'] = np.sum(steps < 3000)
            else:
                features['steps_mean'] = 5000
                features['steps_std'] = 2000
                features['steps_trend'] = 0.0
                features['sedentary_days'] = 0
            
            # 4. Semantic sentiment features
            sentiment_data = self._get_sentiment_history(user_id, days=7)
            if sentiment_data:
                sentiments = np.array([s.get('score', 0) for s in sentiment_data])
                features['sentiment_mean'] = np.mean(sentiments)
                features['sentiment_trend'] = np.polyfit(np.arange(len(sentiments)), sentiments, 1)[0] if len(sentiments) > 1 else 0
            else:
                features['sentiment_mean'] = 0.0
                features['sentiment_trend'] = 0.0
            
            # 5. App engagement features
            engagement = self._get_app_engagement(user_id, days=7)
            features['app_opens_7d'] = engagement.get('opens', 0)
            features['chat_messages_7d'] = engagement.get('chat_messages', 0)
            features['exercises_completed_7d'] = engagement.get('exercises_completed', 0)
            
            # 6. Temporal features
            now = datetime.now()
            features['day_of_week'] = now.weekday()  # 0=Monday
            features['is_weekend'] = 1 if now.weekday() >= 5 else 0
            features['hour_of_day'] = now.hour
            features['month'] = now.month
            features['days_since_start'] = (now - mood_data[0].get('timestamp', now)).days if mood_data else 0
            
            # 7. Crisis/intervention history
            crisis_count = self._get_crisis_count(user_id, days=30)
            features['crisis_count_30d'] = crisis_count
            
            # Convert to array (maintain consistent ordering)
            feature_names = [
                'mood_mean_7d', 'mood_mean_14d', 'mood_mean_30d', 'mood_std_7d', 'mood_volatility',
                'mood_trend', 'mood_momentum', 'mood_min_7d', 'mood_max_7d',
                'negative_days_7d', 'negative_days_14d',
                'sleep_mean', 'sleep_std', 'sleep_trend', 'sleep_deficit_days', 'sleep_quality_mean',
                'steps_mean', 'steps_std', 'steps_trend', 'sedentary_days',
                'sentiment_mean', 'sentiment_trend',
                'app_opens_7d', 'chat_messages_7d', 'exercises_completed_7d',
                'day_of_week', 'is_weekend', 'hour_of_day', 'month', 'days_since_start',
                'crisis_count_30d'
            ]
            
            feature_vector = np.array([features[name] for name in feature_names])
            
            return feature_vector
            
        except Exception as e:
            logger.error(f"Feature engineering failed for user {user_id[:8]}...: {e}")
            return None
    
    def _get_mood_history(self, user_id: str, days: int) -> List[dict]:
        """Fetch mood history from Firestore."""
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            mood_docs = db.collection('users').document(user_id)\
                .collection('moods')\
                .where('timestamp', '>=', start_date.isoformat())\
                .order_by('timestamp')\
                .get()
            
            return [doc.to_dict() for doc in mood_docs]
        except Exception as e:
            logger.warning(f"Failed to fetch mood history: {e}")
            return []
    
    def _get_sleep_data(self, user_id: str, days: int) -> List[dict]:
        """Fetch sleep data from wearables or user input."""
        try:
            # Try to get from biometric data first
            sleep_docs = db.collection('users').document(user_id)\
                .collection('biometric_data')\
                .where('type', '==', 'sleep')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(days)\
                .get()
            
            return [doc.to_dict() for doc in sleep_docs]
        except Exception as e:
            logger.warning(f"Failed to fetch sleep data: {e}")
            return []
    
    def _get_activity_data(self, user_id: str, days: int) -> List[dict]:
        """Fetch activity data."""
        try:
            activity_docs = db.collection('users').document(user_id)\
                .collection('biometric_data')\
                .where('type', '==', 'steps')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(days)\
                .get()
            
            return [doc.to_dict() for doc in activity_docs]
        except Exception as e:
            logger.warning(f"Failed to fetch activity data: {e}")
            return []
    
    def _get_sentiment_history(self, user_id: str, days: int) -> List[dict]:
        """Fetch sentiment analysis from chat messages."""
        try:
            # Get chat sentiments from conversations
            conv_docs = db.collection('users').document(user_id)\
                .collection('conversations')\
                .where('role', '==', 'user')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(days * 2)\
                .get()
            
            sentiments = []
            for doc in conv_docs:
                data = doc.to_dict()
                if 'sentiment_score' in data:
                    sentiments.append({'score': data['sentiment_score']})
            
            return sentiments
        except Exception as e:
            logger.warning(f"Failed to fetch sentiment history: {e}")
            return []
    
    def _get_app_engagement(self, user_id: str, days: int) -> dict:
        """Fetch app engagement metrics."""
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            # Count various interactions
            opens = db.collection('users').document(user_id)\
                .collection('analytics')\
                .where('event', '==', 'app_open')\
                .where('timestamp', '>=', start_date.isoformat())\
                .get()
            
            chats = db.collection('users').document(user_id)\
                .collection('conversations')\
                .where('timestamp', '>=', start_date.isoformat())\
                .get()
            
            exercises = db.collection('users').document(user_id)\
                .collection('completed_exercises')\
                .where('completed_at', '>=', start_date.isoformat())\
                .get()
            
            return {
                'opens': len(opens),
                'chat_messages': len(chats),
                'exercises_completed': len(exercises)
            }
        except Exception as e:
            logger.warning(f"Failed to fetch engagement data: {e}")
            return {'opens': 0, 'chat_messages': 0, 'exercises_completed': 0}
    
    def _get_crisis_count(self, user_id: str, days: int) -> int:
        """Count recent crisis events."""
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            crisis_docs = db.collection('crisis_alerts')\
                .where('user_id', '==', user_id)\
                .where('created_at', '>=', start_date.isoformat())\
                .get()
            
            return len(crisis_docs)
        except Exception as e:
            logger.warning(f"Failed to fetch crisis count: {e}")
            return 0


class MoodPredictor:
    """
    Hybrid ML model: Random Forest for feature importance + LSTM for time-series patterns.
    Replaces np.polyfit() with sophisticated predictive modeling.
    """
    
    def __init__(self, model_path: Optional[str] = None):
        logger.info("🤖 Initializing Mood Predictor (Random Forest + LSTM)...")
        
        self.feature_engineer = FeatureEngineer()
        self.scaler = StandardScaler() if SKLEARN_AVAILABLE else None
        
        # Initialize models
        self.rf_model: Optional[RandomForestRegressor] = None
        self.lstm_model: Optional[Any] = None
        self.model_path = model_path or os.getenv('MODEL_PATH', './models')
        
        # Try to load pre-trained models
        self._load_models()
        
        logger.info("✅ Mood Predictor initialized")
    
    def _load_models(self):
        """Load pre-trained models from disk."""
        try:
            # Load Random Forest
            rf_path = os.path.join(self.model_path, 'mood_rf_model.pkl')
            if os.path.exists(rf_path):
                with open(rf_path, 'rb') as f:
                    self.rf_model = pickle.load(f)
                logger.info("✅ Loaded Random Forest model")
            else:
                logger.warning("⚠️ No pre-trained RF model found, will use fallback")
            
            # Load LSTM
            lstm_path = os.path.join(self.model_path, 'mood_lstm_model.keras')
            if os.path.exists(lstm_path) and TENSORFLOW_AVAILABLE:
                self.lstm_model = load_model(lstm_path)
                logger.info("✅ Loaded LSTM model")
            else:
                logger.warning("⚠️ No pre-trained LSTM model found, will use fallback")
            
            # Load scaler
            scaler_path = os.path.join(self.model_path, 'mood_scaler.pkl')
            if os.path.exists(scaler_path):
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info("✅ Loaded feature scaler")
                
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
    
    def predict_next_week(self, user_id: str) -> Optional[MoodPrediction]:
        """
        Predict mood for the next 7 days with confidence intervals.
        
        Returns:
            MoodPrediction with predicted mood, confidence, and recommendations
        """
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not available, using heuristic prediction")
            return self._heuristic_prediction(user_id)
        
        try:
            # Engineer features
            features = self.feature_engineer.engineer_features(user_id, days_history=30)
            if features is None:
                logger.warning(f"Could not engineer features for user {user_id[:8]}...")
                return self._heuristic_prediction(user_id)
            
            # Scale features
            if self.scaler:
                features_scaled = self.scaler.transform(features.reshape(1, -1))
            else:
                features_scaled = features.reshape(1, -1)
            
            # Random Forest prediction (with feature importance)
            rf_pred = None
            feature_importance = {}
            if self.rf_model:
                rf_pred = self.rf_model.predict(features_scaled)[0]
                
                # Get feature importance
                importance = self.rf_model.feature_importances_
                feature_names = self._get_feature_names()
                feature_importance = dict(zip(feature_names, importance))
                feature_importance = dict(sorted(
                    feature_importance.items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:10])  # Top 10 features
            
            # LSTM prediction (if available)
            lstm_pred = None
            if self.lstm_model and TENSORFLOW_AVAILABLE:
                # Reshape for LSTM: (samples, timesteps, features)
                # For now, use features as single timestep
                lstm_input = features_scaled.reshape(1, 1, -1)
                lstm_pred = self.lstm_model.predict(lstm_input, verbose=0)[0][0]
            
            # Ensemble prediction (weighted average)
            if rf_pred is not None and lstm_pred is not None:
                # Weight LSTM higher for temporal patterns
                ensemble_pred = 0.4 * rf_pred + 0.6 * lstm_pred
            elif rf_pred is not None:
                ensemble_pred = rf_pred
            elif lstm_pred is not None:
                ensemble_pred = lstm_pred
            else:
                # Fallback to simple heuristic
                return self._heuristic_prediction(user_id)
            
            # Clip prediction to valid range
            ensemble_pred = np.clip(ensemble_pred, -1.0, 1.0)
            
            # Calculate confidence based on data quality and model agreement
            confidence = self._calculate_confidence(features, rf_pred, lstm_pred)
            
            # Identify risk factors
            risk_factors = self._identify_risk_factors(features, feature_importance)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                ensemble_pred, risk_factors, feature_importance
            )
            
            return MoodPrediction(
                predicted_mood=ensemble_pred,
                confidence=confidence,
                prediction_date=datetime.now(),
                feature_importance=feature_importance,
                risk_factors=risk_factors,
                recommendations=recommendations,
                model_version="2.0.0"
            )
            
        except Exception as e:
            logger.error(f"Prediction failed for user {user_id[:8]}...: {e}")
            return self._heuristic_prediction(user_id)
    
    def _heuristic_prediction(self, user_id: str) -> MoodPrediction:
        """Fallback heuristic prediction using recent trends."""
        try:
            # Get recent mood data
            mood_data = self.feature_engineer._get_mood_history(user_id, days=14)
            
            if not mood_data:
                return MoodPrediction(
                    predicted_mood=0.0,
                    confidence=0.3,
                    prediction_date=datetime.now(),
                    feature_importance={},
                    risk_factors=['insufficient_data'],
                    recommendations=['Fortsätt logga ditt humör för bättre prediktioner'],
                    model_version="heuristic"
                )
            
            mood_scores = [m.get('score', 0) for m in mood_data]
            
            # Simple trend extrapolation
            if len(mood_scores) >= 3:
                trend = (mood_scores[-1] - mood_scores[-3]) / 3
                prediction = mood_scores[-1] + (trend * 7)  # Project 7 days
            else:
                prediction = np.mean(mood_scores)
            
            prediction = np.clip(prediction, -1.0, 1.0)
            
            return MoodPrediction(
                predicted_mood=prediction,
                confidence=0.4,  # Lower confidence for heuristic
                prediction_date=datetime.now(),
                feature_importance={'recent_trend': 1.0},
                risk_factors=['insufficient_data_for_ml'],
                recommendations=['Fortsätt logga humör för att aktivera ML-prediktioner'],
                model_version="heuristic"
            )
            
        except Exception as e:
            logger.error(f"Heuristic prediction failed: {e}")
            return MoodPrediction(
                predicted_mood=0.0,
                confidence=0.0,
                prediction_date=datetime.now(),
                feature_importance={},
                risk_factors=['prediction_error'],
                recommendations=['Prediktion tillfälligt otillgänglig'],
                model_version="error"
            )
    
    def _calculate_confidence(self, features: np.ndarray, 
                               rf_pred: Optional[float],
                               lstm_pred: Optional[float]) -> float:
        """
        Calculate prediction confidence based on:
        - Data completeness
        - Model agreement
        - Historical volatility
        """
        confidence = 0.5  # Base confidence
        
        # Data completeness boost
        if np.any(features != 0):
            non_zero_ratio = np.sum(features != 0) / len(features)
            confidence += 0.1 * non_zero_ratio
        
        # Model agreement boost
        if rf_pred is not None and lstm_pred is not None:
            agreement = 1.0 - abs(rf_pred - lstm_pred) / 2.0  # Normalized difference
            confidence += 0.2 * agreement
        
        # Volatility penalty (if mood is very volatile, prediction is less certain)
        if 'mood_volatility' in str(features):
            # Extract volatility feature (approximate position)
            volatility_idx = 4  # Based on feature ordering
            if len(features) > volatility_idx:
                volatility = features[volatility_idx]
                confidence -= 0.1 * min(volatility, 0.5)  # Cap penalty
        
        return np.clip(confidence, 0.0, 0.95)
    
    def _identify_risk_factors(self, features: np.ndarray, 
                                feature_importance: Dict[str, float]) -> List[str]:
        """Identify risk factors based on features."""
        risk_factors = []
        
        feature_names = self._get_feature_names()
        feature_dict = dict(zip(feature_names, features))
        
        # Check various risk indicators
        if feature_dict.get('mood_trend', 0) < -0.05:
            risk_factors.append('negative_trend')
        
        if feature_dict.get('negative_days_7d', 0) >= 4:
            risk_factors.append('persistent_low_mood')
        
        if feature_dict.get('sleep_mean', 7) < 5.5:
            risk_factors.append('sleep_deprivation')
        
        if feature_dict.get('crisis_count_30d', 0) > 0:
            risk_factors.append('recent_crisis')
        
        if feature_dict.get('mood_volatility', 0) > 0.5:
            risk_factors.append('high_volatility')
        
        if feature_dict.get('sentiment_trend', 0) < -0.1:
            risk_factors.append('negative_sentiment_trend')
        
        return risk_factors
    
    def _generate_recommendations(self, predicted_mood: float,
                                   risk_factors: List[str],
                                   feature_importance: Dict[str, float]) -> List[str]:
        """Generate personalized recommendations based on prediction."""
        recommendations = []
        
        # Risk-based recommendations
        if 'sleep_deprivation' in risk_factors:
            recommendations.append('Prioritera sömn: Fast läggdags och minska skärmar kvällstid')
        
        if 'persistent_low_mood' in risk_factors:
            recommendations.append('Överväg att kontakta vårdcentral eller terapeut')
        
        if 'negative_trend' in risk_factors:
            recommendations.append('Prova daglig aktivitetsplanering: Små meningsfulla handlingar')
        
        if 'high_volatility' in risk_factors:
            recommendations.append('Öva daglig mindfulness för att stabilisera humör')
        
        # Prediction-based recommendations
        if predicted_mood < -0.3:
            recommendations.extend([
                'Gör en behandlingsplan med din terapeut',
                'Aktivera ditt sociala nätverk - ring en vän',
                'Fokusera på en aktivitet du tidigare tyckt om'
            ])
        elif predicted_mood < 0:
            recommendations.extend([
                'Fortsätt med regelbunden humör-loggning',
                'Prova en ny coping-strategi från appen'
            ])
        
        return recommendations[:5]
    
    def _get_feature_names(self) -> List[str]:
        """Get ordered list of feature names."""
        return [
            'mood_mean_7d', 'mood_mean_14d', 'mood_mean_30d', 'mood_std_7d', 'mood_volatility',
            'mood_trend', 'mood_momentum', 'mood_min_7d', 'mood_max_7d',
            'negative_days_7d', 'negative_days_14d',
            'sleep_mean', 'sleep_std', 'sleep_trend', 'sleep_deficit_days', 'sleep_quality_mean',
            'steps_mean', 'steps_std', 'steps_trend', 'sedentary_days',
            'sentiment_mean', 'sentiment_trend',
            'app_opens_7d', 'chat_messages_7d', 'exercises_completed_7d',
            'day_of_week', 'is_weekend', 'hour_of_day', 'month', 'days_since_start',
            'crisis_count_30d'
        ]
    
    def explain_prediction(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Generate SHAP-based explanation for prediction.
        Returns human-readable explanation of why this prediction was made.
        """
        if not SHAP_AVAILABLE or self.rf_model is None:
            return None
        
        try:
            features = self.feature_engineer.engineer_features(user_id)
            if features is None:
                return None
            
            # Create SHAP explainer
            explainer = shap.TreeExplainer(self.rf_model)
            
            # Calculate SHAP values
            shap_values = explainer.shap_values(features.reshape(1, -1))
            
            # Get feature names
            feature_names = self._get_feature_names()
            
            # Create explanation
            top_features = []
            for i, (name, value) in enumerate(zip(feature_names, shap_values[0])):
                if abs(value) > 0.01:  # Threshold for significance
                    top_features.append({
                        'feature': name,
                        'contribution': float(value),
                        'direction': 'positive' if value > 0 else 'negative'
                    })
            
            # Sort by absolute contribution
            top_features.sort(key=lambda x: abs(x['contribution']), reverse=True)
            
            return {
                'top_features': top_features[:10],
                'base_value': float(explainer.expected_value),
                'explanation_text': self._generate_shap_explanation(top_features[:5])
            }
            
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return None
    
    def _generate_shap_explanation(self, top_features: List[dict]) -> str:
        """Generate natural language explanation from SHAP values."""
        explanations = []
        
        feature_descriptions = {
            'mood_trend': 'Ditt humör har visat en trend',
            'negative_days_7d': 'Antal dagar med negativt humör',
            'sleep_mean': 'Din genomsnittliga sömn',
            'sleep_deficit_days': 'Dagar med för lite sömn',
            'mood_volatility': 'Hur mycket ditt humör varierar',
            'sentiment_trend': 'Trenden i dina texter',
            'steps_mean': 'Din aktivitetsnivå',
            'crisis_count_30d': 'Nyligen upplevda kriser'
        }
        
        for feat in top_features:
            name = feat['feature']
            contribution = feat['contribution']
            direction = feat['direction']
            
            desc = feature_descriptions.get(name, name)
            
            if 'mood_trend' in name and direction == 'negative':
                explanations.append(f"Ditt humör har sjunkit de senaste dagarna")
            elif 'negative_days' in name:
                explanations.append(f"Du har haft flera dagar med svåra känslor")
            elif 'sleep' in name and direction == 'negative':
                explanations.append(f"Din sömn verkar påverka ditt mående negativt")
            elif 'sentiment' in name and direction == 'negative':
                explanations.append(f"Dina texter visar ökad negativitet")
            elif 'steps' in name and direction == 'positive':
                explanations.append(f"Din fysiska aktivitet har positiv effekt")
            elif 'crisis' in name:
                explanations.append(f"Nyligen upplevda svåra händelser påverkar prediktionen")
        
        return "Vi förutser ditt humör baserat på: " + "; ".join(explanations) if explanations else ""


# Singleton instance
_mood_predictor: Optional[MoodPredictor] = None


def get_mood_predictor() -> MoodPredictor:
    """Get or create the mood predictor singleton."""
    global _mood_predictor
    if _mood_predictor is None:
        _mood_predictor = MoodPredictor()
    return _mood_predictor
