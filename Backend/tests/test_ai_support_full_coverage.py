"""
AI Support System — Full Coverage Tests
=========================================
Supplementary test suite that targets branches and helper functions in the
AI Support backend (chatbot_routes.py, ai_routes.py) not yet exercised by the
existing test files.

Run:
    pytest tests/test_ai_support_full_coverage.py -v
"""

import json
import sys
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from flask import g

from src.services.subscription_service import SubscriptionLimitError

from src.routes.ai_routes import (
    generate_ai_mood_forecast,
    generate_therapeutic_story,
    get_forecast_history,
    get_story_history,
)
from src.routes.chatbot_routes import (
    analyze_mood_patterns,
    chat_stream,
    chat_with_ai,
    close_chat_session,
    complete_exercise,
    generate_ai_feature_suggestions,
    generate_enhanced_therapeutic_response,
    generate_fallback_response,
    generate_suggested_actions,
    get_chat_history,
    get_conversation_quality_metrics,
    get_therapeutic_framework_analysis,
    get_therapeutic_progress,
    legacy_chat_message,
    start_exercise,
)
from src.routes.chatbot_routes import _get_sse_cors_headers
from src.routes.ai_routes import _get_db as ai_get_db

BASE = "/api/v1/chatbot"
AI_BASE = "/api/v1/ai"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_db_chain(mock_db):
    """Set up the standard users/<uid>/conversations chain used by chat routes."""
    mock_collection = Mock()
    mock_document = Mock()
    mock_subcollection = Mock()
    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_document
    mock_document.get.return_value = Mock(exists=False, to_dict=lambda: {})
    mock_document.collection.return_value = mock_subcollection
    mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
    mock_subcollection.order_by.return_value.limit.return_value.get.return_value = []
    return mock_collection, mock_document, mock_subcollection


def _make_stream_chunk(content: str = "Hej!", done: bool = False, crisis: bool = False):
    if done:
        return "data: [DONE]\n\n"
    payload = {"content": content}
    if crisis:
        payload["crisis"] = True
    return f"data: {json.dumps(payload)}\n\n"


# ---------------------------------------------------------------------------
# chatbot_routes helper functions
# ---------------------------------------------------------------------------

class TestPreflightAndCorsHelpers:
    def test_preflight_response_returns_204(self, client):
        from src.routes.chatbot_routes import _preflight_response

        with client.application.test_request_context("/"):
            resp = _preflight_response()
        assert resp.status_code == 204
        assert resp.data == b""

    def test_get_sse_cors_headers_with_allowed_origin(self, client):
        from src.routes.chatbot_routes import _get_sse_cors_headers

        fake_main = MagicMock()
        fake_main.is_origin_allowed.return_value = True
        with patch.dict(sys.modules, {"main": fake_main}):
            with client.application.test_request_context(
                "/", headers={"Origin": "https://example.com"}
            ):
                headers = _get_sse_cors_headers()

        assert headers.get("Access-Control-Allow-Origin") == "https://example.com"
        assert headers.get("Access-Control-Allow-Credentials") == "true"

    def test_get_sse_cors_headers_not_allowed_origin(self, client):
        from src.routes.chatbot_routes import _get_sse_cors_headers

        fake_main = MagicMock()
        fake_main.is_origin_allowed.return_value = False
        with patch.dict(sys.modules, {"main": fake_main}):
            with client.application.test_request_context(
                "/", headers={"Origin": "https://evil.com"}
            ):
                headers = _get_sse_cors_headers()

        assert headers == {}

    def test_get_sse_cors_headers_without_origin(self, client):
        from src.routes.chatbot_routes import _get_sse_cors_headers

        fake_main = MagicMock()
        fake_main.is_origin_allowed.return_value = True
        with patch.dict(sys.modules, {"main": fake_main}):
            with client.application.test_request_context("/"):
                headers = _get_sse_cors_headers()

        assert headers == {}


class TestImportFlags:
    def test_rag_available_false_logs_warning(self):
        import importlib

        from src.routes import chatbot_routes

        with patch.dict("sys.modules", {"src.services.chat_rag_service": None}):
            with patch(
                "src.routes.chatbot_routes.get_chat_rag_service",
                side_effect=ImportError("no rag"),
            ):
                with patch("src.routes.chatbot_routes.logger.warning") as mock_warning:
                    importlib.reload(chatbot_routes)
                    assert chatbot_routes.RAG_AVAILABLE is False
                    mock_warning.assert_called()

    def test_framework_available_false_logs_warning(self):
        import importlib

        from src.routes import chatbot_routes

        with patch.dict(
            "sys.modules", {"src.services.therapeutic_framework_detector": None}
        ):
            with patch(
                "src.routes.chatbot_routes.get_framework_detector",
                side_effect=ImportError("no framework"),
            ):
                with patch("src.routes.chatbot_routes.logger.warning") as mock_warning:
                    importlib.reload(chatbot_routes)
                    assert chatbot_routes.FRAMEWORK_AVAILABLE is False
                    mock_warning.assert_called()

    def test_progress_available_false_logs_warning(self):
        import importlib

        from src.routes import chatbot_routes

        with patch.dict(
            "sys.modules", {"src.services.therapeutic_progress_tracker": None}
        ):
            with patch(
                "src.routes.chatbot_routes.get_progress_tracker",
                side_effect=ImportError("no progress"),
            ):
                with patch("src.routes.chatbot_routes.logger.warning") as mock_warning:
                    importlib.reload(chatbot_routes)
                    assert chatbot_routes.PROGRESS_AVAILABLE is False
                    mock_warning.assert_called()


# ---------------------------------------------------------------------------
# Streaming chat endpoint
# ---------------------------------------------------------------------------

