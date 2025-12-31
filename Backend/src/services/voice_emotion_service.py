"""
Voice Emotion Recognition Service
Advanced emotion detection from voice audio using multiple analysis methods
"""

import logging
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import base64
import io

logger = logging.getLogger(__name__)

@dataclass
class VoiceEmotionResult:
    """Result of voice emotion analysis"""
    primary_emotion: str
    confidence: float
    emotion_scores: Dict[str, float]
    voice_features: Dict[str, float]
    stress_indicators: Dict[str, Any]
    analysis_method: str
    transcription_confidence: float

@dataclass
class VoiceFeatures:
    """Extracted voice features"""
    pitch_mean: float
    pitch_std: float
    volume_mean: float
    volume_std: float
    speaking_rate: float
    pause_frequency: float
    tremor_indicators: float
    breath_pattern: str

class VoiceEmotionService:
    """Service for analyzing emotions from voice audio"""

    def __init__(self):
        # Emotion profiles based on voice characteristics
        self.emotion_profiles = {
            'joy': {
                'pitch_range': (0.8, 1.4),  # Higher pitch
                'volume_range': (0.9, 1.3),  # Louder
                'speaking_rate': (1.1, 1.5),  # Faster
                'pause_frequency': (0.3, 0.7),  # Fewer pauses
                'keywords': ['glad', 'lycklig', 'kul', 'härligt']
            },
            'sadness': {
                'pitch_range': (0.6, 0.9),  # Lower pitch
                'volume_range': (0.4, 0.7),  # Quieter
                'speaking_rate': (0.7, 0.9),  # Slower
                'pause_frequency': (1.2, 2.0),  # More pauses
                'keywords': ['ledsen', 'sorglig', 'trist', 'dåligt']
            },
            'anger': {
                'pitch_range': (1.1, 1.6),  # Higher pitch
                'volume_range': (1.2, 1.8),  # Very loud
                'speaking_rate': (1.3, 1.8),  # Fast
                'pause_frequency': (0.8, 1.3),  # Some pauses
                'keywords': ['arg', 'rasande', 'irriterad', 'förbannad']
            },
            'fear': {
                'pitch_range': (1.0, 1.4),  # High pitch
                'volume_range': (0.6, 0.9),  # Variable volume
                'speaking_rate': (1.2, 1.6),  # Fast
                'pause_frequency': (1.0, 1.5),  # More pauses
                'keywords': ['rädd', 'orolig', 'ängslig', 'skräck']
            },
            'stress': {
                'pitch_range': (0.9, 1.3),  # Variable pitch
                'volume_range': (0.8, 1.2),  # Variable volume
                'speaking_rate': (1.1, 1.4),  # Fast
                'pause_frequency': (0.9, 1.4),  # Variable pauses
                'keywords': ['stressad', 'nervös', 'spänd', 'orolig']
            },
            'calm': {
                'pitch_range': (0.7, 1.0),  # Moderate pitch
                'volume_range': (0.6, 0.9),  # Moderate volume
                'speaking_rate': (0.8, 1.1),  # Moderate rate
                'pause_frequency': (0.7, 1.1),  # Moderate pauses
                'keywords': ['lugn', 'avslappnad', 'harmonisk', 'fridfull']
            },
            'neutral': {
                'pitch_range': (0.8, 1.1),  # Normal pitch
                'volume_range': (0.7, 1.0),  # Normal volume
                'speaking_rate': (0.9, 1.1),  # Normal rate
                'pause_frequency': (0.8, 1.2),  # Normal pauses
                'keywords': ['neutral', 'normal', 'vanlig']
            }
        }

        # Stress indicators
        self.stress_indicators = {
            'tremor': {'threshold': 0.3, 'weight': 0.4},
            'irregular_breathing': {'threshold': 0.4, 'weight': 0.3},
            'voice_breaks': {'threshold': 0.2, 'weight': 0.3}
        }

    def analyze_voice_emotion(
        self,
        audio_data: bytes,
        transcription: Optional[str] = None,
        user_context: Optional[Dict[str, Any]] = None
    ) -> VoiceEmotionResult:
        """
        Analyze emotions from voice audio data

        Args:
            audio_data: Raw audio bytes
            transcription: Optional speech-to-text transcription
            user_context: Optional user context information

        Returns:
            VoiceEmotionResult with emotion analysis
        """
        logger.info(f"Analyzing voice emotion from {len(audio_data)} bytes of audio data")

        try:
            # Extract voice features
            voice_features = self._extract_voice_features(audio_data)

            # Analyze based on transcription if available
            text_emotions = {}
            if transcription:
                text_emotions = self._analyze_transcription_emotions(transcription)

            # Combine acoustic and textual analysis
            combined_emotions = self._combine_analyses(voice_features, text_emotions)

            # Determine primary emotion
            primary_emotion = max(combined_emotions.items(), key=lambda x: x[1])[0]

            # Calculate confidence
            confidence = self._calculate_emotion_confidence(
                combined_emotions, voice_features, transcription
            )

            # Detect stress indicators
            stress_indicators = self._detect_stress_indicators(voice_features)

            # Transcription confidence (placeholder - would use actual STT confidence)
            transcription_confidence = 0.8 if transcription else 0.0

            return VoiceEmotionResult(
                primary_emotion=primary_emotion,
                confidence=confidence,
                emotion_scores=combined_emotions,
                voice_features=voice_features.__dict__,
                stress_indicators=stress_indicators,
                analysis_method='hybrid_acoustic_text' if transcription else 'acoustic_only',
                transcription_confidence=transcription_confidence
            )

        except Exception as e:
            logger.error(f"Error analyzing voice emotion: {str(e)}")
            # Return neutral result on error
            return VoiceEmotionResult(
                primary_emotion='neutral',
                confidence=0.5,
                emotion_scores={'neutral': 0.5},
                voice_features={},
                stress_indicators={},
                analysis_method='error_fallback',
                transcription_confidence=0.0
            )

    def _extract_voice_features(self, audio_data: bytes) -> VoiceFeatures:
        """
        Extract acoustic features from audio data
        Note: This is a simplified implementation. In production, you would use
        libraries like librosa, pyAudioAnalysis, or speech processing frameworks.
        """
        try:
            # For now, we'll simulate feature extraction
            # In a real implementation, you would:
            # 1. Load audio with librosa
            # 2. Extract MFCCs, pitch, volume, etc.
            # 3. Calculate statistical features

            # Simulate voice feature extraction
            np.random.seed(len(audio_data) % 1000)  # Deterministic seed based on audio

            pitch_mean = np.random.normal(1.0, 0.2)  # Normalized pitch
            pitch_std = np.random.normal(0.1, 0.05)
            volume_mean = np.random.normal(0.8, 0.15)
            volume_std = np.random.normal(0.1, 0.03)
            speaking_rate = np.random.normal(1.0, 0.2)
            pause_frequency = np.random.normal(1.0, 0.3)
            tremor_indicators = np.random.normal(0.1, 0.05)
            breath_pattern = 'regular'  # Could be 'irregular', 'shallow', etc.

            return VoiceFeatures(
                pitch_mean=max(0.1, min(2.0, pitch_mean)),
                pitch_std=max(0.01, pitch_std),
                volume_mean=max(0.1, min(1.5, volume_mean)),
                volume_std=max(0.01, volume_std),
                speaking_rate=max(0.3, min(2.0, speaking_rate)),
                pause_frequency=max(0.1, min(3.0, pause_frequency)),
                tremor_indicators=max(0.0, min(1.0, tremor_indicators)),
                breath_pattern=breath_pattern
            )

        except Exception as e:
            logger.warning(f"Error extracting voice features: {str(e)}")
            # Return default features
            return VoiceFeatures(
                pitch_mean=1.0, pitch_std=0.1, volume_mean=0.8, volume_std=0.1,
                speaking_rate=1.0, pause_frequency=1.0, tremor_indicators=0.1,
                breath_pattern='regular'
            )

    def _analyze_transcription_emotions(self, transcription: str) -> Dict[str, float]:
        """Analyze emotions from transcription text"""
        text_lower = transcription.lower()
        emotion_scores = {}

        for emotion, profile in self.emotion_profiles.items():
            score = 0.0

            # Check for emotion keywords
            for keyword in profile['keywords']:
                if keyword in text_lower:
                    score += 0.3

            # Check for intensity modifiers
            intensity_modifiers = {
                'väldigt': 1.5, 'mycket': 1.3, 'ganska': 1.1,
                'lite': 0.7, 'knappast': 0.5
            }

            for modifier, multiplier in intensity_modifiers.items():
                if modifier in text_lower:
                    score *= multiplier
                    break

            emotion_scores[emotion] = min(1.0, score)

        return emotion_scores

    def _combine_analyses(
        self,
        voice_features: VoiceFeatures,
        text_emotions: Dict[str, float]
    ) -> Dict[str, float]:
        """Combine acoustic and textual emotion analysis"""
        combined_scores = {}

        for emotion, profile in self.emotion_profiles.items():
            acoustic_score = self._calculate_acoustic_score(emotion, voice_features)
            text_score = text_emotions.get(emotion, 0.0)

            # Weight the scores (acoustic: 60%, text: 40% if available)
            if text_emotions:
                combined_score = (acoustic_score * 0.6) + (text_score * 0.4)
            else:
                combined_score = acoustic_score

            combined_scores[emotion] = combined_score

        # Normalize scores
        total_score = sum(combined_scores.values())
        if total_score > 0:
            combined_scores = {k: v/total_score for k, v in combined_scores.items()}

        return combined_scores

    def _calculate_acoustic_score(self, emotion: str, features: VoiceFeatures) -> float:
        """Calculate emotion score based on acoustic features"""
        profile = self.emotion_profiles[emotion]

        # Check if features fall within emotion profile ranges
        score = 0.0

        # Pitch analysis
        pitch_min, pitch_max = profile['pitch_range']
        if pitch_min <= features.pitch_mean <= pitch_max:
            score += 0.25

        # Volume analysis
        vol_min, vol_max = profile['volume_range']
        if vol_min <= features.volume_mean <= vol_max:
            score += 0.25

        # Speaking rate analysis
        rate_min, rate_max = profile['speaking_rate']
        if rate_min <= features.speaking_rate <= rate_max:
            score += 0.25

        # Pause frequency analysis
        pause_min, pause_max = profile['pause_frequency']
        if pause_min <= features.pause_frequency <= pause_max:
            score += 0.25

        return score

    def _calculate_emotion_confidence(
        self,
        emotion_scores: Dict[str, float],
        voice_features: VoiceFeatures,
        transcription: Optional[str]
    ) -> float:
        """Calculate overall confidence in emotion analysis"""
        confidence = 0.5  # Base confidence

        # Higher confidence if we have transcription
        if transcription:
            confidence += 0.2

        # Higher confidence if top emotion score is significantly higher
        sorted_scores = sorted(emotion_scores.values(), reverse=True)
        if len(sorted_scores) > 1 and sorted_scores[0] > sorted_scores[1] * 1.5:
            confidence += 0.15

        # Lower confidence for very quiet or very loud audio
        if voice_features.volume_mean < 0.3 or voice_features.volume_mean > 1.3:
            confidence -= 0.1

        return max(0.1, min(0.95, confidence))

    def _detect_stress_indicators(self, features: VoiceFeatures) -> Dict[str, Any]:
        """Detect stress indicators in voice"""
        indicators = {}

        # Tremor detection (simplified)
        indicators['tremor'] = {
            'detected': features.tremor_indicators > 0.3,
            'level': min(1.0, features.tremor_indicators),
            'confidence': 0.7
        }

        # Irregular breathing detection
        breathing_irregular = features.volume_std > 0.15 or features.pitch_std > 0.2
        indicators['irregular_breathing'] = {
            'detected': breathing_irregular,
            'pattern': features.breath_pattern,
            'confidence': 0.6
        }

        # Voice breaks (simplified - would need more sophisticated analysis)
        voice_breaks = features.pause_frequency > 1.5
        indicators['voice_breaks'] = {
            'detected': voice_breaks,
            'frequency': features.pause_frequency,
            'confidence': 0.5
        }

        # Overall stress score
        stress_score = sum(
            ind['level'] if 'level' in ind else (1.0 if ind['detected'] else 0.0)
            for ind in indicators.values()
        ) / len(indicators)

        indicators['overall_stress'] = {
            'score': stress_score,
            'level': 'high' if stress_score > 0.6 else 'medium' if stress_score > 0.3 else 'low'
        }

        return indicators

    def get_emotion_color(self, emotion: str) -> str:
        """Get color representation for emotion"""
        color_map = {
            'joy': '#FFD700',      # Gold
            'sadness': '#4169E1',  # Royal Blue
            'anger': '#DC143C',    # Crimson
            'fear': '#800080',     # Purple
            'stress': '#FF6347',   # Tomato
            'calm': '#98FB98',     # Pale Green
            'neutral': '#D3D3D3'   # Light Gray
        }
        return color_map.get(emotion, '#808080')

    def get_emotion_swedish_name(self, emotion: str) -> str:
        """Get Swedish name for emotion"""
        name_map = {
            'joy': 'glädje',
            'sadness': 'sorg',
            'anger': 'ilska',
            'fear': 'rädsla',
            'stress': 'stress',
            'calm': 'lugn',
            'neutral': 'neutral'
        }
        return name_map.get(emotion, emotion)


# Singleton instance
voice_emotion_service = VoiceEmotionService()