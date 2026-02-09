"""
Predictive Analytics Service for Lugn & Trygg
Handles mood prediction, trend analysis, and crisis detection
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

class PredictiveAnalyticsService:
    """
    Service for predictive analytics on mood data
    """

    def __init__(self):
        self.models_dir = Path(__file__).parent.parent.parent / "models"
        self.models_dir.mkdir(exist_ok=True)
        self.scaler = StandardScaler()

        # Model configurations
        self.model_configs = {
            'linear_regression': {
                'model': LinearRegression(),
                'features': ['hour', 'day_of_week', 'month', 'prev_mood', 'trend_3d', 'trend_7d']
            },
            'random_forest': {
                'model': RandomForestRegressor(n_estimators=100, random_state=42),
                'features': ['hour', 'day_of_week', 'month', 'prev_mood', 'trend_3d', 'trend_7d',
                           'seasonal_factor', 'weekend_factor']
            }
        }

        self.current_model = 'random_forest'

    def preprocess_mood_data(self, mood_entries: list[dict]) -> pd.DataFrame:
        """
        Preprocess mood data for predictive modeling

        Args:
            mood_entries: List of mood entry dictionaries

        Returns:
            Preprocessed DataFrame ready for modeling
        """
        if not mood_entries:
            return pd.DataFrame()

        # Convert to DataFrame
        df = pd.DataFrame(mood_entries)

        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')

        # Extract time-based features
        df['hour'] = df['timestamp'].dt.hour  # type: ignore[attr-defined]
        df['day_of_week'] = df['timestamp'].dt.dayofweek  # type: ignore[attr-defined]
        df['month'] = df['timestamp'].dt.month  # type: ignore[attr-defined]
        df['day_of_year'] = df['timestamp'].dt.dayofyear  # type: ignore[attr-defined]

        # Calculate mood score (simplified sentiment mapping)

        df['mood_score'] = df['mood_text'].apply(
            lambda x: self._extract_mood_score(x) if pd.notna(x) else 3
        ) if 'mood_text' in df.columns else 3

        # Calculate rolling averages and trends
        df['prev_mood'] = df['mood_score'].shift(1)
        df['trend_3d'] = df['mood_score'].rolling(window=3, min_periods=1).mean()
        df['trend_7d'] = df['mood_score'].rolling(window=7, min_periods=1).mean()

        # Seasonal factors (simplified)
        df['seasonal_factor'] = np.sin(2 * np.pi * df['day_of_year'] / 365.25)

        # Weekend factor
        df['weekend_factor'] = df['day_of_week'].isin([5, 6]).astype(int)

        # Fill NaN values (using modern pandas methods)
        df = df.ffill().bfill().fillna(3)

        return df

    def _extract_mood_score(self, mood_text: str) -> int:
        """
        Extract mood score from text (simplified version)
        In production, this would use NLP models
        """
        if not mood_text:
            return 3

        text_lower = mood_text.lower()

        # Simple keyword-based scoring
        positive_words = ['glad', 'bra', 'bra', 'härlig', 'fantastisk', 'lycklig', 'nöjd']
        negative_words = ['dålig', 'ledsen', 'arg', 'stressad', 'trött', 'orolig', 'deppig']

        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count:
            return 4
        elif negative_count > positive_count:
            return 2
        else:
            return 3

    def train_predictive_model(self, mood_entries: list[dict]) -> dict[str, Any]:
        """
        Train predictive model on mood data

        Args:
            mood_entries: List of mood entries

        Returns:
            Training results and model performance
        """
        try:
            df = self.preprocess_mood_data(mood_entries)

            if len(df) < 10:
                return {
                    'success': False,
                    'error': 'Insufficient data for training (minimum 10 entries required)',
                    'model_path': None
                }

            # Prepare features and target
            config = self.model_configs[self.current_model]
            feature_cols = config['features']

            # Ensure all required features exist
            available_features = [col for col in feature_cols if col in df.columns]
            if len(available_features) < len(feature_cols):
                logger.warning(f"Missing features: {set(feature_cols) - set(available_features)}")

            X = df[available_features]
            y = df['mood_score']

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )

            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)

            # Train model
            model = config['model']
            model.fit(X_train_scaled, y_train)

            # Evaluate model
            y_pred = model.predict(X_test_scaled)
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)

            # Save model
            model_path = self.models_dir / f"mood_predictor_{self.current_model}.joblib"
            joblib.dump({
                'model': model,
                'scaler': self.scaler,
                'features': available_features,
                'model_type': self.current_model
            }, model_path)

            return {
                'success': True,
                'model_path': str(model_path),
                'performance': {
                    'mse': float(mse),
                    'r2_score': float(r2),
                    'training_samples': len(X_train),
                    'test_samples': len(X_test)
                },
                'features_used': available_features
            }

        except Exception as e:
            logger.error(f"Error training predictive model: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'model_path': None
            }

    def predict_mood_trend(self, mood_entries: list[dict], days_ahead: int = 7) -> dict[str, Any]:
        """
        Predict mood trends for the next N days

        Args:
            mood_entries: Historical mood data
            days_ahead: Number of days to predict

        Returns:
            Prediction results
        """
        try:
            # Load trained model
            model_path = self.models_dir / f"mood_predictor_{self.current_model}.joblib"

            if not model_path.exists():
                return {
                    'success': False,
                    'error': 'No trained model available. Please train the model first.',
                    'predictions': []
                }

            model_data = joblib.load(model_path)
            model = model_data['model']
            scaler = model_data['scaler']
            features = model_data['features']

            # Prepare historical data
            df = self.preprocess_mood_data(mood_entries)
            if df.empty:
                return {
                    'success': False,
                    'error': 'No mood data available for prediction',
                    'predictions': []
                }

            # Generate prediction data points
            predictions = []
            last_entry = df.iloc[-1] if not df.empty else None

            if last_entry is None:
                return {
                    'success': False,
                    'error': 'No recent mood data available',
                    'predictions': []
                }

            current_date = pd.to_datetime(last_entry['timestamp'])

            for i in range(1, days_ahead + 1):
                pred_date = current_date + timedelta(days=i)

                # Create feature vector for prediction
                pred_features = self._create_prediction_features(pred_date, last_entry, df)
                pred_features = {k: v for k, v in pred_features.items() if k in features}

                # Ensure all required features are present
                feature_vector = [pred_features.get(feature, 0) for feature in features]
                feature_vector_scaled = scaler.transform([feature_vector])

                # Make prediction
                predicted_score = model.predict(feature_vector_scaled)[0]

                # Convert score to mood category
                mood_category = self._score_to_mood_category(predicted_score)

                predictions.append({
                    'date': pred_date.strftime('%Y-%m-%d'),
                    'predicted_score': float(predicted_score),
                    'mood_category': mood_category,
                    'confidence': self._calculate_confidence(predicted_score, df)
                })

            return {
                'success': True,
                'predictions': predictions,
                'model_info': {
                    'type': self.current_model,
                    'features_used': features,
                    'training_date': datetime.now().isoformat()
                }
            }

        except Exception as e:
            logger.error(f"Error predicting mood trend: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'predictions': []
            }

    def _create_prediction_features(self, pred_date: pd.Timestamp,
                                  last_entry: pd.Series, df: pd.DataFrame) -> dict[str, float]:
        """
        Create feature vector for prediction
        """
        return {
            'hour': 12,  # Default to noon
            'day_of_week': pred_date.dayofweek,
            'month': pred_date.month,
            'prev_mood': last_entry.get('mood_score', 3),
            'trend_3d': df['mood_score'].tail(3).mean() if len(df) >= 3 else last_entry.get('mood_score', 3),
            'trend_7d': df['mood_score'].tail(7).mean() if len(df) >= 7 else last_entry.get('mood_score', 3),
            'seasonal_factor': np.sin(2 * np.pi * pred_date.dayofyear / 365.25),
            'weekend_factor': 1 if pred_date.dayofweek in [5, 6] else 0
        }

    def _score_to_mood_category(self, score: float) -> str:
        """
        Convert numerical score to mood category
        """
        if score >= 4.5:
            return 'excellent'
        elif score >= 3.5:
            return 'good'
        elif score >= 2.5:
            return 'neutral'
        elif score >= 1.5:
            return 'bad'
        else:
            return 'terrible'

    def _calculate_confidence(self, predicted_score: float, historical_df: pd.DataFrame) -> float:
        """
        Calculate confidence in prediction based on historical variance
        """
        if historical_df.empty:
            return 0.5

        historical_scores = historical_df['mood_score'].values
        mean_score = float(np.mean(historical_scores.astype(float)))  # type: ignore[arg-type]
        std_score = float(np.std(historical_scores.astype(float)))  # type: ignore[arg-type]

        if std_score == 0:
            return 0.8  # High confidence if no variance

        # Calculate z-score of prediction
        z_score = abs(predicted_score - mean_score) / std_score

        # Convert to confidence (lower z-score = higher confidence)
        confidence = max(0.1, min(0.9, 1 - (z_score / 3)))

        return float(confidence)

    def detect_crisis_risk(self, mood_entries: list[dict]) -> dict[str, Any]:
        """
        Detect potential crisis situations based on mood patterns

        Args:
            mood_entries: Recent mood entries

        Returns:
            Crisis risk assessment
        """
        try:
            df = self.preprocess_mood_data(mood_entries)

            if df.empty or len(df) < 3:
                return {
                    'risk_level': 'unknown',
                    'confidence': 0,
                    'indicators': [],
                    'recommendations': ['Logga fler humörinlägg för bättre analys']
                }

            # Analyze recent trends
            recent_scores = df['mood_score'].tail(7).values  # Last 7 entries
            current_trend = df['trend_3d'].iloc[-1] if len(df) >= 3 else df['mood_score'].iloc[-1]

            # Crisis indicators
            indicators = []
            risk_score = 0

            # 1. Sudden drop in mood
            if len(recent_scores) >= 2:
                recent_drop = recent_scores[-2] - recent_scores[-1]
                if recent_drop >= 2:
                    indicators.append('Plötslig humörförsämring')
                    risk_score += 0.4

            # 2. Consistently low mood
            if current_trend <= 2.0:
                indicators.append('Långvarigt lågt humör')
                risk_score += 0.3

            # 3. Extreme negative language patterns
            negative_indicators = ['kris', 'självmord', 'hopplös', 'värdelös', 'dö']
            recent_texts = df.get('mood_text', pd.Series()).tail(3).fillna('')

            for text in recent_texts:
                if any(indicator in text.lower() for indicator in negative_indicators):
                    indicators.append('Allvarliga negativa uttryck')
                    risk_score += 0.5
                    break

            # 4. No improvement over time
            if len(recent_scores) >= 5:
                trend_direction = np.polyfit(range(len(recent_scores)), recent_scores.astype(float), 1)[0]  # type: ignore[arg-type]
                if trend_direction < -0.1:  # Declining trend
                    indicators.append('Försämrande trend')
                    risk_score += 0.2

            # Determine risk level
            if risk_score >= 0.7:
                risk_level = 'high'
            elif risk_score >= 0.4:
                risk_level = 'medium'
            elif risk_score >= 0.2:
                risk_level = 'low'
            else:
                risk_level = 'low'

            # Generate recommendations
            recommendations = self._generate_crisis_recommendations(risk_level, indicators)

            return {
                'risk_level': risk_level,
                'confidence': min(0.95, risk_score + 0.1),  # Add base confidence
                'indicators': indicators,
                'recommendations': recommendations,
                'trend_score': float(current_trend),
                'analyzed_entries': len(recent_scores)
            }

        except Exception as e:
            logger.error(f"Error detecting crisis risk: {str(e)}")
            return {
                'risk_level': 'unknown',
                'confidence': 0,
                'indicators': [],
                'recommendations': ['Kunde inte analysera risk - kontakta support om du mår dåligt'],
                'error': str(e)
            }

    def _generate_crisis_recommendations(self, risk_level: str, indicators: list[str]) -> list[str]:
        """
        Generate personalized recommendations based on risk assessment
        """
        recommendations = []

        if risk_level == 'high':
            recommendations.extend([
                'Kontakta omedelbart en professionell vårdgivare eller journummer',
                'Ring 112 om du känner dig akut hotad',
                'Prata med en nära vän eller familjemedlem',
                'Använd lugnande tekniker: djupandning, mindfulness'
            ])
        elif risk_level == 'medium':
            recommendations.extend([
                'Överväg att kontakta din vårdcentral eller psykolog',
                'Prata med någon du litar på om dina känslor',
                'Fortsätt logga ditt humör för att följa utvecklingen',
                'Använd appens resurser för självhjälp'
            ])
        else:
            recommendations.extend([
                'Fortsätt logga ditt humör regelbundet',
                'Överväg att prata med någon om dina känslor',
                'Använd avslappningstekniker som finns i appen'
            ])

        # Add specific recommendations based on indicators
        if 'Plötslig humörförsämring' in indicators:
            recommendations.append('Identifiera vad som kan ha orsakat förändringen')

        if 'Långvarigt lågt humör' in indicators:
            recommendations.append('Överväg professionell hjälp för långvariga besvär')

        if 'Allvarliga negativa uttryck' in indicators:
            recommendations.append('Du är inte ensam - det finns hjälp att få')

        return recommendations

# Global service instance
predictive_service = PredictiveAnalyticsService()