class TestChatStream:
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_success(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)

        def _stream():
            yield _make_stream_chunk("Hej!")
            yield _make_stream_chunk(" Hur mår du?")
            yield _make_stream_chunk("", done=True)

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = None

        resp = client.post(
            f"{BASE}/chat/stream",
            json={"message": "Hej"},
            headers={"Accept": "text/event-stream"},
        )

        assert resp.status_code == 200
        assert resp.mimetype == "text/event-stream"
        text = resp.get_data(as_text=True)
        assert "Hej!" in text
        assert "data: [DONE]" in text

    def test_chat_stream_db_unavailable(self, client):
        with patch("src.routes.chatbot_routes.db", None):
            resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    def test_chat_stream_invalid_json(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(
            f"{BASE}/chat/stream",
            data="not-json",
            content_type="application/json",
        )
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    def test_chat_stream_missing_message(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/chat/stream", json={})
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    def test_chat_stream_empty_message(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/chat/stream", json={"message": "   "})
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    def test_chat_stream_quota_exceeded(self, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        from src.services.subscription_service import SubscriptionLimitError

        mock_sub.get_plan_context.return_value = {"limits": {"chat_messages": 10}}
        mock_sub.consume_quota.side_effect = SubscriptionLimitError(
            "daily chat limit reached", limit_value=10
        )

        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 429
        assert resp.get_json()["error"] == "RATE_LIMITED"

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_crisis_flag_in_chunk(
        self, mock_ai, mock_sub, mock_db, client
    ):
        _mock_db_chain(mock_db)

        def _stream():
            yield _make_stream_chunk("Kontakta", crisis=True)
            yield _make_stream_chunk("", done=True)

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = None

        resp = client.post(
            f"{BASE}/chat/stream", json={"message": "Jag mår dåligt"}
        )
        assert resp.status_code == 200
        text = resp.get_data(as_text=True)
        assert "crisis" in text or "Kontakta" in text

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_malformed_sse_chunk(
        self, mock_ai, mock_sub, mock_db, client
    ):
        _mock_db_chain(mock_db)

        def _stream():
            yield "data: not-valid-json\n\n"
            yield _make_stream_chunk("OK", done=True)

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = None

        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_generator_raises(
        self, mock_ai, mock_sub, mock_db, client
    ):
        _mock_db_chain(mock_db)

        class BrokenStream:
            def __iter__(self):
                raise RuntimeError("stream failure")
                yield ""  # noqa: B901

        mock_ai.generate_therapeutic_conversation_stream.return_value = BrokenStream()
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = None

        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 200
        text = resp.get_data(as_text=True)
        assert "Stream interrupted" in text

    def test_chat_stream_options(self, client):
        resp = client.options(f"{BASE}/chat/stream")
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Session close
# ---------------------------------------------------------------------------

class TestSessionClose:
    def test_close_session_options(self, client):
        resp = client.options(f"{BASE}/session/close")
        assert resp.status_code == 204

    @patch("src.routes.chatbot_routes.db", None)
    def test_close_session_db_none(self, client):
        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    def test_close_session_no_messages(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = []

        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["summarised"] is False
        assert resp.get_json()["data"]["reason"] == "no_messages"

    @patch("src.routes.chatbot_routes.db")
    def test_close_session_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_msg = Mock()
        mock_msg.to_dict.return_value = {
            "role": "user",
            "content": "Hej",
            "timestamp": datetime.now(UTC).isoformat(),
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_msg]

        with patch(
            "src.services.session_summary_service.SessionSummaryService.summarise_and_save",
            return_value={"summary": "test summary"},
        ):
            resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["summarised"] is True

    @patch("src.routes.chatbot_routes.db")
    def test_close_session_summary_none(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_msg = Mock()
        mock_msg.to_dict.return_value = {"role": "user", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_msg]

        with patch(
            "src.services.session_summary_service.SessionSummaryService.summarise_and_save",
            return_value=None,
        ):
            resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["summarised"] is False

    @patch("src.routes.chatbot_routes.db")
    def test_close_session_db_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("db down")
        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# Advanced analytics endpoints
# ---------------------------------------------------------------------------

class TestAdvancedAnalytics:
    def test_framework_analysis_unavailable(self, client):
        with patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False):
            resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.db")
    def test_framework_analysis_success(self, mock_db, mock_detector, client):
        from src.services.therapeutic_framework_detector import TherapeuticFramework

        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "assistant", "content": "KBT-teknik"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = [mock_doc]

        detector = Mock()
        detector.detect_framework.return_value = (TherapeuticFramework.CBT, 0.92)
        detector.detect_techniques.return_value = [
            Mock(technique="cognitive_restructuring")
        ]
        mock_detector.return_value = detector

        resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["framework"] == "cognitive_behavioral_therapy"
        assert data["confidence"] == 0.92

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.db")
    def test_framework_analysis_no_messages(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = []

        resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["framework"] == "unknown"

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.db")
    def test_framework_analysis_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("db fail")
        resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 500

    def test_progress_analysis_unavailable(self, client):
        with patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", False):
            resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.routes.chatbot_routes.db")
    def test_progress_analysis_success(self, mock_db, mock_tracker, client):
        _mock_db_chain(mock_db)
        docs = []
        for _ in range(5):
            m = Mock()
            m.to_dict.return_value = {
                "role": "assistant",
                "content": "Svar",
                "timestamp": datetime.now(UTC).isoformat(),
                "sentiment": "POSITIVE",
                "emotions_detected": ["joy"],
                "suggested_actions": ["action"],
            }
            docs.append(m)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = docs

        trajectory = Mock(
            slope_wellbeing=0.1,
            clinically_significant_change=True,
            plateau_detected=False,
            deterioration_detected=False,
            risk_of_dropout=0.1,
        )
        tracker = Mock()
        tracker.analyze_progress_trajectory.return_value = trajectory
        tracker.generate_progress_report.return_value = {"summary": "good"}
        mock_tracker.return_value = tracker

        resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert "progress_report" in data
        assert data["recommendations"][0].startswith("Fantastiskt")

    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.db")
    def test_progress_analysis_insufficient_data(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = []

        resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["status"] == "insufficient_data"

    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.db")
    def test_progress_analysis_error(self, mock_db, client):
        mock_db.collection.side_effect = Exception("db fail")
        resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 500

    def test_quality_metrics_unavailable(self, client):
        with patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False):
            resp = client.get(f"{BASE}/analysis/quality")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.db")
    def test_quality_metrics_success(self, mock_db, mock_detector, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "assistant", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = [mock_doc]

        metrics = Mock(
            empathy_score=8,
            specificity_score=7,
            collaboration_score=9,
            structure_score=8,
            overall_quality=8,
            safety_assessment="safe",
            goal_alignment=0.8,
            technique_usage={},
        )
        detector = Mock()
        detector.analyze_conversation_quality.return_value = metrics
        detector.generate_therapeutic_recommendations.return_value = ["Bra jobbat"]
        mock_detector.return_value = detector

        resp = client.get(f"{BASE}/analysis/quality")
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["metrics"]["empathy_score"] == 8

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.db")
    def test_quality_metrics_no_messages(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = []

        resp = client.get(f"{BASE}/analysis/quality")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["metrics"] is None


# ---------------------------------------------------------------------------
# Wellbeing / progress helpers
# ---------------------------------------------------------------------------

class TestWellbeingHelpers:
    def test_estimate_wellbeing_positive(self):
        from src.routes.chatbot_routes import _estimate_wellbeing_from_sentiment

        score = _estimate_wellbeing_from_sentiment(
            {"sentiment": "POSITIVE", "emotions_detected": ["joy", "gratitude"]}
        )
        assert 8 <= score <= 10

    def test_estimate_wellbeing_negative(self):
        from src.routes.chatbot_routes import _estimate_wellbeing_from_sentiment

        score = _estimate_wellbeing_from_sentiment(
            {"sentiment": "NEGATIVE", "emotions_detected": ["sadness", "anxiety"]}
        )
        assert 1 <= score <= 4

    def test_estimate_wellbeing_unknown_sentiment(self):
        from src.routes.chatbot_routes import _estimate_wellbeing_from_sentiment

        score = _estimate_wellbeing_from_sentiment({"sentiment": "UNKNOWN"})
        assert score == 5.0

    def test_progress_recommendations_all_branches(self):
        from src.routes.chatbot_routes import _generate_progress_recommendations

        trajectory = Mock(
            deterioration_detected=True,
            plateau_detected=True,
            risk_of_dropout=0.8,
            clinically_significant_change=True,
        )
        recs = _generate_progress_recommendations(trajectory)
        assert len(recs) == 4

    def test_progress_recommendations_default(self):
        from src.routes.chatbot_routes import _generate_progress_recommendations

        trajectory = Mock(
            deterioration_detected=False,
            plateau_detected=False,
            risk_of_dropout=0.1,
            clinically_significant_change=False,
        )
        recs = _generate_progress_recommendations(trajectory)
        assert len(recs) == 1
        assert "Fortsätt" in recs[0]


# ---------------------------------------------------------------------------
# ai_routes missing branches
# ---------------------------------------------------------------------------

class TestAIRoutesEdgeCases:
    def test_ai_preflight_response(self, client):
        from src.routes.ai_routes import _preflight_response

        with client.application.test_request_context("/"):
            resp = _preflight_response()
        assert resp.status_code == 204

    def test_mask_identifier_branches(self):
        from src.routes.ai_routes import _mask_identifier

        assert _mask_identifier(None) == "anonymous"
        assert _mask_identifier("") == "anonymous"
        assert _mask_identifier("abc") == "***"
        assert _mask_identifier("testuser1234") == "tes***34"

    def test_to_bool_branches(self):
        from src.routes.ai_routes import _to_bool

        assert _to_bool(True) is True
        assert _to_bool(False) is False
        assert _to_bool(None) is True
        assert _to_bool("yes") is True
        assert _to_bool("no") is False
        assert _to_bool("unknown") is True
        assert _to_bool(0) is False
        assert _to_bool(1) is True
        assert _to_bool([1, 2]) is True

    @patch("src.routes.ai_routes.db")
    def test_check_premium_access_denies_free_user(self, mock_db, client):
        from src.routes.ai_routes import _check_premium_access

        _mock_db_chain(mock_db)
        snapshot = Mock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {"subscription": {"plan": "free"}}
        mock_db.collection.return_value.document.return_value.get.return_value = snapshot

        with client.application.test_request_context("/"):
            with patch(
                "src.services.subscription_service.SubscriptionService.get_plan_context",
                return_value={"is_premium": False, "is_trial": False},
            ):
                result = _check_premium_access("testuser1234567890ab")

        assert result is not None
        assert result[1] == 403

    @patch("src.routes.ai_routes.db")
    def test_check_premium_access_exception_grants_access(self, mock_db):
        from src.routes.ai_routes import _check_premium_access

        mock_db.collection.side_effect = Exception("db fail")
        result = _check_premium_access("testuser1234567890ab")
        assert result is None

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_story_non_string_result_returns_error(
        self, mock_ai, mock_premium, mock_db, client
    ):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": 123,
            "ai_generated": True,
        }

        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 500
        assert resp.get_json()["error"] == "STORY_GENERATION_ERROR"

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_story_locale_not_string(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.generate_personalized_therapeutic_story.return_value = {
            "story": "Once upon a time...",
            "ai_generated": True,
        }

        resp = client.post(f"{AI_BASE}/story", json={"locale": 123})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["locale"] == "sv"

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_forecast_not_dict(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        # Provide 2 mood entries so the insufficient_data guard is passed
        mock_mood_doc1 = Mock()
        mock_mood_doc1.to_dict.return_value = {"sentiment": "POSITIVE", "score": 0.8, "timestamp": "2025-01-01"}
        mock_mood_doc2 = Mock()
        mock_mood_doc2.to_dict.return_value = {"sentiment": "NEUTRAL", "score": 0.5, "timestamp": "2025-01-02"}
        mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value.stream.return_value = [mock_mood_doc1, mock_mood_doc2]
        mock_ai.predictive_mood_forecasting_sklearn.return_value = "not-dict"

        resp = client.post(
            f"{AI_BASE}/forecast", json={"days_ahead": 7, "use_sklearn": True}
        )
        assert resp.status_code == 500
        assert resp.get_json()["error"] == "FORECAST_GENERATION_ERROR"

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    def test_forecast_invalid_days_ahead(self, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)

        resp = client.post(f"{AI_BASE}/forecast", json={"days_ahead": "bad"})
        assert resp.status_code in (200, 500)

    def test_story_options(self, client):
        resp = client.options(f"{AI_BASE}/story")
        assert resp.status_code == 204

    def test_forecast_options(self, client):
        resp = client.options(f"{AI_BASE}/forecast")
        assert resp.status_code == 204

    def test_stories_options(self, client):
        resp = client.options(f"{AI_BASE}/stories")
        assert resp.status_code == 204

    def test_forecasts_options(self, client):
        resp = client.options(f"{AI_BASE}/forecasts")
        assert resp.status_code == 204

    @patch("src.routes.ai_routes.db")
    def test_stories_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.id = "story-1"
        mock_doc.to_dict.return_value = {
            "story_content": "En saga...",
            "locale": "sv",
            "mood_data_points": 3,
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.8,
            "generated_at": "2025-01-01T00:00:00+00:00",
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]

        resp = client.get(f"{AI_BASE}/stories")
        assert resp.status_code == 200
        assert len(resp.get_json()["data"]["stories"]) == 1

    @patch("src.routes.ai_routes.db")
    def test_forecasts_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.id = "forecast-1"
        mock_doc.to_dict.return_value = {
            "forecast_summary": {"trend": "up"},
            "days_ahead": 7,
            "model_used": "sklearn",
            "data_points_used": 5,
            "risk_factors": [],
            "generated_at": "2025-01-01T00:00:00+00:00",
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]

        resp = client.get(f"{AI_BASE}/forecasts")
        assert resp.status_code == 200
        assert len(resp.get_json()["data"]["forecasts"]) == 1

    @patch("src.routes.ai_routes.db", None)
    def test_stories_db_unavailable(self, client):
        resp = client.get(f"{AI_BASE}/stories")
        assert resp.status_code == 503

    @patch("src.routes.ai_routes.db", None)
    def test_forecasts_db_unavailable(self, client):
        resp = client.get(f"{AI_BASE}/forecasts")
        assert resp.status_code == 503

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    def test_story_premium_denied(self, mock_premium, mock_db, client):
        mock_premium.return_value = (json.dumps({"error": "PREMIUM_REQUIRED"}), 403)
        _mock_db_chain(mock_db)
        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 403

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    def test_forecast_premium_denied(self, mock_premium, mock_db, client):
        mock_premium.return_value = (json.dumps({"error": "PREMIUM_REQUIRED"}), 403)
        _mock_db_chain(mock_db)
        resp = client.post(f"{AI_BASE}/forecast", json={})
        assert resp.status_code == 403

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    def test_story_invalid_body_not_dict(self, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        resp = client.post(f"{AI_BASE}/story", json=[1, 2, 3])
        assert resp.status_code == 400

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    def test_forecast_invalid_body_not_dict(self, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        resp = client.post(f"{AI_BASE}/forecast", json=[1, 2, 3])
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Chat endpoint edge cases
# ---------------------------------------------------------------------------

class TestChatEdgeCases:
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_crisis_detected_triggers_escalation(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "Jag hör att du har det svårt.",
            "emotions_detected": ["sadness"],
            "suggested_actions": [],
            "crisis_detected": True,
            "crisis_analysis": {"risk": "high"},
            "ai_generated": True,
            "model_used": "gpt-4",
            "sentiment_analysis": {"sentiment": "NEGATIVE"},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        with patch(
            "src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk"
        ) as mock_assess:
            assessment = Mock()
            assessment.overall_risk_level = "high"
            assessment.risk_score = 0.85
            assessment.active_indicators = []
            mock_assess.return_value = assessment

            with patch(
                "src.services.crisis_escalation.get_crisis_escalation_service"
            ) as mock_escalation_factory:
                service = Mock()
                result = Mock()
                result.success = True
                result.channels_used = []
                service.escalate.return_value = result
                mock_escalation_factory.return_value = service

                with patch(
                    "src.services.crisis_escalation.CrisisAlert"
                ) as MockCrisisAlert:
                    alert = Mock()
                    MockCrisisAlert.return_value = alert

                    resp = client.post(
                        f"{BASE}/chat", json={"message": "Jag vill dö"}
                    )

        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    def test_chat_invalid_json(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(
            f"{BASE}/chat",
            data="not-json",
            content_type="application/json",
        )
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    def test_chat_message_sanitized_to_empty(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/chat", json={"message": "   "})
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    @patch("src.routes.chatbot_routes.generate_fallback_response")
    def test_chat_enhanced_response_raises_uses_fallback(
        self, mock_fallback, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.side_effect = RuntimeError("ai fail")
        mock_fallback.return_value = {
            "response": "fallback",
            "crisis_detected": False,
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
            "ai_generated": False,
            "model_used": "fallback",
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["response"] == "fallback"

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_crisis_assessment_exception(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "Jag hör dig.",
            "crisis_detected": True,
            "crisis_analysis": {"risk": "high"},
            "sentiment_analysis": {"sentiment": "NEGATIVE"},
            "ai_generated": True,
            "model_used": "gpt-4",
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        with patch(
            "src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk"
        ) as mock_assess:
            mock_assess.side_effect = RuntimeError("crisis fail")
            resp = client.post(f"{BASE}/chat", json={"message": "Jag mår dåligt"})

        assert resp.status_code == 200
        assert resp.get_json()["data"]["crisisDetected"] is True

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_payload_user_id_mismatch(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "OK",
            "crisis_detected": False,
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
            "ai_generated": True,
            "model_used": "gpt-4",
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        resp = client.post(
            f"{BASE}/chat", json={"message": "Hej", "user_id": "other-user"}
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Fallback response branches
# ---------------------------------------------------------------------------

class TestGenerateEnhancedTherapeuticResponse:
    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.get_chat_rag_service")
    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.RAG_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    def test_generate_enhanced_response_rag_and_framework(
        self,
        mock_generate,
        mock_rag_factory,
        mock_detector_factory,
        mock_progress_factory,
    ):
        from src.routes.chatbot_routes import (
            FRAMEWORK_AVAILABLE,
            PROGRESS_AVAILABLE,
            RAG_AVAILABLE,
            generate_enhanced_therapeutic_response,
        )

        # Verify patches applied
        assert RAG_AVAILABLE is True
        assert FRAMEWORK_AVAILABLE is True
        assert PROGRESS_AVAILABLE is True

        # RAG context
        ctx = Mock()
        ctx.source = "mood"
        ctx.content = "Recent low mood"
        rag_service = Mock()
        rag_service.retrieve_context.return_value = [ctx]
        mock_rag_factory.return_value = rag_service

        # Framework detector
        detector = Mock()
        from src.services.therapeutic_framework_detector import TherapeuticFramework

        detector.detect_framework.return_value = (TherapeuticFramework.CBT, 0.85)
        tech = Mock()
        tech.technique = "cognitive_restructuring"
        detector.detect_techniques.return_value = [tech]
        mock_detector_factory.return_value = detector

        # Progress tracker
        mock_progress_factory.return_value = Mock()

        # AI response
        mock_generate.return_value = {
            "response": "Jag förstår.",
            "crisis_detected": False,
            "sentiment_analysis": {"emotions": ["stress"]},
            "ai_generated": True,
            "model_used": "gpt-4",
        }

        # Patch Firestore db for user profile
        with patch("src.routes.chatbot_routes.db") as mock_db:
            _mock_db_chain(mock_db)
            user_doc = Mock(exists=True)
            user_doc.to_dict.return_value = {
                "name": "Test User",
                "email": "test@example.com",
                "values": ["lugn"],
            }
            mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
            mock_sub.order_by.return_value.limit.return_value.stream.return_value = []
            profile_doc = mock_db.collection.return_value.document.return_value
            profile_doc.get.return_value = user_doc

            result = generate_enhanced_therapeutic_response(
                "Jag känner stress", [], user_id="testuser1234567890ab"
            )

        assert result["response"] == "Jag förstår."
        assert result["rag_context_used"] is True
        assert result["framework_detected"] == "cognitive_behavioral_therapy"
        assert result["progress_tracking_enabled"] is True

    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False)
    @patch("src.routes.chatbot_routes.RAG_AVAILABLE", False)
    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", False)
    def test_generate_enhanced_response_ai_failure(self, mock_generate):
        from src.routes.chatbot_routes import generate_enhanced_therapeutic_response

        mock_generate.side_effect = RuntimeError("ai fail")
        with patch("src.routes.chatbot_routes.db", None):
            result = generate_enhanced_therapeutic_response("Hej", [])

        assert "Jag är här" in result["response"]
        assert result["rag_context_used"] is False

    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.get_chat_rag_service")
    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.RAG_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    def test_generate_enhanced_response_exceptions_in_features(
        self,
        mock_generate,
        mock_rag_factory,
        mock_detector_factory,
        mock_progress_factory,
    ):
        from src.routes.chatbot_routes import generate_enhanced_therapeutic_response

        mock_rag_factory.side_effect = RuntimeError("rag fail")
        mock_detector_factory.side_effect = RuntimeError("detector fail")
        mock_progress_factory.side_effect = RuntimeError("progress fail")
        mock_generate.return_value = {
            "response": "OK",
            "crisis_detected": False,
            "sentiment_analysis": {},
        }

        with patch("src.routes.chatbot_routes.db") as mock_db:
            _mock_db_chain(mock_db)
            user_doc = Mock(exists=True)
            user_doc.to_dict.return_value = {"name": "A", "email": "a@b.com"}
            mock_db.collection.return_value.document.return_value.get.return_value = user_doc
            result = generate_enhanced_therapeutic_response(
                "Hej", [], user_id="testuser1234567890ab"
            )

        assert result["response"] == "OK"
        assert result["rag_context_used"] is False
        assert result["framework_detected"] is None
        assert "progress_tracking_enabled" not in result

    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    @patch("src.routes.chatbot_routes.RAG_AVAILABLE", False)
    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", False)
    def test_generate_enhanced_response_low_confidence_and_profile(
        self, mock_generate
    ):
        from src.routes.chatbot_routes import generate_enhanced_therapeutic_response
        from src.services.therapeutic_framework_detector import TherapeuticFramework

        with patch("src.routes.chatbot_routes.get_framework_detector") as mock_detector_factory:
            detector = Mock()
            detector.detect_framework.return_value = (TherapeuticFramework.CBT, 0.3)
            detector.detect_techniques.return_value = []
            mock_detector_factory.return_value = detector

            mock_generate.return_value = {
                "response": "OK",
                "crisis_detected": False,
                "sentiment_analysis": {"emotions": []},
            }

            with patch("src.routes.chatbot_routes.db") as mock_db:
                _mock_db_chain(mock_db)
                user_doc = Mock(exists=True)
                user_doc.to_dict.return_value = {"email": "first.last@example.com"}
                mock_db.collection.return_value.document.return_value.get.return_value = user_doc
                result = generate_enhanced_therapeutic_response(
                    "Hej", [], user_id="testuser1234567890ab"
                )

        assert result["response"] == "OK"
        assert result["framework_detected"] is None


class TestFallbackResponseBranches:
    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_fallback_response_oro(self, mock_sentiment):
        mock_sentiment.return_value = {
            "sentiment": "NEGATIVE",
            "emotions": ["anxiety"],
        }
        from src.routes.chatbot_routes import generate_fallback_response

        result = generate_fallback_response("Jag har mycket oro")
        assert "oro" in result["response"].lower()

    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_fallback_response_loneliness(self, mock_sentiment):
        mock_sentiment.return_value = {
            "sentiment": "NEGATIVE",
            "emotions": ["loneliness"],
        }
        from src.routes.chatbot_routes import generate_fallback_response

        result = generate_fallback_response("Jag känner mig ensam")
        assert "ensam" in result["response"].lower()

    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_fallback_response_fatigue(self, mock_sentiment):
        mock_sentiment.return_value = {
            "sentiment": "NEGATIVE",
            "emotions": ["fatigue"],
        }
        from src.routes.chatbot_routes import generate_fallback_response

        result = generate_fallback_response("Jag är så trött")
        assert "trött" in result["response"].lower()

    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_fallback_response_hope(self, mock_sentiment):
        mock_sentiment.return_value = {
            "sentiment": "POSITIVE",
            "emotions": ["hope"],
        }
        from src.routes.chatbot_routes import generate_fallback_response

        result = generate_fallback_response("Jag känner hopp")
        assert result["ai_generated"] is False


# ---------------------------------------------------------------------------
# Additional chatbot endpoint coverage
# ---------------------------------------------------------------------------

class TestSessionCloseEndpoint:
    @patch("src.routes.chatbot_routes.db")
    def test_close_session_options(self, mock_db, client):
        resp = client.options(f"{BASE}/session/close")
        assert resp.status_code == 204

    @patch("src.routes.chatbot_routes.db", None)
    def test_close_session_db_unavailable(self, client):
        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    def test_close_session_no_messages(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = []
        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["summarised"] is False

    @patch("src.routes.chatbot_routes.db")
    @patch("src.services.session_summary_service.SessionSummaryService")
    def test_close_session_success(self, mock_summary, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {
            "role": "user",
            "content": "Hej",
            "timestamp": "2025-01-01T00:00:00+00:00",
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        mock_summary.summarise_and_save.return_value = {"summary": "test"}

        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["summarised"] is True


class TestChatHistoryEndpoint:
    @patch("src.routes.chatbot_routes.db")
    def test_history_options(self, mock_db, client):
        resp = client.options(f"{BASE}/history")
        assert resp.status_code == 204

    @patch("src.routes.chatbot_routes.db", None)
    def test_history_db_unavailable(self, client):
        resp = client.get(f"{BASE}/history")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    def test_history_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.id = "msg-1"
        mock_doc.to_dict.return_value = {
            "role": "user",
            "content": "Hej",
            "timestamp": "2025-01-01T00:00:00+00:00",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "crisis_analysis": {},
            "ai_generated": False,
            "model_used": "unknown",
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]

        resp = client.get(f"{BASE}/history")
        assert resp.status_code == 200
        assert len(resp.get_json()["data"]["conversation"]) == 1


class TestAnalyzePatternsEndpoint:
    @patch("src.routes.chatbot_routes.db")
    def test_analyze_patterns_options(self, mock_db, client):
        resp = client.options(f"{BASE}/analyze-patterns")
        assert resp.status_code == 204

    @patch("src.firebase_config.db")
    @patch("src.services.ai_service.ai_services.analyze_mood_patterns")
    def test_analyze_patterns_success(self, mock_analysis, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 8,
            "timestamp": "2025-01-01T00:00:00+00:00",
            "note": "",
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        mock_analysis.return_value = {"pattern_analysis": "ok"}

        resp = client.post(f"{BASE}/analyze-patterns")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["dataPointsAnalyzed"] == 1


class TestExerciseEndpoints:
    @patch("src.routes.chatbot_routes.db")
    def test_exercise_options(self, mock_db, client):
        resp = client.options(f"{BASE}/exercise")
        assert resp.status_code == 204

    @patch("src.routes.chatbot_routes.db")
    def test_exercise_missing_type(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/exercise", json={})
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    def test_exercise_invalid_type(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/exercise", json={"exercise_type": "jumping"})
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    def test_exercise_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/exercise", json={"exercise_type": "breathing", "duration": "abc"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["exerciseType"] == "breathing"

    @patch("src.routes.chatbot_routes.db")
    def test_complete_exercise_options(self, mock_db, client):
        resp = client.options(f"{BASE}/exercise/testuser1234567890ab/ex-1/complete")
        assert resp.status_code == 204

    @patch("src.routes.chatbot_routes.db")
    def test_complete_exercise_unauthorized(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/exercise/otheruser/ex-1/complete")
        assert resp.status_code == 403

    @patch("src.routes.chatbot_routes.db")
    def test_complete_exercise_success(self, mock_db, client):
        _mock_db_chain(mock_db)
        resp = client.post(f"{BASE}/exercise/testuser1234567890ab/ex-1/complete")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Error branches
# ---------------------------------------------------------------------------

class TestChatStreamAdditionalBranches:
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    def test_chat_stream_user_fetch_exception(self, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_db.collection.return_value.document.return_value.get.side_effect = Exception("get fail")
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 200

    @pytest.mark.xfail(strict=False, reason="Flask stream_with_context context cleanup issue in test env — not a production bug")
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_award_xp_exception(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        def _stream():
            yield "data: {\"content\": \"Hej\"}\n\n"
            yield "data: [DONE]\n\n"

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()

        with patch("src.services.rewards_helper.award_xp") as mock_award:
            mock_award.side_effect = Exception("xp fail")
            resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
            resp.get_data(as_text=True)
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_truncation_warning(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "user", "content": "Hej"}
        mock_subcol = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_subcol.order_by.return_value.limit.return_value.stream.return_value = [mock_doc] * 25

        def _stream():
            yield "data: [DONE]\n\n"

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        resp.get_data(as_text=True)
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_outer_exception(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        mock_subcol = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_subcol.order_by.return_value.limit.return_value.stream.side_effect = Exception("stream fail")

        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        resp.get_data(as_text=True)
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_generic_parse_error(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        def _stream():
            yield "data: []\n\n"

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        resp.get_data(as_text=True)
        assert resp.status_code == 200


class TestChatbotErrorBranches:
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    @patch("src.routes.chatbot_routes.generate_fallback_response")
    def test_chat_with_ai_save_failure(
        self, mock_fallback, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.document.return_value.set.side_effect = Exception("save fail")
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        mock_fallback.return_value = {"response": "fallback", "crisis_detected": False, "sentiment_analysis": {}}

        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_timeout(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        mock_time = Mock()
        mock_time.time.side_effect = [0, 130]

        def _stream():
            yield "data: {\"content\": \"Hej\"}\n\n"

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()

        with patch("src.routes.chatbot_routes.time", mock_time):
            resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        text = resp.get_data(as_text=True)
        assert "Streaming timeout" in text

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_save_failure(
        self, mock_ai, mock_sub, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True

        mock_subcol = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_subcol.document.return_value.set.side_effect = [None, Exception("save fail")]

        def _stream():
            yield "data: {\"content\": \"Hej\"}\n\n"
            yield "data: [DONE]\n\n"

        mock_ai.generate_therapeutic_conversation_stream.return_value = _stream()
        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.services.session_summary_service.SessionSummaryService")
    def test_close_session_exception(self, mock_summary, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "user", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        mock_summary.summarise_and_save.side_effect = Exception("summary fail")

        resp = client.post(f"{BASE}/session/close")
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    def test_history_exception(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.side_effect = Exception("stream fail")

        resp = client.get(f"{BASE}/history")
        assert resp.status_code == 500

    @patch("src.firebase_config.db")
    def test_analyze_patterns_exception(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_db.collection.side_effect = Exception("db fail")
        resp = client.post(f"{BASE}/analyze-patterns")
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    def test_exercise_save_exception(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.document.return_value.set.side_effect = Exception("set fail")

        resp = client.post(f"{BASE}/exercise", json={"exercise_type": "breathing"})
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    def test_complete_exercise_exception(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_doc.document.return_value.update.side_effect = Exception("update fail")

        resp = client.post(f"{BASE}/exercise/testuser1234567890ab/ex-1/complete")
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    def test_framework_analysis_exception(self, mock_detector, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "assistant", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = [mock_doc]
        mock_detector.side_effect = Exception("detector fail")

        resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", True)
    def test_progress_analysis_exception(self, mock_tracker, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "assistant", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = [mock_doc]
        mock_tracker.side_effect = Exception("tracker fail")

        resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 500

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", True)
    def test_quality_metrics_exception(self, mock_detector, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "assistant", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.get.return_value = [mock_doc]
        mock_detector.side_effect = Exception("detector fail")

        resp = client.get(f"{BASE}/analysis/quality")
        assert resp.status_code == 500


class TestHelperErrorBranches:
    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_generate_fallback_response_sentiment_exception(self, mock_sentiment):
        from src.routes.chatbot_routes import generate_fallback_response

        mock_sentiment.side_effect = Exception("sentiment fail")
        result = generate_fallback_response("Hej")
        assert "response" in result
        assert result["sentiment_analysis"]["sentiment"] == "NEUTRAL"

    def test_generate_suggested_actions_anger(self):
        from src.routes.chatbot_routes import generate_suggested_actions

        actions = generate_suggested_actions({"sentiment": "NEGATIVE", "emotions": ["anger"]})
        assert len(actions) > 0
        assert len(actions) <= 3

    def test_generate_ai_feature_suggestions_emotional_challenge(self):
        from src.routes.chatbot_routes import generate_ai_feature_suggestions

        result = generate_ai_feature_suggestions("Jag har en svår utmaning", [], {"sentiment_analysis": {"sentiment": "NEGATIVE"}})
        assert result["suggest_story"] is True
        assert "personlig berättelse" in result["story_reason"].lower()

    def test_generate_ai_feature_suggestions_concern(self):
        from src.routes.chatbot_routes import generate_ai_feature_suggestions

        result = generate_ai_feature_suggestions("Jag är bekymrad", [1, 2, 3, 4, 5, 6], {"sentiment_analysis": {"sentiment": "NEUTRAL"}})
        assert result["suggest_forecast"] is True
        assert "kommande utmaningar" in result["forecast_reason"].lower()

    @patch("src.routes.chatbot_routes.get_chat_rag_service")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    def test_generate_enhanced_user_profile_email(
        self, mock_generate, mock_tracker, mock_detector, mock_rag
    ):
        from src.routes.chatbot_routes import generate_enhanced_therapeutic_response

        user_doc = Mock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {"name": "", "email": "test.user@example.com"}

        assessment_doc = Mock()
        assessment_doc.to_dict.return_value = {"type": "phq9", "total_score": 12, "severity": "moderate", "timestamp": "2026-01-01"}

        mock_db = Mock()
        mock_db.collection.return_value.document.return_value.get.return_value = user_doc
        mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value.stream.return_value = [assessment_doc]

        with patch("src.firebase_config.db", mock_db):
            mock_rag.return_value.retrieve_context.return_value = []
            detector = Mock()
            detector.detect_framework.return_value = (Mock(value="CBT"), 0.0)
            detector.detect_techniques.return_value = []
            mock_detector.return_value = detector
            mock_tracker.return_value.analyze_progress.return_value = None
            mock_generate.return_value = {"response": "OK", "sentiment_analysis": {"sentiment": "NEUTRAL"}}

            with patch("src.routes.chatbot_routes.RAG_AVAILABLE", False):
                with patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False):
                    result = generate_enhanced_therapeutic_response("Hej", [], user_id="test")
                    assert result["response"] == "OK"

    @patch("src.routes.chatbot_routes.get_chat_rag_service")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.routes.chatbot_routes.get_progress_tracker")
    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    def test_generate_enhanced_clinical_assessment_exception(
        self, mock_generate, mock_tracker, mock_detector, mock_rag
    ):
        from src.routes.chatbot_routes import generate_enhanced_therapeutic_response

        user_doc = Mock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {"name": "Test", "email": ""}

        mock_db = Mock()
        mock_db.collection.return_value.document.return_value.get.return_value = user_doc
        mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value.stream.side_effect = Exception("assess fail")

        with patch("src.firebase_config.db", mock_db):
            mock_rag.return_value.retrieve_context.return_value = []
            detector = Mock()
            detector.detect_framework.return_value = (Mock(value="CBT"), 0.0)
            detector.detect_techniques.return_value = []
            mock_detector.return_value = detector
            mock_tracker.return_value.analyze_progress.return_value = None
            mock_generate.return_value = {"response": "OK", "sentiment_analysis": {"sentiment": "NEUTRAL"}}

            with patch("src.routes.chatbot_routes.RAG_AVAILABLE", False):
                with patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False):
                    result = generate_enhanced_therapeutic_response("Hej", [], user_id="test")
                    assert result["response"] == "OK"


class TestChatWithAIAdditionalBranches:
    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_truncation_warning(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"role": "user", "content": "Hej"}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc] * 25

        mock_response.return_value = {"response": "Hej", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}, "ai_generated": True, "model_used": "test"}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_xp_award_exception(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "Hej",
            "crisis_detected": False,
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
            "ai_generated": True,
            "model_used": "test",
        }
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        with patch("src.services.rewards_helper.award_xp") as mock_award:
            mock_award.side_effect = Exception("xp fail")
            resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_crisis_thread_timeout(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "Hej",
            "crisis_detected": True,
            "crisis_analysis": {"risk": "high"},
            "sentiment_analysis": {"sentiment": "NEGATIVE"},
            "ai_generated": True,
            "model_used": "test",
        }
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        mock_thread = Mock()
        mock_thread.is_alive.return_value = True

        indicator = Mock()
        indicator.swedish_description = "självskadeanknytning"
        assessment = Mock()
        assessment.overall_risk_level = "high"
        assessment.risk_score = 0.9
        assessment.active_indicators = [indicator]

        with patch("threading.Thread", return_value=mock_thread):
            with patch("src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk") as mock_assess:
                mock_assess.return_value = assessment
                with patch("src.services.crisis_escalation.CrisisAlert") as mock_alert, \
                        patch("src.services.crisis_escalation.get_crisis_escalation_service") as mock_esc:
                    mock_alert.return_value = Mock(timestamp=datetime.now(UTC))
                    mock_esc.return_value.create_alert.return_value = Mock(timestamp=datetime.now(UTC))
                    resp = client.post(f"{BASE}/chat", json={"message": "Jag mår dåligt"})

        assert resp.status_code == 200


class TestDirectRouteOptions:
    """Bypass middleware and jwt_required to hit route-level OPTIONS branches."""

    @pytest.mark.parametrize(
        "route_func,args",
        [
            (chat_with_ai, ()),
            (chat_stream, ()),
            (legacy_chat_message, ()),
            (close_chat_session, ()),
            (get_chat_history, ()),
            (analyze_mood_patterns, ()),
            (start_exercise, ()),
            (complete_exercise, ("", "")),
            (get_therapeutic_framework_analysis, ()),
            (get_therapeutic_progress, ()),
            (get_conversation_quality_metrics, ()),
            (generate_therapeutic_story, ()),
            (generate_ai_mood_forecast, ()),
            (get_story_history, ()),
            (get_forecast_history, ()),
        ],
    )
    def test_options_returns_204(self, route_func, args, app):
        with app.test_request_context("/", method="OPTIONS"):
            resp = route_func.__wrapped__.__wrapped__(*args)
        assert resp.status_code == 204


class TestDirectRouteMissingUserId:
    """Hit missing-user_id branches by calling route functions outside jwt_required."""

    def test_chat_with_ai_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({"message": "Hej"}), content_type="application/json"
        ):
            g.user_id = None
            resp = chat_with_ai.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_chat_stream_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({"message": "Hej"}), content_type="application/json"
        ):
            g.user_id = None
            resp = chat_stream.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_close_chat_session_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({}), content_type="application/json"
        ):
            g.user_id = None
            resp = close_chat_session.__wrapped__.__wrapped__()
        assert resp[1] == 401

    def test_get_chat_history_missing_user_id(self, app):
        with app.test_request_context("/", method="GET"):
            g.user_id = None
            resp = get_chat_history.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_analyze_mood_patterns_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({}), content_type="application/json"
        ):
            g.user_id = None
            resp = analyze_mood_patterns.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_start_exercise_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({"exercise_type": "breathing"}), content_type="application/json"
        ):
            g.user_id = None
            resp = start_exercise.__wrapped__.__wrapped__()
        assert resp[1] == 401

    def test_complete_exercise_missing_user_id(self, app):
        with app.test_request_context("/", method="POST"):
            g.user_id = ""
            resp = complete_exercise.__wrapped__.__wrapped__("", "")
        assert resp[1] == 401

    def test_generate_therapeutic_story_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({}), content_type="application/json"
        ):
            g.user_id = None
            resp = generate_therapeutic_story.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_generate_ai_mood_forecast_missing_user_id(self, app):
        with app.test_request_context(
            "/", method="POST", data=json.dumps({}), content_type="application/json"
        ):
            g.user_id = None
            resp = generate_ai_mood_forecast.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_get_story_history_missing_user_id(self, app):
        with app.test_request_context("/", method="GET"):
            g.user_id = None
            resp = get_story_history.__wrapped__.__wrapped__()
        assert resp[1] == 400

    def test_get_forecast_history_missing_user_id(self, app):
        with app.test_request_context("/", method="GET"):
            g.user_id = None
            resp = get_forecast_history.__wrapped__.__wrapped__()
        assert resp[1] == 400


class TestRemainingCoverage:
    """Target remaining uncovered branches in chatbot_routes and ai_routes."""

    @patch("src.routes.chatbot_routes.db", None)
    def test_chat_with_ai_db_unavailable(self, client):
        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_missing_and_empty_message(self, mock_suggestions, mock_response, mock_db, client):
        _mock_db_chain(mock_db)
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        assert client.post(f"{BASE}/chat", json={}).status_code == 400
        assert client.post(f"{BASE}/chat", json={"message": "   "}).status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_json_parse_error(self, mock_suggestions, mock_response, mock_db, client):
        _mock_db_chain(mock_db)
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        resp = client.post(f"{BASE}/chat", data="not-json", content_type="application/json")
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_user_fetch_exception(self, mock_suggestions, mock_response, mock_db, client):
        _mock_db_chain(mock_db)
        mock_db.collection.return_value.document.return_value.get.side_effect = Exception("boom")
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_quota_exceeded(self, mock_suggestions, mock_response, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.side_effect = SubscriptionLimitError("chat_messages", 10)
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        resp = client.post(f"{BASE}/chat", json={"message": "Hej"})
        assert resp.status_code == 429

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_chat_with_ai_crisis_escalation_success(self, mock_suggestions, mock_response, mock_db, client):
        _mock_db_chain(mock_db)
        mock_response.return_value = {"response": "OK", "crisis_detected": True, "crisis_analysis": {"risk": "high"}, "sentiment_analysis": {"sentiment": "NEGATIVE"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        indicator = Mock()
        indicator.swedish_description = "självskadeanknytning"
        assessment = Mock()
        assessment.overall_risk_level = "high"
        assessment.risk_score = 0.9
        assessment.active_indicators = [indicator]

        future = Mock()
        future.success = True
        future.channels_used = [Mock(value="sms")]
        future.failures = []
        escalation_service = Mock()
        escalation_service.escalate = AsyncMock(return_value=future)

        class FakeThread:
            def __init__(self, target, args=(), kwargs=None, daemon=False, **extra):
                self.target = target
                self.args = args
                self._alive = True

            def start(self):
                self.target(*self.args)
                self._alive = False

            def join(self, timeout=None):
                self._alive = False

            def is_alive(self):
                return self._alive

        with patch("threading.Thread", FakeThread):
            with patch("src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk") as mock_assess:
                mock_assess.return_value = assessment
                with patch("src.services.crisis_escalation.CrisisAlert") as mock_alert, \
                     patch("src.services.crisis_escalation.get_crisis_escalation_service") as mock_esc:
                    mock_alert.return_value = Mock(timestamp=datetime.now(UTC))
                    mock_esc.return_value = escalation_service
                    resp = client.post(f"{BASE}/chat", json={"message": "Jag mår dåligt"})
        assert resp.status_code == 200

    @patch("src.routes.chatbot_routes.db", None)
    def test_chat_stream_db_unavailable(self, client):
        resp = client.post(f"{BASE}/chat/stream", json={"message": "Hej"})
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_missing_and_empty_message(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True
        assert client.post(f"{BASE}/chat/stream", json={}).status_code == 400
        assert client.post(f"{BASE}/chat/stream", json={"message": "   "}).status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.SubscriptionService")
    @patch("src.services.ai_service.ai_services")
    def test_chat_stream_json_parse_error(self, mock_ai, mock_sub, mock_db, client):
        _mock_db_chain(mock_db)
        mock_sub.get_plan_context.return_value = {"limits": {}}
        mock_sub.consume_quota.return_value = True
        resp = client.post(f"{BASE}/chat/stream", data="not-json", content_type="application/json")
        assert resp.status_code == 400

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_legacy_chat_message(self, mock_suggestions, mock_response, mock_db, client):
        _mock_db_chain(mock_db)
        mock_response.return_value = {"response": "OK", "crisis_detected": False, "sentiment_analysis": {"sentiment": "NEUTRAL"}}
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        resp = client.post(f"{BASE}/message", json={"message": "Hej"})
        assert resp.status_code == 200

    @patch("src.services.ai_service.ai_services.analyze_sentiment")
    def test_generate_fallback_response_branches(self, mock_sentiment):
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["sadness", "anger", "fear"]}
        result = generate_fallback_response("Jag är stressad och ledsen")
        assert "stress" in result["response"].lower() or "ledsen" in result["response"].lower()
        result = generate_fallback_response("Jag är arg")
        assert "ilska" in result["response"].lower() or "arg" in result["response"].lower()
        result = generate_fallback_response("Jag är glad")
        assert "glad" in result["response"].lower()
        result = generate_fallback_response("Jag är ledsen")
        assert "Sorg" in result["response"] or "Ilska" in result["response"] or "ångest" in result["response"]

    def test_generate_suggested_actions_branches(self):
        result = generate_suggested_actions({"sentiment": "NEGATIVE", "emotions": ["sadness", "anger", "fear"]})
        assert len(result) == 3
        assert any("andetag" in r.lower() for r in result)
        result = generate_suggested_actions({"sentiment": "POSITIVE", "emotions": []})
        assert any("Fira" in r for r in result)

    def test_generate_ai_feature_suggestions_keywords(self):
        result = generate_ai_feature_suggestions("Jag vill ha en berättelse", [], {"sentiment_analysis": {"sentiment": "NEUTRAL"}})
        assert "berättelser" in result["story_reason"].lower()
        result = generate_ai_feature_suggestions("Vad händer i framtiden?", [], {"sentiment_analysis": {"sentiment": "NEUTRAL"}})
        assert "humörtrender" in result["forecast_reason"].lower()

    @patch("src.routes.chatbot_routes.get_chat_rag_service")
    @patch("src.routes.chatbot_routes.get_framework_detector")
    @patch("src.services.ai_service.ai_services.generate_therapeutic_conversation")
    def test_generate_enhanced_user_profile_exception(self, mock_generate, mock_detector, mock_rag):
        mock_db = Mock()
        mock_db.collection.return_value.document.return_value.get.side_effect = Exception("boom")
        with patch("src.firebase_config.db", mock_db):
            mock_rag.return_value.retrieve_context.return_value = []
            mock_generate.return_value = {"response": "OK", "sentiment_analysis": {"sentiment": "NEUTRAL"}}
            with patch("src.routes.chatbot_routes.RAG_AVAILABLE", False):
                with patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False):
                    with patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", False):
                        result = generate_enhanced_therapeutic_response("Hej", [], user_id="test")
        assert result["response"] == "OK"

    @patch("src.routes.chatbot_routes.db", None)
    def test_exercise_db_unavailable(self, client):
        assert client.post(f"{BASE}/exercise", json={"exercise_type": "breathing"}).status_code == 503
        assert client.post(f"{BASE}/exercise/testuser1234567890ab/ex-1/complete").status_code == 503

    @patch("src.firebase_config.db")
    @patch("src.services.ai_service.ai_services.analyze_mood_patterns")
    def test_analyze_patterns_analysis_exception(self, mock_analysis, mock_db, client):
        _mock_db_chain(mock_db)
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"sentiment": "POSITIVE", "score": 8, "timestamp": "2025-01-01T00:00:00+00:00", "note": ""}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        mock_analysis.side_effect = Exception("analysis fail")
        resp = client.post(f"{BASE}/analyze-patterns")
        assert resp.status_code == 200
        assert resp.get_json()["data"]["patternAnalysis"]["confidence"] == 0.0

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False)
    def test_framework_analysis_unavailable(self, client):
        resp = client.get(f"{BASE}/analysis/framework")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.PROGRESS_AVAILABLE", False)
    def test_progress_analysis_unavailable(self, client):
        resp = client.get(f"{BASE}/analysis/progress")
        assert resp.status_code == 503

    @patch("src.routes.chatbot_routes.FRAMEWORK_AVAILABLE", False)
    def test_quality_metrics_unavailable(self, client):
        resp = client.get(f"{BASE}/analysis/quality")
        assert resp.status_code == 503

    @patch("src.routes.ai_routes.db", None)
    def test_generate_therapeutic_story_db_unavailable(self, client):
        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 503

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_generate_therapeutic_story_locale_and_mood_history(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.generate_personalized_therapeutic_story.return_value = {"story": "Hej", "ai_generated": True}

        resp = client.post(f"{AI_BASE}/story", json={"locale": "de"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["locale"] == "sv"

        mock_doc = Mock()
        mock_doc.to_dict.return_value = {"sentiment": "POSITIVE", "score": 8, "timestamp": "2025-01-01T00:00:00+00:00", "note": "note", "emotions_detected": ["joy"]}
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 200

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_generate_therapeutic_story_generation_exception(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.generate_personalized_therapeutic_story.side_effect = Exception("story fail")
        mock_ai._fallback_therapeutic_story.return_value = {"story": "Fallback", "ai_generated": False}
        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 200

    @patch("src.routes.ai_routes._check_premium_access")
    def test_generate_therapeutic_story_outer_exception(self, mock_premium, client):
        mock_premium.side_effect = Exception("boom")
        resp = client.post(f"{AI_BASE}/story", json={})
        assert resp.status_code == 500

    @patch("src.routes.ai_routes.db", None)
    def test_generate_ai_mood_forecast_db_unavailable(self, client):
        resp = client.post(f"{AI_BASE}/forecast", json={})
        assert resp.status_code == 503

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_generate_ai_mood_forecast_sklearn_exception(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.predictive_mood_analytics.return_value = {"forecast": {"trend": "stable"}, "confidence": 0.5, "model_info": {"algorithm": "test"}, "risk_factors": [], "recommendations": [], "current_analysis": {}}
        mock_ai.predictive_mood_forecasting_sklearn.side_effect = Exception("ml fail")
        resp = client.post(f"{AI_BASE}/forecast", json={"days_ahead": 7, "use_sklearn": True})
        assert resp.status_code == 200

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_generate_ai_mood_forecast_use_sklearn_false(self, mock_ai, mock_premium, mock_db, client):
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.predictive_mood_analytics.return_value = {"forecast": {"trend": "stable"}, "confidence": 0.5, "model_info": {"algorithm": "test"}, "risk_factors": [], "recommendations": [], "current_analysis": {}}
        resp = client.post(f"{AI_BASE}/forecast", json={"days_ahead": 7, "use_sklearn": False})
        assert resp.status_code == 200

    @patch("src.routes.ai_routes.db", None)
    def test_history_db_unavailable(self, client):
        assert client.get(f"{AI_BASE}/stories").status_code == 503
        assert client.get(f"{AI_BASE}/forecasts").status_code == 503

    @patch("src.routes.ai_routes.db")
    def test_history_exceptions(self, mock_db, client):
        _mock_db_chain(mock_db)
        mock_db.collection.side_effect = Exception("boom")
        assert client.get(f"{AI_BASE}/stories").status_code == 500
        assert client.get(f"{AI_BASE}/forecasts").status_code == 500


class TestFinalBranches:
    """Last remaining branch coverage for 100%."""

    def test_sse_cors_headers_import_fallback(self, app):
        """Cover ImportError fallback in _get_sse_cors_headers (lines 59-64)."""
        import sys
        import types
        fake_main = types.ModuleType("main")
        with patch.dict(sys.modules, {"main": fake_main}):
            with app.test_request_context("/", headers={"Origin": "https://evil.example.com"}):
                result = _get_sse_cors_headers()
        assert result == {}

    @patch("src.routes.chatbot_routes.db")
    @patch("src.routes.chatbot_routes.generate_enhanced_therapeutic_response")
    @patch("src.routes.chatbot_routes.generate_ai_feature_suggestions")
    def test_crisis_escalation_failure_path(self, mock_suggestions, mock_response, mock_db, client):
        """Cover crisis escalation failure branch where result.success is False (lines 332-335)."""
        _mock_db_chain(mock_db)
        mock_response.return_value = {
            "response": "OK",
            "crisis_detected": True,
            "crisis_analysis": {"risk": "high"},
            "sentiment_analysis": {"sentiment": "NEGATIVE"},
        }
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        indicator = Mock()
        indicator.swedish_description = "riskindikator"
        assessment = Mock()
        assessment.overall_risk_level = "high"
        assessment.risk_score = 0.85
        assessment.active_indicators = [indicator]

        future = Mock()
        future.success = False
        future.channels_used = []
        future.failures = [Mock(), Mock()]
        escalation_service = Mock()
        escalation_service.escalate = AsyncMock(return_value=future)

        class FakeThread:
            def __init__(self, target, args=(), kwargs=None, daemon=False, **extra):
                self.target = target
                self.args = args
                self._alive = True

            def start(self):
                self.target(*self.args)
                self._alive = False

            def join(self, timeout=None):
                self._alive = False

            def is_alive(self):
                return self._alive

        with patch("threading.Thread", FakeThread):
            with patch("src.services.crisis_intervention.crisis_intervention_service.assess_text_crisis_risk") as mock_assess:
                mock_assess.return_value = assessment
                with patch("src.services.crisis_escalation.CrisisAlert") as mock_alert, \
                     patch("src.services.crisis_escalation.get_crisis_escalation_service") as mock_esc:
                    mock_alert.return_value = Mock(timestamp=datetime.now(UTC))
                    mock_esc.return_value = escalation_service
                    with patch("time.sleep"):
                        resp = client.post(f"{BASE}/chat", json={"message": "Jag mår dåligt"})
        assert resp.status_code == 200

    def test_ai_get_db_exception_handler(self):
        """Cover _get_db() exception handler in ai_routes (lines 23-25)."""
        import src.routes.ai_routes as mod
        original = mod.__dict__["db"]
        del mod.__dict__["db"]
        try:
            result = ai_get_db()
            assert result is None
        finally:
            mod.__dict__["db"] = original

    @patch("src.routes.ai_routes.db")
    @patch("src.routes.ai_routes._check_premium_access")
    @patch("src.services.ai_service.ai_services")
    def test_forecast_mood_history_loop(self, mock_ai, mock_premium, mock_db, client):
        """Cover mood history loop body in generate_ai_mood_forecast (lines 234-235)."""
        mock_premium.return_value = None
        _mock_db_chain(mock_db)
        mock_ai.predictive_mood_forecasting_sklearn.return_value = {
            "forecast": {"trend": "stable"},
            "confidence": 0.5,
            "model_info": {"algorithm": "test"},
            "risk_factors": [],
            "recommendations": [],
            "current_analysis": {},
        }
        mock_doc = Mock()
        mock_doc.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 8,
            "timestamp": "2025-01-01T00:00:00+00:00",
            "note": "bra dag",
            "emotions_detected": ["joy"],
        }
        mock_sub = mock_db.collection.return_value.document.return_value.collection.return_value
        mock_sub.order_by.return_value.limit.return_value.stream.return_value = [mock_doc]
        resp = client.post(f"{AI_BASE}/forecast", json={"days_ahead": 7})
        assert resp.status_code == 200
