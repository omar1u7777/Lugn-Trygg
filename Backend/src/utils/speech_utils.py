import logging
import os

logger = logging.getLogger(__name__)
_IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'

def transcribe_audio_google(audio_data: bytes, language_code: str = "sv-SE") -> str | None:
    """
    Transcribe audio using Google Cloud Speech-to-Text API

    Args:
        audio_data: Raw audio bytes
        language_code: Language code (default: Swedish)

    Returns:
        Transcribed text or None if failed
    """
    try:
        # [F1] Fail fast with clear message if credentials are not configured.
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if not credentials_path:
            if _IS_PRODUCTION:
                logger.warning(
                    "[F1] GOOGLE_APPLICATION_CREDENTIALS is not set — "
                    "falling back to client-side Web Speech API (lower quality). "
                    "Set GOOGLE_APPLICATION_CREDENTIALS to enable server-side Google Speech-to-Text."
                )
            else:
                logger.warning("[F1] GOOGLE_APPLICATION_CREDENTIALS not set — Google Speech unavailable")
            return None

        import google.auth
        from google.cloud import speech

        # Log project ID from credentials
        credentials, project = google.auth.default()
        logger.info(f"🔍 Google Cloud Project ID från credentials: {project}")

        # Initialize client
        client = speech.SpeechClient()

        # Configure audio settings - try multiple formats for better compatibility
        audio = speech.RecognitionAudio(content=audio_data)

        # Try multiple audio formats for better compatibility
        formats_to_try = [
            {
                "encoding": speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                "sample_rate": 48000,
                "name": "WEBM_OPUS"
            },
            {
                "encoding": speech.RecognitionConfig.AudioEncoding.LINEAR16,
                "sample_rate": 16000,
                "name": "LINEAR16"
            },
            {
                "encoding": speech.RecognitionConfig.AudioEncoding.FLAC,
                "sample_rate": 16000,
                "name": "FLAC"
            },
            {
                "encoding": speech.RecognitionConfig.AudioEncoding.MP3,
                "sample_rate": 16000,
                "name": "MP3"
            },
            {
                "encoding": speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
                "sample_rate": 48000,
                "name": "OGG_OPUS"
            }
        ]

        config = None
        last_error = None

        for fmt in formats_to_try:
            try:
                config = speech.RecognitionConfig(
                    encoding=fmt["encoding"],
                    sample_rate_hertz=fmt["sample_rate"],
                    language_code=language_code,
                    enable_automatic_punctuation=True,
                    enable_word_time_offsets=False,
                    # Add model adaptation for better accuracy
                    use_enhanced=True,
                    model="latest_long",
                )
                logger.info(f"🎙️ Försöker med {fmt['name']}-format...")
                break
            except Exception as format_error:
                logger.warning(f"⚠️ {fmt['name']} inte tillgängligt: {format_error}")
                last_error = format_error
                continue

        if config is None:
            logger.error(f"❌ Ingen kompatibel ljudformat hittades. Senaste fel: {last_error}")
            return None

        # Perform transcription with timeout
        logger.info("🎙️ Startar transkribering med Google Speech-to-Text...")
        try:
            response = client.recognize(config=config, audio=audio, timeout=30.0)
        except Exception as timeout_error:
            logger.warning(f"⚠️ Transkribering timeout eller fel: {timeout_error}")
            return None

        # Extract transcript
        if response.results and len(response.results) > 0:
            transcript = response.results[0].alternatives[0].transcript
            confidence = response.results[0].alternatives[0].confidence
            logger.info(f"✅ Transkribering lyckades: {len(transcript)} tecken, konfidens: {confidence:.2f}")

            # Only return transcript if confidence is reasonable
            if confidence > 0.5:
                return transcript.strip()
            else:
                logger.warning(f"⚠️ Transkribering har låg konfidens ({confidence:.2f}), hoppar över")
                return None
        else:
            logger.warning("⚠️ Ingen transkribering kunde göras")
            return None

    except ImportError:
        logger.error("❌ google-cloud-speech är inte installerat")
        return None
    except Exception as e:
        logger.error(f"❌ Fel vid Google Speech transkribering: {str(e)}")
        return None

def initialize_google_speech() -> bool:
    """
    Initialize Google Cloud Speech credentials

    Returns:
        True if initialization successful, False otherwise
    """
    try:
        # Check if GOOGLE_APPLICATION_CREDENTIALS is set
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path:
            if _IS_PRODUCTION:
                logger.warning(
                    "[F1] GOOGLE_APPLICATION_CREDENTIALS is not set in production — "
                    "server-side voice transcription is DISABLED. "
                    "Voice recording falls back to the browser Web Speech API (lower quality, "
                    "not available in all browsers). Set GOOGLE_APPLICATION_CREDENTIALS to "
                    "enable Google Cloud Speech-to-Text."
                )
            else:
                logger.warning(
                    "⚠️  GOOGLE_APPLICATION_CREDENTIALS inte satt — Google Speech kommer inte fungera"
                )
            return False

        if not os.path.exists(credentials_path):
            logger.error(f"❌ Google credentials-fil hittades inte: {credentials_path}")
            return False

        logger.info("✅ Google Cloud Speech-to-Text är redo")
        return True

    except Exception as e:
        logger.error(f"❌ Fel vid initiering av Google Speech: {str(e)}")
        return False
