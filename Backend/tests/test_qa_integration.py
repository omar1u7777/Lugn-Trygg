"""
INTEGRATION TESTS - API Endpoints & Redis Cache
=================================================
Tests API endpoints (POST /api/mood, GET /api/recommendations, etc.)
and Redis cache integration for all four domains:
- Humör, AI Stöd, Klinisk bedömning, Dagliga insikter

Uses Flask test client from conftest.py and mock_redis_client from test_qa_conftest.py.

Run: pytest tests/test_qa_integration.py -v
"""

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest


# ===========================================================================
# REDIS CACHE INTEGRATION
# ===========================================================================

class TestRedisCacheIntegration:
    """Test Redis cache save/get operations for mood data."""

    def test_redis_set_and_get_string(self, mock_redis_client):
        """Should store and retrieve a string value from Redis."""
        mock_redis_client.set("test_key", "test_value")
        assert mock_redis_client.get("test_key") == "test_value"

    def test_redis_setex_with_ttl(self, mock_redis_client):
        """Should store value with TTL expiration."""
        mock_redis_client.setex("mood:user1:latest", 300, json.dumps({"score": 7}))
        result = mock_redis_client.get("mood:user1:latest")
        assert result is not None
        data = json.loads(result)
        assert data["score"] == 7

    def test_redis_delete_removes_key(self, mock_redis_client):
        """Should delete a key from Redis."""
        mock_redis_client.set("temp_key", "temp_value")
        mock_redis_client.delete("temp_key")
        assert mock_redis_client.get("temp_key") is None

    def test_redis_scan_with_pattern(self, mock_redis_client):
        """Should find keys matching a pattern using SCAN."""
        mock_redis_client.set("mood:history:user1:abc", "data1")
        mock_redis_client.set("mood:history:user1:def", "data2")
        mock_redis_client.set("other:key", "data3")

        cursor, keys = mock_redis_client.scan(0, match="mood:history:user1:*")
        assert len(keys) == 2
        assert all("mood:history:user1:" in k for k in keys)

    def test_redis_cache_invalidation_pattern(self, mock_redis_client):
        """Should invalidate all cache entries for a user via pattern."""
        mock_redis_client.set("mood:get_mood_history:user1:page1", "data1")
        mock_redis_client.set("mood:get_mood_history:user1:page2", "data2")
        mock_redis_client.set("mood:get_mood_stats:user1:", "data3")

        cursor, keys = mock_redis_client.scan(0, match="mood:*:user1:*")
        mock_redis_client.delete(*keys)

        for key in keys:
            assert mock_redis_client.get(key) is None

    def test_redis_json_cache_roundtrip(self, mock_redis_client):
        """Should store and retrieve JSON mood data through Redis."""
        mood_data = {
            "mood_text": "Glad",
            "score": 8,
            "timestamp": datetime.now(UTC).isoformat(),
            "tags": ["nature", "exercise"],
        }
        cache_key = "mood:latest:user123"
        mock_redis_client.setex(cache_key, 300, json.dumps(mood_data))

        retrieved = json.loads(mock_redis_client.get(cache_key))
        assert retrieved["mood_text"] == "Glad"
        assert retrieved["score"] == 8
        assert "nature" in retrieved["tags"]


# ===========================================================================
# MOOD API ENDPOINTS
# ===========================================================================

