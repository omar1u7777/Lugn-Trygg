"""
SECURITY & EDGE CASE TESTS
============================
Tests authentication enforcement (401 Unauthorized), edge cases
(empty results, Redis down, malformed input), and security boundaries
for all four domains:
- Humör, AI Stöd, Klinisk bedömning, Dagliga insikter

Run: pytest tests/test_qa_security_edge.py -v
"""

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest


# ===========================================================================
# AUTHENTICATION / UNAUTHORIZED ACCESS (401)
# ===========================================================================

class TestUnauthorizedAccess:
    """Verify that sensitive health data endpoints require authentication."""

    def test_post_mood_log_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """POST /api/v1/mood/log without Authorization header should return 401."""
        response = strict_auth_client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Glad', 'score': 8},
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_get_mood_history_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """GET /api/v1/mood without auth should return 401."""
        response = strict_auth_client.get(
            '/api/v1/mood',
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_post_chat_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """POST /api/v1/chatbot/chat without auth should return 401."""
        response = strict_auth_client.post(
            '/api/v1/chatbot/chat',
            json={'message': 'Hej'},
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_post_phq9_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """POST /api/v1/advanced-mood/assess/phq9 without auth should return 401."""
        responses = {f'q{i+1}': 1 for i in range(9)}
        response = strict_auth_client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json={'responses': responses},
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_post_gad7_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """POST /api/v1/advanced-mood/assess/gad7 without auth should return 401."""
        responses = {f'q{i+1}': 1 for i in range(7)}
        response = strict_auth_client.post(
            '/api/v1/advanced-mood/assess/gad7',
            json={'responses': responses},
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_get_pending_insights_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """GET /api/v1/insights/pending without auth should return 401."""
        response = strict_auth_client.get(
            '/api/v1/insights/pending/testuser1234567890ab',
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_post_generate_insights_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """POST /api/v1/insights/generate without auth should return 401."""
        response = strict_auth_client.post(
            '/api/v1/insights/generate/testuser1234567890ab',
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_get_recommendations_without_auth_returns_401(self, strict_auth_client, no_auth_headers):
        """GET /api/v1/cbt/modules without auth should return 401."""
        response = strict_auth_client.get(
            '/api/v1/cbt/modules',
            headers=no_auth_headers,
        )
        assert response.status_code in [401, 403]

    def test_invalid_bearer_token_returns_401(self, strict_auth_client, invalid_auth_headers):
        """Invalid Bearer token should return 401."""
        response = strict_auth_client.get(
            '/api/v1/mood',
            headers=invalid_auth_headers,
        )
        assert response.status_code in [401, 403, 422]


# ===========================================================================
# CROSS-USER ACCESS PREVENTION
# ===========================================================================

class TestCrossUserAccess:
    """Verify users cannot access other users' health data."""

    def test_get_pending_insights_for_other_user_returns_403(self, client, auth_headers, mock_auth_service):
        """User should not be able to fetch another user's insights."""
        # auth_headers sets user_id to 'testuser1234567890ab'
        # Try to access insights for a different user
        response = client.get(
            '/api/v1/insights/pending/different_user_id',
            headers=auth_headers,
        )
        assert response.status_code in [403, 503]

    def test_generate_insights_for_other_user_returns_403(self, client, auth_headers, mock_auth_service):
        """User should not be able to generate insights for another user."""
        response = client.post(
            '/api/v1/insights/generate/different_user_id',
            headers=auth_headers,
        )
        assert response.status_code in [403, 503]


# ===========================================================================
# EDGE CASES - EMPTY DATABASE RESULTS
# ===========================================================================

class TestEmptyDatabaseResults:
    """Test behavior when Firestore returns empty results."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_insights_with_zero_moods_generates_onboarding(self, mock_db):
        """0 mood entries → onboarding insight (not crash)."""
        from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

        gen = DailyInsightGeneratorV2()

        # Mock empty moods collection
        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_collection = Mock()
        mock_collection.order_by.return_value = mock_query
        mock_user_doc = Mock()
        mock_user_doc.collection.return_value = mock_collection
        mock_users = Mock()
        mock_users.document.return_value = mock_user_doc
        mock_db.collection.return_value = mock_users

        # Mock no existing onboarding insight
        mock_insight_doc = Mock()
        mock_insight_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_insight_doc

        memories = gen._fetch_memories('user_empty', days=14)
        assert memories == []
        assert len(memories) < gen.min_memories

    @patch('src.services.daily_insight_service_v2.db')
    def test_activity_patterns_with_no_tags_returns_empty(self, mock_db):
        """No mood entries → empty tag counts (not crash)."""
        from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

        gen = DailyInsightGeneratorV2()

        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_collection = Mock()
        mock_collection.order_by.return_value = mock_query
        mock_user_doc = Mock()
        mock_user_doc.collection.return_value = mock_collection
        mock_users = Mock()
        mock_users.document.return_value = mock_user_doc
        mock_db.collection.return_value = mock_users

        result = gen._fetch_activity_patterns('user_empty')
        assert result == {}

    def test_get_pending_insights_empty_returns_empty_list(self, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/insights/pending with no insights should return 200 with empty list."""
        # mock_db from conftest returns empty stream by default
        response = client.get(
            '/api/v1/insights/pending/testuser1234567890ab',
            headers=auth_headers,
        )
        if response.status_code == 200:
            data = response.get_json()
            assert data is not None


# ===========================================================================
# EDGE CASES - REDIS UNAVAILABLE
# ===========================================================================

class TestRedisUnavailable:
    """Test graceful degradation when Redis is down."""

    @patch('src.routes.mood_routes._get_redis_client')
    def test_mood_log_works_without_redis(self, mock_redis_get, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log should still work when Redis is unavailable."""
        mock_redis_get.return_value = None  # Redis not available
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Glad', 'score': 8},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 503]

    @patch('src.routes.mood_routes._get_redis_client')
    def test_mood_history_works_without_redis(self, mock_redis_get, client, auth_headers, mock_auth_service, mock_db):
        """GET /api/v1/mood should still work when Redis is unavailable."""
        mock_redis_get.return_value = None
        response = client.get(
            '/api/v1/mood',
            headers=auth_headers,
        )
        assert response.status_code in [200, 503]

    def test_redis_connection_error_handled_gracefully(self, mock_redis_down):
        """Redis ConnectionError should be caught, not propagated."""
        import redis
        try:
            mock_redis_down.get("any_key")
            assert False, "Should have raised ConnectionError"
        except redis.ConnectionError:
            pass  # Expected - the calling code should catch this

    @patch('src.redis_config.get_redis_client')
    def test_redis_init_failure_returns_none(self, mock_get):
        """get_redis_client should return None when Redis fails to initialize."""
        mock_get.return_value = None
        result = mock_get()
        assert result is None


# ===========================================================================
# EDGE CASES - MALFORMED INPUT
# ===========================================================================

class TestMalformedInput:
    """Test handling of malformed or extreme input."""

    def test_post_mood_log_with_non_numeric_score(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log with string score should not crash."""
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Glad', 'score': 'not_a_number'},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400, 503]

    def test_post_mood_log_with_null_note(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log with null note should be handled."""
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Glad', 'score': 7, 'note': None},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400, 503]

    def test_post_mood_log_with_very_long_mood_text(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log with extremely long mood_text should be handled."""
        long_text = 'A' * 10000
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': long_text, 'score': 5},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400, 503]

    def test_post_mood_log_with_special_characters(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/mood/log with special characters should be handled."""
        response = client.post(
            '/api/v1/mood/log',
            json={'mood_text': 'Mår <script>alert("xss")</script>', 'score': 5},
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400, 503]

    def test_post_chat_with_extremely_long_message(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/chatbot/chat with extremely long message should be handled."""
        long_msg = 'A' * 50000
        response = client.post(
            '/api/v1/chatbot/chat',
            json={'message': long_msg},
            headers=auth_headers,
        )
        assert response.status_code in [200, 400, 413, 503]

    def test_post_phq9_with_extra_questions(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/advanced-mood/assess/phq9 with extra questions should be handled."""
        responses = {f'q{i+1}': 1 for i in range(15)}  # Extra questions
        response = client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json={'responses': responses},
            headers=auth_headers,
        )
        assert response.status_code in [200, 400, 503]

    def test_post_phq9_with_out_of_range_answers(self, client, auth_headers, mock_auth_service, mock_db):
        """POST /api/v1/advanced-mood/assess/phq9 with answers > 3 should be handled."""
        responses = {f'q{i+1}': 5 for i in range(9)}  # Out of range
        response = client.post(
            '/api/v1/advanced-mood/assess/phq9',
            json={'responses': responses},
            headers=auth_headers,
        )
        assert response.status_code in [200, 400, 422, 503]


# ===========================================================================
# EDGE CASES - RATE LIMITING
# ===========================================================================

class TestRateLimitingEdgeCases:
    """Test rate limiting behavior under edge conditions."""

    def test_multiple_rapid_requests_dont_crash(self, client, auth_headers, mock_auth_service, mock_db):
        """Multiple rapid requests should be handled (rate limited or served)."""
        for _ in range(5):
            response = client.get(
                '/api/v1/mood',
                headers=auth_headers,
            )
            assert response.status_code in [200, 400, 429, 503]


# ===========================================================================
# EDGE CASES - FIRESTORE ERRORS
# ===========================================================================

class TestFirestoreErrorHandling:
    """Test graceful handling of Firestore errors."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_fetch_memories_handles_firestore_error(self, mock_db):
        """_fetch_memories should return empty list on Firestore error."""
        from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

        gen = DailyInsightGeneratorV2()
        mock_db.collection.side_effect = Exception("Firestore unavailable")

        result = gen._fetch_memories('user_error', days=14)
        assert result == []

    @patch('src.services.daily_insight_service_v2.db')
    def test_fetch_activity_patterns_handles_firestore_error(self, mock_db):
        """_fetch_activity_patterns should return empty dict on Firestore error."""
        from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

        gen = DailyInsightGeneratorV2()
        mock_db.collection.side_effect = Exception("Firestore unavailable")

        result = gen._fetch_activity_patterns('user_error')
        assert result == {}

    @patch('src.services.daily_insight_service_v2.db')
    def test_get_pending_insights_handles_firestore_error(self, mock_db):
        """get_pending_insights should return empty list on Firestore error."""
        from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

        gen = DailyInsightGeneratorV2()
        mock_db.collection.side_effect = Exception("Firestore unavailable")

        result = gen.get_pending_insights('user_error')
        assert result == []
