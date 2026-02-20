"""
Comprehensive tests for chatbot routes - targeting 90%+ coverage
Tests: chat endpoint, history, pattern analysis, exercises

URL prefix: /api/v1/chatbot (registered in main.py)
Auth: @AuthService.jwt_required sets g.user_id = 'testuser1234567890ab' via conftest
Response envelope:
  Success: {"success": true, "data": {...}, "message": "..."}
  Error:   {"success": false, "error": "ERROR_CODE", "message": "...", "details": ...}
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import json
from src.services.subscription_service import SubscriptionLimitError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
BASE = "/api/v1/chatbot"


def _mock_db_chain(mock_db):
    """Set up the standard db mock chain used by most chat/exercise routes."""
    mock_collection = Mock()
    mock_document = Mock()
    mock_subcollection = Mock()
    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_document
    # user doc lookup for subscription check
    mock_document.get.return_value = Mock(exists=False, to_dict=lambda: {})
    mock_document.collection.return_value = mock_subcollection
    mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
    mock_subcollection.order_by.return_value.stream.return_value = []
    return mock_collection, mock_document, mock_subcollection


class TestChatEndpoint:
    """Tests for POST /api/v1/chatbot/chat"""

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_success(self, mock_suggestions, mock_response, mock_db, client):
        """Test successful chat message"""
        _mock_db_chain(mock_db)

        mock_response.return_value = {
            "response": "Jag förstår att du känner dig stressad.",
            "emotions_detected": ["stress"],
            "suggested_actions": ["Andas djupt", "Ta en paus"],
            "crisis_detected": False,
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

        response = client.post(
            f"{BASE}/chat",
            json={"message": "Jag känner mig stressad"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["response"] == "Jag förstår att du känner dig stressad."
        assert data["data"]["emotionsDetected"] == ["stress"]
        assert len(data["data"]["suggestedActions"]) == 2
        assert data["data"]["aiGenerated"] is True
        assert data["data"]["modelUsed"] == "gpt-4"
        assert data["data"]["crisisDetected"] is False

    def test_chat_missing_message(self, client):
        """Test chat without message field"""
        response = client.post(f"{BASE}/chat", json={"some_key": "value"})

        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert data["error"] == "BAD_REQUEST"
        assert "Message required" in data["message"]

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_no_payload_user_id_falls_back_to_token(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        """Test chat without payload user_id falls back to token identity (g.user_id)"""
        _mock_db_chain(mock_db)

        mock_response.return_value = {
            "response": "Hej!",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "test",
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        response = client.post(f"{BASE}/chat", json={"message": "Hej"})

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["response"] == "Hej!"
        assert data["data"]["aiGenerated"] is True
        assert data["data"]["sentimentAnalysis"]["sentiment"] == "NEUTRAL"
        assert data["data"]["aiFeatureSuggestions"]["suggestStory"] is False

    def test_chat_empty_message(self, client):
        """Test chat with whitespace-only message"""
        response = client.post(f"{BASE}/chat", json={"message": "   "})

        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert data["error"] == "BAD_REQUEST"
        assert "Message required" in data["message"]

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_empty_payload_user_id_uses_token(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        """Test chat with empty user_id in body still succeeds via token context"""
        _mock_db_chain(mock_db)

        mock_response.return_value = {
            "response": "Allt är bra",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "test",
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        response = client.post(
            f"{BASE}/chat",
            json={"user_id": "  ", "message": "Hej"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["response"] == "Allt är bra"
        assert data["data"]["sentimentAnalysis"]["sentiment"] == "NEUTRAL"

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.SubscriptionService.consume_quota')
    def test_chat_quota_limit_returns_429(self, mock_quota, mock_db, client):
        """Test chat returns 429 when subscription quota is exceeded"""
        _mock_db_chain(mock_db)
        mock_quota.side_effect = SubscriptionLimitError("chat_messages", 5)

        response = client.post(
            f"{BASE}/chat",
            json={"message": "Hej"},
        )

        assert response.status_code == 429
        data = response.get_json()
        assert data["success"] is False
        assert data["error"] == "RATE_LIMITED"
        assert data["details"]["limit"] == 5

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.SubscriptionService.consume_quota')
    def test_legacy_alias_respects_quota(self, mock_quota, mock_db, client):
        """Test /message alias inherits quota enforcement"""
        _mock_db_chain(mock_db)
        mock_quota.side_effect = SubscriptionLimitError("chat_messages", 3)

        response = client.post(
            f"{BASE}/message",
            json={"message": "Behöver stöd"},
        )

        assert response.status_code == 429
        data = response.get_json()
        assert data["details"]["limit"] == 3

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_with_conversation_history(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        """Test chat with existing conversation history"""
        mock_msg1 = Mock()
        mock_msg1.to_dict.return_value = {
            "role": "user",
            "content": "Jag känner mig ledsen",
            "timestamp": "2024-01-01T10:00:00Z",
        }
        mock_msg2 = Mock()
        mock_msg2.to_dict.return_value = {
            "role": "assistant",
            "content": "Jag förstår att du känner dig ledsen.",
            "timestamp": "2024-01-01T10:00:01Z",
        }

        mock_collection, mock_document, mock_subcollection = _mock_db_chain(mock_db)
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [
            mock_msg1,
            mock_msg2,
        ]

        mock_response.return_value = {
            "response": "Hur kan jag hjälpa dig idag?",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "gpt-4",
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        response = client.post(
            f"{BASE}/chat",
            json={"message": "Jag mår bättre nu"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["response"] == "Hur kan jag hjälpa dig idag?"

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_fallback_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_ai_failure_uses_fallback(
        self, mock_suggestions, mock_fallback, mock_response, mock_db, client
    ):
        """Test that fallback response is used when AI fails"""
        _mock_db_chain(mock_db)

        mock_response.side_effect = Exception("AI service unavailable")

        mock_fallback.return_value = {
            "response": "Jag förstår att du känner dig stressad.",
            "emotions_detected": ["stress"],
            "suggested_actions": ["Andas djupt"],
            "ai_generated": False,
            "sentiment_analysis": {"sentiment": "NEGATIVE", "emotions": ["stress"]},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        response = client.post(
            f"{BASE}/chat",
            json={"message": "Jag är stressad"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["aiGenerated"] is False
        assert mock_fallback.called

    @patch('src.routes.chatbot_routes.db')
    def test_chat_database_error(self, mock_db, client):
        """Test chat when database fails on conversation retrieval"""
        mock_db.collection.side_effect = Exception("Database connection failed")

        response = client.post(
            f"{BASE}/chat",
            json={"message": "Hej"},
        )

        assert response.status_code == 500
        data = response.get_json()
        assert data["success"] is False
        assert "error" in data

    @patch('src.routes.chatbot_routes.db', None)
    def test_chat_db_none_returns_503(self, client):
        """Test chat when db is None (service unavailable)"""
        response = client.post(
            f"{BASE}/chat",
            json={"message": "Hej"},
        )

        assert response.status_code == 503
        data = response.get_json()
        assert data["error"] == "SERVICE_UNAVAILABLE"

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_crisis_detected_triggers_audit(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        """Test that crisis detection triggers audit log"""
        _mock_db_chain(mock_db)

        mock_response.return_value = {
            "response": "Jag märker att du har det svårt.",
            "emotions_detected": ["distress"],
            "suggested_actions": ["Ring 112"],
            "crisis_detected": True,
            "crisis_analysis": {"severity": "high"},
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

        with patch('src.routes.chatbot_routes.audit_log') as mock_audit:
            response = client.post(
                f"{BASE}/chat",
                json={"message": "Jag vill inte leva längre"},
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["crisisDetected"] is True
        mock_audit.assert_called_once()

    def test_chat_options_request(self, client):
        """Test OPTIONS request for CORS preflight"""
        response = client.options(f"{BASE}/chat")
        assert response.status_code == 204


class TestLegacyMessageEndpoint:
    """Tests for POST /api/v1/chatbot/message (legacy alias)"""

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_legacy_message_success(
        self, mock_suggestions, mock_response, mock_db, client
    ):
        """Test legacy /message endpoint works like /chat"""
        _mock_db_chain(mock_db)

        mock_response.return_value = {
            "response": "Hej!",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "gpt-4",
            "sentiment_analysis": {"sentiment": "NEUTRAL"},
        }
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False,
            "story_reason": "",
            "forecast_reason": "",
        }

        response = client.post(f"{BASE}/message", json={"message": "Hej"})

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["response"] == "Hej!"

    def test_legacy_message_options(self, client):
        """Test OPTIONS for legacy /message endpoint"""
        response = client.options(f"{BASE}/message")
        assert response.status_code == 204


class TestChatHistory:
    """Tests for GET /api/v1/chatbot/history

    Note: user_id is read exclusively from g.user_id (set by jwt_required).
    There is no query param or body user_id - conftest provides 'testuser1234567890ab'.
    """

    @patch('src.routes.chatbot_routes.db')
    def test_get_history_success(self, mock_db, client):
        """Test successful history retrieval"""
        mock_msg1 = Mock()
        mock_msg1.to_dict.return_value = {
            "role": "user",
            "content": "Hej",
            "timestamp": "2024-01-01T10:00:00Z",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": False,
            "model_used": "unknown",
        }
        mock_msg2 = Mock()
        mock_msg2.to_dict.return_value = {
            "role": "assistant",
            "content": "Hej! Hur kan jag hjälpa dig?",
            "timestamp": "2024-01-01T10:00:01Z",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "gpt-4",
        }

        _, mock_document, mock_subcollection = _mock_db_chain(mock_db)
        mock_subcollection.order_by.return_value.stream.return_value = [
            mock_msg1,
            mock_msg2,
        ]

        response = client.get(f"{BASE}/history")

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        conv = data["data"]["conversation"]
        assert len(conv) == 2
        assert conv[0]["role"] == "user"
        assert conv[1]["role"] == "assistant"
        # Verify camelCase conversion by _to_camel_case_message
        assert "emotionsDetected" in conv[0]
        assert "suggestedActions" in conv[0]
        assert "crisisDetected" in conv[0]
        assert "aiGenerated" in conv[0]

    @patch('src.routes.chatbot_routes.db')
    def test_get_history_no_messages(self, mock_db, client):
        """Test history when user has no messages"""
        _, _, mock_subcollection = _mock_db_chain(mock_db)
        mock_subcollection.order_by.return_value.stream.return_value = []

        response = client.get(f"{BASE}/history")

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["conversation"] == []

    @patch('src.routes.chatbot_routes.db')
    def test_get_history_database_error(self, mock_db, client):
        """Test history when database fails"""
        mock_db.collection.side_effect = Exception("Database error")

        response = client.get(f"{BASE}/history")

        assert response.status_code == 500
        data = response.get_json()
        assert data["success"] is False
        assert "error" in data

    @patch('src.routes.chatbot_routes.db', None)
    def test_get_history_db_none_returns_503(self, client):
        """Test history when db is None"""
        response = client.get(f"{BASE}/history")

        assert response.status_code == 503
        data = response.get_json()
        assert data["error"] == "SERVICE_UNAVAILABLE"

    def test_get_history_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options(f"{BASE}/history")
        assert response.status_code == 204


class TestPatternAnalysis:
    """Tests for POST /api/v1/chatbot/analyze-patterns

    Note: This route does `from src.firebase_config import db` locally
    inside the function, so we use the mock_db fixture from conftest
    (which controls sys.modules['src.firebase_config'].db) instead of
    patching src.routes.chatbot_routes.db.
    """

    def test_analyze_patterns_success(self, mock_db, client):
        """Test successful pattern analysis"""
        # Set up mood docs on the subcollection the route will access
        mock_mood1 = Mock()
        mock_mood1.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 0.8,
            "timestamp": "2024-01-01T10:00:00Z",
            "note": "Känner mig bra idag",
        }
        mock_mood2 = Mock()
        mock_mood2.to_dict.return_value = {
            "sentiment": "NEGATIVE",
            "score": -0.6,
            "timestamp": "2024-01-02T10:00:00Z",
            "note": "Lite nedstämd",
        }

        users_col = mock_db.collection("users")
        user_doc = users_col.document("testuser1234567890ab")
        moods_sub = user_doc.collection("moods")
        moods_sub.order_by.return_value.limit.return_value.stream.return_value = [
            mock_mood1,
            mock_mood2,
        ]

        with patch(
            "src.services.ai_service.ai_services.analyze_mood_patterns"
        ) as mock_analyze:
            mock_analyze.return_value = {
                "pattern_analysis": "Du har en positiv trend",
                "predictions": "Fortsatt förbättring förväntad",
                "confidence": 0.85,
            }
            response = client.post(f"{BASE}/analyze-patterns")

        assert response.status_code == 200
        data = response.get_json()
        assert "patternAnalysis" in data["data"]
        assert data["data"]["dataPointsAnalyzed"] == 2
        assert "analysisTimestamp" in data["data"]

    def test_analyze_patterns_ai_failure_uses_fallback(self, mock_db, client):
        """Test fallback when AI analysis fails"""
        users_col = mock_db.collection("users")
        user_doc = users_col.document("testuser1234567890ab")
        moods_sub = user_doc.collection("moods")
        moods_sub.order_by.return_value.limit.return_value.stream.return_value = []

        with patch(
            "src.services.ai_service.ai_services.analyze_mood_patterns"
        ) as mock_analyze:
            mock_analyze.side_effect = Exception("AI service error")
            response = client.post(f"{BASE}/analyze-patterns")

        assert response.status_code == 200
        data = response.get_json()
        pa = data["data"]["patternAnalysis"]
        assert pa["confidence"] == 0.0

    def test_analyze_patterns_database_error(self, mock_db, client):
        """Test pattern analysis when database fails"""
        mock_db.collection.side_effect = Exception("Database error")

        response = client.post(f"{BASE}/analyze-patterns")

        assert response.status_code == 500
        data = response.get_json()
        assert data["success"] is False
        assert "error" in data

    def test_analyze_patterns_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options(f"{BASE}/analyze-patterns")
        assert response.status_code == 204


class TestExercises:
    """Tests for exercise endpoints under /api/v1/chatbot/exercise"""

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_breathing(self, mock_db, client):
        """Test starting breathing exercise"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing", "duration": 5},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["exerciseType"] == "breathing"
        assert data["data"]["duration"] == 5
        ex = data["data"]["exercise"]
        assert "title" in ex
        assert "steps" in ex
        assert "Andning" in ex["title"]

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_mindfulness(self, mock_db, client):
        """Test starting mindfulness exercise"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "mindfulness"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["exerciseType"] == "mindfulness"
        assert data["data"]["exercise"]["title"] == "Mindfulness - Kroppsskanning"

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_cbt(self, mock_db, client):
        """Test starting CBT exercise"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "cbt_thought_record"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["exerciseType"] == "cbt_thought_record"
        assert "KBT" in data["data"]["exercise"]["title"]

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_gratitude(self, mock_db, client):
        """Test starting gratitude exercise"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "gratitude"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["exerciseType"] == "gratitude"
        assert "Tacksamhet" in data["data"]["exercise"]["title"]

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_progressive_relaxation(self, mock_db, client):
        """Test starting progressive relaxation"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "progressive_relaxation"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["exerciseType"] == "progressive_relaxation"
        assert "Progressiv" in data["data"]["exercise"]["title"]

    def test_start_exercise_invalid_type_returns_400(self, client):
        """Test starting exercise with unknown type returns 400"""
        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "unknown_type"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "Invalid exercise type" in data["message"]

    def test_start_exercise_missing_type(self, client):
        """Test exercise without exercise_type"""
        response = client.post(f"{BASE}/exercise", json={"duration": 5})

        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "Exercise type required" in data["message"]

    def test_start_exercise_empty_type(self, client):
        """Test exercise with empty exercise_type string"""
        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "  "},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "Invalid exercise type" in data["message"]

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_default_duration(self, mock_db, client):
        """Test exercise without duration uses default (5 minutes)"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["duration"] == 5

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_duration_clamped(self, mock_db, client):
        """Test that exercise duration is clamped to 1-60 range"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing", "duration": 999},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["duration"] == 60

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_accepts_camel_case_type(self, mock_db, client):
        """Test that exerciseType (camelCase) is also accepted"""
        _mock_db_chain(mock_db)

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing", "exerciseType": "mindfulness"},
        )

        assert response.status_code == 200
        data = response.get_json()
        # exerciseType takes priority via `data.get("exerciseType") or ...`
        assert data["data"]["exerciseType"] == "mindfulness"

    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_database_error(self, mock_db, client):
        """Test exercise when database fails"""
        mock_db.collection.side_effect = Exception("Database error")

        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing"},
        )

        assert response.status_code == 500
        data = response.get_json()
        assert data["success"] is False

    @patch('src.routes.chatbot_routes.db', None)
    def test_start_exercise_db_none_returns_503(self, client):
        """Test exercise when db is None"""
        response = client.post(
            f"{BASE}/exercise",
            json={"exercise_type": "breathing"},
        )

        assert response.status_code == 503
        data = response.get_json()
        assert data["error"] == "SERVICE_UNAVAILABLE"

    def test_start_exercise_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options(f"{BASE}/exercise")
        assert response.status_code == 204

    # ---- Complete exercise ---------------------------------------------------

    @patch('src.routes.chatbot_routes.db')
    def test_complete_exercise_success(self, mock_db, client):
        """Test completing an exercise (user_id in URL must match g.user_id)"""
        _, mock_document, mock_subcollection = _mock_db_chain(mock_db)
        mock_exercise_doc = Mock()
        mock_subcollection.document.return_value = mock_exercise_doc

        response = client.post(
            f"{BASE}/exercise/testuser1234567890ab/exercise_123/complete"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["message"] == "Exercise marked as completed"
        assert mock_exercise_doc.update.called

    def test_complete_exercise_wrong_user_returns_403(self, client):
        """Test completing exercise for a different user returns 403"""
        response = client.post(
            f"{BASE}/exercise/different-user/exercise_123/complete"
        )

        assert response.status_code == 403
        data = response.get_json()
        assert data["error"] == "FORBIDDEN"

    def test_complete_exercise_missing_segments_returns_404(self, client):
        """Test completing exercise with missing URL segments"""
        response = client.post(f"{BASE}/exercise//exercise_123/complete")
        assert response.status_code == 404

    @patch('src.routes.chatbot_routes.db')
    def test_complete_exercise_database_error(self, mock_db, client):
        """Test completing exercise when database fails"""
        mock_db.collection.side_effect = Exception("Database error")

        response = client.post(
            f"{BASE}/exercise/testuser1234567890ab/exercise_123/complete"
        )

        assert response.status_code == 500
        data = response.get_json()
        assert data["success"] is False

    def test_complete_exercise_options_request(self, client):
        """Test OPTIONS request for complete endpoint"""
        response = client.options(
            f"{BASE}/exercise/testuser1234567890ab/exercise_123/complete"
        )
        assert response.status_code == 204


class TestHelperFunctions:
    """Tests for helper functions (called directly, no HTTP layer)"""

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_stress(self, mock_sentiment):
        """Test fallback response for stress-related message"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["stress"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag är så stressad")

        assert "response" in response
        assert "stressad" in response["response"].lower() or "stress" in response["response"].lower()
        assert "suggested_actions" in response
        assert len(response["suggested_actions"]) > 0
        assert response["ai_generated"] is False

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_sadness(self, mock_sentiment):
        """Test fallback response for sadness"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["sadness"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag känner mig ledsen")

        assert "ledsen" in response["response"].lower()
        assert any("tacksam" in action.lower() for action in response["suggested_actions"])

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_anger(self, mock_sentiment):
        """Test fallback response for anger"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["anger"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag är så arg")

        assert "arg" in response["response"].lower() or "ilska" in response["response"].lower()

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_happiness(self, mock_sentiment):
        """Test fallback response for happiness"""
        mock_sentiment.return_value = {"sentiment": "POSITIVE", "emotions": ["joy"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag är så glad idag")

        assert "glad" in response["response"].lower()

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_loneliness(self, mock_sentiment):
        """Test fallback response for loneliness"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["sadness"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag känner mig ensam")

        assert "ensam" in response["response"].lower()

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_anxiety(self, mock_sentiment):
        """Test fallback response for anxiety"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": ["fear"]}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag är orolig")

        assert "oro" in response["response"].lower() or "ångest" in response["response"].lower()

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_tiredness(self, mock_sentiment):
        """Test fallback response for tiredness"""
        mock_sentiment.return_value = {"sentiment": "NEGATIVE", "emotions": []}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Jag är så trött")

        assert "trött" in response["response"].lower() or "utmattad" in response["response"].lower()

    @patch('src.services.ai_service.ai_services.analyze_sentiment')
    def test_generate_fallback_response_general(self, mock_sentiment):
        """Test fallback response for general message"""
        mock_sentiment.return_value = {"sentiment": "NEUTRAL", "emotions": []}
        from src.routes.chatbot_routes import generate_fallback_response

        response = generate_fallback_response("Hej, hur mår du?")

        assert "response" in response
        assert len(response["response"]) > 0

    def test_generate_suggested_actions_negative(self):
        """Test suggested actions for negative sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions

        actions = generate_suggested_actions({
            "sentiment": "NEGATIVE",
            "emotions": ["sadness", "fear"],
        })

        assert len(actions) > 0
        assert len(actions) <= 3

    def test_generate_suggested_actions_positive(self):
        """Test suggested actions for positive sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions

        actions = generate_suggested_actions({
            "sentiment": "POSITIVE",
            "emotions": ["joy"],
        })

        assert len(actions) > 0
        assert any(
            "fira" in action.lower() or "glädjen" in action.lower()
            for action in actions
        )

    def test_generate_suggested_actions_neutral(self):
        """Test suggested actions for neutral sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions

        actions = generate_suggested_actions({
            "sentiment": "NEUTRAL",
            "emotions": [],
        })

        assert len(actions) > 0

    def test_generate_ai_feature_suggestions_story_keywords(self):
        """Test AI feature suggestions with story keywords"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions

        suggestions = generate_ai_feature_suggestions(
            "Jag vill förstå min berättelse",
            [],
            {"sentiment_analysis": {"sentiment": "NEUTRAL"}},
        )

        assert suggestions["suggest_story"] is True
        assert len(suggestions["story_reason"]) > 0

    def test_generate_ai_feature_suggestions_forecast_keywords(self):
        """Test AI feature suggestions with forecast keywords"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions

        suggestions = generate_ai_feature_suggestions(
            "Vad händer med mig i framtiden?",
            [],
            {"sentiment_analysis": {"sentiment": "NEUTRAL"}},
        )

        assert suggestions["suggest_forecast"] is True
        assert len(suggestions["forecast_reason"]) > 0

    def test_generate_ai_feature_suggestions_no_suggestions(self):
        """Test AI feature suggestions with no triggers"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions

        suggestions = generate_ai_feature_suggestions(
            "Hej",
            [],
            {"sentiment_analysis": {"sentiment": "POSITIVE"}},
        )

        assert suggestions["suggest_story"] is False
        assert suggestions["suggest_forecast"] is False

    def test_generate_exercise_content_all_types(self):
        """Test exercise content generation for all types"""
        from src.routes.chatbot_routes import generate_exercise_content

        exercise_types = [
            "breathing",
            "mindfulness",
            "cbt_thought_record",
            "gratitude",
            "progressive_relaxation",
        ]

        for ex_type in exercise_types:
            content = generate_exercise_content(ex_type, 5)
            assert "title" in content
            assert "steps" in content
            assert "tips" in content
            assert "benefits" in content
            assert "duration_minutes" in content
            assert len(content["steps"]) > 0

    def test_to_camel_case_message(self):
        """Test _to_camel_case_message helper"""
        from src.routes.chatbot_routes import _to_camel_case_message

        msg = {
            "role": "assistant",
            "content": "Hej!",
            "timestamp": "2024-01-01T00:00:00Z",
            "emotions_detected": ["joy"],
            "suggested_actions": ["Fira"],
            "crisis_detected": False,
            "crisis_analysis": {},
            "ai_generated": True,
            "model_used": "gpt-4",
        }

        result = _to_camel_case_message(msg)
        assert result["role"] == "assistant"
        assert result["emotionsDetected"] == ["joy"]
        assert result["suggestedActions"] == ["Fira"]
        assert result["crisisDetected"] is False
        assert result["aiGenerated"] is True
        assert result["modelUsed"] == "gpt-4"

    def test_to_camel_case_exercise(self):
        """Test _to_camel_case_exercise helper"""
        from src.routes.chatbot_routes import _to_camel_case_exercise

        exercise = {
            "title": "Andning",
            "description": "Andas lugnt",
            "duration_minutes": 10,
            "steps": ["Steg 1"],
            "tips": "Andas",
            "benefits": "Lugn",
            "instructions": "Gör så här",
        }

        result = _to_camel_case_exercise(exercise)
        assert result["durationMinutes"] == 10
        assert result["title"] == "Andning"
        assert result["steps"] == ["Steg 1"]

    def test_to_camel_case_ai_suggestions(self):
        """Test _to_camel_case_ai_suggestions helper"""
        from src.routes.chatbot_routes import _to_camel_case_ai_suggestions

        suggestions = {
            "suggest_story": True,
            "suggest_forecast": False,
            "story_reason": "Du verkar intresserad",
            "forecast_reason": "",
        }

        result = _to_camel_case_ai_suggestions(suggestions)
        assert result["suggestStory"] is True
        assert result["suggestForecast"] is False
        assert result["storyReason"] == "Du verkar intresserad"
        assert result["forecastReason"] == ""