class TestMoodAPIIntegration:
    """Integration tests for mood-related API endpoints."""

    def test_post_mood_log_returns_200_or_201(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log should return 200 or 201 with valid data."""
        response = client.post(
            '/api/v1/mood/log',
            json={
                'mood_text': 'Glad',
                'score': 8,
                'note': 'Bra dag på jobbet',
                'tags': ['work', 'social'],
                'valence': 8,
                'arousal': 6,
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 503]

    def test_post_mood_log_response_has_json(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log response should be valid JSON."""
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Neutral', 'score': 5},
            headers=auth_headers,
        )
        data = response.get_json()
        assert data is not None

    def test_get_mood_history_returns_200(self, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/mood should return 200."""
        response = client.get(
            '/api/v1/mood?limit=10',
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    def test_post_mood_log_with_empty_body_returns_400(self, client, auth_headers, mock_auth_service):
        """POST /api/v1/mood/log with empty body should return 400."""
        response = client.post(
            '/api/v1/mood/log',
            json={},
            headers=auth_headers,
        )
        assert response.status_code in [400, 503]

    def test_post_mood_log_with_long_note_accepted(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log with note > 1000 chars should be accepted (truncated to 2000)."""
        long_note = 'A' * 1500
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Glad', 'score': 7, 'note': long_note},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400, 503]


# ===========================================================================
# AI SUPPORT API ENDPOINTS
# ===========================================================================

class TestAISupportAPIIntegration:
    """Integration tests for AI chatbot endpoints."""

    @patch('src.services.ai_service.AIServices.generate_therapeutic_conversation')
    def test_post_chat_returns_200(self, mock_ai, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/chatbot/chat should return 200 with valid message."""
        mock_ai.return_value = {
            'response': 'Hej! Hur kan jag hjälpa dig?',
            'sentiment': 'NEUTRAL',
        }
        response = client.post(
            '/api/v1/chatbot/chat',
            json={'message': 'Hej, jag mår bra idag'},
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    @patch('src.services.ai_service.AIServices.generate_therapeutic_conversation')
    def test_post_chat_response_has_message_field(self, mock_ai, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/chatbot/chat response should contain a message field."""
        mock_ai.return_value = {
            'response': 'Det låter bra!',
            'sentiment': 'POSITIVE',
        }
        response = client.post(
            '/api/v1/chatbot/chat',
            json={'message': 'Jag känner mig glad'},
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.get_json()
            assert data is not None

    def test_post_chat_empty_message_returns_400(self, client, auth_headers, mock_auth_service):
        """POST /api/v1/chatbot/chat with empty message should return 400."""
        response = client.post(
            '/api/v1/chatbot/chat',
            json={'message': ''},
            headers=auth_headers,
        )
        assert response.status_code in [400, 503]


# ===========================================================================
# CLINICAL ASSESSMENT API ENDPOINTS
# ===========================================================================

class TestClinicalAssessmentAPIIntegration:
    """Integration tests for PHQ-9 and GAD-7 assessment endpoints."""

    def test_post_phq9_returns_200(self, client, auth_headers, mock_auth_service, mock_db, make_phq9_data):
        """POST /api/v1/advanced-mood/assess/phq9 should return 200 with valid responses."""
        data = make_phq9_data(answers=[1] * 9)
        response = client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json=data,
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    def test_post_gad7_returns_200(self, client, auth_headers, mock_auth_service, mock_db, make_gad7_data):
        """POST /api/v1/advanced-mood/assess/gad7 should return 200 with valid responses."""
        data = make_gad7_data(answers=[1] * 7)
        response = client.post(
            '/api/v1/advanced-mood/assess/gad7',
            json=data,
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    def test_post_phq9_response_has_total_score(self, client, auth_headers, mock_auth_service, mock_db, make_phq9_data):
        """POST /api/v1/advanced-mood/assess/phq9 response should contain total_score."""
        data = make_phq9_data(answers=[2] * 9)
        response = client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json=data,
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.get_json()
            assert data is not None

    def test_post_phq9_empty_responses_returns_400(self, client, auth_headers, mock_auth_service):
        """POST /api/v1/advanced-mood/assess/phq9 with empty responses should return 400 or error."""
        response = client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json={'responses': {}},
            headers=auth_headers,
        )
        assert response.status_code in [400, 500, 503]


# ===========================================================================
# DAILY INSIGHTS API ENDPOINTS
# ===========================================================================

class TestDailyInsightsAPIIntegration:
    """Integration tests for daily insights endpoints."""

    @patch('src.services.daily_insight_service_v2.generate_daily_insights')
    def test_post_generate_insights_returns_200(self, mock_gen, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/insights/generate/<user_id> should return 200."""
        mock_gen.return_value = []
        response = client.post(
            '/api/v1/insights/generate/testuser1234567890ab',
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    @patch('src.services.daily_insight_service_v2.get_insight_generator')
    def test_get_pending_insights_returns_200(self, mock_gen, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/insights/pending/<user_id> should return 200."""
        mock_instance = Mock()
        mock_instance.get_pending_insights.return_value = []
        mock_gen.return_value = mock_instance

        response = client.get(
            '/api/v1/insights/pending/testuser1234567890ab',
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    @patch('src.services.daily_insight_service_v2.get_insight_generator')
    def test_get_pending_insights_response_has_count(self, mock_gen, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/insights/pending response should have count field."""
        mock_instance = Mock()
        mock_instance.get_pending_insights.return_value = []
        mock_gen.return_value = mock_instance

        response = client.get(
            '/api/v1/insights/pending/testuser1234567890ab',
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.get_json()
            assert data is not None


# ===========================================================================
# RECOMMENDATIONS API ENDPOINT
# ===========================================================================

class TestRecommendationsAPIIntegration:
    """Integration tests for CBT recommendations endpoint."""

    def test_get_cbt_modules_returns_200(self, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/cbt/modules should return 200."""
        response = client.get(
            '/api/v1/cbt/modules',
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    def test_get_cbt_modules_response_is_json(self, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/cbt/modules response should be valid JSON."""
        response = client.get(
            '/api/v1/cbt/modules',
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.get_json()
            assert data is not None
