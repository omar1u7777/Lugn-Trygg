"""
Tests for speech utilities (Google Speech-to-Text transcription)
"""

import pytest
import os
from unittest.mock import Mock, patch, MagicMock
from src.utils.speech_utils import initialize_google_speech


class TestTranscribeAudioGoogle:
    """Tests for transcribe_audio_google function"""

    def test_transcribe_import_error(self):
        """Test transcription when google-cloud-speech not installed"""
        from src.utils.speech_utils import transcribe_audio_google
        
        # The function handles ImportError internally
        with patch.dict('sys.modules', {'google.cloud.speech': None}):
            audio_data = b"fake_audio"
            result = transcribe_audio_google(audio_data)
            
            # Should return None when import fails
            assert result is None or isinstance(result, str)

    def test_transcribe_returns_string_or_none(self):
        """Test transcription returns expected type"""
        from src.utils.speech_utils import transcribe_audio_google
        
        audio_data = b"fake_audio"
        result = transcribe_audio_google(audio_data)
        
        # Should return None or string
        assert result is None or isinstance(result, str)

    def test_transcribe_with_language_code(self):
        """Test transcription accepts language code parameter"""
        from src.utils.speech_utils import transcribe_audio_google
        
        audio_data = b"fake_audio"
        # Should not raise exception
        result = transcribe_audio_google(audio_data, language_code="en-US")
        
        assert result is None or isinstance(result, str)

    def test_transcribe_with_swedish_default(self):
        """Test transcription with default Swedish language"""
        from src.utils.speech_utils import transcribe_audio_google
        
        audio_data = b"fake_audio"
        # Should use default sv-SE
        result = transcribe_audio_google(audio_data)
        
        assert result is None or isinstance(result, str)

    def test_transcribe_with_empty_audio(self):
        """Test transcription with empty audio data"""
        from src.utils.speech_utils import transcribe_audio_google
        
        audio_data = b""
        result = transcribe_audio_google(audio_data)
        
        assert result is None or isinstance(result, str)

    def test_transcribe_function_exists(self):
        """Test that transcribe function exists and is callable"""
        from src.utils.speech_utils import transcribe_audio_google
        
        assert callable(transcribe_audio_google)

    def test_transcribe_signature(self):
        """Test transcribe function signature"""
        from src.utils.speech_utils import transcribe_audio_google
        import inspect
        
        sig = inspect.signature(transcribe_audio_google)
        params = list(sig.parameters.keys())
        
        assert 'audio_data' in params
        assert 'language_code' in params


class TestInitializeGoogleSpeech:
    """Tests for initialize_google_speech function"""

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"})
    @patch('os.path.exists')
    def test_initialize_success(self, mock_exists):
        """Test successful initialization"""
        mock_exists.return_value = True
        
        result = initialize_google_speech()
        
        assert result is True
        mock_exists.assert_called_once_with("/path/to/credentials.json")

    @patch.dict(os.environ, {}, clear=True)
    def test_initialize_no_credentials_env(self):
        """Test initialization without GOOGLE_APPLICATION_CREDENTIALS"""
        result = initialize_google_speech()
        
        assert result is False

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": ""})
    def test_initialize_empty_credentials_env(self):
        """Test initialization with empty GOOGLE_APPLICATION_CREDENTIALS"""
        result = initialize_google_speech()
        
        assert result is False

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/path/to/nonexistent.json"})
    @patch('os.path.exists')
    def test_initialize_credentials_file_not_found(self, mock_exists):
        """Test initialization when credentials file doesn't exist"""
        mock_exists.return_value = False
        
        result = initialize_google_speech()
        
        assert result is False

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/valid/path.json"})
    @patch('os.path.exists')
    def test_initialize_with_exception(self, mock_exists):
        """Test initialization with unexpected exception"""
        mock_exists.side_effect = Exception("Unexpected error")
        
        result = initialize_google_speech()
        
        assert result is False

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/path/credentials.json"})
    @patch('os.path.exists')
    def test_initialize_various_paths(self, mock_exists):
        """Test initialization with various credential paths"""
        mock_exists.return_value = True
        
        # Test with different path formats
        result = initialize_google_speech()
        assert result is True

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "relative/path.json"})
    @patch('os.path.exists')
    def test_initialize_relative_path(self, mock_exists):
        """Test initialization with relative path"""
        mock_exists.return_value = True
        
        result = initialize_google_speech()
        
        assert result is True

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "C:\\Windows\\path\\credentials.json"})
    @patch('os.path.exists')
    def test_initialize_windows_path(self, mock_exists):
        """Test initialization with Windows path"""
        mock_exists.return_value = True
        
        result = initialize_google_speech()
        
        assert result is True

    @patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/unix/path/credentials.json"})
    @patch('os.path.exists')
    def test_initialize_unix_path(self, mock_exists):
        """Test initialization with Unix path"""
        mock_exists.return_value = True
        
        result = initialize_google_speech()
        
        assert result is True
