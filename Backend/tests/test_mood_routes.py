import os
import sys
import pytest
from unittest.mock import Mock, patch
from main import create_app

# Lägg till projektets rot till sys.path för korrekta importer
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(scope="module")
def client():
    """Skapar en testklient för Flask-applikationen med mockade beroenden."""
    with patch('src.firebase_config.initialize_firebase', return_value=True):
        try:
            app = create_app(testing=True)
        except Exception as e:
            pytest.fail(f"Misslyckades med att skapa appen: {str(e)}")
        return app.test_client()

@pytest.fixture(scope="function")
def mock_firestore(mocker):
    """Mockar Firestore för mood routes."""
    mock_db = Mock()
    mock_users = Mock()
    mock_db.collection.return_value = mock_users

    # Mock for user lookup by email
    mock_user_query = Mock()
    mock_user_query.limit.return_value.stream.return_value = [Mock(id="test-user-id", to_dict=lambda: {"email": "test@example.com"})]
    mock_users.where.return_value = mock_user_query

    # Mock for mood operations
    mock_user_doc = Mock()
    mock_users.document.return_value = mock_user_doc
    mock_moods = Mock()
    mock_user_doc.collection.return_value = mock_moods
    mock_ordered = Mock()
    mock_moods.order_by.return_value = mock_ordered
    mock_ordered.stream.return_value = [
        Mock(to_dict=lambda: {"mood": "glad", "timestamp": "2025-01-01T00:00:00"}),
        Mock(to_dict=lambda: {"mood": "ledsen", "timestamp": "2025-01-02T00:00:00"})
    ]
    mock_ordered.limit.return_value.stream.return_value = [
        Mock(to_dict=lambda: {"mood": "glad", "timestamp": "2025-01-01T00:00:00", "sentiment": None}),
        Mock(to_dict=lambda: {"mood": "ledsen", "timestamp": "2025-01-02T00:00:00", "sentiment": None})
    ]
    mock_moods.document.return_value.set = Mock()

    mocker.patch('src.firebase_config.db', mock_db)
    mocker.patch('src.routes.mood_routes.db', mock_db)
    return mock_db


def test_log_mood_json(client, mock_firestore, mocker):
    """Testar loggning av humör via JSON."""
    # Mock the decrypt_data function to return the mood directly for testing
    mocker.patch('src.routes.mood_routes.decrypt_data', return_value="glad")

    response = client.post("/api/mood/log", json={
        "user_id": "test-user-id",
        "mood": "encrypted_glad",  # Mock encrypted data
        "score": 0.8
    })
    assert response.status_code == 200
    assert "Ditt humör har sparats!" in response.get_json()["message"]

def test_get_moods(client, mock_firestore):
    """Testar hämtning av humörloggar."""
    response = client.get("/api/mood/get?user_id=test-user-id")
    assert response.status_code == 200
    data = response.get_json()
    assert "moods" in data
    assert len(data["moods"]) == 2
    assert data["moods"][0]["mood"] == "glad"

def test_get_moods_no_data(client, mock_firestore):
    """Testar hämtning när inga humörloggar finns."""
    mock_firestore.collection.return_value.document.return_value.collection.return_value.order_by.return_value.stream.return_value = []
    response = client.get("/api/mood/get?user_id=test-user-id")
    assert response.status_code == 200
    assert "Inga humörloggar hittades." in response.get_json()["message"]

def test_log_mood_invalid_mood(client, mock_firestore):
    """Testar loggning med ogiltigt humör."""
    response = client.post("/api/mood/log", json={
        "user_email": "test@example.com",
        "mood": "invalid",
        "transcript": "Jag är invalid!"
    })
    assert response.status_code == 400
    assert "Felaktig JSON-data!" in response.get_json()["error"]

def test_get_moods_missing_user_id(client, mock_firestore):
    """Testar hämtning utan användar-ID."""
    response = client.get("/api/mood/get")
    assert response.status_code == 400
    assert "Användar-ID krävs!" in response.get_json()["error"]

