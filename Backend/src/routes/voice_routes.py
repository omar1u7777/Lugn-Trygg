"""
Voice Routes - Real speech-to-text and voice analysis endpoints
Uses Google Cloud Speech-to-Text API for transcription
"""
from flask import Blueprint, request, jsonify, g
import logging
import base64
from ..services.auth_service import AuthService
from ..utils.speech_utils import transcribe_audio_google

voice_bp = Blueprint('voice', __name__)
logger = logging.getLogger(__name__)


@voice_bp.route('/transcribe', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
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
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        user_id = g.user_id
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        audio_base64 = data.get('audio_data')
        language = data.get('language', 'sv-SE')
        
        if not audio_base64:
            return jsonify({'error': 'audio_data is required'}), 400
        
        # Decode base64 audio
        try:
            audio_bytes = base64.b64decode(audio_base64)
            logger.info(f"📦 Received audio: {len(audio_bytes)} bytes from user {user_id}")
        except Exception as decode_error:
            logger.error(f"❌ Failed to decode base64 audio: {decode_error}")
            return jsonify({'error': 'Invalid base64 audio data'}), 400
        
        # Transcribe using Google Cloud Speech-to-Text
        transcript = transcribe_audio_google(audio_bytes, language)
        
        if transcript:
            logger.info(f"✅ Transcription successful for user {user_id}: {len(transcript)} chars")
            return jsonify({
                'success': True,
                'transcript': transcript,
                'confidence': 0.85,  # Google doesn't always return confidence
                'language': language
            }), 200
        else:
            # If Google Speech fails, try Web Speech API fallback (client-side)
            logger.warning(f"⚠️ Transcription failed for user {user_id}, suggesting client fallback")
            return jsonify({
                'success': False,
                'error': 'transcription_failed',
                'message': 'Google Speech-to-Text could not transcribe. Try speaking more clearly.',
                'fallback': 'web_speech_api'
            }), 200
            
    except Exception as e:
        logger.exception(f"❌ Voice transcription error: {e}")
        return jsonify({
            'success': False,
            'error': 'server_error',
            'message': str(e)
        }), 500


@voice_bp.route('/analyze-emotion', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
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
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        user_id = g.user_id
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        audio_base64 = data.get('audio_data')
        transcript = data.get('transcript', '')
        
        if not audio_base64:
            return jsonify({'error': 'audio_data is required'}), 400
        
        # Decode audio
        try:
            audio_bytes = base64.b64decode(audio_base64)
        except Exception:
            return jsonify({'error': 'Invalid base64 audio data'}), 400
        
        # Analyze audio characteristics
        # In production, this would use librosa or similar for proper analysis
        audio_analysis = analyze_audio_features(audio_bytes)
        
        # If we have a transcript, add text sentiment
        text_sentiment = None
        if transcript:
            text_sentiment = analyze_text_sentiment(transcript)
        
        # Combine audio and text analysis
        emotions = combine_emotion_analysis(audio_analysis, text_sentiment)
        
        logger.info(f"✅ Voice emotion analysis for user {user_id}: primary={emotions['primary']}")
        
        return jsonify({
            'success': True,
            'emotions': emotions['all'],
            'primary_emotion': emotions['primary'],
            'energy_level': audio_analysis['energy_level'],
            'speaking_pace': audio_analysis['pace'],
            'volume_variation': audio_analysis['volume_variation']
        }), 200
        
    except Exception as e:
        logger.exception(f"❌ Voice emotion analysis error: {e}")
        return jsonify({
            'success': False,
            'error': 'analysis_failed',
            'message': str(e)
        }), 500


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
    primary = max(emotion_scores, key=emotion_scores.get)
    
    return {
        'primary': primary,
        'scores': normalized
    }


def combine_emotion_analysis(audio: dict, text: dict) -> dict:
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
    if text:
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
    primary = max(emotions, key=emotions.get)
    
    return {
        'all': emotions,
        'primary': primary
    }


@voice_bp.route('/status', methods=['GET'])
def voice_service_status():
    """Check if voice services are available"""
    try:
        from ..utils.speech_utils import initialize_google_speech
        google_available = initialize_google_speech()
        
        return jsonify({
            'google_speech': google_available,
            'web_speech_fallback': True,
            'emotion_analysis': True,
            'supported_languages': ['sv-SE', 'en-US', 'en-GB', 'de-DE', 'fr-FR']
        }), 200
    except Exception as e:
        logger.error(f"Voice status check failed: {e}")
        return jsonify({
            'google_speech': False,
            'web_speech_fallback': True,
            'emotion_analysis': True,
            'error': str(e)
        }), 200
