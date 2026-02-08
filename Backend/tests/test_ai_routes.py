"""
Comprehensive tests for AI routes - targeting 90%+ coverage
Tests: therapeutic stories, mood forecasting, history
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import json


class TestTherapeuticStory:
    """Tests for /story endpoint"""
    
    @patch('src.utils.ai_services.ai_services.generate_personalized_therapeutic_story')
    def test_generate_story_success(self, mock_ai, client, mock_db):
        """Test successful story generation"""
        # Mock mood data
        mock_mood = Mock()
        mock_mood.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 0.8,
            "timestamp": "2024-01-01T10:00:00Z",
            "note": "Känner mig bra",
            "emotions_detected": ["joy"]
        }
        
        # Mock database
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [mock_mood]
        
        # Mock AI response
        mock_ai.return_value = {
            "story": "En vacker berättelse om din resa...",
            "mood_summary": {"overall": "positive"},
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "word_count": 250
        }
        
        response = client.post('/api/ai/story',
            json={"user_id": "test123", "locale": "sv"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "story" in data
        assert "En vacker berättelse" in data["story"]
        assert data["ai_generated"] == True
        assert data["confidence"] == 0.9
    
    def test_generate_story_missing_user_id(self, client):
        """Test story without user_id"""
        response = client.post('/api/ai/story',
            json={},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert "krävs" in data["error"].lower()
    
    def test_generate_story_empty_user_id(self, client):
        """Test story with empty user_id"""
        response = client.post('/api/ai/story',
            json={"user_id": "  "},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.utils.ai_services.ai_services.generate_personalized_therapeutic_story')
    @patch('src.utils.ai_services.ai_services._fallback_therapeutic_story')
    def test_generate_story_ai_failure_uses_fallback(self, mock_fallback, mock_ai, client, mock_db):
        """Test fallback when AI fails"""
        mock_mood = Mock()
        mock_mood.to_dict.return_value = {
            "sentiment": "NEUTRAL",
            "score": 0.0,
            "timestamp": "2024-01-01T10:00:00Z",
            "note": "Okej dag",
            "emotions_detected": []
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [mock_mood]
        
        # Make AI fail
        mock_ai.side_effect = Exception("AI service unavailable")
        
        # Setup fallback
        mock_fallback.return_value = {
            "story": "Fallback berättelse...",
            "mood_summary": {},
            "ai_generated": False,
            "model_used": "fallback",
            "confidence": 0.5,
            "word_count": 100
        }
        
        response = client.post('/api/ai/story',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["ai_generated"] == False
        assert data["model_used"] == "fallback"
        assert mock_fallback.called
    
    @patch('src.utils.ai_services.ai_services.generate_personalized_therapeutic_story')
    def test_generate_story_invalid_locale(self, mock_ai, client, mock_db):
        """Test story with invalid locale defaults to Swedish"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_ai.return_value = {
            "story": "Story...",
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.8,
            "word_count": 150
        }
        
        response = client.post('/api/ai/story',
            json={"user_id": "test123", "locale": "invalid_locale"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["locale"] == "sv"  # Should default to Swedish
    
    @patch('src.utils.ai_services.ai_services.generate_personalized_therapeutic_story')
    def test_generate_story_english_locale(self, mock_ai, client, mock_db):
        """Test story generation in English"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_ai.return_value = {
            "story": "A beautiful story...",
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "word_count": 200
        }
        
        response = client.post('/api/ai/story',
            json={"user_id": "test123", "locale": "en"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["locale"] == "en"
    
    
    def test_generate_story_database_error(self, client, mock_db):
        """Test story when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/ai/story',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_generate_story_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/ai/story')
        assert response.status_code == 204


class TestMoodForecast:
    """Tests for /forecast endpoint"""
    
    @patch('src.utils.ai_services.ai_services.predictive_mood_forecasting_sklearn')
    def test_forecast_sklearn_success(self, mock_ai, client, mock_db):
        """Test successful sklearn-based forecast"""
        mock_mood = Mock()
        mock_mood.to_dict.return_value = {
            "sentiment": "POSITIVE",
            "score": 0.7,
            "timestamp": "2024-01-01T10:00:00Z",
            "note": "Bra dag",
            "emotions_detected": ["joy"]
        }
        
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = [mock_mood] * 20
        
        mock_ai.return_value = {
            "forecast": {
                "trend": "improving",
                "average_forecast": 0.75,
                "predictions": [0.7, 0.72, 0.75, 0.77, 0.78, 0.79, 0.8]
            },
            "model_info": {
                "algorithm": "LinearRegression",
                "features_used": 5
            },
            "current_analysis": {"sentiment": "positive"},
            "risk_factors": [],
            "recommendations": ["Fortsätt med positiva aktiviteter"],
            "confidence": 0.85
        }
        
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "days_ahead": 7, "use_sklearn": True},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "forecast" in data
        assert data["forecast"]["trend"] == "improving"
        assert data["confidence"] == 0.85
        assert data["forecast_period_days"] == 7
    
    @patch('src.utils.ai_services.ai_services.predictive_mood_analytics')
    def test_forecast_fallback_method(self, mock_ai, client, mock_db):
        """Test fallback forecast method"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_ai.return_value = {
            "forecast": {"trend": "stable"},
            "model_info": {},
            "current_analysis": {},
            "risk_factors": [],
            "recommendations": [],
            "confidence": 0.6
        }
        
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "use_sklearn": False},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "forecast" in data
    
    def test_forecast_missing_user_id(self, client):
        """Test forecast without user_id"""
        response = client.post('/api/ai/forecast',
            json={},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_forecast_empty_user_id(self, client):
        """Test forecast with empty user_id"""
        response = client.post('/api/ai/forecast',
            json={"user_id": "  "},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    @patch('src.utils.ai_services.ai_services.predictive_mood_forecasting_sklearn')
    def test_forecast_invalid_days_ahead(self, mock_ai, client, mock_db):
        """Test forecast with invalid days_ahead defaults to 7"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        mock_ai.return_value = {
            "forecast": {},
            "model_info": {},
            "current_analysis": {},
            "risk_factors": [],
            "recommendations": [],
            "confidence": 0.7
        }
        
        # Test too high
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "days_ahead": 100},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["forecast_period_days"] == 7  # Should default
        
        # Test negative
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "days_ahead": -5},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["forecast_period_days"] == 7
        
        # Test non-integer
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "days_ahead": "invalid"},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["forecast_period_days"] == 7
    
    @patch('src.utils.ai_services.ai_services.predictive_mood_forecasting_sklearn')
    @patch('src.utils.ai_services.ai_services.predictive_mood_analytics')
    def test_forecast_sklearn_failure_uses_fallback(self, mock_fallback, mock_sklearn, client, mock_db):
        """Test fallback when sklearn fails"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        # Make sklearn fail
        mock_sklearn.side_effect = Exception("Model error")
        
        mock_fallback.return_value = {
            "forecast": {"trend": "stable"},
            "model_info": {},
            "current_analysis": {},
            "risk_factors": [],
            "recommendations": [],
            "confidence": 0.5
        }
        
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123", "use_sklearn": True},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert mock_fallback.called
    
    
    def test_forecast_database_error(self, client, mock_db):
        """Test forecast when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.post('/api/ai/forecast',
            json={"user_id": "test123"},
            content_type='application/json'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
    
    def test_forecast_options_request(self, client):
        """Test OPTIONS request for CORS"""
        response = client.options('/api/ai/forecast')
        assert response.status_code == 204


class TestStoryHistory:
    """Tests for /stories endpoint"""
    
    
    def test_get_story_history_success(self, client, mock_db):
        """Test getting story history"""
        story1 = Mock()
        story1.id = "story_1"
        story1.to_dict.return_value = {
            "story_content": "Första berättelsen...",
            "locale": "sv",
            "mood_data_points": 10,
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.9,
            "generated_at": "2024-01-01T10:00:00Z"
        }
        
        story2 = Mock()
        story2.id = "story_2"
        story2.to_dict.return_value = {
            "story_content": "Andra berättelsen...",
            "locale": "en",
            "mood_data_points": 15,
            "ai_generated": True,
            "model_used": "gpt-4",
            "confidence": 0.85,
            "generated_at": "2024-01-02T10:00:00Z"
        }

        # Mocks for nested collections
        mock_stories_collection = Mock()
        mock_stories_collection.order_by.return_value.limit.return_value.stream.return_value = [story1, story2]

        mock_user_doc = Mock()
        mock_user_doc.collection.return_value = mock_stories_collection

        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc

        def collection_side_effect(collection_name):
            if collection_name == 'users':
                return mock_users_collection
            return Mock() # Return a generic mock for any other collection call

        mock_db.collection.side_effect = collection_side_effect

        response = client.get('/api/ai/stories?user_id=test123')

        assert response.status_code == 200
        data = response.get_json()
        assert "stories" in data
        assert len(data["stories"]) == 2
        assert data["stories"][0]["id"] == "story_1"
        assert data["stories"][0]["locale"] == "sv"
    
    def test_get_story_history_missing_user_id(self, client):
        """Test story history without user_id"""
        response = client.get('/api/ai/stories')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_get_story_history_empty_user_id(self, client):
        """Test story history with empty user_id"""
        response = client.get('/api/ai/stories?user_id=  ')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    
    def test_get_story_history_no_stories(self, client, mock_db):
        """Test story history when user has no stories"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        response = client.get('/api/ai/stories?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "stories" in data
        assert len(data["stories"]) == 0
    
    
    def test_get_story_history_database_error(self, client, mock_db):
        """Test story history when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/ai/stories?user_id=test123')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data


class TestForecastHistory:
    """Tests for /forecasts endpoint"""
    
    
    def test_get_forecast_history_success(self, client, mock_db):
        """Test getting forecast history"""
        forecast1 = Mock()
        forecast1.id = "forecast_1"
        forecast1.to_dict.return_value = {
            "forecast_summary": {
                "trend": "improving",
                "average": 0.75,
                "confidence": 0.85
            },
            "days_ahead": 7,
            "model_used": "LinearRegression",
            "data_points_used": 50,
            "risk_factors": [],
            "generated_at": "2024-01-01T10:00:00Z"
        }
        
        forecast2 = Mock()
        forecast2.id = "forecast_2"
        forecast2.to_dict.return_value = {
            "forecast_summary": {
                "trend": "stable",
                "average": 0.65,
                "confidence": 0.8
            },
            "days_ahead": 14,
            "model_used": "fallback",
            "data_points_used": 30,
            "risk_factors": ["insufficient_data"],
            "generated_at": "2024-01-02T10:00:00Z"
        }

        # Mocks for nested collections
        mock_forecasts_collection = Mock()
        mock_forecasts_collection.order_by.return_value.limit.return_value.stream.return_value = [forecast1, forecast2]

        mock_user_doc = Mock()
        mock_user_doc.collection.return_value = mock_forecasts_collection

        mock_users_collection = Mock()
        mock_users_collection.document.return_value = mock_user_doc

        def collection_side_effect(collection_name):
            if collection_name == 'users':
                return mock_users_collection
            return Mock()

        mock_db.collection.side_effect = collection_side_effect

        response = client.get('/api/ai/forecasts?user_id=test123')

        assert response.status_code == 200
        data = response.get_json()
        assert "forecasts" in data
        assert len(data["forecasts"]) == 2
        assert data["forecasts"][0]["id"] == "forecast_1"
        assert data["forecasts"][0]["forecast_summary"]["trend"] == "improving"
    
    def test_get_forecast_history_missing_user_id(self, client):
        """Test forecast history without user_id"""
        response = client.get('/api/ai/forecasts')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    def test_get_forecast_history_empty_user_id(self, client):
        """Test forecast history with empty user_id"""
        response = client.get('/api/ai/forecasts?user_id=  ')
        
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
    
    
    def test_get_forecast_history_no_forecasts(self, client, mock_db):
        """Test forecast history when user has no forecasts"""
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.order_by.return_value.limit.return_value.stream.return_value = []
        
        response = client.get('/api/ai/forecasts?user_id=newuser')
        
        assert response.status_code == 200
        data = response.get_json()
        assert "forecasts" in data
        assert len(data["forecasts"]) == 0
    
    
    def test_get_forecast_history_database_error(self, client, mock_db):
        """Test forecast history when database fails"""
        mock_db.collection.side_effect = Exception("Database error")
        
        response = client.get('/api/ai/forecasts?user_id=test123')
        
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
