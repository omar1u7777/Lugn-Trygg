"""
Voice Routes - Real speech-to-text and voice analysis endpoints
Uses Google Cloud Speech-to-Text API for transcription
"""
import base64
import logging

from flask import Blueprint, g, request

from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse
from ..utils.speech_utils import transcribe_audio_google

voice_bp = Blueprint('voice', __name__)
logger = logging.getLogger(__name__)


# ============================================================================
# OPTIONS Handlers (CORS Preflight)
# ============================================================================

@voice_bp.route('/transcribe', methods=['OPTIONS'])
def transcribe_options():
    """Handle CORS preflight for transcribe endpoint"""
    return APIResponse.success()


@voice_bp.route('/analyze-emotion', methods=['OPTIONS'])
def analyze_emotion_options():
    """Handle CORS preflight for analyze-emotion endpoint"""
    return APIResponse.success()


@voice_bp.route('/status', methods=['OPTIONS'])
def status_options():
    """Handle CORS preflight for status endpoint"""
    return APIResponse.success()


# ============================================================================
# Voice Transcription
# ============================================================================
# ============================================================================
# Voice Transcription
# ============================================================================

@voice_bp.route('/transcribe', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def transcribe_audio():
    """
    Transcribe audio to text using Google Cloud Speech-to-Text

    Request body:
        audio_data: Base64-encoded audio data (WAV, WEBM, OGG)
        language: Language code (default: 'sv-SE')

    Returns:
        transcript: The transcribed text
        confidence: Confidence score (0-1)
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    data = request.get_json(silent=True)

    if not data:
        return APIResponse.bad_request("No data provided")

    audio_base64 = data.get('audio_data')
    language = sanitize_text(data.get('language', 'sv-SE'), max_length=10)

    if not audio_base64:
        return APIResponse.bad_request("audio_data is required")

    # Decode base64 audio
    try:
        audio_bytes = base64.b64decode(audio_base64)
        logger.info(f"📦 Received audio: {len(audio_bytes)} bytes from user {user_id}")
    except Exception as decode_error:
        logger.error(f"❌ Failed to decode base64 audio: {decode_error}")
        return APIResponse.bad_request("Invalid base64 audio data")

    try:
        # Transcribe using Google Cloud Speech-to-Text
        transcript = transcribe_audio_google(audio_bytes, language)

        if transcript:
            audit_log(
                event_type="VOICE_TRANSCRIPTION_SUCCESS",
                user_id=user_id,
                details={
                    "transcript_length": len(transcript),
                    "language": language,
                    "audio_size_bytes": len(audio_bytes)
                }
            )

            logger.info(f"✅ Transcription successful for user {user_id}: {len(transcript)} chars")
            return APIResponse.success({
                "transcript": transcript,
                "confidence": 0.85,
                "language": language
            }, "Transcription successful")
        else:
            # If Google Speech fails, suggest client fallback
            logger.warning(f"⚠️ Transcription failed for user {user_id}, suggesting client fallback")
            return APIResponse.success({
                "transcript": None,
                "fallback": "web_speech_api",
                "message": "Google Speech-to-Text could not transcribe. Try speaking more clearly."
            }, "Transcription failed, use client fallback")

    except Exception as e:
        logger.exception(f"❌ Voice transcription error: {e}")
        audit_log(
            event_type="VOICE_TRANSCRIPTION_ERROR",
            user_id=user_id,
            details={"error": str(e), "language": language}
        )
        return APIResponse.error("Voice transcription failed", "TRANSCRIPTION_ERROR", 500, str(e))


# ============================================================================
# Voice Emotion Analysis
# ============================================================================

@voice_bp.route('/analyze-emotion', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def analyze_voice_emotion():
    """
    Analyze emotion from voice recording using audio features

    This uses basic audio analysis (volume, pitch patterns) combined
    with text sentiment if transcription is available.

    Request body:
        audio_data: Base64-encoded audio data
        transcript: Optional transcript for combined analysis

    Returns:
        emotions: Detected emotions with confidence scores
        energy_level: Overall energy/intensity level
        speaking_pace: Fast/normal/slow speaking pace
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    data = request.get_json(silent=True)

    if not data:
        return APIResponse.bad_request("No data provided")

    audio_base64 = data.get('audio_data')
    transcript = sanitize_text(data.get('transcript', ''), max_length=10000) if data.get('transcript') else ''

    if not audio_base64:
        return APIResponse.bad_request("audio_data is required")

    # Decode audio
    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception:
        return APIResponse.bad_request("Invalid base64 audio data")

    try:
        # Analyze audio characteristics
        audio_analysis = analyze_audio_features(audio_bytes)

        # If we have a transcript, add text sentiment
        text_sentiment = None
        if transcript:
            text_sentiment = analyze_text_sentiment(transcript)

        # Combine audio and text analysis
        emotions = combine_emotion_analysis(audio_analysis, text_sentiment)

        audit_log(
            event_type="VOICE_EMOTION_ANALYZED",
            user_id=user_id,
            details={
                "primary_emotion": emotions['primary'],
                "has_transcript": bool(transcript),
                "audio_size_bytes": len(audio_bytes)
            }
        )

        logger.info(f"✅ Voice emotion analysis for user {user_id}: primary={emotions['primary']}")

        return APIResponse.success({
            "emotions": emotions['all'],
            "primaryEmotion": emotions['primary'],
            "energyLevel": audio_analysis['energy_level'],
            "speakingPace": audio_analysis['pace'],
            "volumeVariation": audio_analysis['volume_variation']
        }, "Emotion analysis successful")

    except Exception as e:
        logger.exception(f"❌ Voice emotion analysis error: {e}")
        return APIResponse.error("Voice emotion analysis failed", "ANALYSIS_ERROR", 500, str(e))


# ============================================================================
# Helper Functions
# ============================================================================

def analyze_audio_features(audio_bytes: bytes) -> dict:
    """
    Analyze basic audio features from raw audio bytes

    In production, this would use librosa for proper audio analysis.
    This is a simplified version that works without extra dependencies.
    """
    try:
        # Calculate basic statistics from audio bytes
        # Convert bytes to amplitude values
        amplitudes = [int.from_bytes(audio_bytes[i:i+2], 'little', signed=True)
                     for i in range(0, min(len(audio_bytes), 100000), 2)]

        if not amplitudes:
            return {
                'energy_level': 'medium',
                'pace': 'normal',
                'volume_variation': 'moderate'
            }

        # Calculate statistics
        avg_amplitude = sum(abs(a) for a in amplitudes) / len(amplitudes)
        max_amplitude = max(abs(a) for a in amplitudes)

        # Estimate energy level
        if avg_amplitude > 10000:
            energy = 'high'
        elif avg_amplitude > 3000:
            energy = 'medium'
        else:
            energy = 'low'

        # Estimate volume variation
        variance = sum((abs(a) - avg_amplitude) ** 2 for a in amplitudes) / len(amplitudes)
        if variance > 50000000:
            variation = 'high'
        elif variance > 10000000:
            variation = 'moderate'
        else:
            variation = 'low'

        # Pace estimation (based on zero crossings)
        zero_crossings = sum(1 for i in range(1, len(amplitudes))
                            if (amplitudes[i] > 0) != (amplitudes[i-1] > 0))
        crossing_rate = zero_crossings / len(amplitudes)

        if crossing_rate > 0.3:
            pace = 'fast'
        elif crossing_rate > 0.1:
            pace = 'normal'
        else:
            pace = 'slow'

        return {
            'energy_level': energy,
            'pace': pace,
            'volume_variation': variation,
            'avg_amplitude': avg_amplitude,
            'max_amplitude': max_amplitude
        }

    except Exception as e:
        logger.warning(f"Audio analysis fallback: {e}")
        return {
            'energy_level': 'medium',
            'pace': 'normal',
            'volume_variation': 'moderate'
        }


def analyze_text_sentiment(text: str) -> dict:
    """
    Analyze sentiment from transcript text

    Uses keyword matching for Swedish emotional words.
    In production, this could use OpenAI or a Swedish NLP model.
    """
    text_lower = text.lower()

    # Swedish emotion keywords
    emotion_keywords = {
        'happy': ['glad', 'lycklig', 'nöjd', 'fantastisk', 'underbar', 'bra', 'toppen', 'superbra'],
        'sad': ['ledsen', 'sorgsen', 'nedstämd', 'deprimerad', 'olycklig', 'tråkig', 'melankolisk'],
        'anxious': ['orolig', 'nervös', 'ångest', 'rädd', 'spänd', 'stressad', 'panik'],
        'angry': ['arg', 'irriterad', 'frustrerad', 'upprörd', 'ilsken', 'förbannad'],
        'calm': ['lugn', 'avslappnad', 'fridfull', 'stilla', 'ro', 'harmonisk'],
        'tired': ['trött', 'utmattad', 'sliten', 'orkeslös', 'sömnig', 'dränerad']
    }

    # Count emotion matches
    emotion_scores = {}
    for emotion, keywords in emotion_keywords.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            emotion_scores[emotion] = score

    if not emotion_scores:
        return {'primary': 'neutral', 'scores': {'neutral': 0.5}}

    # Normalize scores
    total = sum(emotion_scores.values())
    normalized = {e: s/total for e, s in emotion_scores.items()}
    primary = max(emotion_scores.keys(), key=lambda k: emotion_scores[k])  # type: ignore

    return {
        'primary': primary,
        'scores': normalized
    }


def combine_emotion_analysis(audio: dict, text: dict | None) -> dict:
    """
    Combine audio and text analysis for final emotion prediction
    """
    # Default emotions
    emotions = {
        'happy': 0.0,
        'sad': 0.0,
        'anxious': 0.0,
        'angry': 0.0,
        'calm': 0.0,
        'neutral': 0.5
    }

    # Adjust based on audio energy
    energy = audio.get('energy_level', 'medium')
    if energy == 'high':
        emotions['angry'] += 0.2
        emotions['anxious'] += 0.15
        emotions['happy'] += 0.1
    elif energy == 'low':
        emotions['sad'] += 0.2
        emotions['calm'] += 0.15
        emotions['tired'] = 0.15

    # Adjust based on pace
    pace = audio.get('pace', 'normal')
    if pace == 'fast':
        emotions['anxious'] += 0.2
        emotions['angry'] += 0.1
    elif pace == 'slow':
        emotions['sad'] += 0.15
        emotions['calm'] += 0.1

    # Incorporate text sentiment if available
    if text and isinstance(text, dict):
        text_scores = text.get('scores', {})
        for emotion, score in text_scores.items():
            if emotion in emotions:
                emotions[emotion] += score * 0.5
            else:
                emotions[emotion] = score * 0.5

    # Normalize
    total = sum(emotions.values())
    if total > 0:
        emotions = {e: round(s/total, 2) for e, s in emotions.items()}

    # Find primary emotion
    primary = max(emotions.keys(), key=lambda k: emotions[k])  # type: ignore

    return {
        'all': emotions,
        'primary': primary
    }


# ============================================================================
# Service Status
# ============================================================================

@voice_bp.route('/status', methods=['GET'])
@rate_limit_by_endpoint
def voice_service_status():
    """Check if voice services are available"""
    try:
        from ..utils.speech_utils import initialize_google_speech
        google_available = initialize_google_speech()

        return APIResponse.success({
            "googleSpeech": google_available,
            "webSpeechFallback": True,
            "emotionAnalysis": True,
            "supportedLanguages": ['sv-SE', 'en-US', 'en-GB', 'de-DE', 'fr-FR']
        }, "Voice service status retrieved")
    except Exception as e:
        logger.error(f"Voice status check failed: {e}")
        return APIResponse.success({
            "googleSpeech": False,
            "webSpeechFallback": True,
            "emotionAnalysis": True,
            "error": str(e)
        }, "Voice service status retrieved with errors")
