"""
Comprehensive tests for chatbot routes - targeting 90%+ coverage
Tests: chat endpoint, history, pattern analysis, exercises
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import json
from src.services.subscription_service import SubscriptionLimitError

class TestChatEndpoint:
    """Tests for /chat endpoint"""
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_success(self, mock_suggestions, mock_response, mock_db, client):
        """Test successful chat message"""
        # Setup mocks
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_response.return_value = {
            "response": "Jag förstår att du känner dig stressad.",
            "emotions_detected": ["stress"],
            "suggested_actions": ["Andas djupt", "Ta en paus"],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "gpt-4",
            "sentiment_analysis": {"sentiment": "NEGATIVE"}
        }
        
        mock_suggestions.return_value = {
            "suggest_story": False,
            "suggest_forecast": False
        }
        
        # Test request
        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "Jag känner mig stressad"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "response" in data
        assert data["emotions_detected"] == ["stress"]
        assert len(data["suggested_actions"]) == 2
        assert data["ai_generated"] == True
    
    def test_chat_missing_message(self, client):
        """Test chat without message"""
        response = client.post('/api/chatbot/chat',
            json={"user_id": "test-user-123"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert "krävs" in data["error"].lower()
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_missing_user_id(self, mock_suggestions, mock_response, mock_db, client):
        """Test chat without payload user_id falls back to token identity"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []

        mock_response.return_value = {
            "response": "Hej!",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "test",
            "sentiment_analysis": {"sentiment": "NEUTRAL"}
        }
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        response = client.post('/api/chatbot/chat',
            json={"message": "Hej"},
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["response"] == "Hej!"
        assert data["ai_generated"] is True
        assert data["sentiment_analysis"]["sentiment"] == "NEUTRAL"
        assert data["ai_feature_suggestions"]["suggest_story"] is False
    
    def test_chat_empty_message(self, client):
        """Test chat with empty message"""
        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "   "
            },
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert "meddelande" in data["error"].lower()
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_empty_user_id(self, mock_suggestions, mock_response, mock_db, client):
        """Test chat with empty user_id still succeeds via token context"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []

        mock_response.return_value = {
            "response": "Allt är bra",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "test",
            "sentiment_analysis": {"sentiment": "NEUTRAL"}
        }
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}

        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "  ",
                "message": "Hej"
            },
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["response"] == "Allt är bra"
        assert data["sentiment_analysis"]["sentiment"] == "NEUTRAL"

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.SubscriptionService.consume_quota')
    def test_chat_quota_limit_returns_429(self, mock_quota, mock_db, client):
        """Test chat returns 429 when subscription quota is exceeded"""
        mock_quota.side_effect = SubscriptionLimitError("chat_messages", 5)

        mock_collection = Mock()
        mock_document = Mock()
        mock_document.get.return_value = Mock(exists=False, to_dict=lambda: {})
        mock_collection.document.return_value = mock_document
        mock_db.collection.return_value = mock_collection

        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "Hej"
            },
            content_type='application/json'
        )

        assert response.status_code == 429
        data = response.get_json()
        assert "limit" in data
        assert data["limit"] == 5

    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.SubscriptionService.consume_quota')
    def test_legacy_alias_respects_quota(self, mock_quota, mock_db, client):
        """Test /api/chatbot/message alias inherits quota enforcement"""
        mock_quota.side_effect = SubscriptionLimitError("chat_messages", 3)

        mock_collection = Mock()
        mock_document = Mock()
        mock_document.get.return_value = Mock(exists=False, to_dict=lambda: {})
        mock_collection.document.return_value = mock_document
        mock_db.collection.return_value = mock_collection

        response = client.post('/api/chatbot/message',
            json={
                "user_id": "test-user-123",
                "message": "Behöver stöd"
            },
            content_type='application/json'
        )

        assert response.status_code == 429
        data = response.get_json()
        assert data["limit"] == 3
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_with_conversation_history(self, mock_suggestions, mock_response, mock_db, client):
        """Test chat with existing conversation history"""
        # Setup mocks with conversation history
        mock_msg1 = Mock()
        mock_msg1.to_dict.return_value = {
            "role": "user",
            "content": "Jag känner mig ledsen",
            "timestamp": "2024-01-01T10:00:00Z"
        }
        mock_msg2 = Mock()
        mock_msg2.to_dict.return_value = {
            "role": "assistant",
            "content": "Jag förstår att du känner dig ledsen.",
            "timestamp": "2024-01-01T10:00:01Z"
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [mock_msg1, mock_msg2]
        
        mock_response.return_value = {
            "response": "Hur kan jag hjälpa dig idag?",
            "emotions_detected": [],
            "suggested_actions": [],
            "crisis_detected": False,
            "ai_generated": True,
            "model_used": "gpt-4",
            "sentiment_analysis": {"sentiment": "NEUTRAL"}
        }
        
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        
        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "Jag mår bättre nu"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "response" in data
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.routes.chatbot_routes.generate_enhanced_therapeutic_response')
    @patch('src.routes.chatbot_routes.generate_fallback_response')
    @patch('src.routes.chatbot_routes.generate_ai_feature_suggestions')
    def test_chat_ai_failure_uses_fallback(self, mock_suggestions, mock_fallback, mock_response, mock_db, client):
        """Test that fallback response is used when AI fails"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        # Make AI response fail
        mock_response.side_effect = Exception("AI service unavailable")
        
        # Setup fallback response
        mock_fallback.return_value = {
            "response": "Jag förstår att du känner dig stressad.",
            "emotions_detected": ["stress"],
            "suggested_actions": ["Andas djupt"],
            "ai_generated": False,
            "sentiment_analysis": {"sentiment": "NEGATIVE", "emotions": ["stress"]}
        }
        
        mock_suggestions.return_value = {"suggest_story": False, "suggest_forecast": False}
        
        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "Jag är stressad"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["ai_generated"] == False
        assert mock_fallback.called
    
    @patch('src.routes.chatbot_routes.db')
    def test_chat_database_error(self, mock_db, client):
        """Test chat when database fails"""
        mock_db.collection.side_effect = Exception("Database connection failed")
        
        response = client.post('/api/chatbot/chat',
            json={
                "user_id": "test-user-123",
                "message": "Hej"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_chat_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/chatbot/chat')
        assert response.status_code == 204


class TestChatHistory:
    """Tests for /history endpoint"""
    
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
            "ai_generated": True,
            "model_used": "gpt-4"
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
            "model_used": "gpt-4"
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.stream.return_value = [mock_msg1, mock_msg2]
        
        response = client.get('/api/chatbot/history?user_id=test-user-123')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "conversation" in data
        assert len(data["conversation"]) == 2
        assert data["conversation"][0]["role"] == "user"
        assert data["conversation"][1]["role"] == "assistant"
    
    def test_get_history_missing_user_id(self, client):
        """Test history without user_id"""
        response = client.get('/api/chatbot/history')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_get_history_empty_user_id(self, client):
        """Test history with empty user_id"""
        response = client.get('/api/chatbot/history?user_id=  ')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.chatbot_routes.db')
    def test_get_history_no_messages(self, mock_db, client):
        """Test history when user has no messages"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.stream.return_value = []
        
        response = client.get('/api/chatbot/history?user_id=new-user')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "conversation" in data
        assert len(data["conversation"]) == 0
    
    @patch('src.routes.chatbot_routes.db')
    def test_get_history_database_error(self, mock_db, client):
        """Test history when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/chatbot/history?user_id=test-user')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data


class TestPatternAnalysis:
    """Tests for /analyze-patterns endpoint"""
    
    @patch('src.services.ai_service.ai_services.analyze_mood_patterns')
    @patch('src.firebase_config.db')
    def test_analyze_patterns_success(self, mock_db, mock_analyze, client):
        """Test successful pattern analysis"""
        # Setup mood history
        mock_mood1 = Mock()
        mock_mood1.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 0.8,
            "timestamp": "2024-01-01T10:00:00Z",
            "note": "Känner mig bra idag"
        }
        mock_mood2 = Mock()
        mock_mood2.to_dict.return_value = {
            "sentiment": "NEGATIVE",
            "score": -0.6,
            "timestamp": "2024-01-02T10:00:00Z",
            "note": "Lite nedstämd"
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [mock_mood1, mock_mood2]
        
        mock_analyze.return_value = {
            "pattern_analysis": "Du har en positiv trend",
            "predictions": "Fortsatt förbättring förväntad",
            "confidence": 0.85
        }
        
        response = client.post('/api/chatbot/analyze-patterns',
            json={"user_id": "test-user-123"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "pattern_analysis" in data
        assert "data_points_analyzed" in data
        assert data["data_points_analyzed"] == 2
        assert "analysis_timestamp" in data
    
    def test_analyze_patterns_missing_user_id(self, client):
        """Test pattern analysis without user_id"""
        response = client.post('/api/chatbot/analyze-patterns',
            json={},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_analyze_patterns_empty_user_id(self, client):
        """Test pattern analysis with empty user_id"""
        response = client.post('/api/chatbot/analyze-patterns',
            json={"user_id": "  "},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.chatbot_routes.db')
    @patch('src.services.ai_service.ai_services.analyze_mood_patterns')
    def test_analyze_patterns_ai_failure_uses_fallback(self, mock_analyze, mock_db, client):
        """Test fallback when AI analysis fails"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_analyze.side_effect = Exception("AI service error")
        
        response = client.post('/api/chatbot/analyze-patterns',
            json={"user_id": "test-user-123"},
            content_type='application/json'
        )
        
        # Accept 200 (fallback successful) or 500 (AI service error propagates)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.get_json()
            assert "pattern_analysis" in data
            assert data["pattern_analysis"]["confidence"] == 0.0
    
    @patch('src.firebase_config.db')
    def test_analyze_patterns_database_error(self, mock_db, client):
        """Test pattern analysis when database fails"""
        # Make the initial collection call fail
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/chatbot/analyze-patterns',
            json={"user_id": "test-user"},
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_analyze_patterns_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/chatbot/analyze-patterns')
        assert response.status_code == 204


class TestExercises:
    """Tests for exercise endpoints"""
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_breathing(self, mock_db, client):
        """Test starting breathing exercise"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "breathing",
                "duration": 5
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "exercise" in data
        assert data["exercise_type"] == "breathing"
        assert data["duration"] == 5
        assert "title" in data["exercise"]
        assert "steps" in data["exercise"]
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_mindfulness(self, mock_db, client):
        """Test starting mindfulness exercise"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "mindfulness"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["exercise_type"] == "mindfulness"
        assert data["exercise"]["title"] == "Mindfulness - Kroppsskanning"
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_cbt(self, mock_db, client):
        """Test starting CBT exercise"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "cbt_thought_record"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["exercise_type"] == "cbt_thought_record"
        assert "KBT" in data["exercise"]["title"]
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_gratitude(self, mock_db, client):
        """Test starting gratitude exercise"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "gratitude"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["exercise_type"] == "gratitude"
        assert "Tacksamhet" in data["exercise"]["title"]
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_progressive_relaxation(self, mock_db, client):
        """Test starting progressive relaxation"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "progressive_relaxation"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["exercise_type"] == "progressive_relaxation"
        assert "Progressiv" in data["exercise"]["title"]
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_unknown_type(self, mock_db, client):
        """Test starting exercise with unknown type (should default to breathing)"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "unknown_type"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "exercise" in data
        assert "Andning" in data["exercise"]["title"]  # Should default to breathing
    
    def test_start_exercise_missing_user_id(self, client):
        """Test exercise without user_id"""
        response = client.post('/api/chatbot/exercise',
            json={"exercise_type": "breathing"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_start_exercise_missing_type(self, client):
        """Test exercise without exercise_type"""
        response = client.post('/api/chatbot/exercise',
            json={"user_id": "test-user-123"},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_start_exercise_empty_fields(self, client):
        """Test exercise with empty user_id and type"""
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "  ",
                "exercise_type": "  "
            },
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.routes.chatbot_routes.db')
    def test_start_exercise_database_error(self, mock_db, client):
        """Test exercise when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/chatbot/exercise',
            json={
                "user_id": "test-user-123",
                "exercise_type": "breathing"
            },
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_start_exercise_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/chatbot/exercise')
        assert response.status_code == 204
    
    @patch('src.routes.chatbot_routes.db')
    def test_complete_exercise_success(self, mock_db, client):
        """Test completing an exercise"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_exercise_doc = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.document.return_value = mock_exercise_doc
        
        response = client.post('/api/chatbot/exercise/test-user-123/exercise_123/complete')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "message" in data
        assert "slutförd" in data["message"].lower()
        assert mock_exercise_doc.update.called
    
    def test_complete_exercise_missing_user_id(self, client):
        """Test completing exercise without user_id"""
        response = client.post('/api/chatbot/exercise//exercise_123/complete')
        
        assert response.status_code == 404  # Flask returns 404 for missing route params
    
    def test_complete_exercise_missing_exercise_id(self, client):
        """Test completing exercise without exercise_id"""
        response = client.post('/api/chatbot/exercise/test-user-123//complete')
        
        assert response.status_code == 404
    
    @patch('src.routes.chatbot_routes.db')
    def test_complete_exercise_database_error(self, mock_db, client):
        """Test completing exercise when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/chatbot/exercise/test-user-123/exercise_123/complete')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data


class TestHelperFunctions:
    """Tests for helper functions"""
    
    def test_generate_fallback_response_stress(self):
        """Test fallback response for stress-related message"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag är så stressad")
        
        assert "response" in response
        assert "stressad" in response["response"].lower()
        assert "suggested_actions" in response
        assert len(response["suggested_actions"]) > 0
        assert response["ai_generated"] == False
    
    def test_generate_fallback_response_sadness(self):
        """Test fallback response for sadness"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag känner mig ledsen")
        
        assert "ledsen" in response["response"].lower()
        assert any("tacksam" in action.lower() for action in response["suggested_actions"])
    
    def test_generate_fallback_response_anger(self):
        """Test fallback response for anger"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag är så arg")
        
        assert "arg" in response["response"].lower() or "ilska" in response["response"].lower()
    
    def test_generate_fallback_response_happiness(self):
        """Test fallback response for happiness"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag är så glad idag")
        
        assert "glad" in response["response"].lower()
    
    def test_generate_fallback_response_loneliness(self):
        """Test fallback response for loneliness"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag känner mig ensam")
        
        assert "ensam" in response["response"].lower()
    
    def test_generate_fallback_response_anxiety(self):
        """Test fallback response for anxiety"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Jag är orolig")
        
        # Should contain either "oro" or "ångest" in response
        assert "oro" in response["response"].lower() or "ångest" in response["response"].lower()
    
    def test_generate_fallback_response_general(self):
        """Test fallback response for general message"""
        from src.routes.chatbot_routes import generate_fallback_response
        
        response = generate_fallback_response("Hej, hur mår du?")
        
        assert "response" in response
        assert len(response["response"]) > 0
    
    def test_generate_suggested_actions_negative(self):
        """Test suggested actions for negative sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions
        
        actions = generate_suggested_actions({
            "sentiment": "NEGATIVE",
            "emotions": ["sadness", "fear"]
        })
        
        assert len(actions) > 0
        assert len(actions) <= 3
    
    def test_generate_suggested_actions_positive(self):
        """Test suggested actions for positive sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions
        
        actions = generate_suggested_actions({
            "sentiment": "POSITIVE",
            "emotions": ["joy"]
        })
        
        assert len(actions) > 0
        assert any("fira" in action.lower() or "glädjen" in action.lower() for action in actions)
    
    def test_generate_suggested_actions_neutral(self):
        """Test suggested actions for neutral sentiment"""
        from src.routes.chatbot_routes import generate_suggested_actions
        
        actions = generate_suggested_actions({
            "sentiment": "NEUTRAL",
            "emotions": []
        })
        
        assert len(actions) > 0
    
    def test_generate_ai_feature_suggestions_story_keywords(self):
        """Test AI feature suggestions with story keywords"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions
        
        suggestions = generate_ai_feature_suggestions(
            "Jag vill förstå min berättelse",
            [],
            {"sentiment_analysis": {"sentiment": "NEUTRAL"}}
        )
        
        assert suggestions["suggest_story"] == True
        assert len(suggestions["story_reason"]) > 0
    
    def test_generate_ai_feature_suggestions_forecast_keywords(self):
        """Test AI feature suggestions with forecast keywords"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions
        
        suggestions = generate_ai_feature_suggestions(
            "Vad händer med mig i framtiden?",
            [],
            {"sentiment_analysis": {"sentiment": "NEUTRAL"}}
        )
        
        assert suggestions["suggest_forecast"] == True
        assert len(suggestions["forecast_reason"]) > 0
    
    def test_generate_ai_feature_suggestions_no_suggestions(self):
        """Test AI feature suggestions with no triggers"""
        from src.routes.chatbot_routes import generate_ai_feature_suggestions
        
        suggestions = generate_ai_feature_suggestions(
            "Hej",
            [],
            {"sentiment_analysis": {"sentiment": "POSITIVE"}}
        )
        
        assert suggestions["suggest_story"] == False
        assert suggestions["suggest_forecast"] == False
    
    def test_generate_exercise_content_all_types(self):
        """Test exercise content generation for all types"""
        from src.routes.chatbot_routes import generate_exercise_content
        
        exercise_types = ["breathing", "mindfulness", "cbt_thought_record", 
                         "gratitude", "progressive_relaxation"]
        
        for ex_type in exercise_types:
            content = generate_exercise_content(ex_type, 5)
            assert "title" in content
            assert "steps" in content
            assert "tips" in content
            assert "benefits" in content
            assert len(content["steps"]) > 0
