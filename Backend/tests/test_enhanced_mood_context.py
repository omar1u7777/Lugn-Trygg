"""Tests for enhanced mood context: raw data, confidence marker, safety check."""
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest

from src.services.ai_service import AIServices


@pytest.fixture
def ai_service():
    return AIServices()


@pytest.fixture
def mock_openai_client():
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = "Test"
    mock_client.chat.completions.create.return_value = mock_response
    return mock_client


def _mood(score, ts, note="", tags=None):
    m = Mock()
    m.to_dict.return_value = {"score": score, "timestamp": ts, "note": note, "tags": tags or []}
    return m


def _setup_ai(ai_service, mock_openai_client):
    ai_service._openai_checked = False
    ai_service._openai_available = True
    ai_service.client = mock_openai_client


@patch('src.services.ai_service.os.getenv')
def test_prompt_includes_raw_data(mock_getenv, ai_service, mock_openai_client):
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [
        _mood(2, datetime(2026, 7, 1, 1, 16, tzinfo=UTC), "jag mår illa", ["health"]),
        _mood(7, datetime(2026, 6, 29, 23, 32, tzinfo=UTC)),
    ]
    with patch('src.firebase_config.db') as mock_db:
        c = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        c.stream.return_value = moods
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "Rådata" in prompt
    assert "2/10" in prompt
    assert "jag mår illa" in prompt


@patch('src.services.ai_service.os.getenv')
def test_prompt_includes_confidence(mock_getenv, ai_service, mock_openai_client):
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [_mood(5, datetime(2026, 7, 1, tzinfo=UTC)) for _ in range(3)]
    with patch('src.firebase_config.db') as mock_db:
        c = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        c.stream.return_value = moods
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "konfidens: måttlig" in prompt
    assert "Baserat på dina senaste 3 loggningar" in prompt
    assert "Mönster:" in prompt
    assert "begränsad" in prompt
    assert "ALDRIG" in prompt
    assert "4 datapunkter" in prompt


@patch('src.services.ai_service.os.getenv')
def test_safety_check_triggered(mock_getenv, ai_service, mock_openai_client):
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [
        _mood(2, datetime(2026, 7, 1, tzinfo=UTC), "mår dåligt"),
        _mood(1, datetime(2026, 6, 30, tzinfo=UTC), "ledsen"),
        _mood(7, datetime(2026, 6, 29, tzinfo=UTC)),
    ]
    with patch('src.firebase_config.db') as mock_db:
        c = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        c.stream.return_value = moods
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "SÄKERHETSCHECK" in prompt
    assert "MÅSTE" in prompt
    assert "professionell" in prompt
    assert "EFTER reflektionsfrågan" in prompt


@patch('src.services.ai_service.os.getenv')
def test_safety_check_not_triggered_for_high_moods(mock_getenv, ai_service, mock_openai_client):
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [
        _mood(8, datetime(2026, 7, 1, tzinfo=UTC), "bra dag"),
        _mood(7, datetime(2026, 6, 30, tzinfo=UTC), "lagom"),
        _mood(9, datetime(2026, 6, 29, tzinfo=UTC), "toppen"),
    ]
    with patch('src.firebase_config.db') as mock_db:
        c = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        c.stream.return_value = moods
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "SÄKERHETSCHECK" not in prompt


@patch('src.services.ai_service.os.getenv')
def test_low_confidence_with_2_entries(mock_getenv, ai_service, mock_openai_client):
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [_mood(5, datetime(2026, 7, 1, tzinfo=UTC)) for _ in range(2)]
    with patch('src.firebase_config.db') as mock_db:
        c = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        c.stream.return_value = moods
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "konfidens: låg" in prompt


@patch('src.services.ai_service.os.getenv')
def test_crisis_alert_triggered_for_suicidal_ideation(mock_getenv, ai_service, mock_openai_client):
    """When PHQ-9 shows suicidal ideation, prompt must include KRISISLARM."""
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [_mood(5, datetime(2026, 7, 1, tzinfo=UTC)) for _ in range(3)]
    phq9_doc = Mock()
    phq9_doc.to_dict.return_value = {
        "type": "phq9", "total_score": 7, "severity": "mild",
        "suicidal_ideation": True, "self_harm_score": 1,
    }
    with patch('src.firebase_config.db') as mock_db:
        mood_chain = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        mood_chain.stream.return_value = moods
        assess_chain = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        assess_chain.stream.return_value = [phq9_doc]
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "KRISISLARM" in prompt
    assert "90101" in prompt
    assert "självskadetankar" in prompt


@patch('src.services.ai_service.os.getenv')
def test_no_crisis_alert_when_no_suicidal_ideation(mock_getenv, ai_service, mock_openai_client):
    """When PHQ-9 has no suicidal ideation, prompt should NOT include KRISISLARM."""
    mock_getenv.return_value = "test-key"
    _setup_ai(ai_service, mock_openai_client)
    moods = [_mood(5, datetime(2026, 7, 1, tzinfo=UTC)) for _ in range(3)]
    phq9_doc = Mock()
    phq9_doc.to_dict.return_value = {
        "type": "phq9", "total_score": 7, "severity": "mild",
        "suicidal_ideation": False, "self_harm_score": 0,
    }
    with patch('src.firebase_config.db') as mock_db:
        mood_chain = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        mood_chain.stream.return_value = moods
        assess_chain = mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value
        assess_chain.stream.return_value = [phq9_doc]
        prompt = ai_service._build_enhanced_system_prompt("test", "u1")
    assert "KRISISLARM" not in prompt
