"""Voice emotion analysis (librosa audio features + transcript sentiment)."""

import logging
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)


class VoiceEmotionEngine:
    """Single responsibility: derive emotion signals from audio + transcript."""

    def __init__(self, svc):
        self._svc = svc

    def analyze_voice_emotion(self, audio_data: bytes, transcript: str) -> dict[str, Any]:
        """
        Enhanced voice emotion analysis using advanced audio processing
        """
        svc = self._svc
        try:
            from io import BytesIO  # noqa: F401

            import librosa  # noqa: F401
            import numpy as np  # noqa: F401

            # For now, combine transcript analysis with basic audio features
            transcript_analysis = svc.analyze_sentiment(transcript)

            # Enhanced voice characteristics analysis
            voice_characteristics = svc._analyze_audio_features(audio_data)

            # Combine transcript and audio analysis for better accuracy
            combined_confidence = (transcript_analysis["confidence"] + voice_characteristics["confidence"]) / 2

            return {
                "primary_emotion": transcript_analysis["emotions"][0] if transcript_analysis["emotions"] else "neutral",
                "confidence": combined_confidence,
                "voice_characteristics": voice_characteristics,
                "transcript_sentiment": transcript_analysis["sentiment"],
                "audio_emotion_score": voice_characteristics["emotion_score"],
                "combined_analysis": svc._combine_analyses(transcript_analysis, voice_characteristics),
                **transcript_analysis
            }

        except ImportError:
            logger.warning("Advanced audio libraries not available, using basic analysis")
            return svc._basic_voice_analysis(audio_data, transcript)

    def analyze_audio_features(self, audio_data: bytes) -> dict[str, Any]:
        """Analyze audio features for emotion detection using librosa."""
        try:
            from io import BytesIO

            import librosa
            import numpy as np

            # Load audio from bytes using librosa (handles wav, mp3, ogg, etc.)
            audio_array, sr = librosa.load(BytesIO(audio_data), sr=None, mono=True)

            # RMS energy
            rms = float(np.sqrt(np.mean(audio_array ** 2)))
            if rms > 0.05:
                energy_level = "high"
            elif rms > 0.015:
                energy_level = "medium"
            else:
                energy_level = "low"

            # Speech tempo via onset detection
            onset_frames = librosa.onset.onset_detect(y=audio_array, sr=sr, units='frames')
            duration_sec = len(audio_array) / sr
            onsets_per_sec = len(onset_frames) / max(duration_sec, 0.1)
            if onsets_per_sec > 4.0:
                speech_rate = "fast"
            elif onsets_per_sec > 1.5:
                speech_rate = "normal"
            else:
                speech_rate = "slow"

            # Pitch variation via fundamental frequency (F0)
            f0, voiced_flag, _ = librosa.pyin(
                audio_array, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr
            )
            voiced_f0 = f0[voiced_flag] if voiced_flag is not None else f0[~np.isnan(f0)]
            if len(voiced_f0) > 1:
                pitch_variation = float(np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-6))
                pitch_variation = min(pitch_variation, 1.0)
            else:
                pitch_variation = 0.0

            # Composite emotion score from features
            emotion_score = 0.0
            if energy_level == "high":
                emotion_score += 0.35
            elif energy_level == "medium":
                emotion_score += 0.15
            if speech_rate == "fast":
                emotion_score += 0.25
            elif speech_rate == "slow":
                emotion_score += 0.1
            emotion_score += pitch_variation * 0.4

            return {
                "energy_level": energy_level,
                "speech_rate": speech_rate,
                "pitch_variation": round(pitch_variation, 3),
                "emotion_score": round(min(emotion_score, 1.0), 3),
                "confidence": 0.75,
                "analysis_method": "librosa_features",
                "duration_seconds": round(duration_sec, 1),
                "sample_rate": sr,
            }

        except ImportError:
            logger.warning("librosa not installed — falling back to basic audio analysis")
            return {
                "energy_level": "unknown",
                "speech_rate": "unknown",
                "pitch_variation": 0.0,
                "emotion_score": 0.0,
                "confidence": 0.0,
                "analysis_method": "unavailable"
            }
        except Exception as e:
            logger.error(f"Audio feature analysis failed: {str(e)}")
            return {
                "energy_level": "unknown",
                "speech_rate": "unknown",
                "pitch_variation": 0.0,
                "emotion_score": 0.0,
                "confidence": 0.0,
                "analysis_method": "failed"
            }

    def basic_voice_analysis(self, audio_data: bytes, transcript: str) -> dict[str, Any]:
        """Basic voice analysis when advanced libraries aren't available"""
        svc = self._svc
        transcript_analysis = svc.analyze_sentiment(transcript)

        return {
            "primary_emotion": transcript_analysis["emotions"][0] if transcript_analysis["emotions"] else "neutral",
            "confidence": transcript_analysis["confidence"] * 0.8,
            "voice_characteristics": {
                "energy_level": "medium",
                "speech_rate": "normal",
                "emotional_intensity": transcript_analysis["intensity"],
                "analysis_method": "transcript_only"
            },
            "transcript_sentiment": transcript_analysis["sentiment"],
            "audio_emotion_score": 0.0,
            "combined_analysis": transcript_analysis["sentiment"],
            **transcript_analysis
        }

    @staticmethod
    def combine_analyses(transcript_analysis: dict, voice_characteristics: dict) -> str:
        """Combine transcript and voice analysis for better accuracy"""
        transcript_sentiment = transcript_analysis.get("sentiment", "NEUTRAL")
        audio_score = voice_characteristics.get("emotion_score", 0.0)

        # If audio analysis shows high emotion but transcript is neutral, adjust
        if audio_score > 0.6 and transcript_sentiment == "NEUTRAL":
            return "MIXED_HIGH_EMOTION"
        elif audio_score > 0.4 and transcript_sentiment == "NEGATIVE":
            return "NEGATIVE_INTENSE"
        elif audio_score > 0.4 and transcript_sentiment == "POSITIVE":
            return "POSITIVE_INTENSE"

        return transcript_sentiment

    @staticmethod
    def analyze_voice_emotion_fallback(text: str = "") -> dict[str, Any]:
        """
        Fallback voice emotion analysis when primary methods fail
        Uses simple keyword matching for Swedish text

        Args:
            text: Transcript text to analyze (can be empty)

        Returns:
            Basic emotion analysis dict
        """
        telemetry.degraded("voice_emotion", "keyword_fallback")
        # Swedish emotion keywords
        emotion_keywords = {
            'glad': ['glad', 'lycklig', 'nöjd', 'positiv', 'bra', 'härligt', 'fantastiskt', 'underbart'],
            'ledsen': ['ledsen', 'sorglig', 'deprimerad', 'nere', 'dålig', 'tråkig', 'hemsk'],
            'arg': ['arg', 'irriterad', 'frustrerad', 'förbannad', 'upprörd'],
            'orolig': ['orolig', 'ängslig', 'nervös', 'stressad', 'rädd'],
            'trött': ['trött', 'utmattad', 'sliten', 'orkeslös'],
            'lugn': ['lugn', 'avslappnad', 'harmonisk', 'fridfull']
        }

        text_lower = text.lower() if text else ""
        detected_emotions = []
        max_score = 0.0
        primary_emotion = 'neutral'

        # Check for emotion keywords
        for emotion, keywords in emotion_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    detected_emotions.append(emotion)
                    score = 0.7  # Base confidence for keyword match
                    if score > max_score:
                        max_score = score
                        primary_emotion = emotion

        # If no keywords found, default to neutral
        if not detected_emotions:
            detected_emotions = ['neutral']
            primary_emotion = 'neutral'
            max_score = 0.5

        # Map to sentiment
        sentiment_map = {
            'glad': 'POSITIVE',
            'ledsen': 'NEGATIVE',
            'arg': 'NEGATIVE',
            'orolig': 'NEGATIVE',
            'trött': 'NEUTRAL',
            'lugn': 'POSITIVE',
            'neutral': 'NEUTRAL'
        }

        sentiment = sentiment_map.get(primary_emotion, 'NEUTRAL')

        return {
            "primary_emotion": primary_emotion,
            "confidence": max_score,
            "voice_characteristics": {
                "energy_level": "unknown",
                "speech_rate": "unknown",
                "pitch_variation": 0.0,
                "emotion_score": max_score,
                "confidence": max_score,
                "analysis_method": "fallback_keywords"
            },
            "transcript_sentiment": sentiment,
            "audio_emotion_score": 0.0,
            "combined_analysis": sentiment,
            "sentiment": sentiment,
            "score": max_score if sentiment == 'POSITIVE' else -max_score if sentiment == 'NEGATIVE' else 0.0,
            "magnitude": max_score,
            "emotions": detected_emotions,
            "intensity": max_score,
            "method": "fallback_keyword_analysis"
        }
