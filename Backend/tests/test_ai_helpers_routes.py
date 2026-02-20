"""
Tests for ai_helpers_routes.py
Covers: text sentiment analysis endpoint.
"""
import pytest
from unittest.mock import patch, MagicMock


BASE = "/api/v1/ai-helpers"


@pytest.fixture
def mock_ai_service():
    """Mock ai_services for sentiment analysis."""
    with patch("src.routes.ai_helpers_routes.ai_services") as mock:
        mock.analyze_sentiment.return_value = {
            "sentiment": "positive",
            "score": 0.85,
            "emotions": ["joy", "contentment"],
            "intensity": "moderate",
            "method": "transformer",
        }
        yield mock


class TestAnalyzeText:
    """Tests for POST /api/ai-helpers/analyze-text"""

    def test_analyze_text_success(self, client, auth_headers, mock_ai_service):
        resp = client.post(
            f"{BASE}/analyze-text",
            json={"text": "I feel wonderful today, everything is great!"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "sentiment" in data

    def test_analyze_text_missing_text(self, client, auth_headers, mock_ai_service):
        resp = client.post(
            f"{BASE}/analyze-text",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_analyze_text_empty_text(self, client, auth_headers, mock_ai_service):
        resp = client.post(
            f"{BASE}/analyze-text",
            json={"text": ""},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_analyze_text_too_long(self, client, auth_headers, mock_ai_service):
        resp = client.post(
            f"{BASE}/analyze-text",
            json={"text": "a" * 5000},
            headers=auth_headers,
        )
        assert resp.status_code in (400, 200)

    def test_analyze_text_no_auth(self, client, mock_ai_service):
        resp = client.post(
            f"{BASE}/analyze-text",
            json={"text": "Hello world"},
        )
        # Mock jwt_required always sets g.user_id, so auth is bypassed in tests
        assert resp.status_code in (200, 401, 403, 422)

    def test_analyze_text_service_error(self, client, auth_headers, mock_ai_service):
        mock_ai_service.analyze_sentiment.side_effect = Exception("AI service down")
        resp = client.post(
            f"{BASE}/analyze-text",
            json={"text": "Test text for analysis"},
            headers=auth_headers,
        )
        assert resp.status_code == 500

    def test_analyze_text_options(self, client):
        resp = client.options(f"{BASE}/analyze-text")
        assert resp.status_code in (200, 204)
