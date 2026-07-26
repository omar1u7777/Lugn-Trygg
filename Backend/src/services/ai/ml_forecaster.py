"""Statistical / ML mood pattern analysis and forecasting."""

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np

from src.utils.timestamp_utils import parse_iso_timestamp

logger = logging.getLogger(__name__)


class MLForecaster:
    """Single responsibility: analyze mood history and forecast future mood."""

    def __init__(self, svc):
        self._svc = svc

    def analyze_mood_patterns(self, mood_history: list[dict]) -> dict[str, Any]:
        """
        Analyze mood patterns using machine learning techniques
        Predict future mood trends and provide insights
        """
        if len(mood_history) < 7:
            return {
                "pattern_analysis": "Otillräcklig data för mönsteranalys",
                "predictions": "Behöver mer data för prediktioner",
                "confidence": 0.0
            }

        try:
            # Extract mood scores and timestamps
            mood_scores = []
            timestamps = []

            for entry in mood_history[-30:]:  # Last 30 entries
                try:
                    # Get score from ai_analysis if available, otherwise from direct field
                    ai_analysis = entry.get("ai_analysis", {})
                    score = float(ai_analysis.get("score", entry.get("sentiment_score", 0)))
                    mood_scores.append(score)
                    timestamps.append(parse_iso_timestamp(entry.get("timestamp")))
                except (ValueError, TypeError):
                    continue

            if len(mood_scores) < 7:
                return {
                    "pattern_analysis": "Otillräcklig numerisk data för analys",
                    "predictions": "Behöver mer kvantitativ data",
                    "confidence": 0.0
                }

            # Calculate trends using numpy
            scores_array = np.array(mood_scores)

            # Simple linear trend analysis
            x = np.arange(len(scores_array))
            trend = np.polyfit(x, scores_array, 1)[0]

            # Calculate moving averages
            short_ma = np.mean(scores_array[-7:])  # Last week
            np.mean(scores_array[-14:]) if len(scores_array) >= 14 else short_ma

            # Determine trend direction
            trend_direction = "improving" if trend > 0.05 else "declining" if trend < -0.05 else "stable"

            # Calculate volatility (mood swings)
            volatility = np.std(scores_array)

            # Generate insights
            insights = []
            if trend_direction == "improving":
                insights.append("Din sinnesstämning visar en positiv trend")
            elif trend_direction == "declining":
                insights.append("Din sinnesstämning visar en nedåtgående trend - överväg extra stöd")

            if volatility > 0.5:
                insights.append("Du upplever stora humörsvängningar - mindfulness kan hjälpa")
            elif volatility < 0.2:
                insights.append("Din sinnesstämning är stabil - bra jobbat!")

            # Simple prediction for next week
            prediction = "Liknande mönster förväntas nästa vecka"
            if abs(trend) > 0.1:
                prediction = f"Trend pekar mot {'förbättring' if trend > 0 else 'försämring'}"

            return {
                "pattern_analysis": "; ".join(insights),
                "predictions": prediction,
                "confidence": min(0.8, len(mood_scores) / 30.0),
                "trend_direction": trend_direction,
                "volatility": float(volatility),
                "trend_strength": abs(float(trend))
            }

        except Exception as e:
            logger.error(f"Pattern analysis failed: {str(e)}")
            return {
                "pattern_analysis": "Kunde inte analysera mönster",
                "predictions": "Otillräcklig data för prediktioner",
                "confidence": 0.0
            }

    def predictive_mood_analytics(self, mood_history: list[dict], days_ahead: int = 7) -> dict[str, Any]:
        """
        Advanced predictive analytics for mood forecasting using ML techniques
        Uses user's mood score (1-10 scale) for clinically meaningful predictions.
        """
        svc = self._svc
        if len(mood_history) < 14:
            return {
                "forecast": "Otillräcklig data för prediktion",
                "confidence": 0.0,
                "risk_factors": [],
                "recommendations": ["Logga fler humör för bättre prediktioner"]
            }

        try:
            # Extract and prepare data — prefer user's 1-10 score
            scores = []
            dates = []

            for entry in mood_history[-60:]:  # Use last 60 entries for better prediction
                try:
                    raw_score = entry.get("score", entry.get("sentiment_score", 0))
                    score = float(raw_score)
                    # Normalize to 1-10 range
                    score = max(1.0, min(10.0, score))
                    timestamp = parse_iso_timestamp(entry.get("timestamp"))
                    scores.append(score)
                    dates.append(timestamp)
                except (ValueError, TypeError):
                    continue

            if len(scores) < 14:
                return {
                    "forecast": "Behöver mer data för prediktion",
                    "confidence": 0.0,
                    "risk_factors": [],
                    "recommendations": ["Fortsätt logga humör dagligen"]
                }

            scores_array = np.array(scores)

            # Advanced trend analysis
            trend = np.polyfit(range(len(scores_array)), scores_array, 2)  # Quadratic trend

            # Calculate momentum (rate of change)
            momentum = np.gradient(scores_array)

            # Volatility analysis
            volatility = np.std(scores_array[-14:])  # Recent volatility

            # Seasonal patterns (weekly)
            weekly_patterns = {}
            if len(scores_array) >= 14:
                weekly_patterns = svc._analyze_weekly_patterns(scores_array, dates)

            # Predict future values
            future_predictions = []
            last_score = scores_array[-1]
            current_trend = trend[1]  # Linear coefficient

            for i in range(days_ahead):
                # Simple exponential smoothing prediction
                prediction = last_score + (current_trend * (i + 1))
                # Add some randomness based on historical volatility
                noise = np.random.normal(0, volatility * 0.3)
                prediction += noise
                # Bound predictions to 1-10 scale
                prediction = np.clip(prediction, 1.0, 10.0)
                future_predictions.append(float(prediction))

            # Risk assessment (1-10 scale: low mood < 4)
            risk_factors = []
            recent_avg = float(np.mean(scores_array[-7:]))
            avg_forecast = float(np.mean(future_predictions))
            if volatility > 1.5:
                risk_factors.append("high_volatility_predicted")
            if avg_forecast < 4.0:
                risk_factors.append("low_mood_forecast")
            if current_trend < -0.1:
                risk_factors.append("negative_trend")
            if recent_avg < 4.0:
                risk_factors.append("persistently_low_mood")
            if len([s for s in scores_array[-7:] if s < 4.0]) > 3:
                risk_factors.append("frequent_negative_moods")

            # Generate recommendations based on analysis
            recommendations = svc._generate_predictive_recommendations(
                risk_factors, float(current_trend), float(volatility), future_predictions
            )

            # Calculate confidence with NaN/Inf protection
            data_consistency = max(0.0, min(1.0, 1.0 - (volatility / 5.0)))  # Scaled for 1-10
            data_quantity = min(1.0, len(scores_array) / 60.0)  # More data = higher confidence
            confidence = float(max(0.0, min(1.0, (data_consistency + data_quantity) / 2.0)))
            if not np.isfinite(confidence):
                confidence = 0.3

            return {
                "forecast": {
                    "next_week_average": float(np.mean(future_predictions)),
                    "trend_direction": "improving" if current_trend > 0.1 else "declining" if current_trend < -0.1 else "stable",
                    "volatility_level": "high" if volatility > 2.0 else "medium" if volatility > 1.0 else "low",
                    "daily_predictions": future_predictions
                },
                "current_analysis": {
                    "recent_average": float(np.mean(scores_array[-7:])),
                    "trend_strength": abs(float(current_trend)),
                    "volatility": float(volatility),
                    "momentum": float(momentum[-1])
                },
                "risk_factors": risk_factors,
                "weekly_patterns": weekly_patterns,
                "recommendations": recommendations,
                "confidence": float(confidence),
                "data_points_used": len(scores_array)
            }

        except Exception as e:
            logger.error(f"Predictive analytics failed: {str(e)}")
            return {
                "forecast": "Kunde inte generera prediktion",
                "confidence": 0.0,
                "risk_factors": ["analysis_error"],
                "recommendations": ["Försök igen senare"]
            }

    @staticmethod
    def analyze_weekly_patterns(scores: np.ndarray, dates: list[datetime]) -> dict[str, Any]:
        """Analyze weekly mood patterns"""
        try:
            # Group by day of week
            weekday_scores = {i: [] for i in range(7)}

            for score, date in zip(scores, dates, strict=False):
                weekday = date.weekday()  # 0=Monday, 6=Sunday
                weekday_scores[weekday].append(score)

            # Calculate average for each weekday
            weekday_averages = {}
            for day, day_scores in weekday_scores.items():
                if day_scores:
                    weekday_averages[day] = float(np.mean(day_scores))

            return {
                "weekday_patterns": weekday_averages,
                "best_day": max(weekday_averages.items(), key=lambda x: x[1]) if weekday_averages else None,
                "worst_day": min(weekday_averages.items(), key=lambda x: x[1]) if weekday_averages else None
            }
        except Exception:
            return {"weekday_patterns": {}, "best_day": None, "worst_day": None}

    @staticmethod
    def generate_predictive_recommendations(risk_factors: list[str],
                                            trend: float, volatility: float,
                                            predictions: list[float]) -> list[str]:
        """Generate personalized recommendations based on predictive analysis"""
        recommendations = []

        if "high_volatility_predicted" in risk_factors:
            recommendations.extend([
                "Öva daglig mindfulness för att stabilisera humör",
                "Skapa rutiner för att minska stressfaktorer",
                "Överväg att föra en känslodagbok"
            ])

        if "negative_trend" in risk_factors:
            recommendations.extend([
                "Öka fysisk aktivitet för humörförbättring",
                "Sök socialt stöd från vänner eller familj",
                "Överväg professionell rådgivning om trenden fortsätter"
            ])

        if "persistently_low_mood" in risk_factors:
            recommendations.extend([
                "Kontakta vårdcentral för professionell bedömning",
                "Öka exponeringen för naturligt ljus",
                "Utvärdera sömnkvalitet och rutiner"
            ])

        if trend > 0.1:
            recommendations.append("Fortsätt med de strategier som fungerar bra för dig")

        if volatility < 0.2:
            recommendations.append("Din humörstabilitet är imponerande - fortsätt med dina rutiner")

        # Add general recommendations if none specific
        if not recommendations:
            recommendations.extend([
                "Fortsätt logga ditt humör regelbundet",
                "Uppmärksamma positiva händelser i vardagen",
                "Skapa balans mellan arbete och återhämtning"
            ])

        return recommendations[:5]  # Return top 5 recommendations

    def predictive_mood_forecasting_simple(self, mood_history: list[dict], days_ahead: int = 7, user_id: str | None = None) -> dict[str, Any]:
        """
        Fast, simple mood forecasting using basic statistical methods
        No ML training required - much faster than sklearn version

        Args:
            mood_history: List of mood entries with timestamps and scores
            days_ahead: Number of days to forecast

        Returns:
            Simple statistical forecast
        """
        svc = self._svc
        if len(mood_history) < 3:
            return {
                "forecast": "Behöver minst 3 humörinlägg för prognos",
                "confidence": 0.0,
                "model_info": "insufficient_data",
                "recommendations": ["Logga fler humör för bättre prognoser"]
            }

        try:
            import numpy as np
            from sklearn.ensemble import RandomForestRegressor
            from sklearn.linear_model import LinearRegression
            from sklearn.metrics import mean_squared_error
            from sklearn.model_selection import train_test_split

            # Extract scores from recent history (last 30 days)
            scores: list[float] = []
            dates: list = []
            features: list = []
            for entry in mood_history[-30:]:
                try:
                    # Prefer user's actual mood score (1-10 scale) over AI sentiment (-1 to +1)
                    # The user's score is the clinically meaningful value for mood tracking
                    raw_score = entry.get("score", entry.get("sentiment_score", 0))
                    score = float(raw_score)
                    # Normalize to 0-10 range if somehow out of bounds
                    score = max(0.0, min(10.0, score))
                    timestamp = parse_iso_timestamp(entry.get("timestamp"))

                    scores.append(score)
                    dates.append(timestamp)

                    # Create features: day of week, time of day, recent averages
                    day_of_week = timestamp.weekday()
                    hour = timestamp.hour

                    # Calculate rolling averages as features
                    if len(scores) >= 7:
                        week_avg = np.mean(scores[-7:])
                        month_avg = np.mean(scores[-30:]) if len(scores) >= 30 else week_avg
                    else:
                        week_avg = np.mean(scores)
                        month_avg = week_avg

                    features.append([day_of_week, hour, week_avg, month_avg])

                except (ValueError, TypeError):
                    continue

            if len(scores) < 14:
                return {
                    "forecast": "Behöver mer data för ML-träning",
                    "confidence": 0.0,
                    "model_info": "insufficient_data"
                }

            # Prepare training data — 1-day-ahead prediction
            X = np.array(features[:-1])  # Features for training (all but last)
            y = np.array(scores[1:])     # Target: next day's score (1-day shift)

            if len(X) < 7:
                return {
                    "forecast": "Behöver längre historik för prognos",
                    "confidence": 0.0,
                    "model_info": "insufficient_history"
                }

            # Split data for validation
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            # Train models
            models = {
                "linear_regression": LinearRegression(),
                "random_forest": RandomForestRegressor(n_estimators=50, random_state=42)
            }

            best_model = None
            best_score = float('inf')
            best_model_name = ""

            for name, model in models.items():
                try:
                    model.fit(X_train, y_train)
                    predictions = model.predict(X_test)
                    mse = mean_squared_error(y_test, predictions)

                    if mse < best_score:
                        best_score = mse
                        best_model = model
                        best_model_name = name
                except Exception as e:
                    logger.warning(f"Model {name} training failed: {str(e)}")
                    continue

            if best_model is None:
                return {
                    "forecast": "Kunde inte träna ML-modell",
                    "confidence": 0.0,
                    "model_info": "training_failed"
                }

            # Generate forecast
            forecast_scores = []

            for day in range(days_ahead):
                # Create features for next day
                next_day = dates[-1] + timedelta(days=day+1)
                next_day_of_week = next_day.weekday()
                next_hour = 12  # Assume midday for simplicity

                # Update rolling averages with forecasted values
                recent_scores = scores[-7:] + forecast_scores
                week_avg = np.mean(recent_scores[-7:])
                month_avg = np.mean(recent_scores[-30:]) if len(recent_scores) >= 30 else week_avg

                next_features = np.array([[next_day_of_week, next_hour, week_avg, month_avg]])
                predicted_score = best_model.predict(next_features)[0]

                # Clip to valid mood score range (1-10 scale)
                predicted_score = np.clip(predicted_score, 1.0, 10.0)
                forecast_scores.append(float(predicted_score))

            # Calculate confidence with NaN/Inf protection
            rmse = float(np.sqrt(best_score))
            if not np.isfinite(rmse):
                rmse = 0.5  # Default moderate confidence on numerical issues
            confidence = float(max(0.0, min(1.0, 1.0 - (rmse / 5.0))))  # Scaled for 1-10 range

            # Analyze forecast trends
            avg_forecast = np.mean(forecast_scores)
            trend = "improving" if avg_forecast > np.mean(scores[-7:]) + 0.1 else "declining" if avg_forecast < np.mean(scores[-7:]) - 0.1 else "stable"

            # Risk assessment (1-10 scale: low mood < 4)
            risk_factors = []
            if np.std(forecast_scores) > 1.5:
                risk_factors.append("high_volatility_predicted")
            if avg_forecast < 4.0:
                risk_factors.append("low_mood_forecast")
            if trend == "declining":
                risk_factors.append("negative_trend")

            result = {
                "forecast": {
                    "daily_predictions": forecast_scores,
                    "average_forecast": float(avg_forecast),
                    "trend": trend,
                    "confidence_interval": {
                        "lower": float(np.percentile(forecast_scores, 25)),
                        "upper": float(np.percentile(forecast_scores, 75))
                    }
                },
                "model_info": {
                    "algorithm": best_model_name,
                    "training_rmse": float(rmse),
                    "data_points_used": len(X_train),
                    "features_used": ["day_of_week", "hour", "week_avg", "month_avg"]
                },
                "current_analysis": {
                    "recent_average": float(np.mean(scores[-7:])),
                    "historical_volatility": float(np.std(scores)),
                    "data_points": len(scores)
                },
                "risk_factors": risk_factors,
                "recommendations": svc._generate_ml_forecast_recommendations(risk_factors, trend, float(avg_forecast)),
                "confidence": float(confidence),
                "forecast_period_days": days_ahead
            }

            # Cache the result if user_id provided
            if user_id:
                svc._cache_ml_model(user_id, result, mood_history)
                logger.info(f"✅ Cached ML forecast model for user {user_id}")

            return result

        except Exception as e:
            logger.error(f"ML forecasting failed: {str(e)}")
            return {
                "forecast": "ML-prognos misslyckades, använder fallback",
                "confidence": 0.0,
                "error": str(e),
                "fallback": svc.predictive_mood_analytics(mood_history, days_ahead)
            }

    @staticmethod
    def generate_ml_forecast_recommendations(risk_factors: list[str], trend: str, avg_forecast: float) -> list[str]:
        """Generate recommendations based on ML forecast"""
        recommendations = []

        if "high_volatility_predicted" in risk_factors:
            recommendations.extend([
                "Förbered dig för humörsvängningar - ha coping-strategier redo",
                "Öka mindfulness-övningar för bättre känsloreglering",
                "Skapa en stödjande rutin för utmanande dagar"
            ])

        if "low_mood_forecast" in risk_factors:
            recommendations.extend([
                "Öka socialt stöd och kontakt med nära vänner",
                "Planera aktiviteter som vanligtvis förbättrar ditt humör",
                "Överväg professionell hjälp om nedstämdheten kvarstår"
            ])

        if trend == "improving":
            recommendations.append("Fortsätt med de strategier som fungerar bra för dig")
        elif trend == "declining":
            recommendations.extend([
                "Öka självvårdsaktiviteter för att motverka nedåtgående trend",
                "Sök extra stöd från terapeut eller stödgrupp",
                "Övervaka ditt mående noga de kommande dagarna"
            ])

        if avg_forecast > 0.2:
            recommendations.append("Dina prognoser ser positiva ut - fira små segrar")

        # Add general recommendations if needed
        if not recommendations:
            recommendations.extend([
                "Fortsätt logga ditt humör regelbundet för bättre prognoser",
                "Uppmärksamma positiva händelser i vardagen",
                "Bygg upp ett nätverk av stödjande relationer"
            ])

        return recommendations[:4]  # Return top 4 recommendations

    @staticmethod
    def generate_simple_forecast_recommendations(risk_factors: list[str], trend: str, avg_forecast: float) -> list[str]:
        """Generate recommendations based on simple forecast analysis"""
        recommendations = []

        if "high_volatility" in risk_factors:
            recommendations.extend([
                "Öva mindfulness för att hantera humörsvängningar",
                "Skapa dagliga rutiner för stabilitet"
            ])

        if "low_mood_forecast" in risk_factors:
            recommendations.extend([
                "Öka fysisk aktivitet och solljus",
                "Sök stöd från vänner eller familj"
            ])

        if trend == "improving":
            recommendations.append("Fortsätt med strategier som fungerar bra")
        elif trend == "declining":
            recommendations.extend([
                "Öka självvårdsaktiviteter",
                "Överväg professionell hjälp om nedstämdheten kvarstår"
            ])

        if avg_forecast > 0.1:
            recommendations.append("Dina prognoser ser positiva ut")

        # Add general recommendations if needed
        if not recommendations:
            recommendations.extend([
                "Fortsätt logga ditt humör regelbundet",
                "Uppmärksamma positiva händelser"
            ])

        return recommendations[:3]  # Return top 3 recommendations
