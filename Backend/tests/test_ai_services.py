import pytest
from unittest.mock import Mock, patch, MagicMock
from src.utils.ai_services import AIServices


class TestAIServices:
    """Comprehensive tests for AI services functionality"""

    @pytest.fixture
    def ai_service(self):
        """Create AI service instance for testing"""
        return AIServices()

    @pytest.fixture
    def mock_openai_client(self):
        """Mock OpenAI client for testing"""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test AI response"
        mock_client.chat.completions.create.return_value = mock_response
        return mock_client

    def test_sentiment_analysis_positive(self, ai_service):
        """Test sentiment analysis with positive text"""
        result = ai_service.analyze_sentiment("Jag känner mig så glad och lycklig idag!")

        assert result["sentiment"] in ["POSITIVE", "NEUTRAL"]
        assert "score" in result
        assert "emotions" in result
        assert isinstance(result["emotions"], list)

    def test_sentiment_analysis_negative(self, ai_service):
        """Test sentiment analysis with negative text"""
        result = ai_service.analyze_sentiment("Jag känner mig ledsen och orolig")

        assert result["sentiment"] in ["NEGATIVE", "NEUTRAL"]
        assert "score" in result
        assert "emotions" in result

    def test_crisis_detection(self, ai_service):
        """Test crisis indicator detection"""
        crisis_text = "Jag vill inte leva längre"
        result = ai_service.detect_crisis_indicators(crisis_text)

        assert result["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert "indicators" in result
        assert "requires_immediate_attention" in result

    def test_crisis_detection_high_risk(self, ai_service):
        """Test high-risk crisis detection"""
        high_risk_text = "Jag ska ta livet av mig idag"
        result = ai_service.detect_crisis_indicators(high_risk_text)

        assert result["risk_level"] in ["MEDIUM", "HIGH", "CRITICAL"]
        assert result["requires_immediate_attention"] is True

    @patch('src.utils.ai_services.os.getenv')
    def test_openai_available_when_configured(self, mock_getenv, ai_service, mock_openai_client):
        """Test OpenAI availability when properly configured"""
        mock_getenv.return_value = "test-key"

        with patch('src.utils.ai_services.OpenAI', return_value=mock_openai_client):
            ai_service._check_openai()  # Reset check
            assert ai_service.openai_available is True

    @patch('src.utils.ai_services.os.getenv')
    def test_openai_not_available_without_key(self, mock_getenv, ai_service):
        """Test OpenAI not available without API key"""
        mock_getenv.return_value = None

        ai_service._check_openai()  # Reset check
        assert ai_service.openai_available is False

    def test_fallback_recommendations(self, ai_service):
        """Test fallback recommendations when AI is unavailable"""
        user_history = [
            {"sentiment": "NEGATIVE", "score": -0.5},
            {"sentiment": "POSITIVE", "score": 0.3}
        ]

        result = ai_service._fallback_recommendations(user_history, "NEGATIVE")

        assert "recommendations" in result
        assert "ai_generated" in result
        assert result["ai_generated"] is False
        assert len(result["recommendations"]) > 0

    def test_mood_pattern_analysis_insufficient_data(self, ai_service):
        """Test pattern analysis with insufficient data"""
        short_history = [{"score": 0.1}]

        result = ai_service.analyze_mood_patterns(short_history)

        assert result["pattern_analysis"] == "Otillräcklig data för mönsteranalys"
        assert result["confidence"] == 0.0

    def test_mood_pattern_analysis_with_data(self, ai_service):
        """Test pattern analysis with sufficient data"""
        # Create 10 days of mood data
        history = []
        for i in range(10):
            history.append({
                "ai_analysis": {"score": 0.1 + (i * 0.05)},  # Gradually increasing
                "timestamp": f"2024-01-{10+i:02d}T10:00:00Z"
            })

        result = ai_service.analyze_mood_patterns(history)

        assert "pattern_analysis" in result
        assert "predictions" in result
        assert "trend_direction" in result
        assert "confidence" in result
        assert result["confidence"] > 0

    def test_emotion_extraction(self, ai_service):
        """Test emotion extraction from text"""
        text = "Jag känner mig glad och nöjd med livet"
        emotions = ai_service._extract_emotions_from_text(text, [])

        assert isinstance(emotions, list)
        assert len(emotions) <= 3  # Should return max 3 emotions

    def test_voice_emotion_analysis_fallback(self, ai_service):
        """Test voice analysis fallback when audio processing fails"""
        audio_data = b"fake audio data"
        transcript = "Jag känner mig bra"

        result = ai_service._basic_voice_analysis(audio_data, transcript)

        assert "primary_emotion" in result
        assert "confidence" in result
        assert "voice_characteristics" in result

    def test_weekly_insights_fallback(self, ai_service):
        """Test weekly insights fallback"""
        weekly_data = {
            "moods": [{"score": 0.2}, {"score": -0.1}],
            "memories": [{"title": "Good day"}]
        }

        result = ai_service._fallback_weekly_insights(weekly_data)

        assert "insights" in result
        assert "ai_generated" in result
        assert result["ai_generated"] is False
        assert len(result["insights"]) > 0

    @patch('src.utils.ai_services.os.getenv')
    @patch('src.utils.ai_services.OpenAI')
    def test_therapeutic_conversation_generation(self, mock_openai_class, mock_getenv, ai_service, mock_openai_client):
        """Test therapeutic conversation generation"""
        mock_getenv.return_value = "test-key"
        mock_openai_class.return_value = mock_openai_client

        # Reset OpenAI check
        ai_service._openai_checked = False
        ai_service._openai_available = True
        ai_service.client = mock_openai_client

        user_message = "Jag känner mig stressad"
        conversation_history = []

        result = ai_service.generate_therapeutic_conversation(
            user_message, conversation_history
        )

        assert "response" in result
        assert "sentiment_analysis" in result
        assert "crisis_detected" in result
        assert result["ai_generated"] is True

    def test_crisis_response_generation(self, ai_service):
        """Test crisis response generation"""
        crisis_analysis = {
            "risk_level": "HIGH",
            "indicators": ["suicidal thoughts"],
            "severity_score": 4.5
        }

        response = ai_service._generate_crisis_response(crisis_analysis)

        assert "Hjälp" in response or "help" in response.lower()
        assert len(response) > 50  # Should be substantial response

    def test_exercise_recommendations_generation(self, ai_service):
        """Test CBT exercise recommendations"""
        sentiment_analysis = {
            "sentiment": "NEGATIVE",
            "emotions": ["sadness", "fear"]
        }

        recommendations = ai_service._generate_exercise_recommendations(
            sentiment_analysis, "Jag känner mig ledsen"
        )

        assert isinstance(recommendations, list)
        assert len(recommendations) <= 2  # Should return max 2 recommendations

        if recommendations:
            rec = recommendations[0]
            assert "type" in rec
            assert "title" in rec
            assert "description" in rec
            assert "duration" in rec
            assert "urgency" in rec

    def test_summarize_mood_history(self, ai_service):
        """Test mood history summarization"""
        history = [
            {"sentiment": "POSITIVE"},
            {"sentiment": "NEGATIVE"},
            {"sentiment": "POSITIVE"}
        ]

        summary = ai_service._summarize_mood_history(history)

        assert isinstance(summary, str)
        assert len(summary) > 0
        assert "positiva" in summary.lower() or "positive" in summary.lower()

    def test_enhanced_sentiment_analysis(self, ai_service):
        """Test enhanced sentiment analysis with transformers fallback"""
        text = "Jag är så glad idag!"

        result = ai_service.enhanced_sentiment_analysis(text)

        assert "sentiment" in result
        assert "method" in result
        assert result["method"] in ["transformer", "keyword_based"]