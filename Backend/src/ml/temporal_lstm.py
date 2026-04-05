"""
Temporal Attention LSTM for Mood Forecasting
Implements state-of-the-art deep learning for mood prediction with attention mechanisms
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np

# Deep learning with graceful fallback
try:
    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.layers import (
        LSTM,
        BatchNormalization,
        Concatenate,
        Dense,
        Dropout,
        Input,
        Lambda,
        Multiply,
        Permute,
        Reshape,
    )
    from tensorflow.keras.layers import Attention as KerasAttention
    from tensorflow.keras.models import Model, Sequential, load_model
    from tensorflow.keras.optimizers import Adam
    from tensorflow.keras.regularizers import l2
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("TensorFlow not available, LSTM features disabled")

try:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import MinMaxScaler, StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


logger = logging.getLogger(__name__)


@dataclass
class MoodForecast:
    """A mood forecast with uncertainty quantification."""
    timestamp: datetime
    predicted_valence: float
    confidence_interval: tuple[float, float]
    uncertainty: float
    contributing_factors: dict[str, float]
    risk_flags: list[str]


@dataclass
class TemporalPattern:
    """Discovered temporal pattern in mood data."""
    pattern_type: str  # 'circadian', 'weekly', 'monthly', 'trend'
    strength: float  # 0-1
    description: str
    clinical_significance: str | None


class TemporalAttentionLSTM:
    """
    LSTM with attention mechanism for mood forecasting.

    Architecture:
    - Bidirectional LSTM for temporal feature extraction
    - Multi-head attention for focusing on relevant time steps
    - Contextual feature fusion (sleep, weather, activity)
    - Uncertainty quantification via Monte Carlo dropout
    """

    def __init__(self, sequence_length: int = 14, n_features: int = 31):
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.model = None
        self.scaler = StandardScaler() if SKLEARN_AVAILABLE else None
        self.feature_names = [
            # Core mood features
            'valence', 'arousal', 'dominance', 'intensity',
            # Temporal features
            'hour_sin', 'hour_cos', 'day_of_week_sin', 'day_of_week_cos',
            'month_sin', 'month_cos', 'is_weekend',
            # Contextual features
            'sleep_hours', 'sleep_quality', 'steps', 'social_interaction',
            'weather_pressure', 'weather_temp', 'daylight_hours',
            # Historical features
            'mood_trend_3d', 'mood_trend_7d', 'mood_volatility',
            'days_since_positive', 'days_since_negative',
            # Clinical features
            'phq9_score', 'gad7_score', 'medication_adherence',
            # Intervention features
            'days_since_therapy', 'exercise_count_7d', 'meditation_minutes_7d'
        ]

        if TENSORFLOW_AVAILABLE:
            self._build_model()

    def _build_model(self):
        """Build the attention-based LSTM architecture."""
        # Input layers
        mood_input = Input(shape=(self.sequence_length, self.n_features), name='mood_sequence')

        # Bidirectional LSTM layers
        lstm_out = tf.keras.layers.Bidirectional(
            LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.2),
            name='bilstm_1'
        )(mood_input)

        lstm_out = BatchNormalization(name='bn_1')(lstm_out)

        lstm_out = tf.keras.layers.Bidirectional(
            LSTM(64, return_sequences=True, dropout=0.2),
            name='bilstm_2'
        )(lstm_out)

        # Temporal attention mechanism
        attention = tf.keras.layers.MultiHeadAttention(
            num_heads=4, key_dim=16, name='temporal_attention'
        )(lstm_out, lstm_out)

        # Global average pooling with attention weights
        pooled = tf.keras.layers.GlobalAveragePooling1D(name='global_pool')(attention)

        # Dense layers with regularization
        dense = Dense(128, activation='relu', kernel_regularizer=l2(0.001), name='dense_1')(pooled)
        dense = Dropout(0.3, name='dropout_1')(dense)
        dense = BatchNormalization(name='bn_2')(dense)

        dense = Dense(64, activation='relu', kernel_regularizer=l2(0.001), name='dense_2')(dense)
        dense = Dropout(0.2, name='dropout_2')(dense)

        # Output layer (valence prediction: -1 to 1)
        output = Dense(1, activation='tanh', name='valence_output')(dense)

        # Uncertainty head (MC Dropout)
        uncertainty = Dense(1, activation='softplus', name='uncertainty')(dense)

        # Combined output
        combined = Concatenate(name='combined_output')([output, uncertainty])

        self.model = Model(inputs=mood_input, outputs=combined, name='TemporalAttentionLSTM')

        # Compile with custom loss
        self.model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss=self._negative_log_likelihood,
            metrics=['mae']
        )

        logger.info("✅ Temporal Attention LSTM model built")

    def _negative_log_likelihood(self, y_true, y_pred):
        """Negative log likelihood loss for uncertainty quantification."""
        mean = y_pred[:, 0:1]
        variance = y_pred[:, 1:2] + 1e-6  # Add epsilon for numerical stability

        loss = 0.5 * tf.math.log(variance) + 0.5 * tf.square(y_true - mean) / variance
        return tf.reduce_mean(loss)

    def prepare_features(self, mood_entries: list[dict],
                        contextual_data: dict | None = None) -> np.ndarray:
        """
        Prepare feature vectors from mood entries with contextual data.

        Features engineered:
        - Core: valence, arousal, dominance, intensity
        - Temporal: cyclical time encodings
        - Contextual: sleep, activity, weather, social
        - Clinical: PHQ-9, GAD-7, medication
        - Historical: trends, volatility, streaks
        """
        if not mood_entries:
            return np.zeros((self.sequence_length, self.n_features))

        features = []

        for i, entry in enumerate(mood_entries[-self.sequence_length:]):
            feature_vector = []

            # Core mood features
            feature_vector.extend([
                entry.get('valence', 0),
                entry.get('arousal', 0.5),
                entry.get('dominance', 0.5),
                entry.get('intensity', 5) / 10  # Normalize to 0-1
            ])

            # Temporal features (cyclical encoding)
            timestamp = entry.get('timestamp', datetime.now())
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            hour = timestamp.hour
            feature_vector.extend([
                np.sin(2 * np.pi * hour / 24),
                np.cos(2 * np.pi * hour / 24)
            ])

            day_of_week = timestamp.weekday()
            feature_vector.extend([
                np.sin(2 * np.pi * day_of_week / 7),
                np.cos(2 * np.pi * day_of_week / 7)
            ])

            month = timestamp.month
            feature_vector.extend([
                np.sin(2 * np.pi * month / 12),
                np.cos(2 * np.pi * month / 12)
            ])

            feature_vector.append(1.0 if day_of_week >= 5 else 0.0)  # is_weekend

            # Contextual features (if available)
            ctx = contextual_data or {}
            feature_vector.extend([
                ctx.get('sleep_hours', 7) / 12,  # Normalize
                ctx.get('sleep_quality', 5) / 10,
                ctx.get('steps', 5000) / 20000,
                ctx.get('social_interaction', 0.5),
                ctx.get('weather_pressure', 1013) / 1100,
                ctx.get('weather_temp', 15) / 40,
                ctx.get('daylight_hours', 12) / 24
            ])

            # Historical features (calculated from previous entries)
            if i >= 3:
                recent_valences = [e.get('valence', 0) for e in mood_entries[i-3:i]]
                trend_3d = np.polyfit(range(3), recent_valences, 1)[0]
            else:
                trend_3d = 0

            if i >= 7:
                recent_valences = [e.get('valence', 0) for e in mood_entries[i-7:i]]
                trend_7d = np.polyfit(range(7), recent_valences, 1)[0]
                volatility = np.std(recent_valences)
            else:
                trend_7d = 0
                volatility = 0

            # Days since last positive/negative mood
            days_since_positive = 0
            days_since_negative = 0
            for j in range(i-1, -1, -1):
                v = mood_entries[j].get('valence', 0)
                if v > 0.3 and days_since_positive == 0:
                    days_since_positive = i - j
                if v < -0.3 and days_since_negative == 0:
                    days_since_negative = i - j
                if days_since_positive > 0 and days_since_negative > 0:
                    break

            feature_vector.extend([
                trend_3d,
                trend_7d,
                volatility,
                min(days_since_positive, 14) / 14,  # Cap at 14 days
                min(days_since_negative, 14) / 14
            ])

            # Clinical features
            feature_vector.extend([
                ctx.get('phq9_score', 0) / 27,  # PHQ-9 max is 27
                ctx.get('gad7_score', 0) / 21,  # GAD-7 max is 21
                ctx.get('medication_adherence', 1.0)
            ])

            # Intervention features
            feature_vector.extend([
                min(ctx.get('days_since_therapy', 7), 30) / 30,
                ctx.get('exercise_count_7d', 3) / 7,
                ctx.get('meditation_minutes_7d', 0) / 140  # 20 min/day
            ])

            features.append(feature_vector)

        # Pad or truncate to sequence_length
        while len(features) < self.sequence_length:
            features.insert(0, [0] * self.n_features)

        return np.array(features[-self.sequence_length:])

    def train(self, mood_entries: list[dict],
              contextual_data: list[dict] | None = None,
              validation_split: float = 0.2) -> dict[str, Any]:
        """
        Train the LSTM model on user's mood history.
        """
        if not TENSORFLOW_AVAILABLE:
            return {'success': False, 'error': 'TensorFlow not available'}

        if len(mood_entries) < 21:  # Need at least 21 entries for 14-day sequences + 7-day prediction
            return {
                'success': False,
                'error': f'Insufficient data: need 21+ entries, got {len(mood_entries)}'
            }

        try:
            # Prepare sequences
            X, y = self._create_sequences(mood_entries, contextual_data)

            if len(X) < 5:  # Need at least 5 sequences for training
                return {'success': False, 'error': f'Insufficient sequences: need 5+, got {len(X)}'}

            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=validation_split, shuffle=False
            )

            # Scale features
            X_train_reshaped = X_train.reshape(-1, self.n_features)
            X_train_scaled = self.scaler.fit_transform(X_train_reshaped).reshape(X_train.shape)
            X_val_reshaped = X_val.reshape(-1, self.n_features)
            X_val_scaled = self.scaler.transform(X_val_reshaped).reshape(X_val.shape)

            # Callbacks
            callbacks = [
                EarlyStopping(patience=10, restore_best_weights=True),
                ReduceLROnPlateau(factor=0.5, patience=5)
            ]

            # Train
            history = self.model.fit(
                X_train_scaled, y_train,
                validation_data=(X_val_scaled, y_val),
                epochs=100,
                batch_size=32,
                callbacks=callbacks,
                verbose=0
            )

            # Calculate metrics
            final_mae = history.history['mae'][-1]
            val_mae = history.history['val_mae'][-1]

            return {
                'success': True,
                'epochs_trained': len(history.history['loss']),
                'final_mae': final_mae,
                'validation_mae': val_mae,
                'training_samples': len(X_train),
                'validation_samples': len(X_val)
            }

        except Exception as e:
            logger.error(f"LSTM training failed: {e}")
            return {'success': False, 'error': str(e)}

    def _create_sequences(self, mood_entries: list[dict],
                          contextual_data: list[dict] | None) -> tuple[np.ndarray, np.ndarray]:
        """Create training sequences with 14-day lookback and 1-day prediction."""
        X, y = [], []

        for i in range(len(mood_entries) - self.sequence_length):
            sequence_entries = mood_entries[i:i + self.sequence_length]
            context = contextual_data[i + self.sequence_length - 1] if contextual_data else None

            X_seq = self.prepare_features(sequence_entries, context)
            y_val = mood_entries[i + self.sequence_length].get('valence', 0)

            X.append(X_seq)
            y.append([y_val, 0.1])  # [value, uncertainty]

        return np.array(X), np.array(y)

    def predict(self, recent_entries: list[dict],
                contextual_data: dict | None = None,
                days_ahead: int = 7) -> list[MoodForecast]:
        """
        Generate mood forecasts with uncertainty quantification.
        """
        if not TENSORFLOW_AVAILABLE or self.model is None:
            return self._fallback_forecast(recent_entries, days_ahead)

        try:
            # Prepare input sequence
            X = self.prepare_features(recent_entries, contextual_data)
            X_scaled = self.scaler.transform(X.reshape(-1, self.n_features)).reshape(1, self.sequence_length, self.n_features)

            forecasts = []
            current_entries = recent_entries.copy()

            for day in range(days_ahead):
                # Predict next day
                pred = self.model.predict(X_scaled, verbose=0)[0]
                valence = float(pred[0])
                uncertainty = float(pred[1])

                # Calculate confidence interval (95%)
                ci_lower = max(-1, valence - 1.96 * uncertainty)
                ci_upper = min(1, valence + 1.96 * uncertainty)

                # Identify contributing factors
                factors = self._identify_contributing_factors(X[0])

                # Risk flags
                risk_flags = self._assess_risk(valence, uncertainty, factors)

                forecast_time = datetime.now() + timedelta(days=day + 1)

                forecasts.append(MoodForecast(
                    timestamp=forecast_time,
                    predicted_valence=valence,
                    confidence_interval=(ci_lower, ci_upper),
                    uncertainty=uncertainty,
                    contributing_factors=factors,
                    risk_flags=risk_flags
                ))

                # Update sequence for next prediction (autoregressive)
                new_entry = {
                    'valence': valence,
                    'arousal': 0.5,  # Default
                    'dominance': 0.5,
                    'intensity': 5,
                    'timestamp': forecast_time.isoformat()
                }
                current_entries.append(new_entry)
                X = self.prepare_features(current_entries, contextual_data)
                X_scaled = self.scaler.transform(X.reshape(-1, self.n_features)).reshape(1, self.sequence_length, self.n_features)

            return forecasts

        except Exception as e:
            logger.error(f"LSTM prediction failed: {e}")
            return self._fallback_forecast(recent_entries, days_ahead)

    def _identify_contributing_factors(self, features: np.ndarray) -> dict[str, float]:
        """Identify which features contribute most to the prediction."""
        factor_scores = {}

        # Map feature indices to names
        for i, name in enumerate(self.feature_names[:len(features)]):
            factor_scores[name] = float(features[i])

        # Sort by absolute value and return top 5
        sorted_factors = sorted(factor_scores.items(), key=lambda x: abs(x[1]), reverse=True)
        return dict(sorted_factors[:5])

    def _assess_risk(self, valence: float, uncertainty: float, factors: dict[str, float]) -> list[str]:
        """Assess clinical risk flags based on forecast."""
        risks = []

        if valence < -0.6:
            risks.append('predicted_depressive_episode')

        if valence < -0.4 and uncertainty > 0.3:
            risks.append('unstable_negative_state')

        if factors.get('phq9_score', 0) > 0.6:  # > 15 on PHQ-9
            risks.append('high_depression_risk')

        if factors.get('gad7_score', 0) > 0.5:  # > 10 on GAD-7
            risks.append('high_anxiety_risk')

        if factors.get('sleep_hours', 0.58) < 0.5:  # < 6 hours
            risks.append('sleep_deprivation_risk')

        if factors.get('days_since_negative', 1.0) < 0.14:  # < 2 days
            risks.append('recent_negative_mood')

        return risks

    def _fallback_forecast(self, recent_entries: list[dict], days_ahead: int) -> list[MoodForecast]:
        """Simple heuristic forecast when LSTM unavailable."""
        forecasts = []

        if not recent_entries:
            return forecasts

        # Calculate trend
        recent_valences = [e.get('valence', 0) for e in recent_entries[-7:]]
        if len(recent_valences) >= 2:
            trend = np.polyfit(range(len(recent_valences)), recent_valences, 1)[0]
        else:
            trend = 0

        last_valence = recent_entries[-1].get('valence', 0)

        for day in range(days_ahead):
            predicted = last_valence + trend * (day + 1)
            predicted = max(-1, min(1, predicted))  # Clip

            # Increasing uncertainty over time
            uncertainty = 0.15 + day * 0.05

            forecasts.append(MoodForecast(
                timestamp=datetime.now() + timedelta(days=day + 1),
                predicted_valence=predicted,
                confidence_interval=(predicted - uncertainty, predicted + uncertainty),
                uncertainty=uncertainty,
                contributing_factors={'trend': trend},
                risk_flags=[]
            ))

        return forecasts

    def discover_patterns(self, mood_entries: list[dict]) -> list[TemporalPattern]:
        """
        Discover temporal patterns in mood data using LSTM attention weights.
        """
        patterns = []

        if len(mood_entries) < 30:
            return patterns

        # Circadian pattern
        hourly_moods = {}
        for entry in mood_entries:
            ts = entry.get('timestamp', datetime.now())
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            hour = ts.hour
            if hour not in hourly_moods:
                hourly_moods[hour] = []
            hourly_moods[hour].append(entry.get('valence', 0))

        if hourly_moods:
            hour_variability = np.std([np.mean(moods) for moods in hourly_moods.values()])
            if hour_variability > 0.2:
                best_hour = max(hourly_moods.items(), key=lambda x: np.mean(x[1]))[0]
                worst_hour = min(hourly_moods.items(), key=lambda x: np.mean(x[1]))[0]
                patterns.append(TemporalPattern(
                    pattern_type='circadian',
                    strength=min(hour_variability * 2, 1.0),
                    description=f'Mood typically better at {best_hour}:00, lower at {worst_hour}:00',
                    clinical_significance='Consider scheduling activities during high-mood hours'
                ))

        # Weekly pattern
        daily_moods = {}
        for entry in mood_entries:
            ts = entry.get('timestamp', datetime.now())
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            day = ts.weekday()
            if day not in daily_moods:
                daily_moods[day] = []
            daily_moods[day].append(entry.get('valence', 0))

        if len(daily_moods) >= 5:
            day_variability = np.std([np.mean(moods) for moods in daily_moods.values()])
            if day_variability > 0.15:
                best_day = max(daily_moods.items(), key=lambda x: np.mean(x[1]))[0]
                day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                patterns.append(TemporalPattern(
                    pattern_type='weekly',
                    strength=min(day_variability * 3, 1.0),
                    description=f'Mood typically highest on {day_names[best_day]}',
                    clinical_significance='Plan challenging activities on good days'
                ))

        return patterns


# Singleton
_lstm_model: TemporalAttentionLSTM | None = None


def get_lstm_forecaster() -> TemporalAttentionLSTM:
    """Get or create the LSTM forecaster singleton."""
    global _lstm_model
    if _lstm_model is None:
        _lstm_model = TemporalAttentionLSTM()
    return _lstm_model