def test_weekly_analysis_basic(client, mock_firestore, mocker):
    """Testar grundläggande veckoanalys."""
    # Mock AI services
    mock_ai = Mock()
    mock_ai.generate_weekly_insights.return_value = {
        "insights": "Test insights",
        "ai_generated": True,
        "confidence": 0.8
    }
    mocker.patch('src.utils.ai_services.ai_services', mock_ai)

    # Mock Redis
    mock_redis = Mock()
    mock_redis.get.return_value = None  # No cache hit
    mock_redis.setex = Mock()
    mocker.patch('src.routes.mood_routes.redis_client', mock_redis)

    response = client.get("/api/mood/weekly-analysis?user_id=test-user-id&locale=sv")
    assert response.status_code == 200
    data = response.get_json()
    assert "total_moods" in data
    assert "insights" in data
    assert data["insights"] == "Test insights"

def test_weekly_analysis_cached(client, mock_firestore, mocker):
    """Testar cachad veckoanalys."""
    # Mock the _ensure_redis_connection function to return True
    mocker.patch('src.routes.mood_routes._ensure_redis_connection', return_value=True)

    # Mock Redis with cache hit
    mock_redis = Mock()
    cached_data = '{"total_moods": 2, "insights": "Cached insights"}'
    mock_redis.get.return_value = cached_data
    mocker.patch('src.routes.mood_routes.redis_client', mock_redis)

    response = client.get("/api/mood/weekly-analysis?user_id=test-user-id&locale=sv")
    assert response.status_code == 200
    data = response.get_json()
    assert data["insights"] == "Cached insights"
    # Verify Redis was called for cache retrieval
    mock_redis.get.assert_called_once()

def test_weekly_analysis_multilingual(client, mock_firestore, mocker):
    """Testar veckoanalys på olika språk."""
    # Mock AI services for different locales
    mock_ai = Mock()
    mock_ai.generate_weekly_insights.side_effect = [
        {"insights": "Swedish insights", "ai_generated": True, "confidence": 0.8},
        {"insights": "English insights", "ai_generated": True, "confidence": 0.8},
        {"insights": "Norwegian insights", "ai_generated": True, "confidence": 0.8}
    ]
    mocker.patch('src.utils.ai_services.ai_services', mock_ai)

    # Mock Redis
    mock_redis = Mock()
    mock_redis.get.return_value = None
    mock_redis.setex = Mock()
    mocker.patch('src.routes.mood_routes.redis_client', mock_redis)

    for locale in ['sv', 'en', 'no']:
        response = client.get(f"/api/mood/weekly-analysis?user_id=test-user-id&locale={locale}")
        assert response.status_code == 200
        data = response.get_json()
        assert "insights" in data
        assert locale in data["insights"].lower() or "insights" in data["insights"].lower()

def test_recommendations_basic(client, mock_firestore, mocker):
    """Testar grundläggande rekommendationer."""
    # Mock AI services
    mock_ai = Mock()
    mock_ai.generate_personalized_recommendations.return_value = {
        "recommendations": "Test recommendations",
        "ai_generated": True,
        "confidence": 0.8,
        "personalized": True
    }
    mocker.patch('src.utils.ai_services.ai_services', mock_ai)

    response = client.get("/api/mood/recommendations?user_id=test-user-id")
    assert response.status_code == 200
    data = response.get_json()
    assert "recommendations" in data
    assert data["recommendations"] == "Test recommendations"

def test_voice_analysis_basic(client, mock_firestore, mocker):
    """Testar grundläggande röstanalys."""
    # Mock AI services
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = {"sentiment": "POSITIVE", "score": 0.8}
    mock_ai.analyze_voice_emotion.return_value = {
        "primary_emotion": "joy",
        "confidence": 0.9,
        "voice_characteristics": {"energy_level": "high"}
    }
    mocker.patch('src.utils.ai_services.ai_services', mock_ai)

    response = client.post("/api/mood/analyze-voice", json={
        "user_id": "test-user-id",
        "audio_data": "base64_audio_data",
        "transcript": "Jag är glad!"
    })
    assert response.status_code == 200
    data = response.get_json()
    assert "voice_analysis" in data
    assert data["voice_analysis"]["primary_emotion"] == "joy"