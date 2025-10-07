import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

def transcribe_audio_google(audio_data: bytes, language_code: str = "sv-SE") -> Optional[str]:
    """
    Transcribe audio using Google Cloud Speech-to-Text API

    Args:
        audio_data: Raw audio bytes
        language_code: Language code (default: Swedish)

    Returns:
        Transcribed text or None if failed
    """
    try:
        from google.cloud import speech
        import google.auth

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
            }
        ]

        config = None
        for fmt in formats_to_try:
            try:
                config = speech.RecognitionConfig(
                    encoding=fmt["encoding"],
                    sample_rate_hertz=fmt["sample_rate"],
                    language_code=language_code,
                    enable_automatic_punctuation=True,
                    enable_word_time_offsets=False,
                )
                logger.info(f"🎙️ Försöker med {fmt['name']}-format...")
                break
            except Exception as format_error:
                logger.warning(f"⚠️ {fmt['name']} inte tillgängligt: {format_error}")
                continue

        if config is None:
            logger.error("❌ Ingen kompatibel ljudformat hittades")
            return None

        # Perform transcription
        logger.info("🎙️ Startar transkribering med Google Speech-to-Text...")
        response = client.recognize(config=config, audio=audio)

        # Extract transcript
        if response.results:
            transcript = response.results[0].alternatives[0].transcript
            logger.info(f"✅ Transkribering lyckades: {len(transcript)} tecken")
            return transcript.strip()
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
            logger.warning("⚠️ GOOGLE_APPLICATION_CREDENTIALS inte satt - Google Speech kommer inte fungera")
            return False

        if not os.path.exists(credentials_path):
            logger.error(f"❌ Google credentials-fil hittades inte: {credentials_path}")
            return False

        logger.info("✅ Google Cloud Speech-to-Text är redo")
        return True

    except Exception as e:
        logger.error(f"❌ Fel vid initiering av Google Speech: {str(e)}")
        return False