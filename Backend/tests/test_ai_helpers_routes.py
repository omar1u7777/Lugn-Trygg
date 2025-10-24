"""
Comprehensive tests for ai_helpers_routes.py
Target: Increase coverage from 35% to 100%

Tests all endpoints:
- POST /analyze-text
- OPTIONS /analyze-text
"""

import pytest
import json
from unittest.mock import Mock, patch


def test_analyze_text_success(client, mocker):
    """Test successful text sentiment analysis"""
    mock_analysis = {
        "sentiment": "positive",
        "score": 0.85,
        "emotions": ["joy", "excitement"],
        "intensity": 0.75,
        "method": "openai"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Jag känner mig jätteglad idag!"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["sentiment"] == "positive"
    assert data["score"] == 0.85
    assert data["emotions"] == ["joy", "excitement"]
    assert data["intensity"] == 0.75
    assert data["method"] == "openai"


def test_analyze_text_negative_sentiment(client, mocker):
    """Test text analysis with negative sentiment"""
    mock_analysis = {
        "sentiment": "negative",
        "score": 0.25,
        "emotions": ["sadness", "anxiety"],
        "intensity": 0.80,
        "method": "textblob"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Jag mår inte bra, känner mig ledsen"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["sentiment"] == "negative"
    assert data["score"] == 0.25


def test_analyze_text_neutral_sentiment(client, mocker):
    """Test text analysis with neutral sentiment"""
    mock_analysis = {
        "sentiment": "neutral",
        "score": 0.50,
        "emotions": [],
        "intensity": 0.20,
        "method": "vader"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Jag går till affären"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["sentiment"] == "neutral"


def test_analyze_text_empty_text(client):
    """Test analysis with empty text field"""
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": ""}
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Textfältet är tomt"


def test_analyze_text_whitespace_only(client):
    """Test analysis with only whitespace"""
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "   \n\t   "}
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "Textfältet är tomt"


def test_analyze_text_missing_text_field(client, mocker):
    """Test analysis with missing text field"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = {
        "sentiment": "neutral",
        "score": 0.5,
        "emotions": [],
        "intensity": 0.0,
        "method": "default"
    }
    
    response = client.post(
        '/api/mood/analyze-text',
        json={}
    )
    
    # Empty string after .get("text", "").strip()
    assert response.status_code == 400


def test_analyze_text_no_json_body(client):
    """Test analysis without JSON body"""
    response = client.post('/api/mood/analyze-text')
    
    # With silent=True, returns {} which has empty text
    assert response.status_code == 400


def test_analyze_text_invalid_json(client):
    """Test analysis with malformed JSON"""
    response = client.post(
        '/api/mood/analyze-text',
        data='invalid json{',
        content_type='application/json'
    )
    
    # silent=True returns {}, leading to empty text error
    assert response.status_code == 400


def test_analyze_text_with_emotions_detected_key(client, mocker):
    """Test analysis when AI returns 'emotions_detected' instead of 'emotions'"""
    mock_analysis = {
        "sentiment": "positive",
        "score": 0.90,
        "emotions_detected": ["happiness", "confidence"],  # Alternative key
        "intensity": 0.85,
        "method": "custom"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "I feel amazing today!"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    # Should normalize to "emotions" key
    assert data["emotions"] == ["happiness", "confidence"]


def test_analyze_text_no_emotions_key(client, mocker):
    """Test analysis when no emotions key is returned"""
    mock_analysis = {
        "sentiment": "neutral",
        "score": 0.50,
        # No emotions or emotions_detected key
        "intensity": 0.30,
        "method": "simple"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Normal day"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["emotions"] == []  # Default to empty list


def test_analyze_text_long_text(client, mocker):
    """Test analysis with very long text"""
    long_text = "Detta är ett mycket långt meddelande. " * 100
    
    mock_analysis = {
        "sentiment": "positive",
        "score": 0.70,
        "emotions": ["contentment"],
        "intensity": 0.60,
        "method": "openai"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": long_text}
    )
    
    assert response.status_code == 200
    mock_ai_services.analyze_sentiment.assert_called_once_with(long_text.strip())


def test_analyze_text_special_characters(client, mocker):
    """Test analysis with special characters and emojis"""
    text = "Jag känner mig 😊 glad! ❤️ #lycka @vänner"
    
    mock_analysis = {
        "sentiment": "positive",
        "score": 0.95,
        "emotions": ["joy"],
        "intensity": 0.90,
        "method": "openai"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": text}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["sentiment"] == "positive"


def test_analyze_text_exception_handling(client, mocker):
    """Test error handling when AI service raises exception"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.side_effect = Exception("AI service unavailable")
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Test text"}
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Internt serverfel vid textanalys"


def test_analyze_text_runtime_error(client, mocker):
    """Test handling of RuntimeError from AI service"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.side_effect = RuntimeError("Model not loaded")
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Test text"}
    )
    
    assert response.status_code == 500


def test_analyze_text_value_error(client, mocker):
    """Test handling of ValueError from AI service"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.side_effect = ValueError("Invalid input format")
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Test text"}
    )
    
    assert response.status_code == 500


def test_analyze_text_options_request(client):
    """Test OPTIONS request for CORS preflight"""
    response = client.options('/api/mood/analyze-text')
    
    assert response.status_code == 204
    assert response.data == b''


def test_analyze_text_options_no_body(client):
    """Test OPTIONS returns no content"""
    response = client.options('/api/mood/analyze-text')
    
    assert response.status_code == 204
    assert len(response.data) == 0


def test_analyze_text_with_logger_call(client, mocker):
    """Test that logger.exception is called on error"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.side_effect = Exception("Test error")
    
    mock_logger = mocker.patch('src.routes.ai_helpers_routes.logger')
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Test"}
    )
    
    assert response.status_code == 500
    mock_logger.exception.assert_called_once()
    call_args = str(mock_logger.exception.call_args)
    assert 'Fel vid textanalys' in call_args


def test_analyze_text_multilingual(client, mocker):
    """Test analysis with different languages"""
    texts = [
        ("Jag är glad", "Swedish"),
        ("I am happy", "English"),
        ("Jeg er glad", "Norwegian")
    ]
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    
    for text, lang in texts:
        mock_ai_services.analyze_sentiment.return_value = {
            "sentiment": "positive",
            "score": 0.80,
            "emotions": ["joy"],
            "intensity": 0.70,
            "method": "multilingual"
        }
        
        response = client.post(
            '/api/mood/analyze-text',
            json={"text": text}
        )
        
        assert response.status_code == 200


def test_analyze_text_multiple_emotions(client, mocker):
    """Test analysis with multiple complex emotions"""
    mock_analysis = {
        "sentiment": "mixed",
        "score": 0.55,
        "emotions": ["joy", "anxiety", "hope", "fear", "excitement"],
        "intensity": 0.65,
        "method": "complex"
    }
    
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = mock_analysis
    
    response = client.post(
        '/api/mood/analyze-text',
        json={"text": "Jag är nervös men också spänd inför intervjun"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["emotions"]) == 5


def test_analyze_text_force_and_silent_flags(client, mocker):
    """Test that force=True and silent=True work correctly"""
    mock_ai_services = mocker.patch('src.routes.ai_helpers_routes.ai_services')
    mock_ai_services.analyze_sentiment.return_value = {
        "sentiment": "neutral",
        "score": 0.50,
        "emotions": [],
        "intensity": 0.0,
        "method": "default"
    }
    
    # Send invalid JSON but force=True and silent=True should handle it
    response = client.post(
        '/api/mood/analyze-text',
        data='not really json',
        content_type='application/json'
    )
    
    # Should get empty dict, leading to empty text
    assert response.status_code == 400
