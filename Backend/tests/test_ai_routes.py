"""
Tests for AI routes — /api/v1/ai endpoints.

Endpoints under test:
  POST /api/v1/ai/story      – generate therapeutic story
  POST /api/v1/ai/forecast   – predictive mood forecast
  GET  /api/v1/ai/stories    – story history
  GET  /api/v1/ai/forecasts  – forecast history

Key facts (verified against ai_routes.py + main.py + conftest.py):
- Blueprint registered at url_prefix='/api/v1/ai'
- user_id always comes from g.user_id (set to 'testuser1234567890ab' by conftest)
- AI service import path: src.services.ai_service.ai_services
- Database accessed via module-level `db` (from src.firebase_config) through _get_db()
- OPTIONS intercepted by before_request handler -> 204
- days_ahead clamped to 1-30 (not defaulted to 7)
"""

from unittest.mock import Mock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_user_subcollections(mock_db, *, moods_stream=None, extra_sub=None):
    """Wire up mock_db so that
        db.collection("users").document(uid).collection("moods") -> moods_col
        db.collection("users").document(uid).collection(<extra_sub>) -> writable col
    Returns (moods_col, extra_col) for further assertions.
    """
    moods_col = Mock()
    moods_col.order_by.return_value.limit.return_value.stream.return_value = (
        moods_stream if moods_stream is not None else []
    )

    extra_col = Mock()
    extra_doc = Mock()
    extra_doc.set = Mock()
    extra_col.document = Mock(return_value=extra_doc)
    # Also make it chainable for history GETs
    extra_col.order_by.return_value.limit.return_value.stream.return_value = []

    def _sub_router(name):
        if name == "moods":
            return moods_col
        if extra_sub and name == extra_sub:
            return extra_col
        return Mock()

    premium_user_snapshot = Mock()
    premium_user_snapshot.exists = True
    premium_user_snapshot.to_dict.return_value = {
        "subscription": {"plan": "premium", "status": "active"}
    }

    user_doc = Mock()
    user_doc.get.return_value = premium_user_snapshot
    user_doc.collection = Mock(side_effect=_sub_router)

    users_col = Mock()
    users_col.document = Mock(return_value=user_doc)

    mock_db.collection.side_effect = lambda n: users_col if n == "users" else Mock()

    return moods_col, extra_col


def _make_mood_doc(**overrides):
    """Return a Mock Firestore document snapshot with mood data."""
    defaults = {
        "sentiment": "POSITIVE",
        "score": 0.8,
        "timestamp": "2024-01-01T10:00:00Z",
        "note": "Feeling good",
        "emotions_detected": ["joy"],
    }
    defaults.update(overrides)
    doc = Mock()
    doc.to_dict.return_value = defaults
    return doc


# ===========================================================================
# POST /api/v1/ai/story
# ===========================================================================

