"""
Enhanced NLP Service for Advanced Mood Analysis
Supports Swedish language processing and contextual understanding
"""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, time
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class MoodContext:
    """Context information for mood analysis"""
    time_of_day: str  # morning, afternoon, evening, night
    day_of_week: str  # monday, tuesday, etc.
    season: str      # winter, spring, summer, fall
    recent_moods: List[float]  # last few mood scores
    user_patterns: Dict[str, Any]  # learned user patterns

@dataclass
class EnhancedMoodAnalysis:
    """Enhanced mood analysis result"""
    primary_mood: str
    confidence: float
    emotions: List[Tuple[str, float]]
    intensity: float
    context_factors: Dict[str, Any]
    swedish_keywords: List[str]
    sentiment_trends: Dict[str, float]
    recommendations: List[str]

class EnhancedNLPService:
    """Advanced NLP service for Swedish mood analysis"""

    def __init__(self):
        # Swedish mood keywords with intensity scores
        self.mood_keywords = {
            # Positive moods
            'glad': 4.5, 'lycklig': 4.8, 'nöjd': 4.2, 'upprymd': 4.6,
            'harmonisk': 4.3, 'fridsam': 4.1, 'tillfreds': 4.0, 'optimistisk': 4.4,
            'entusiastisk': 4.7, 'energisk': 4.5, 'motiverad': 4.3, 'inspirerad': 4.4,

            # Neutral moods
            'neutral': 3.0, 'balanserad': 3.2, 'stabila': 3.1, 'normal': 3.0,
            'vanlig': 3.0, 'vardaglig': 3.0,

            # Negative moods - mild
            'trött': 2.5, 'uttråkad': 2.3, 'orolig': 2.4, 'stressad': 2.6,
            'irriterad': 2.7, 'frustrerad': 2.8, 'bekymrad': 2.5, 'osäker': 2.4,

            # Negative moods - moderate
            'ledsen': 2.0, 'nedstämd': 1.8, 'deprimerad': 1.5, 'ängslig': 1.9,
            'arg': 2.2, 'rasande': 1.7, 'sårad': 2.1, 'ensam': 1.9,

            # Negative moods - severe
            'hopplös': 1.2, 'förtvivlad': 1.1, 'panikslagen': 1.3, 'förstörd': 1.0,
            'självmordsbenägen': 0.5, 'dödstrött': 1.4, 'utbränd': 1.3
        }

        # Swedish emotion keywords
        self.emotion_keywords = {
            'glädje': 'joy', 'lycka': 'joy', 'nöje': 'joy', 'munterhet': 'joy',
            'sorg': 'sadness', 'ledsenhet': 'sadness', 'vemod': 'sadness',
            'ilska': 'anger', 'raseri': 'anger', 'vrede': 'anger',
            'rädsla': 'fear', 'skräck': 'fear', 'ångest': 'fear',
            'förvåning': 'surprise', 'chock': 'surprise',
            'avsky': 'disgust', 'äckel': 'disgust',
            'förtroende': 'trust', 'tillit': 'trust',
            'förväntan': 'anticipation', 'spänning': 'anticipation',
            'lugn': 'calm', 'ro': 'calm', 'harmoni': 'calm'
        }

        # Contextual modifiers
        self.intensity_modifiers = {
            'väldigt': 1.3, 'mycket': 1.2, 'ganska': 1.1, 'lite': 0.9,
            'nästan': 0.95, 'helt': 1.4, 'totalt': 1.5, 'extremt': 1.6
        }

        self.negation_words = {
            'inte', 'aldrig', 'knappast', 'sällan', 'ej', 'icke'
        }

        # Seasonal patterns (Sweden)
        self.seasonal_patterns = {
            'winter': {'depression_risk': 1.3, 'energy_level': 0.8},
            'spring': {'depression_risk': 0.9, 'energy_level': 1.1},
            'summer': {'depression_risk': 0.7, 'energy_level': 1.2},
            'fall': {'depression_risk': 1.1, 'energy_level': 0.9}
        }

    def analyze_mood_with_context(self, text: str, context: MoodContext) -> EnhancedMoodAnalysis:
        """
        Perform enhanced mood analysis with contextual understanding
        """
        logger.info(f"Analyzing mood text with context: {len(text)} chars, time: {context.time_of_day}")

        # Basic sentiment analysis
        base_score, keywords = self._extract_base_sentiment(text)

        # Apply contextual modifiers
        contextual_score = self._apply_contextual_modifiers(base_score, context)

        # Extract emotions
        emotions = self._extract_emotions(text)

        # Calculate intensity
        intensity = self._calculate_intensity(text, keywords)

        # Generate recommendations
        recommendations = self._generate_contextual_recommendations(
            contextual_score, context, emotions
        )

        # Determine primary mood
        primary_mood = self._score_to_mood_category(contextual_score)

        # Calculate confidence
        confidence = self._calculate_confidence(text, keywords, context)

        return EnhancedMoodAnalysis(
            primary_mood=primary_mood,
            confidence=confidence,
            emotions=emotions,
            intensity=intensity,
            context_factors={
                'time_of_day': context.time_of_day,
                'season': context.season,
                'recent_trend': self._calculate_recent_trend(context.recent_moods),
                'seasonal_adjustment': self.seasonal_patterns[context.season]
            },
            swedish_keywords=keywords,
            sentiment_trends=self._analyze_sentiment_trends(text),
            recommendations=recommendations
        )

    def _extract_base_sentiment(self, text: str) -> Tuple[float, List[str]]:
        """Extract base sentiment score and keywords from text"""
        text_lower = text.lower()
        found_keywords = []
        total_score = 0
        keyword_count = 0

        # Find mood keywords
        for keyword, score in self.mood_keywords.items():
            if keyword in text_lower:
                found_keywords.append(keyword)
                total_score += score
                keyword_count += 1

        # Apply intensity modifiers
        for modifier, multiplier in self.intensity_modifiers.items():
            if modifier in text_lower:
                total_score *= multiplier

        # Check for negations
        negation_count = sum(1 for word in self.negation_words if word in text_lower)
        if negation_count > 0:
            # Flip the sentiment for negations
            total_score = 6.0 - total_score  # Invert around neutral (3.0 * 2)

        base_score = total_score / max(keyword_count, 1) if keyword_count > 0 else 3.0

        # Ensure score is within bounds
        base_score = max(0.5, min(5.5, base_score))

        return base_score, found_keywords

    def _apply_contextual_modifiers(self, base_score: float, context: MoodContext) -> float:
        """Apply contextual modifiers to base score"""
        modified_score = base_score

        # Time of day adjustments (Sweden - darker winters affect mood)
        time_adjustments = {
            'morning': 1.05,  # Slightly more positive mornings
            'afternoon': 1.0,
            'evening': 0.95,  # Slightly lower in evenings
            'night': 0.9      # Lowest at night
        }
        modified_score *= time_adjustments.get(context.time_of_day, 1.0)

        # Seasonal adjustments
        season_data = self.seasonal_patterns.get(context.season, {})
        depression_modifier = season_data.get('depression_risk', 1.0)
        energy_modifier = season_data.get('energy_level', 1.0)

        # Apply seasonal effects more strongly to negative moods
        if base_score < 3.0:
            modified_score *= depression_modifier
        else:
            modified_score *= energy_modifier

        # Recent trend adjustment
        if context.recent_moods:
            recent_avg = np.mean(context.recent_moods[-7:])  # Last 7 entries
            trend_modifier = 0.1 * (recent_avg - 3.0)  # Small adjustment based on trend
            modified_score += trend_modifier

        return max(0.5, min(5.5, modified_score))

    def _extract_emotions(self, text: str) -> List[Tuple[str, float]]:
        """Extract emotions from text"""
        text_lower = text.lower()
        emotions = []

        for swedish_word, english_emotion in self.emotion_keywords.items():
            if swedish_word in text_lower:
                # Calculate intensity based on context
                intensity = 0.8  # Base intensity

                # Check for intensifiers
                for modifier, multiplier in self.intensity_modifiers.items():
                    if modifier in text_lower:
                        intensity *= multiplier
                        break

                emotions.append((english_emotion, min(1.0, intensity)))

        # Sort by intensity
        emotions.sort(key=lambda x: x[1], reverse=True)

        return emotions[:5]  # Top 5 emotions

    def _calculate_intensity(self, text: str, keywords: List[str]) -> float:
        """Calculate emotional intensity"""
        # Base intensity from keywords
        base_intensity = len(keywords) * 0.1

        # Add intensity from exclamation marks and caps
        exclamation_count = text.count('!')
        caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)

        intensity_modifier = 1.0 + (exclamation_count * 0.1) + (caps_ratio * 0.2)

        intensity = min(1.0, base_intensity * intensity_modifier)

        return intensity

    def _calculate_confidence(self, text: str, keywords: List[str], context: MoodContext) -> float:
        """Calculate confidence in the analysis"""
        confidence = 0.5  # Base confidence

        # More keywords = higher confidence
        keyword_factor = min(1.0, len(keywords) * 0.15)
        confidence += keyword_factor

        # Longer text = higher confidence
        length_factor = min(0.2, len(text) * 0.001)
        confidence += length_factor

        # Recent context available = higher confidence
        if context.recent_moods:
            confidence += 0.1

        return min(0.95, confidence)

    def _score_to_mood_category(self, score: float) -> str:
        """Convert numerical score to mood category"""
        if score >= 4.5:
            return 'excellent'
        elif score >= 4.0:
            return 'very_good'
        elif score >= 3.5:
            return 'good'
        elif score >= 2.5:
            return 'neutral'
        elif score >= 2.0:
            return 'bad'
        elif score >= 1.5:
            return 'very_bad'
        else:
            return 'terrible'

    def _calculate_recent_trend(self, recent_moods: List[float]) -> str:
        """Calculate recent mood trend"""
        if len(recent_moods) < 2:
            return 'stable'

        # Simple linear trend
        recent = recent_moods[-7:]  # Last 7 entries
        if len(recent) < 2:
            return 'stable'

        # Calculate slope
        x = np.arange(len(recent))
        slope = np.polyfit(x, recent, 1)[0]

        if slope > 0.1:
            return 'improving'
        elif slope < -0.1:
            return 'declining'
        else:
            return 'stable'

    def _analyze_sentiment_trends(self, text: str) -> Dict[str, float]:
        """Analyze sentiment trends in text"""
        # Simple analysis - can be enhanced with more sophisticated NLP
        words = text.lower().split()

        positive_indicators = ['glad', 'bra', 'bra', 'positiv', 'härlig', 'underbar']
        negative_indicators = ['dålig', 'ledsen', 'arg', 'stressad', 'trött', 'dåligt']

        positive_count = sum(1 for word in words if any(pos in word for pos in positive_indicators))
        negative_count = sum(1 for word in words if any(neg in word for neg in negative_indicators))

        total_indicators = positive_count + negative_count

        if total_indicators == 0:
            return {'positive_ratio': 0.5, 'negative_ratio': 0.5, 'neutral_ratio': 1.0}

        return {
            'positive_ratio': positive_count / total_indicators,
            'negative_ratio': negative_count / total_indicators,
            'neutral_ratio': (len(words) - total_indicators) / len(words)
        }

    def _generate_contextual_recommendations(
        self,
        score: float,
        context: MoodContext,
        emotions: List[Tuple[str, float]]
    ) -> List[str]:
        """Generate contextual recommendations"""
        recommendations = []

        # Time-based recommendations
        if context.time_of_day == 'morning':
            if score < 3.0:
                recommendations.append("Börja dagen med en kort promenad i solljus")
            else:
                recommendations.append("Bra jobbat! Fortsätt med positiva rutiner")
        elif context.time_of_day == 'evening':
            if score < 3.0:
                recommendations.append("Försök få en god natts sömn för bättre morgondag")
            else:
                recommendations.append("Avsluta dagen med något trevligt")

        # Seasonal recommendations
        if context.season == 'winter' and score < 3.0:
            recommendations.append("Överväg vitamin D-tillskott eller ljusterapi")
        elif context.season == 'summer' and score > 4.0:
            recommendations.append("Njut av det fina vädret - gå ut och rör på dig")

        # Emotion-based recommendations
        primary_emotion = emotions[0][0] if emotions else None
        if primary_emotion == 'sadness':
            recommendations.append("Prata med en vän eller skriv dagbok")
        elif primary_emotion == 'anger':
            recommendations.append("Ta en kort promenad eller lyssna på lugn musik")
        elif primary_emotion == 'fear':
            recommendations.append("Andningsövningar kan hjälpa: andas in 4 sekunder, håll 4, andas ut 4")

        # Trend-based recommendations
        trend = self._calculate_recent_trend(context.recent_moods)
        if trend == 'declining':
            recommendations.append("Överväg att kontakta en professionell för stöd")
        elif trend == 'improving':
            recommendations.append("Fortsätt med det som fungerar bra för dig!")

        return recommendations[:3]  # Max 3 recommendations

    def get_season_from_date(self, date: datetime) -> str:
        """Get season from date (Sweden)"""
        month = date.month
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'spring'
        elif month in [6, 7, 8]:
            return 'summer'
        else:
            return 'fall'

    def get_time_of_day(self, timestamp: datetime) -> str:
        """Get time of day category"""
        hour = timestamp.hour
        if 6 <= hour < 12:
            return 'morning'
        elif 12 <= hour < 17:
            return 'afternoon'
        elif 17 <= hour < 22:
            return 'evening'
        else:
            return 'night'


# Singleton instance
enhanced_nlp_service = EnhancedNLPService()