class TestTherapeuticStory:
    """Tests for POST /api/v1/ai/story"""

    @patch("src.services.ai_service.ai_services")
    def test_generate_story_success(self, mock_ai, client, mock_db):
        mood = _make_mood_doc()
        _mock_user_subcollections(mock_db, moods_stream=[mood], extra_sub="stories")

        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": "A beautiful therapeutic story about resilience...",
            "mood_summary": {"overall": "positive"},
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "word_count": 250,
        }

        resp = client.post(
            "/api/v1/ai/story",
            json={"locale": "sv"},
            content_type="application/json",
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["message"] == "Therapeutic story generated successfully"
        d = body["data"]
        assert "A beautiful therapeutic story" in d["story"]
        assert d["aiGenerated"] is True
        assert d["confidence"] == 0.9
        assert d["locale"] == "sv"
        assert d["modelUsed"] == "gpt-4"
        assert d["wordCount"] == 250
        assert "generatedAt" in d

    @patch("src.services.ai_service.ai_services")
    def test_generate_story_invalid_locale_defaults_to_sv(self, mock_ai, client, mock_db):
        _mock_user_subcollections(mock_db, extra_sub="stories")

        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": "Story...",
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.8,
            "word_count": 150,
        }

        resp = client.post(
            "/api/v1/ai/story",
            json={"locale": "xx"},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["locale"] == "sv"

    @patch("src.services.ai_service.ai_services")
    def test_generate_story_english_locale(self, mock_ai, client, mock_db):
        _mock_user_subcollections(mock_db, extra_sub="stories")

        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": "A story in English...",
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "word_count": 200,
        }

        resp = client.post(
            "/api/v1/ai/story",
            json={"locale": "en"},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["locale"] == "en"

    @patch("src.services.ai_service.ai_services")
    def test_generate_story_no_locale_defaults_to_sv(self, mock_ai, client, mock_db):
        """Omitting locale entirely should default to 'sv'."""
        _mock_user_subcollections(mock_db, extra_sub="stories")

        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": "Story...",
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.8,
            "word_count": 100,
        }

        resp = client.post(
            "/api/v1/ai/story",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["locale"] == "sv"

    @patch("src.services.ai_service.ai_services")
    def test_generate_story_ai_failure_uses_fallback(self, mock_ai, client, mock_db):
        mood = _make_mood_doc(sentiment="NEUTRAL", score=0.0)
        _mock_user_subcollections(mock_db, moods_stream=[mood], extra_sub="stories")

        mock_ai.generate_personalized_therapeutic_story.side_effect = Exception(
            "AI service unavailable"
        )
        mock_ai._fallback_therapeutic_story.return_value = {
            "story": "Fallback story...",
            "mood_summary": {},
            "ai_generated": False,
            "model_used": "fallback",
            "confidence": 0.5,
            "word_count": 100,
        }

        resp = client.post(
            "/api/v1/ai/story",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 200
        d = resp.get_json()["data"]
        assert d["aiGenerated"] is False
        assert d["modelUsed"] == "fallback"
        mock_ai._fallback_therapeutic_story.assert_called_once()

    def test_generate_story_database_error(self, client, mock_db):
        """Collection access raises -> 500 with STORY_GENERATION_ERROR."""
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            "/api/v1/ai/story",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "STORY_GENERATION_ERROR"

    @patch("src.routes.ai_routes._get_db")
    def test_generate_story_db_unavailable(self, mock_get_db, client):
        """_get_db() returns None -> 503 SERVICE_UNAVAILABLE."""
        mock_get_db.return_value = None

        resp = client.post(
            "/api/v1/ai/story",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 503
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "SERVICE_UNAVAILABLE"

    def test_generate_story_options_request(self, client):
        resp = client.options("/api/v1/ai/story")
        assert resp.status_code == 204


# ===========================================================================
# POST /api/v1/ai/forecast
# ===========================================================================

class TestMoodForecast:
    """Tests for POST /api/v1/ai/forecast"""

    _SKLEARN_RESULT = {
        "forecast": {
            "trend": "improving",
            "average_forecast": 0.75,
            "predictions": [0.7, 0.72, 0.75, 0.77, 0.78, 0.79, 0.8],
        },
        "model_info": {"algorithm": "LinearRegression", "features_used": 5},
        "current_analysis": {"sentiment": "positive"},
        "risk_factors": [],
        "recommendations": ["Continue positive activities"],
        "confidence": 0.85,
    }

    _FALLBACK_RESULT = {
        "forecast": {"trend": "stable"},
        "model_info": {},
        "current_analysis": {},
        "risk_factors": [],
        "recommendations": [],
        "confidence": 0.5,
    }

    @patch("src.services.ai_service.ai_services")
    def test_forecast_sklearn_success(self, mock_ai, client, mock_db):
        moods = [_make_mood_doc()] * 20
        _mock_user_subcollections(mock_db, moods_stream=moods, extra_sub="forecasts")

        mock_ai.predictive_mood_forecasting_sklearn.return_value = self._SKLEARN_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"days_ahead": 7, "use_sklearn": True},
            content_type="application/json",
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["message"] == "Mood forecast generated successfully"
        d = body["data"]
        assert d["forecast"]["trend"] == "improving"
        assert d["confidence"] == 0.85
        assert d["forecastPeriodDays"] == 7
        assert d["dataPointsUsed"] == 20

    @patch("src.services.ai_service.ai_services")
    def test_forecast_fallback_method(self, mock_ai, client, mock_db):
        _mock_user_subcollections(mock_db, extra_sub="forecasts")

        mock_ai.predictive_mood_analytics.return_value = self._FALLBACK_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"use_sklearn": False},
            content_type="application/json",
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert "forecast" in body["data"]
        mock_ai.predictive_mood_analytics.assert_called_once()

    @patch("src.services.ai_service.ai_services")
    def test_forecast_days_ahead_clamped_high(self, mock_ai, client, mock_db):
        """days_ahead=100 is clamped to 30."""
        _mock_user_subcollections(mock_db, extra_sub="forecasts")
        mock_ai.predictive_mood_forecasting_sklearn.return_value = self._SKLEARN_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"days_ahead": 100},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["forecastPeriodDays"] == 30

    @patch("src.services.ai_service.ai_services")
    def test_forecast_days_ahead_clamped_low(self, mock_ai, client, mock_db):
        """days_ahead=-5 is clamped to 1."""
        _mock_user_subcollections(mock_db, extra_sub="forecasts")
        mock_ai.predictive_mood_forecasting_sklearn.return_value = self._SKLEARN_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"days_ahead": -5},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["forecastPeriodDays"] == 1

    @patch("src.services.ai_service.ai_services")
    def test_forecast_days_ahead_non_integer_defaults_to_7(self, mock_ai, client, mock_db):
        """Non-parseable string falls through to default 7."""
        _mock_user_subcollections(mock_db, extra_sub="forecasts")
        mock_ai.predictive_mood_forecasting_sklearn.return_value = self._SKLEARN_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"days_ahead": "invalid"},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["forecastPeriodDays"] == 7

    @patch("src.services.ai_service.ai_services")
    def test_forecast_default_days_ahead_is_7(self, mock_ai, client, mock_db):
        """Omitting days_ahead entirely defaults to 7."""
        _mock_user_subcollections(mock_db, extra_sub="forecasts")
        mock_ai.predictive_mood_forecasting_sklearn.return_value = self._SKLEARN_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["data"]["forecastPeriodDays"] == 7

    @patch("src.services.ai_service.ai_services")
    def test_forecast_sklearn_failure_uses_fallback(self, mock_ai, client, mock_db):
        _mock_user_subcollections(mock_db, extra_sub="forecasts")

        mock_ai.predictive_mood_forecasting_sklearn.side_effect = Exception("Model error")
        mock_ai.predictive_mood_analytics.return_value = self._FALLBACK_RESULT

        resp = client.post(
            "/api/v1/ai/forecast",
            json={"use_sklearn": True},
            content_type="application/json",
        )

        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        mock_ai.predictive_mood_analytics.assert_called_once()

    def test_forecast_database_error(self, client, mock_db):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.post(
            "/api/v1/ai/forecast",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "FORECAST_GENERATION_ERROR"

    @patch("src.routes.ai_routes._get_db")
    def test_forecast_db_unavailable(self, mock_get_db, client):
        mock_get_db.return_value = None

        resp = client.post(
            "/api/v1/ai/forecast",
            json={},
            content_type="application/json",
        )

        assert resp.status_code == 503
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "SERVICE_UNAVAILABLE"

    def test_forecast_options_request(self, client):
        resp = client.options("/api/v1/ai/forecast")
        assert resp.status_code == 204


# ===========================================================================
# GET /api/v1/ai/stories
# ===========================================================================

class TestStoryHistory:
    """Tests for GET /api/v1/ai/stories"""

    def test_get_story_history_success(self, client, mock_db):
        story1 = Mock()
        story1.id = "story_1"
        story1.to_dict.return_value = {
            "story_content": "First story preview...",
            "locale": "sv",
            "mood_data_points": 10,
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "generated_at": "2024-01-01T10:00:00Z",
        }

        story2 = Mock()
        story2.id = "story_2"
        story2.to_dict.return_value = {
            "story_content": "Second story preview...",
            "locale": "en",
            "mood_data_points": 15,
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.85,
            "generated_at": "2024-01-02T10:00:00Z",
        }

        stories_col = Mock()
        stories_col.order_by.return_value.limit.return_value.stream.return_value = [
            story1,
            story2,
        ]

        user_doc = Mock()
        user_doc.collection.return_value = stories_col

        users_col = Mock()
        users_col.document.return_value = user_doc

        mock_db.collection.side_effect = lambda n: users_col if n == "users" else Mock()

        resp = client.get("/api/v1/ai/stories")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        stories = body["data"]["stories"]
        assert len(stories) == 2
        assert stories[0]["id"] == "story_1"
        assert stories[0]["locale"] == "sv"
        assert stories[0]["storyPreview"] == "First story preview..."
        assert stories[0]["aiGenerated"] is True
        assert stories[1]["id"] == "story_2"

    def test_get_story_history_empty(self, client, mock_db):
        stories_col = Mock()
        stories_col.order_by.return_value.limit.return_value.stream.return_value = []

        user_doc = Mock()
        user_doc.collection.return_value = stories_col

        users_col = Mock()
        users_col.document.return_value = user_doc

        mock_db.collection.side_effect = lambda n: users_col if n == "users" else Mock()

        resp = client.get("/api/v1/ai/stories")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["stories"] == []

    def test_get_story_history_database_error(self, client, mock_db):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.get("/api/v1/ai/stories")

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "STORY_HISTORY_ERROR"

    @patch("src.routes.ai_routes._get_db")
    def test_get_story_history_db_unavailable(self, mock_get_db, client):
        mock_get_db.return_value = None

        resp = client.get("/api/v1/ai/stories")

        assert resp.status_code == 503
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "SERVICE_UNAVAILABLE"

    def test_get_stories_options_request(self, client):
        resp = client.options("/api/v1/ai/stories")
        assert resp.status_code == 204


# ===========================================================================
# GET /api/v1/ai/forecasts
# ===========================================================================

class TestForecastHistory:
    """Tests for GET /api/v1/ai/forecasts"""

    def test_get_forecast_history_success(self, client, mock_db):
        fc1 = Mock()
        fc1.id = "forecast_1"
        fc1.to_dict.return_value = {
            "forecast_summary": {"trend": "improving", "average": 0.75, "confidence": 0.85},
            "days_ahead": 7,
            "model_used": "LinearRegression",
            "data_points_used": 50,
            "risk_factors": [],
            "generated_at": "2024-01-01T10:00:00Z",
        }

        fc2 = Mock()
        fc2.id = "forecast_2"
        fc2.to_dict.return_value = {
            "forecast_summary": {"trend": "stable", "average": 0.65, "confidence": 0.8},
            "days_ahead": 14,
            "model_used": "fallback",
            "data_points_used": 30,
            "risk_factors": ["insufficient_data"],
            "generated_at": "2024-01-02T10:00:00Z",
        }

        forecasts_col = Mock()
        forecasts_col.order_by.return_value.limit.return_value.stream.return_value = [
            fc1,
            fc2,
        ]

        user_doc = Mock()
        user_doc.collection.return_value = forecasts_col

        users_col = Mock()
        users_col.document.return_value = user_doc

        mock_db.collection.side_effect = lambda n: users_col if n == "users" else Mock()

        resp = client.get("/api/v1/ai/forecasts")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        forecasts = body["data"]["forecasts"]
        assert len(forecasts) == 2
        assert forecasts[0]["id"] == "forecast_1"
        assert forecasts[0]["forecastSummary"]["trend"] == "improving"
        assert forecasts[0]["daysAhead"] == 7
        assert forecasts[1]["id"] == "forecast_2"
        assert forecasts[1]["riskFactors"] == ["insufficient_data"]

    def test_get_forecast_history_empty(self, client, mock_db):
        forecasts_col = Mock()
        forecasts_col.order_by.return_value.limit.return_value.stream.return_value = []

        user_doc = Mock()
        user_doc.collection.return_value = forecasts_col

        users_col = Mock()
        users_col.document.return_value = user_doc

        mock_db.collection.side_effect = lambda n: users_col if n == "users" else Mock()

        resp = client.get("/api/v1/ai/forecasts")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["forecasts"] == []

    def test_get_forecast_history_database_error(self, client, mock_db):
        mock_db.collection.side_effect = Exception("Database error")

        resp = client.get("/api/v1/ai/forecasts")

        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "FORECAST_HISTORY_ERROR"

    @patch("src.routes.ai_routes._get_db")
    def test_get_forecast_history_db_unavailable(self, mock_get_db, client):
        mock_get_db.return_value = None

        resp = client.get("/api/v1/ai/forecasts")

        assert resp.status_code == 503
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"] == "SERVICE_UNAVAILABLE"

    def test_get_forecasts_options_request(self, client):
        resp = client.options("/api/v1/ai/forecasts")
        assert resp.status_code == 204
