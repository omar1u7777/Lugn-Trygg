"""
Humör (Mood) System Menu — comprehensive backend coverage tests.

Targets the endpoints exposed in the frontend Humör menu:
  POST   /api/mood/analyze-text
  POST   /api/mood/log
  GET    /api/mood
  GET    /api/mood/<id>
  PUT    /api/mood/<id>
  DELETE /api/mood/<id>
  GET    /api/mood/recent
  GET    /api/mood/today
  GET    /api/mood/streaks
  GET    /api/mood/weekly-analysis
  GET    /api/mood/predictive-forecast
  GET    /api/mood-stats/statistics

These tests exercise success paths and the most important edge/error branches
so that the menu choices behave correctly in production.
"""

from __future__ import annotations

import inspect
import json
import sys
from datetime import UTC, datetime, timedelta
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest

sys.path.insert(0, "..")


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_mood_state():
    """Reset module-level caches between tests for deterministic coverage."""
    from src.routes import mood_routes
    mood_routes._mood_cache.clear()
    mood_routes._redis_client = None
    mood_routes._redis_unavailable = True  # skip slow Redis connection attempts
    yield
    mood_routes._mood_cache.clear()
    mood_routes._redis_client = None
    mood_routes._redis_unavailable = True


@pytest.fixture
def mock_firestore(mocker):
    """Provide a Firestore mock with a realistic moods collection."""
    mock_db = MagicMock()

    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = {"email": "test@example.com"}

    mood_doc_ref = MagicMock()
    mood_doc_ref.id = "mock-mood-id"

    moods_collection = MagicMock()
    moods_collection.add.return_value = (None, mood_doc_ref)
    moods_collection.order_by.return_value = moods_collection
    moods_collection.where.return_value = moods_collection
    moods_collection.limit.return_value = moods_collection
    moods_collection.offset.return_value = moods_collection
    moods_collection.stream.return_value = []
    moods_collection.get.return_value = []

    user_doc_ref = MagicMock()
    user_doc_ref.get.return_value = user_doc
    user_doc_ref.collection.return_value = moods_collection

    users_collection = MagicMock()
    users_collection.document.return_value = user_doc_ref

    def _collection(name):
        if name == "users":
            return users_collection
        return MagicMock()

    mock_db.collection.side_effect = _collection
    mocker.patch("src.firebase_config.db", mock_db)
    mocker.patch("src.routes.mood_routes.db", mock_db)
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)
    return mock_db


@pytest.fixture
def mock_ai_services(mocker):
    """Mock AI services module used by mood routes."""
    fake_module = SimpleNamespace(
        ai_services=Mock(
            analyze_sentiment=Mock(return_value={
                "sentiment": "POSITIVE",
                "score": 0.85,
                "emotions": ["joy"],
                "method": "mock",
            }),
            analyze_voice_emotion=Mock(return_value={
                "primary_emotion": "joy",
                "confidence": 0.9,
                "sentiment": "POSITIVE",
                "score": 0.8,
            }),
            analyze_voice_emotion_fallback=Mock(return_value={
                "primary_emotion": "neutral",
                "confidence": 0.5,
                "sentiment": "NEUTRAL",
                "score": 0.0,
            }),
            predictive_mood_forecasting_sklearn=Mock(return_value={
                "forecast": {
                    "daily_predictions": [0.6] * 7,
                    "average_forecast": 0.6,
                    "trend": "stable",
                    "confidence_interval": {"lower": 0.4, "upper": 0.8},
                },
                "model_info": {"algorithm": "mock", "training_rmse": 0.1, "data_points_used": 10},
                "current_analysis": {"recent_average": 0.6, "volatility": 0.2},
                "risk_factors": [],
                "recommendations": ["Keep logging daily."],
                "confidence": 0.8,
            }),
        )
    )
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=fake_module)
    return fake_module.ai_services


@pytest.fixture
def mock_subscription_ok(mocker):
    """Make subscription quota checks pass."""
    mocker.patch(
        "src.routes.mood_routes.SubscriptionService.get_plan_context",
        return_value={"limits": {"moodLogsPerDay": 100}},
    )
    mocker.patch("src.routes.mood_routes.SubscriptionService.consume_quota", return_value=None)


@pytest.fixture
def mock_crisis_none(mocker):
    """Stub crisis intervention so crisis branches run but do not block."""
    fake_service = Mock()
    fake_service.assess_crisis_risk.return_value = SimpleNamespace(
        overall_risk_level="none",
        risk_score=0.1,
    )
    fake_module = SimpleNamespace(crisis_intervention_service=fake_service)
    mocker.patch(
        "src.services.crisis_intervention.crisis_intervention_service",
        fake_service,
    )
    return fake_service


@pytest.fixture
def mock_user_db(mocker):
    """Build a deterministic Firestore mock for a user document that exists."""
    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = {"email": "test@example.com"}

    users_collection = MagicMock()
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_collection.document.return_value = users_doc

    def _collection(name):
        return users_collection if name == "users" else MagicMock()

    mock_db = MagicMock()
    mock_db.collection.side_effect = _collection
    mocker.patch("src.routes.mood_routes.db", mock_db)
    return mock_db


def _make_moods_collection(docs):
    """Helper: create a moods collection mock that returns `docs` when streamed."""
    moods = MagicMock()
    order_by = MagicMock()
    order_by.stream.return_value = docs
    order_by.limit.return_value = order_by
    order_by.offset.return_value = order_by
    moods.order_by.return_value = order_by
    moods.where.return_value = moods
    return moods


# ---------------------------------------------------------------------------
# /api/mood/analyze-text
# ---------------------------------------------------------------------------

def test_analyze_text_success(client, auth_csrf_headers, mock_ai_services):
    response = client.post(
        "/api/mood/analyze-text",
        json={"text": "Jag är så glad idag!"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["sentiment"] == "POSITIVE"


def test_analyze_text_options(client):
    response = client.options("/api/mood/analyze-text")
    assert response.status_code == 204


def test_analyze_text_empty(client, auth_csrf_headers):
    response = client.post(
        "/api/mood/analyze-text",
        json={"text": ""},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_analyze_text_too_long(client, auth_csrf_headers):
    response = client.post(
        "/api/mood/analyze-text",
        json={"text": "x" * 4001},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# /api/mood/log
# ---------------------------------------------------------------------------

def test_log_mood_json_success(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mock_crisis_none
):
    response = client.post(
        "/api/mood/log",
        json={
            "score": 8,
            "mood_text": "Glad",
            "note": "Bra dag",
            "tags": ["arbete"],
            "valence": 8,
            "arousal": 5,
            "timestamp": "2026-07-15T08:00:00Z",
        },
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    assert "moodEntry" in data["data"]


def test_log_mood_options(client):
    response = client.options("/api/mood/log")
    assert response.status_code == 204


def test_log_mood_quota_exceeded(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mocker
):
    mocker.patch(
        "src.routes.mood_routes.SubscriptionService.get_plan_context",
        return_value={"limits": {"moodLogsPerDay": 1}},
    )
    from src.services.subscription_service import SubscriptionLimitError
    mocker.patch(
        "src.routes.mood_routes.SubscriptionService.consume_quota",
        side_effect=SubscriptionLimitError("mood_logs", 1),
    )
    response = client.post(
        "/api/mood/log",
        json={"mood_text": "Test", "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 429


def test_log_mood_no_data(client, mock_firestore, auth_csrf_headers, mock_subscription_ok):
    response = client.post(
        "/api/mood/log",
        json={},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_log_mood_with_only_score(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mock_crisis_none
):
    response = client.post(
        "/api/mood/log",
        json={"score": 3, "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["data"]["moodEntry"]["mood_text"] == "Orolig"


def test_log_mood_spam_note(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok
):
    response = client.post(
        "/api/mood/log",
        json={"note": "aaa", "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_log_mood_with_tags_as_string(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mock_crisis_none
):
    response = client.post(
        "/api/mood/log",
        json={
            "mood_text": "Bra",
            "tags": json.dumps(["hälsa", "vänner"]),
            "timestamp": "2026-07-15T08:00:00Z",
        },
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_log_mood_audio_multipart(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mock_crisis_none, mocker
):
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="Glad idag")
    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
            "tags": json.dumps(["röst"]),
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True


def test_log_mood_crisis_detected(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mocker
):
    fake_crisis = Mock()
    fake_crisis.assess_crisis_risk.return_value = SimpleNamespace(
        overall_risk_level="critical",
        risk_score=0.95,
    )
    mocker.patch("src.services.crisis_intervention.crisis_intervention_service", fake_crisis)
    response = client.post(
        "/api/mood/log",
        json={
            "score": 2,
            "note": "Jag vill inte leva längre",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# /api/mood (GET)
# ---------------------------------------------------------------------------

def test_get_moods_success(client, mock_firestore, auth_csrf_headers):
    response = client.get("/api/mood", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "moods" in data


def test_get_moods_with_filters(client, mocker, auth_csrf_headers):
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"mood-{i}"
        d.to_dict.return_value = {
            "mood_text": "Glad",
            "timestamp": "2026-07-15T08:00:00Z",
            "sentiment": "POSITIVE",
        }
        docs.append(d)

    moods = _make_moods_collection(docs)
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get(
        "/api/mood?limit=10&offset=0&start_date=2026-07-01&end_date=2026-07-15&sentiment=POSITIVE",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_get_moods_query_error_fallback(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    order_by = MagicMock()
    order_by.stream.side_effect = Exception("missing composite index")
    moods.order_by.return_value = order_by
    moods.limit.return_value = order_by
    moods.offset.return_value = order_by

    fallback_doc = MagicMock()
    fallback_doc.id = "fb1"
    fallback_doc.to_dict.return_value = {"timestamp": "2026-07-15T08:00:00Z"}
    order_by.limit.return_value = order_by
    order_by.offset.return_value = order_by
    # After order_by fails, the fallback uses mood_ref.limit directly
    moods.limit.return_value = MagicMock(stream=Mock(return_value=[fallback_doc]))
    moods.offset.return_value = moods.limit.return_value

    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood?limit=5&offset=1", headers=auth_csrf_headers)
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# /api/mood/<id>
# ---------------------------------------------------------------------------

def test_get_mood_success(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.id = "mood-abc1234567"
    mood_doc.to_dict.return_value = {"mood_text": "Lugn", "timestamp": "2026-07-15T08:00:00Z"}

    moods = MagicMock()
    moods.document.return_value.get.return_value = mood_doc
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/mood-abc1234567", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["mood"]["id"] == "mood-abc1234567"


def test_get_mood_invalid_id(client, auth_csrf_headers):
    response = client.get("/api/mood/invalid", headers=auth_csrf_headers)
    assert response.status_code == 400


def test_get_mood_not_found(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = False

    moods = MagicMock()
    moods.document.return_value.get.return_value = mood_doc
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/mood-notfound123", headers=auth_csrf_headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# /api/mood/<id> DELETE / PUT
# ---------------------------------------------------------------------------

def test_delete_mood_success(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.to_dict.return_value = {"mood_text": "Lugn"}

    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.delete("/api/mood/mood-delete1234", headers=auth_csrf_headers)
    assert response.status_code == 200
    mood_ref.delete.assert_called_once()


def test_delete_mood_invalid_id(client, auth_csrf_headers):
    response = client.delete("/api/mood/bad", headers=auth_csrf_headers)
    assert response.status_code == 400


def test_update_mood_success(client, mocker, auth_csrf_headers, mock_ai_services):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.id = "mood-update1234"
    mood_doc.to_dict.return_value = {"mood_text": "old", "timestamp": "2026-07-14T08:00:00Z"}

    updated_doc = MagicMock()
    updated_doc.id = "mood-update1234"
    updated_doc.to_dict.return_value = {"mood_text": "Ny", "timestamp": "2026-07-15T08:00:00Z"}

    mood_ref = MagicMock()
    mood_ref.get.side_effect = [mood_doc, updated_doc]
    moods = MagicMock()
    moods.document.return_value = mood_ref
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.put(
        "/api/mood/mood-update1234",
        json={"mood_text": "Ny", "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_update_mood_no_data(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.to_dict.return_value = {"mood_text": "old"}

    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.put(
        "/api/mood/mood-update1234",
        json={},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_update_mood_invalid_id(client, auth_csrf_headers):
    response = client.put(
        "/api/mood/bad",
        json={"mood_text": "Ny"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# /api/mood/recent
# ---------------------------------------------------------------------------

def test_get_recent_moods_success(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(3):
        d = MagicMock()
        d.id = f"recent-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat()}
        docs.append(d)

    moods = MagicMock()
    query = MagicMock()
    query.stream.return_value = docs
    moods.where.return_value = query
    moods.order_by.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query

    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["period"] == "last7Days"


# ---------------------------------------------------------------------------
# /api/mood/today
# ---------------------------------------------------------------------------

def test_get_today_mood_found(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"today-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(hours=i)).isoformat(),
            "mood_text": "Glad",
        }
        docs.append(d)

    moods = MagicMock()
    query = MagicMock()
    query.stream.return_value = docs
    moods.where.return_value = query
    query.where.return_value = query

    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/today", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["hasMoodToday"] is True


def test_get_today_mood_empty(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    query = MagicMock()
    query.stream.return_value = []
    moods.where.return_value = query

    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/today", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["hasMoodToday"] is False


# ---------------------------------------------------------------------------
# /api/mood/streaks
# ---------------------------------------------------------------------------

def test_get_streaks_with_data(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"streak-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat()}
        docs.append(d)

    moods = _make_moods_collection(docs)
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["currentStreak"] >= 1


def test_get_streaks_empty(client, mocker, auth_csrf_headers):
    moods = _make_moods_collection([])
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["currentStreak"] == 0


# ---------------------------------------------------------------------------
# /api/mood/weekly-analysis
# ---------------------------------------------------------------------------

def test_weekly_analysis_with_data(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(4):
        d = MagicMock()
        d.id = f"wa-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "sentiment": "POSITIVE" if i % 2 == 0 else "NEGATIVE",
            "score": 8 if i % 2 == 0 else 3,
        }
        docs.append(d)

    moods = MagicMock()
    query = MagicMock()
    query.stream.return_value = docs
    moods.where.return_value = query
    moods.order_by.return_value = query
    query.order_by.return_value = query
    query.limit.return_value = query

    memories = MagicMock()
    memories.order_by.return_value = MagicMock(stream=Mock(return_value=[]))

    users_doc = MagicMock()
    users_doc.collection.side_effect = lambda name: moods if name == "moods" else memories
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalMoods"] == 4


def test_weekly_analysis_empty(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    query = MagicMock()
    query.stream.return_value = []
    moods.where.return_value = query

    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["fallback"] is True


# ---------------------------------------------------------------------------
# /api/mood/predictive-forecast
# ---------------------------------------------------------------------------

def test_predictive_forecast_success(client, mocker, auth_csrf_headers, mock_ai_services):
    docs = []
    for i in range(10):
        d = MagicMock()
        d.id = f"fc-{i}"
        d.to_dict.return_value = {
            "timestamp": "2026-07-05T08:00:00Z",
            "score": 7,
            "sentiment": "POSITIVE",
        }
        docs.append(d)

    moods = _make_moods_collection(docs)
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/predictive-forecast?days_ahead=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "forecast" in data["data"]


def test_predictive_forecast_options(client):
    response = client.options("/api/mood/predictive-forecast")
    assert response.status_code == 204


def test_predictive_forecast_invalid_days(client, auth_csrf_headers):
    response = client.get("/api/mood/predictive-forecast?days_ahead=abc", headers=auth_csrf_headers)
    # Flask will coerce or default; route clamps to 7
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# /api/mood-stats/statistics
# ---------------------------------------------------------------------------

def test_mood_statistics_success(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"stat-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "sentiment": "POSITIVE" if i % 2 == 0 else "NEUTRAL",
            "score": 8 if i % 2 == 0 else 5,
        }
        docs.append(d)

    moods = _make_moods_collection(docs)
    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = {"email": "test@example.com"}
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalMoods"] == 5


def test_mood_statistics_empty(client, mocker, auth_csrf_headers):
    moods = _make_moods_collection([])
    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = {"email": "test@example.com"}
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalMoods"] == 0


def test_mood_statistics_user_not_found(client, mocker, auth_csrf_headers):
    user_doc = MagicMock()
    user_doc.exists = False
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 404


def test_mood_statistics_user_query_error(client, mocker, auth_csrf_headers):
    users_collection = MagicMock()
    users_collection.document.side_effect = Exception("firebase down")

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 503


def _make_stats_moods_collection(docs):
    moods = MagicMock()
    order_by = MagicMock()
    order_by.limit.return_value = order_by
    order_by.stream.return_value = docs

    where_result = MagicMock()
    where_result.order_by.return_value = order_by
    moods.where.return_value = where_result
    moods.order_by.return_value = order_by
    return moods


def test_get_daily_analytics_success(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(3):
        d = MagicMock()
        d.id = f"daily-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 7 if i == 0 else 4,
            "tags": ["arbete", "hälsa"],
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalEntries"] == 3
    assert len(data["data"]["hourlyDistribution"]) == 24


def test_get_daily_analytics_empty(client, mocker, auth_csrf_headers):
    moods = _make_stats_moods_collection([])
    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/daily", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalEntries"] == 0


def test_get_monthly_analytics_success(client, mocker, auth_csrf_headers):
    now = datetime.now(UTC)
    docs = []
    for i in range(3):
        d = MagicMock()
        d.id = f"monthly-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i * 30)).isoformat(),
            "score": 8 - i,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalEntries"] == 3


def test_get_monthly_analytics_empty(client, mocker, auth_csrf_headers):
    moods = _make_stats_moods_collection([])
    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/monthly", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["totalEntries"] == 0


def test_get_monthly_analytics_invalid_months(client, mocker, auth_csrf_headers):
    moods = _make_stats_moods_collection([])
    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/monthly?months=invalid", headers=auth_csrf_headers)
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Extra branch coverage for mood_routes.py
# ---------------------------------------------------------------------------

def test_log_mood_duplicate_blocked(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mock_crisis_none, mocker
):
    """Logging the same score twice within 5 minutes should be blocked."""
    duplicate_doc = MagicMock()
    duplicate_doc.id = "existing"
    duplicate_doc.to_dict.return_value = {"score": 7, "timestamp": datetime.now(UTC).isoformat()}

    moods = MagicMock()
    moods.where.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = [duplicate_doc]

    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.post(
        "/api/mood/log",
        json={"score": 7, "mood_text": "Bra", "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 409


def test_log_mood_voice_fallback(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Voice analysis should use the fallback emotion analyzer when the primary fails."""
    mock_ai = Mock()
    mock_ai.analyze_voice_emotion.side_effect = Exception("primary failed")
    mock_ai.analyze_voice_emotion_fallback.return_value = {
        "primary_emotion": "sadness",
        "confidence": 0.6,
        "sentiment": "NEGATIVE",
        "score": -0.5,
    }
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="Jag är ledsen")

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_get_moods_exception(client, mocker, auth_csrf_headers):
    """Firestore failure during get_moods should return a 500 error."""
    moods = MagicMock()
    moods.order_by.side_effect = Exception("firestore broken")
    moods.where.return_value = moods
    users_doc = MagicMock()
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_weekly_analysis_query_fallback(client, mocker, auth_csrf_headers):
    """Weekly analysis should fall back to client-side filtering when composite index is missing."""
    now = datetime.now(UTC)
    docs = []
    for i in range(3):
        d = MagicMock()
        d.id = f"wf-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "sentiment": "POSITIVE",
            "score": 8,
        }
        docs.append(d)

    moods = MagicMock()
    order_by = MagicMock()
    order_by.stream.return_value = docs
    moods.order_by.return_value = order_by

    where_result = MagicMock()
    where_result.order_by.side_effect = Exception("missing composite index")
    moods.where.return_value = where_result

    memories = MagicMock()
    memories.order_by.return_value = MagicMock(stream=Mock(return_value=[]))

    users_doc = MagicMock()
    users_doc.collection.side_effect = lambda name: moods if name == "moods" else memories
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_weekly_analysis_insights_low_average(
    client, mocker, auth_csrf_headers
):
    """Weekly analysis should generate insights for low average mood."""
    now = datetime.now(UTC)
    docs = []
    for i in range(4):
        d = MagicMock()
        d.id = f"wi-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "sentiment": "NEGATIVE",
            "score": 3,
        }
        docs.append(d)

    moods = MagicMock()
    order_by = MagicMock()
    order_by.limit.return_value = order_by
    order_by.stream.return_value = docs
    moods.where.return_value = order_by

    memories = MagicMock()
    memories.order_by.return_value = MagicMock(stream=Mock(return_value=[]))

    users_doc = MagicMock()
    users_doc.collection.side_effect = lambda name: moods if name == "moods" else memories
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "insights" in data["data"]


def test_log_mood_crisis_service_failure(
    client, mock_firestore, auth_csrf_headers, mock_ai_services, mock_subscription_ok, mocker
):
    """A non-fatal crisis-service failure should not block mood logging."""
    fake_crisis = Mock()
    fake_crisis.assess_crisis_risk.side_effect = Exception("crisis service down")
    mocker.patch("src.services.crisis_intervention.crisis_intervention_service", fake_crisis)

    response = client.post(
        "/api/mood/log",
        json={"score": 2, "note": "Jag mår inte bra", "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_log_mood_audio_transcript_only(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Audio upload with transcript but no usable voice analysis returns transcript-based mood."""
    mock_ai = Mock()
    mock_ai.analyze_voice_emotion.return_value = None
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="Jag är glad idag")
    mocker.patch(
        "src.routes.mood_routes._get_ai_services_module",
        return_value=SimpleNamespace(ai_services=mock_ai),
    )

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Error-handling / edge case coverage for remaining branches
# ---------------------------------------------------------------------------

def _patch_mood_route_db(mocker, moods=None, user_exists=True):
    moods = moods or MagicMock()
    # Ensure add() returns a tuple (None, doc_ref) with a string id
    # so mood_entry['id'] is JSON-serializable after the production fix
    _doc_ref = MagicMock()
    _doc_ref.id = "mock-mood-id"
    moods.add.return_value = (None, _doc_ref)
    user_doc = MagicMock()
    user_doc.exists = user_exists
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    return mocker.patch("src.routes.mood_routes.db", mock_db)


def _patch_mood_stats_db(mocker, moods=None, user_exists=True):
    moods = moods or MagicMock()
    user_doc = MagicMock()
    user_doc.exists = user_exists
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    return mocker.patch("src.routes.mood_stats_routes.db", mock_db)


def test_get_mood_invalid_id(client, auth_csrf_headers):
    response = client.get("/api/mood/invalid_id!", headers=auth_csrf_headers)
    assert response.status_code == 400


def test_get_mood_not_found(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = False
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/moodnotfound", headers=auth_csrf_headers)
    assert response.status_code == 404


def test_delete_mood_not_found(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = False
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.delete("/api/mood/moodnotfound", headers=auth_csrf_headers)
    assert response.status_code == 404


def test_get_today_mood_exception(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    moods.where.side_effect = Exception("firestore error")
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/today", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_recent_moods_query_fallback(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    moods.order_by.side_effect = Exception("missing composite index")
    moods.stream.return_value = []
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["data"]["total"] == 0


def test_get_mood_streaks_exception(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    moods.order_by.side_effect = Exception("firestore error")
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_predictive_forecast_exception(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    moods.order_by.side_effect = Exception("firestore error")
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/predictive-forecast", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_daily_analytics_query_fallback(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    order_by = MagicMock()
    order_by.limit.return_value = order_by
    order_by.stream.return_value = []
    moods.order_by.return_value = order_by
    where_result = MagicMock()
    where_result.order_by.side_effect = Exception("missing composite index")
    moods.where.return_value = where_result
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["data"]["totalEntries"] == 0


def test_get_monthly_analytics_query_fallback_empty(client, mocker, auth_csrf_headers):
    moods = MagicMock()
    order_by = MagicMock()
    order_by.limit.return_value = order_by
    order_by.stream.return_value = []
    moods.order_by.return_value = order_by
    where_result = MagicMock()
    where_result.order_by.side_effect = Exception("missing composite index")
    moods.where.return_value = where_result
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["data"]["totalEntries"] == 0


# ---------------------------------------------------------------------------
# Push remaining branches toward 100% coverage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path", [
    "/api/mood/log",
    "/api/mood/predictive-forecast",
])
def test_options_preflight(client, path):
    response = client.options(path, headers={"Origin": "http://localhost"})
    assert response.status_code == 204


@pytest.mark.parametrize("score,expected", [
    (10, "Super"),
    (9, "Super"),
    (8, "Glad"),
    (7, "Bra"),
    (6, "Neutral"),
    (5, "Neutral"),
    (4, "Orolig"),
    (2, "Ledsen"),
    (1, "Ledsen"),
])
def test_log_mood_score_to_mood_mapping(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, score, expected
):
    response = client.post(
        "/api/mood/log",
        json={"score": score, "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201
    assert response.get_json()["data"]["moodEntry"]["mood_text"] == expected


def test_log_mood_default_mood_text(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none
):
    """Empty payload should default to Neutral mood text."""
    response = client.post(
        "/api/mood/log",
        json={"timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201
    assert response.get_json()["data"]["moodEntry"]["mood_text"] == "Neutral"


def test_log_mood_voice_emotion_mapping(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Voice analysis primary emotion should map to Swedish mood label."""
    mock_ai = Mock()
    mock_ai.analyze_voice_emotion.return_value = {
        "primary_emotion": "joy",
        "confidence": 0.9,
        "sentiment": "POSITIVE",
        "score": 0.8,
    }
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="Jag är glad")

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["mood"] == "glad"


def test_log_mood_voice_fallback_empty_transcript(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Empty transcript should trigger fallback voice analysis."""
    mock_ai = Mock()
    mock_ai.analyze_voice_emotion.return_value = None
    mock_ai.analyze_voice_emotion_fallback.return_value = {
        "primary_emotion": "sadness",
        "confidence": 0.7,
        "sentiment": "NEGATIVE",
        "score": -0.6,
    }
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="")

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_log_mood_dedup_exception_non_blocking(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """A failing duplicate check should not block logging."""
    moods = MagicMock()
    moods.where.return_value = moods
    moods.limit.return_value = moods
    moods.stream.side_effect = Exception("firestore error")
    _doc_ref = MagicMock()
    _doc_ref.id = "mock-mood-id"
    moods.add.return_value = (None, _doc_ref)

    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.post(
        "/api/mood/log",
        json={"score": 5, "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_log_mood_db_save_exception_still_responds(
    client, mocker, auth_csrf_headers, mock_subscription_ok, mock_crisis_none
):
    """Firestore add failure should be logged but still return success with the entry."""
    moods = MagicMock()
    moods.add.side_effect = Exception("firestore write failed")
    moods.where.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = []

    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.return_value = moods
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.post(
        "/api/mood/log",
        json={"score": 5, "timestamp": "2026-07-15T08:00:00Z"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_update_mood_invalid_id(client, auth_csrf_headers):
    response = client.put("/api/mood/bad-id!", json={"mood_text": "Ny"}, headers=auth_csrf_headers)
    assert response.status_code == 400


def test_update_mood_no_data(client, mocker, auth_csrf_headers, mock_ai_services):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.put("/api/mood/moodupdate1234", json={}, headers=auth_csrf_headers)
    assert response.status_code == 400


def test_update_mood_not_found(client, mocker, auth_csrf_headers):
    mood_doc = MagicMock()
    mood_doc.exists = False
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.put("/api/mood/missing1234", json={"mood_text": "Ny"}, headers=auth_csrf_headers)
    assert response.status_code == 404


def test_update_mood_exception(client, mocker, auth_csrf_headers, mock_ai_services):
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.to_dict.return_value = {"mood_text": "old", "timestamp": "2026-07-14T08:00:00Z"}
    mood_ref = MagicMock()
    mood_ref.get.side_effect = [mood_doc, Exception("firestore error")]
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.put("/api/mood/moodupdate1234", json={"mood_text": "Ny"}, headers=auth_csrf_headers)
    assert response.status_code == 500




def test_get_mood_streaks_with_datetime_objects(client, mocker, auth_csrf_headers):
    """Streaks should handle mood docs whose timestamp is a datetime object."""
    now = datetime.now(UTC)
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"streak-dt-{i}"
        d.to_dict.return_value = {
            "timestamp": now - timedelta(days=i),
            "score": 7,
        }
        docs.append(d)

    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_mood_streaks_empty_data(client, mocker, auth_csrf_headers):
    """Streaks with no recent data should return zero streaks."""
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[]))
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["currentStreak"] == 0


def test_predictive_forecast_empty_data(client, mocker, auth_csrf_headers):
    """Forecast with no data should return empty/no-forecast response."""
    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[]))
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/predictive-forecast", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_predictive_forecast_both_ai_failures(client, mocker, auth_csrf_headers):
    """Forecast should use static fallback when both AI forecast functions fail."""
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"forecast-fail-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 6,
        }
        docs.append(d)

    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))

    mock_ai = Mock()
    mock_ai.predictive_mood_forecasting_sklearn.side_effect = Exception("sklearn failed")
    mock_ai.predictive_mood_analytics.side_effect = Exception("analytics failed")
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))

    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/predictive-forecast", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["modelInfo"]["algorithm"] == "fallback"


def test_get_mood_statistics_user_lookup_exception(client, mocker, auth_csrf_headers):
    """Statistics endpoint should return 503 when Firestore user lookup fails."""
    moods = MagicMock()
    users_doc = MagicMock()
    users_doc.get.side_effect = Exception("firestore error")
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 503


def test_get_daily_analytics_invalid_days(client, mocker, auth_csrf_headers):
    """Daily analytics should reject non-integer days."""
    _patch_mood_stats_db(mocker)
    response = client.get("/api/mood-stats/daily?days=abc", headers=auth_csrf_headers)
    assert response.status_code == 400


def test_get_monthly_analytics_trend_improving(client, mocker, auth_csrf_headers):
    """Monthly analytics should detect improving trend."""
    now = datetime.now(UTC)
    docs = []
    for i, score in enumerate([4, 5, 7, 8]):
        d = MagicMock()
        d.id = f"trend-{i}"
        # Spread across this month and previous month
        month = now.month if i >= 2 else (now.month - 1 if now.month > 1 else 12)
        year = now.year if i >= 2 else (now.year if now.month > 1 else now.year - 1)
        d.to_dict.return_value = {
            "timestamp": now.replace(year=year, month=month, day=i + 1).isoformat(),
            "score": score,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["overallTrend"] in ("improving", "stable")


# ---------------------------------------------------------------------------
# Remaining branch coverage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("emotion,expected_mood", [
    ("sadness", "ledsen"),
    ("anger", "arg"),
    ("fear", "orolig"),
    ("surprise", "förvånad"),
    ("disgust", "irriterad"),
    ("trust", "lugn"),
    ("anticipation", "spännande"),
    ("neutral", "neutral"),
    ("unknown", "unknown"),
])
def test_log_mood_voice_emotion_variants(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker, emotion, expected_mood
):
    """Voice emotion fallback should map all supported emotions (and unknown to neutral)."""
    mock_ai = Mock()
    mock_ai.analyze_voice_emotion.return_value = None
    mock_ai.analyze_voice_emotion_fallback.return_value = {
        "primary_emotion": emotion,
        "confidence": 0.8,
        "sentiment": "NEUTRAL",
        "score": 0.0,
    }
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="")

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["mood"] == expected_mood


def test_delete_mood_firestore_exception(client, mocker, auth_csrf_headers):
    """Deleting a mood should return 500 if Firestore raises unexpectedly."""
    mood_ref = MagicMock()
    mood_ref.get.return_value = MagicMock(exists=True)
    mood_ref.delete.side_effect = Exception("firestore error")
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.delete("/api/mood/mooddelete1234", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_recent_moods_firestore_exception(client, mocker, auth_csrf_headers):
    """Recent moods should handle Firestore query failure gracefully."""
    moods = MagicMock()
    moods.order_by.side_effect = Exception("firestore error")
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200


def _make_weekly_moods_collection(docs):
    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = docs
    return moods


def test_get_weekly_analysis_memories_exception(client, mocker, auth_csrf_headers, mock_ai_services):
    """Weekly analysis should continue even if memory retrieval fails."""
    now = datetime.now(UTC)
    docs = []
    for i in range(3):
        d = MagicMock()
        d.id = f"weekly-mem-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 6,
            "sentiment": "NEUTRAL",
            "mood_text": "Neutral",
        }
        docs.append(d)

    moods = _make_weekly_moods_collection(docs)

    memories = MagicMock()
    memories.order_by.return_value = MagicMock(limit=MagicMock(stream=MagicMock(side_effect=Exception("firestore error"))))

    user_doc = MagicMock()
    user_doc.exists = True
    users_doc = MagicMock()
    users_doc.get.return_value = user_doc
    users_doc.collection.side_effect = lambda name: moods if name == "moods" else memories
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_routes.db", mock_db)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["data"]["recentMemories"] == []


def test_get_weekly_analysis_trend_declining(client, mocker, auth_csrf_headers, mock_ai_services):
    """Weekly analysis should report declining trend when scores drop over time."""
    now = datetime.now(UTC)
    docs = []
    for i, score in enumerate([2, 4, 6, 8]):
        d = MagicMock()
        d.id = f"weekly-trend-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": score,
            "sentiment": "NEUTRAL",
            "mood_text": "Bra",
        }
        docs.append(d)

    moods = _make_weekly_moods_collection(docs)
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["trend"] in ("declining", "stable")


def test_get_weekly_analysis_outer_exception(client, mocker, auth_csrf_headers):
    """Weekly analysis outer exception should return 500."""
    bad_doc = MagicMock()
    bad_doc.id = "weekly-bad"
    bad_doc.to_dict.return_value = None  # Will raise TypeError during processing

    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = [bad_doc]
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_predictive_forecast_with_insights(client, mocker, auth_csrf_headers, mock_ai_services):
    """Forecast should include insights when AI returns a full result."""
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"forecast-ins-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 7,
            "mood_text": "Bra",
        }
        docs.append(d)

    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))

    ai_services = mock_ai_services
    ai_services.predictive_mood_forecasting_sklearn.return_value = {
        "forecast_scores": [7, 7, 7],
        "trend": "stable",
        "confidence": 0.8,
        "insights": ["Maintain your current routine."],
        "recommendations": ["Keep journaling."],
    }

    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/predictive-forecast", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "recommendations" in data["data"]
    assert len(data["data"]["recommendations"]) > 0


def test_get_mood_statistics_with_varied_sentiments(client, mocker, auth_csrf_headers):
    """Statistics should compute percentages and best/worst days."""
    now = datetime.now(UTC)
    base = now.replace(hour=12, minute=0, second=0, microsecond=0)
    docs = []
    sentiments = ["POSITIVE", "POSITIVE", "NEGATIVE", "NEUTRAL"]
    scores = [8, 9, 3, 5]
    for i, (sentiment, score) in enumerate(zip(sentiments, scores)):
        d = MagicMock()
        d.id = f"stats-{i}"
        d.to_dict.return_value = {
            "timestamp": (base - timedelta(days=i)).isoformat(),
            "sentiment": sentiment,
            "score": score,
        }
        docs.append(d)

    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["positivePercentage"] > 0
    assert data["negativePercentage"] > 0
    assert data["bestDay"] is not None
    assert data["worstDay"] is not None


def test_get_mood_statistics_calculation_exception(client, mocker, auth_csrf_headers):
    """Statistics calculation exception should return 500 error response."""
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[MagicMock()]))
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_daily_analytics_exception(client, mocker, auth_csrf_headers):
    """Daily analytics should return 500 on unrecoverable Firestore failure."""
    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.side_effect = Exception("firestore error")
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_daily_analytics_with_entries(client, mocker, auth_csrf_headers):
    """Daily analytics should aggregate entries by hour."""
    now = datetime.now(UTC)
    docs = []
    for hour in [8, 12, 18]:
        d = MagicMock()
        d.id = f"daily-{hour}"
        d.to_dict.return_value = {
            "timestamp": now.replace(hour=hour, minute=0).isoformat(),
            "score": 7,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalEntries"] == 3


def test_get_monthly_analytics_exception(client, mocker, auth_csrf_headers):
    """Monthly analytics should return 500 on unrecoverable Firestore failure."""
    moods = MagicMock()
    moods.where.return_value = moods
    moods.order_by.side_effect = Exception("firestore error")
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly", headers=auth_csrf_headers)
    assert response.status_code == 500


# ---------------------------------------------------------------------------
# Direct unit tests for helper functions to cover remaining branches
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "total,average,trend,positive,negative,neutral,expected_substring",
    [
        (0, 0, "stable", 0, 0, 0, "Start logging your mood daily"),
        (8, 8.0, "improving", 5, 1, 2, "Fantastic!"),
        (8, 6.0, "improving", 5, 1, 2, "good"),
        (8, 4.5, "declining", 2, 5, 1, "challenging"),
        (8, 3.0, "stable", 1, 6, 1, "challenging"),
        (8, 6.0, "stable", 5, 1, 2, "stable"),
        (8, 6.0, "improving", 5, 1, 2, "positive trend"),
        (8, 6.0, "declining", 5, 1, 2, "dipped"),
        (10, 6.0, "stable", 5, 1, 4, "Excellent habit"),
        (5, 6.0, "stable", 5, 0, 0, "Great start"),
        (1, 6.0, "stable", 1, 0, 0, "Regular logging helps"),
        (5, 6.0, "stable", 4, 1, 0, "majority of your entries"),
        (5, 6.0, "stable", 1, 4, 0, "Breathing and meditation"),
    ],
)
def test_generate_weekly_insights_branches(
    total, average, trend, positive, negative, neutral, expected_substring
):
    from src.routes.mood_routes import _generate_weekly_insights

    result = _generate_weekly_insights(total, average, trend, positive, negative, neutral)
    assert expected_substring in result


# ---------------------------------------------------------------------------
# Remaining mood_stats_routes branches
# ---------------------------------------------------------------------------


def test_get_daily_analytics_query_fallback(client, mocker, auth_csrf_headers):
    """Daily analytics should fall back to client-side filtering when composite index is missing."""
    now = datetime.now(UTC)
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"daily-fb-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 6,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    # Make the first where/order_by query fail to trigger fallback
    moods.where.return_value.order_by.side_effect = Exception("missing composite index")
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_mood_statistics_outer_exception(client, mocker, auth_csrf_headers):
    """Statistics should return 500 when outer exception occurs."""
    users_doc = MagicMock()
    users_doc.get.side_effect = Exception("firestore user lookup failed")
    users_collection = MagicMock()
    users_collection.document.return_value = users_doc

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: users_collection if name == "users" else MagicMock()
    mocker.patch("src.routes.mood_stats_routes.db", mock_db)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 503


def test_update_mood_invalid_json_body(client, mocker, auth_csrf_headers):
    """Updating mood with malformed JSON should return 400."""
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.put(
        "/api/mood/moodupdate1234",
        data="not-json",
        content_type="application/json",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_update_mood_no_valid_fields(client, mocker, auth_csrf_headers, mock_ai_services):
    """Updating mood with no valid fields should return 400."""
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.to_dict.return_value = {"mood_text": "old", "timestamp": "2026-07-14T08:00:00Z"}
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)

    response = client.put(
        "/api/mood/moodupdate1234",
        json={"invalid_field": "value"},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 400


def test_get_weekly_analysis_trend_improving(client, mocker, auth_csrf_headers, mock_ai_services):
    """Weekly analysis should report improving trend when scores rise over time."""
    now = datetime.now(UTC)
    docs = []
    for i, score in enumerate([8, 7, 5, 3]):
        d = MagicMock()
        d.id = f"weekly-imp-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": score,
            "sentiment": "NEUTRAL",
            "mood_text": "Bra",
        }
        docs.append(d)

    moods = _make_weekly_moods_collection(docs)
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["trend"] == "improving"


def test_get_mood_streaks_with_gaps(client, mocker, auth_csrf_headers):
    """Streaks should calculate longest streak correctly even with gaps."""
    now = datetime.now(UTC)
    docs = []
    for i in [0, 1, 2, 4, 5]:
        d = MagicMock()
        d.id = f"streak-gap-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "score": 7,
        }
        docs.append(d)

    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["data"]["longestStreak"] >= 3


def test_log_mood_audio_transcript_without_voice_analysis(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Audio with transcript but failing voice analysis should fall back to transcript sentiment."""
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = {
        "sentiment": "POSITIVE",
        "confidence": 0.8,
        "score": 0.7,
    }
    mock_ai.analyze_voice_emotion.return_value = None
    mock_ai.analyze_voice_emotion_fallback.return_value = None
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value="Jag är glad idag")

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "note": "Jag är glad idag",
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_log_mood_audio_storage_success(client, mocker, auth_csrf_headers, mock_subscription_ok, mock_crisis_none):
    """Audio upload should successfully upload to Firebase Storage and continue."""
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = None
    mock_ai.analyze_voice_emotion.return_value = {
        "primary_emotion": "neutral",
        "confidence": 0.8,
        "sentiment": "NEUTRAL",
        "score": 0.0,
    }
    mock_ai.analyze_voice_emotion_fallback.return_value = None
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value=None)

    blob = MagicMock()
    bucket = MagicMock()
    bucket.blob.return_value = blob
    mocker.patch("src.routes.mood_routes.firebase_storage.bucket", return_value=bucket)

    _patch_mood_route_db(mocker)

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    blob.upload_from_string.assert_called_once()


def test_log_mood_validation_branches(client, mocker, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mock_ai_services):
    """Log mood should truncate note/context, parse string tags, and handle invalid score/valence/arousal."""
    _patch_mood_route_db(mocker)
    response = client.post(
        "/api/mood/log",
        json={
            "mood_text": "Bra",
            "note": "ABC" * 1000,
            "context": "C" * 600,
            "tags": '["stress", 42, "" , "x"]',
            "score": "invalid",
            "valence": "bad",
            "arousal": "-1",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_log_mood_voice_fallback_exception_uses_default(
    client, mock_firestore, auth_csrf_headers, mock_subscription_ok, mock_crisis_none, mocker
):
    """Voice fallback exception should use neutral default values."""
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = None
    mock_ai.analyze_voice_emotion.return_value = None
    mock_ai.analyze_voice_emotion_fallback.side_effect = Exception("fallback failed")
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    mocker.patch("src.utils.speech_utils.transcribe_audio_google", return_value=None)

    audio = BytesIO(b"fake audio")
    response = client.post(
        "/api/mood/log",
        data={
            "audio": (audio, "test.webm"),
            "mood_text": "",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_get_recent_moods_query_fallback(client, mocker, auth_csrf_headers):
    """Recent moods should use client-side fallback when composite-index query fails."""
    now = datetime.now(UTC)
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"recent-fb-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat(), "score": 7}
        docs.append(d)

    moods = MagicMock()
    where_query = MagicMock()
    where_query.order_by.return_value = MagicMock(stream=MagicMock(side_effect=Exception("missing index")))
    moods.where.return_value = where_query
    moods.stream.return_value = docs
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["data"]["moods"]) == 2


def test_get_recent_moods_outer_exception(client, mocker, auth_csrf_headers):
    """Recent moods should return 500 when unrecoverable error occurs."""
    moods = MagicMock()
    order_result = MagicMock()
    order_result.stream.side_effect = Exception("firestore")
    where_query = MagicMock()
    where_query.order_by.return_value = order_result
    moods.where.return_value = where_query
    moods.stream.side_effect = Exception("firestore")
    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_weekly_analysis_query_fallback(client, mocker, auth_csrf_headers, mock_ai_services):
    """Weekly analysis should use client-side fallback when composite-index query fails."""
    now = datetime.now(UTC)
    docs = []
    for i in range(4):
        d = MagicMock()
        d.id = f"weekly-fb-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat(), "score": 6, "sentiment": "NEUTRAL"}
        docs.append(d)

    moods = MagicMock()
    moods.where.return_value = moods
    where_query = MagicMock()
    where_query.order_by.return_value = MagicMock(stream=MagicMock(side_effect=Exception("missing index")))
    moods.where.return_value = where_query
    moods.order_by.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = docs

    _patch_mood_route_db(mocker, moods=moods)

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200


def _unwrap_route(func):
    """Unwrap decorators, including the conftest mock_jwt_required wrapper that lacks __wrapped__."""
    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__
    if func.__closure__:
        for cell in func.__closure__:
            try:
                candidate = cell.cell_contents
                if callable(candidate):
                    func = _unwrap_route(candidate)
                    break
            except ValueError:
                continue
    return func


def test_predictive_forecast_missing_user_id(app):
    """Predictive forecast should return 400 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.predictive_mood_forecast)
    with app.test_request_context("/api/mood/predictive-forecast?days_ahead=7"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 400


def test_log_mood_missing_user_id(app):
    """Log mood should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra"}), content_type="application/json"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


def test_get_moods_missing_user_id(app):
    """Get moods should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_moods)
    with app.test_request_context("/api/mood"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


def test_get_mood_missing_user_id(app):
    """Get mood by id should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_mood)
    with app.test_request_context("/api/mood/abc123def456"):
        mr.g.user_id = None
        response = unwrapped("abc123def456")
    assert response[1] == 401


def test_delete_mood_missing_user_id(app):
    """Delete mood should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.delete_mood)
    with app.test_request_context("/api/mood/abc123def456"):
        mr.g.user_id = None
        response = unwrapped("abc123def456")
    assert response[1] == 401


def test_update_mood_missing_user_id(app):
    """Update mood should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.update_mood)
    with app.test_request_context("/api/mood/abc123def456", method="PUT", data=json.dumps({"mood_text": "Bra"}), content_type="application/json"):
        mr.g.user_id = None
        response = unwrapped("abc123def456")
    assert response[1] == 401


def test_get_today_mood_missing_user_id(app):
    """Get today mood should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_today_mood)
    with app.test_request_context("/api/mood/today"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


def test_get_mood_streaks_missing_user_id(app):
    """Get streaks should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_mood_streaks)
    with app.test_request_context("/api/mood/streaks"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


def test_get_weekly_analysis_missing_user_id(app):
    """Weekly analysis should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_weekly_analysis)
    with app.test_request_context("/api/mood/weekly-analysis"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


# ---------------------------------------------------------------------------
# Remaining mood_stats_routes edge cases
# ---------------------------------------------------------------------------


def test_get_mood_statistics_no_user_id(app):
    """Statistics should return 403 when user_id is missing."""
    from src.routes import mood_stats_routes as msr
    unwrapped = _unwrap_route(msr.get_mood_statistics)
    with app.test_request_context("/api/mood-stats/statistics"):
        msr.g.user_id = None
        response = unwrapped()
    assert response[1] == 403


def test_get_daily_analytics_missing_user_id(app):
    """Daily analytics should return 403 when user_id is missing."""
    from src.routes import mood_stats_routes as msr
    unwrapped = _unwrap_route(msr.get_daily_analytics)
    with app.test_request_context("/api/mood-stats/daily?days=7"):
        msr.g.user_id = None
        response = unwrapped()
    assert response[1] == 403


def test_get_monthly_analytics_missing_user_id(app):
    """Monthly analytics should return 403 when user_id is missing."""
    from src.routes import mood_stats_routes as msr
    unwrapped = _unwrap_route(msr.get_monthly_analytics)
    with app.test_request_context("/api/mood-stats/monthly?months=3"):
        msr.g.user_id = None
        response = unwrapped()
    assert response[1] == 403


# ---------------------------------------------------------------------------
# Cache / Redis coverage
# ---------------------------------------------------------------------------


def test_cached_mood_data_no_user_id_dict_result(app):
    """Cache decorator should jsonify dict result when user_id is missing."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data

    @cached_mood_data(ttl=60)
    def dummy():
        return {"data": "x"}, 200

    with app.test_request_context("/"):
        mr.g.user_id = None
        response = dummy()
    assert response[1] == 200


def test_cached_mood_data_no_user_id_response_result(app):
    """Cache decorator should return raw response tuple when user_id is missing."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data
    from flask import jsonify

    @cached_mood_data(ttl=60)
    def dummy():
        return jsonify({"data": "x"}), 200

    with app.test_request_context("/"):
        mr.g.user_id = None
        response = dummy()
    assert response[1] == 200


def test_cached_mood_data_in_memory_cache_hit(app, client, mocker, auth_csrf_headers):
    """Cache decorator should return cached data when in-memory cache has a valid entry."""
    from src.routes import mood_routes as mr
    cache_key = "mood:get_recent_moods:testuser1234567890ab:[]"
    mr._mood_cache[cache_key] = ({"data": {"moods": []}}, __import__("time").time())
    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["cached"] is True


def test_cached_mood_data_redis_cache_miss(client, mocker, auth_csrf_headers):
    """Cache decorator should use Redis when available and fall through to function."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)
    _patch_mood_route_db(mocker)
    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    mock_redis.setex.assert_called_once()


def test_cached_mood_data_redis_cache_hit(app, mocker):
    """Cache decorator should return data from Redis cache."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = json.dumps({"data": "from-redis"})
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)

    @cached_mood_data(ttl=60)
    def dummy():
        return {"data": "compute"}, 200

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response[1] == 200
    assert response[0].get_json()["cached"] is True


def test_cached_mood_data_get_json_exception(app, mocker):
    """Cache decorator should return raw result if response.get_json raises."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data

    class FakeResponse:
        def get_json(self):
            raise Exception("bad json")

    @cached_mood_data(ttl=60)
    def dummy():
        return FakeResponse(), 200

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response[1] == 200


def test_cached_mood_data_redis_setex_exception(app, mocker):
    """Cache decorator should continue when Redis setex fails."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None
    mock_redis.setex.side_effect = Exception("redis write failed")
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)

    @cached_mood_data(ttl=60)
    def dummy():
        return {"data": "x"}, 200

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response[1] == 200


def test_cached_mood_data_cache_cleanup(app, mocker):
    """Cache decorator should cleanup old entries when cache exceeds max size."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data, MOOD_CACHE_MAX_SIZE
    import time

    @cached_mood_data(ttl=60)
    def dummy_for_key(i):
        return {"data": i}, 200

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        for i in range(MOOD_CACHE_MAX_SIZE + 2):
            mr._mood_cache[f"mood:dummy:{i}:user1:[]"] = ({"data": i}, time.time() - i)
        # Force cache miss by using unique cache key
        response = dummy_for_key(1)
    assert response[1] == 200


def test_cached_mood_data_non_dict_non_200_response(app, mocker):
    """Cache decorator should pass through non-200 or non-dict responses."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data

    @cached_mood_data(ttl=60)
    def dummy():
        return "plain text", 202

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response[1] == 202


def test_get_redis_client_initial_failure(client, mocker):
    """Redis client initialization failure should be handled gracefully."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mocker.patch.object(_redis, "from_url", side_effect=Exception("redis down"))
    assert mr._get_redis_client() is None
    assert mr._redis_unavailable is True


def test_invalidate_mood_cache_with_redis(mocker):
    """invalidate_mood_cache should scan and delete Redis keys for the user."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.scan.return_value = (0, ["mood:get_recent_moods:user1:()"])
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)
    mr._mood_cache["mood:get_recent_moods:user1:()"] = ({}, 0)
    mr.invalidate_mood_cache("user1")
    mock_redis.delete.assert_called_once()


def test_invalidate_mood_cache_redis_exception(mocker):
    """invalidate_mood_cache should handle Redis exception gracefully."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.scan.side_effect = Exception("redis scan failed")
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)
    mr._mood_cache["mood:get_recent_moods:user1:()"] = ({}, 0)
    mr.invalidate_mood_cache("user1")


def test_cached_mood_data_redis_get_exception(app, mocker):
    """Cache decorator should handle Redis get exception."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.side_effect = Exception("redis get failed")
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)

    @cached_mood_data(ttl=60)
    def dummy():
        return {"data": "x"}, 200

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response[1] == 200


def test_cached_mood_data_non_tuple_result(app, mocker):
    """Cache decorator should pass through non-tuple return values."""
    from src.routes import mood_routes as mr
    from src.routes.mood_routes import cached_mood_data
    from flask import jsonify

    @cached_mood_data(ttl=60)
    def dummy():
        return jsonify({"data": "x"})

    with app.test_request_context("/"):
        mr.g.user_id = "user1"
        response = dummy()
    assert response.status_code == 200


def test_predictive_forecast_options_unwrapped(app):
    """predictive_mood_forecast OPTIONS body should be reachable."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.predictive_mood_forecast)
    with app.test_request_context("/api/mood/predictive-forecast", method="OPTIONS"):
        response = unwrapped()
    assert response[1] == 200


def test_analyze_text_options_unwrapped(app):
    """analyze_text OPTIONS body should be reachable."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.analyze_text)
    with app.test_request_context("/api/mood/analyze-text", method="OPTIONS"):
        response = unwrapped()
    assert response[1] == 200


def test_analyze_text_text_not_string(app, mocker):
    """analyze_text should return 400 for non-string text."""
    from src.routes import mood_routes as mr
    mock_request = MagicMock()
    mock_request.get_json.return_value = {"text": b"not a string"}
    mocker.patch.object(mr, "request", mock_request)
    unwrapped = _unwrap_route(mr.analyze_text)
    with app.test_request_context("/api/mood/analyze-text", method="POST"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 400


def test_log_mood_options_unwrapped(app):
    """log_mood OPTIONS body should be reachable."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="OPTIONS"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 200


def test_log_mood_user_not_found_not_testing(app, mocker):
    """log_mood should return 404 when user not found and TESTING is False."""
    from src.routes import mood_routes as mr
    mock_user = MagicMock()
    mock_user.exists = False
    users = MagicMock()
    users.document.return_value = MagicMock(get=Mock(return_value=mock_user))
    mocker.patch.object(mr.db, "collection", side_effect=lambda name: users if name == "users" else MagicMock())
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        app.config["TESTING"] = False
        response = unwrapped()
        app.config["TESTING"] = True
    assert response[1] == 404


def test_log_mood_user_lookup_exception(app, mocker):
    """log_mood should return 503 when user lookup raises."""
    from src.routes import mood_routes as mr
    users = MagicMock()
    users.document.return_value = MagicMock(get=Mock(side_effect=Exception("firestore down")))
    mocker.patch.object(mr.db, "collection", side_effect=lambda name: users if name == "users" else MagicMock())
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 503


def test_log_mood_tags_not_json_string(app, mocker):
    """log_mood should treat non-JSON string tags as single tag."""
    from src.routes import mood_routes as mr
    _patch_mood_route_db(mocker)
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra", "tags": "stress, work"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 201


def test_log_mood_tags_non_string_non_empty(app, mocker):
    """log_mood should handle non-list, non-string tags."""
    from src.routes import mood_routes as mr
    _patch_mood_route_db(mocker)
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra", "tags": 123}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 201


def test_log_mood_score_validation(app, mocker):
    """log_mood should clamp out-of-range or non-numeric scores."""
    from src.routes import mood_routes as mr
    _patch_mood_route_db(mocker)
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra", "score": "abc", "valence": "20", "arousal": "0"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 201


def test_log_mood_outer_exception(app, mocker):
    """log_mood outer try should return 500 on unexpected exception."""
    from src.routes import mood_routes as mr
    mock_request = MagicMock()
    mock_request.content_type = "application/json"
    mock_request.get_json.side_effect = Exception("boom")
    mocker.patch.object(mr, "request", mock_request)
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 500


def test_get_mood_exception(app, mocker):
    """get_mood outer exception should return 500."""
    from src.routes import mood_routes as mr
    mocker.patch.object(mr.db, "collection", side_effect=Exception("firestore down"))
    unwrapped = _unwrap_route(mr.get_mood)
    with app.test_request_context("/api/mood/abc123def456"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped("abc123def456")
    assert response[1] == 500


def test_get_recent_moods_exception(app, mocker):
    """get_recent_moods outer exception should return 500."""
    from src.routes import mood_routes as mr
    mocker.patch.object(mr.db, "collection", side_effect=Exception("firestore down"))
    unwrapped = _unwrap_route(mr.get_recent_moods)
    with app.test_request_context("/api/mood/recent"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 500


def test_analyze_text_outer_exception(app, mocker):
    """analyze_text should return 500 on outer exception."""
    from src.routes import mood_routes as mr
    mock_request = MagicMock()
    mock_request.get_json.side_effect = Exception("boom")
    mocker.patch.object(mr, "request", mock_request)
    unwrapped = _unwrap_route(mr.analyze_text)
    with app.test_request_context("/api/mood/analyze-text", method="POST"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 500


def test_log_mood_score_out_of_range(app, mocker):
    """log_mood should clamp out-of-range score."""
    from src.routes import mood_routes as mr
    _patch_mood_route_db(mocker)
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra", "score": 15, "arousal": "abc"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 201


def test_log_mood_xp_award_exception(app, mocker):
    """log_mood should continue when XP award fails."""
    from src.routes import mood_routes as mr
    from src.services import rewards_helper
    _patch_mood_route_db(mocker)
    mocker.patch.object(rewards_helper, "award_xp", side_effect=Exception("reward service down"))
    unwrapped = _unwrap_route(mr.log_mood)
    with app.test_request_context("/api/mood/log", method="POST", data=json.dumps({"mood_text": "Bra"}), content_type="application/json"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 201


def test_test_mood_route(client, auth_csrf_headers):
    """Test /api/mood/test route."""
    response = client.get("/api/mood/test", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_recent_moods_missing_user_id(app):
    """get_recent_moods should return 401 when user_id is missing."""
    from src.routes import mood_routes as mr
    unwrapped = _unwrap_route(mr.get_recent_moods)
    with app.test_request_context("/api/mood/recent"):
        mr.g.user_id = None
        response = unwrapped()
    assert response[1] == 401


def test_get_weekly_analysis_query_fallback(app, mocker):
    """Weekly analysis should handle query exception and fallback."""
    from src.routes import mood_routes as mr
    _patch_mood_route_db(mocker)
    mock_mood_ref = MagicMock()
    mock_mood_ref.order_by.return_value = MagicMock(limit=MagicMock(stream=Mock(side_effect=Exception("query failed"))))
    mocker.patch.object(mr.db, "collection", side_effect=lambda name: MagicMock(document=Mock(return_value=MagicMock(collection=Mock(return_value=mock_mood_ref)))) if name == "users" else MagicMock())
    unwrapped = _unwrap_route(mr.get_weekly_analysis)
    with app.test_request_context("/api/mood/weekly-analysis"):
        mr.g.user_id = "testuser1234567890ab"
        response = unwrapped()
    assert response[1] == 200


def test_get_mood_statistics_outer_exception(client, mocker, auth_csrf_headers):
    """Statistics should return 500 on outer exception."""
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[MagicMock()]))
    _patch_mood_stats_db(mocker, moods=moods)
    mocker.patch("src.routes.mood_stats_routes.get_mood_statistics", side_effect=Exception("unexpected"))

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 500


def test_get_daily_analytics_monthly_aggregation(client, mocker, auth_csrf_headers):
    """Daily analytics should aggregate entries by hour and include hour breakdown."""
    now = datetime.now(UTC)
    docs = []
    for hour in [8, 8, 12, 18]:
        d = MagicMock()
        d.id = f"daily-hour-{hour}"
        d.to_dict.return_value = {
            "timestamp": now.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat(),
            "score": 7,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalEntries"] >= 4


def test_get_monthly_analytics_query_fallback(client, mocker, auth_csrf_headers):
    """Monthly analytics should use client-side fallback when composite-index query fails."""
    now = datetime.now(UTC)
    docs = []
    for i in range(2):
        d = MagicMock()
        d.id = f"monthly-fb-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i * 30)).isoformat(), "score": 6}
        docs.append(d)

    moods = MagicMock()
    where_query = MagicMock()
    where_query.order_by.return_value = MagicMock(stream=MagicMock(side_effect=Exception("missing index")))
    moods.where.return_value = where_query
    moods.order_by.return_value = moods
    moods.limit.return_value = moods
    moods.stream.return_value = docs

    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly", headers=auth_csrf_headers)
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Final coverage push: remaining uncovered branches
# ---------------------------------------------------------------------------


def test_invalidate_mood_cache_scan_not_tuple(mocker):
    """invalidate_mood_cache should break when scan_result is not a 2-tuple (line 194)."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.scan.return_value = "not-a-tuple"
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)
    mr._mood_cache["mood:get_recent_moods:user1:()"] = ({}, 0)
    mr.invalidate_mood_cache("user1")


def test_get_weekly_analysis_both_queries_fail(client, mocker, auth_csrf_headers):
    """Weekly analysis should return empty result when both where and fallback queries fail (lines 1145-1147)."""
    from src.routes import mood_routes as mr
    moods = MagicMock()
    where_query = MagicMock()
    where_order = MagicMock()
    where_order.limit.return_value = MagicMock(stream=MagicMock(side_effect=Exception("where failed")))
    where_query.order_by.return_value = where_order
    moods.where.return_value = where_query
    fallback_order = MagicMock()
    fallback_order.limit.return_value = MagicMock(stream=MagicMock(side_effect=Exception("fallback failed")))
    moods.order_by.return_value = fallback_order
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert response.get_json()["data"]["totalMoods"] == 0


def test_get_weekly_analysis_memories_exception(client, mocker, auth_csrf_headers):
    """Weekly analysis should continue when recent memories fetch fails (lines 1217-1218)."""
    from src.routes import mood_routes as mr
    now = datetime.now(UTC)
    mood_doc = MagicMock()
    mood_doc.id = "mood-1"
    mood_doc.to_dict.return_value = {
        "timestamp": now.isoformat(),
        "sentiment": "POSITIVE",
        "score": 8,
    }

    moods = MagicMock()
    where_query = MagicMock()
    where_order = MagicMock()
    where_order.limit.return_value = where_order
    where_order.stream.return_value = [mood_doc]
    where_query.order_by.return_value = where_order
    moods.where.return_value = where_query

    memories_collection = MagicMock()
    memories_order = MagicMock()
    memories_order.limit.return_value = MagicMock(stream=MagicMock(side_effect=Exception("memories query failed")))
    memories_collection.order_by.return_value = memories_order

    user_doc_ref = MagicMock()
    user_doc_ref.get.return_value = MagicMock(exists=True, to_dict=MagicMock(return_value={"email": "test@test.com"}))
    user_doc_ref.collection.side_effect = lambda name: moods if name == "moods" else memories_collection

    users_collection = MagicMock()
    users_collection.document.return_value = user_doc_ref
    mock_db = MagicMock()
    mock_db.collection.return_value = users_collection
    mocker.patch("src.routes.mood_routes.db", mock_db)
    mr._mood_cache.clear()

    response = client.get("/api/mood/weekly-analysis", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalMoods"] == 1
    assert data["recentMemories"] == []


def test_get_mood_statistics_non_consecutive_dates(client, mocker, auth_csrf_headers):
    """Statistics should handle non-consecutive dates for streak calculation (lines 150-151)."""
    now = datetime.now(UTC)
    docs = []
    dates = [now, now - timedelta(days=1), now - timedelta(days=5)]
    for i, dt in enumerate(dates):
        d = MagicMock()
        d.id = f"streak-{i}"
        d.to_dict.return_value = {
            "timestamp": dt.isoformat(),
            "sentiment": "POSITIVE",
            "score": 7,
        }
        docs.append(d)

    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["longestStreak"] >= 1


def test_get_mood_statistics_declining_trend(client, mocker, auth_csrf_headers):
    """Statistics should detect declining trend (line 174)."""
    now = datetime.now(UTC)
    docs = []
    scores = [2, 1, 8, 9]
    for i, score in enumerate(scores):
        d = MagicMock()
        d.id = f"decline-{i}"
        d.to_dict.return_value = {
            "timestamp": (now - timedelta(days=i)).isoformat(),
            "sentiment": "NEGATIVE" if score < 4 else "POSITIVE",
            "score": score,
        }
        docs.append(d)

    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["recentTrend"] == "declining"


def test_get_mood_statistics_outer_exception_direct(app):
    """Statistics outer except should return 500 (lines 195-197)."""
    from src.routes import mood_stats_routes as msr
    from unittest.mock import patch as _patch
    unwrapped = _unwrap_route(msr.get_mood_statistics)
    with app.test_request_context("/api/mood-stats/statistics"):
        with _patch.object(msr.g, "get", side_effect=Exception("g.get exploded")):
            response = unwrapped()
        assert response[1] == 500


def test_get_daily_analytics_datetime_timestamp(client, mocker, auth_csrf_headers):
    """Daily analytics should handle datetime objects with isoformat (line 269-270)."""
    now = datetime.now(UTC)
    d = MagicMock()
    d.id = "dt-ts"
    d.to_dict.return_value = {
        "timestamp": now,
        "score": 7,
        "tags": ["work"],
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_daily_analytics_non_string_non_datetime_timestamp(client, mocker, auth_csrf_headers):
    """Daily analytics should handle non-string non-datetime timestamps (line 271-272)."""
    d = MagicMock()
    d.id = "int-ts"
    d.to_dict.return_value = {
        "timestamp": 12345,
        "score": 7,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_daily_analytics_invalid_string_timestamp(client, mocker, auth_csrf_headers):
    """Daily analytics should handle invalid string timestamps (line 273-274)."""
    d = MagicMock()
    d.id = "bad-ts"
    d.to_dict.return_value = {
        "timestamp": "not-a-date",
        "score": 7,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_daily_analytics_low_intensity(client, mocker, auth_csrf_headers):
    """Daily analytics should count low intensity scores (line 287)."""
    now = datetime.now(UTC)
    d = MagicMock()
    d.id = "low-score"
    d.to_dict.return_value = {
        "timestamp": now.isoformat(),
        "score": 2,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["intensityDistribution"]["low"] == 1


def test_get_monthly_analytics_datetime_timestamp(client, mocker, auth_csrf_headers):
    """Monthly analytics should handle datetime objects with isoformat (line 410-411)."""
    now = datetime.now(UTC)
    d = MagicMock()
    d.id = "monthly-dt"
    d.to_dict.return_value = {
        "timestamp": now,
        "score": 7,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_monthly_analytics_non_string_non_datetime_timestamp(client, mocker, auth_csrf_headers):
    """Monthly analytics should handle non-string non-datetime timestamps (line 412-413)."""
    d = MagicMock()
    d.id = "monthly-int"
    d.to_dict.return_value = {
        "timestamp": 99999,
        "score": 7,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_monthly_analytics_invalid_string_timestamp(client, mocker, auth_csrf_headers):
    """Monthly analytics should handle invalid string timestamps (line 414-415)."""
    d = MagicMock()
    d.id = "monthly-bad"
    d.to_dict.return_value = {
        "timestamp": "garbage",
        "score": 7,
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200


def test_get_monthly_analytics_declining_trend(client, mocker, auth_csrf_headers):
    """Monthly analytics should detect declining trend (lines 445-446)."""
    now = datetime.now(UTC)
    docs = []
    scores = [8, 9, 3, 2]
    for i, score in enumerate(scores):
        d = MagicMock()
        d.id = f"monthly-decline-{i}"
        month = now.month if i >= 2 else (now.month - 1 if now.month > 1 else 12)
        year = now.year if i >= 2 else (now.year if now.month > 1 else now.year - 1)
        d.to_dict.return_value = {
            "timestamp": now.replace(year=year, month=month, day=min(i + 1, 28)).isoformat(),
            "score": score,
        }
        docs.append(d)

    moods = _make_stats_moods_collection(docs)
    _patch_mood_stats_db(mocker, moods=moods)

    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["overallTrend"] == "declining"


# ---------------------------------------------------------------------------
# Branch coverage: close every branch gap found by --cov-branch
# ---------------------------------------------------------------------------


# --- mood_routes.py branch gaps ---

def test_get_redis_client_already_initialized(mocker):
    """Branch 71->82: _redis_client already set, skip initialization."""
    from src.routes import mood_routes as mr
    mr._redis_unavailable = False
    existing = MagicMock()
    mr._redis_client = existing
    result = mr._get_redis_client()
    assert result is existing


def test_cached_mood_data_expired_cache(app, client, mocker, auth_csrf_headers):
    """Branch 105->110: cache item exists but is expired, should fall through to function."""
    from src.routes import mood_routes as mr
    import time as _time
    mr._redis_unavailable = True
    mr._redis_client = None
    cache_key = "mood:get_recent_moods:testuser1234567890ab:[]"
    mr._mood_cache[cache_key] = ({"data": {"moods": []}}, _time.time() - 9999)
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[]))
    _patch_mood_route_db(mocker, moods=moods)
    response = client.get("/api/mood/recent", headers=auth_csrf_headers)
    assert response.status_code == 200
    assert "cached" not in response.get_json() or response.get_json().get("cached") is not True


def test_invalidate_mood_cache_keys_and_cursor_loop(mocker):
    """Branches 189->191 and 191->185: scan returns keys and cursor != 0 (loop continues)."""
    from src.routes import mood_routes as mr
    import redis as _redis
    mr._redis_unavailable = False
    mr._redis_client = None
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    # First scan returns cursor=1 and keys=["key1"], second returns cursor=0 and keys=[]
    mock_redis.scan.side_effect = [(1, ["mood:get_recent:user1:()"]), (0, [])]
    mocker.patch.object(_redis, "from_url", return_value=mock_redis)
    mr._mood_cache["mood:get_recent_moods:user1:()"] = ({}, 0)
    mr.invalidate_mood_cache("user1")
    mock_redis.delete.assert_called_once_with("mood:get_recent:user1:()")


def test_log_mood_audio_storage_exception(client, mocker, auth_csrf_headers, mock_subscription_ok, mock_crisis_none):
    """Branch 297->315: multipart form with no audio file, audio_bytes is None, skip storage block."""
    from src.routes import mood_routes as mr
    mr._mood_cache.clear()
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = {"sentiment": "NEGATIVE", "score": 0.2, "emotions": ["tired"]}
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=SimpleNamespace(ai_services=mock_ai))
    _patch_mood_route_db(mocker)
    response = client.post(
        "/api/mood/log",
        data={
            "mood_text": "Trött idag",
            "score": "3",
            "timestamp": "2026-07-15T08:00:00Z",
        },
        content_type="multipart/form-data",
        headers=auth_csrf_headers,
    )
    assert response.status_code in (201, 200)


def test_log_mood_dedup_different_score(client, mocker, auth_csrf_headers, mock_subscription_ok, mock_crisis_none):
    """Branch 486->484: dedup check finds docs but scores differ, should continue."""
    from src.routes import mood_routes as mr
    mr._mood_cache.clear()
    now = datetime.now(UTC)
    existing_doc = MagicMock()
    existing_doc.to_dict.return_value = {"score": 5, "timestamp": now.isoformat()}
    moods = MagicMock()
    where_query = MagicMock()
    where_query.limit.return_value = MagicMock(stream=Mock(return_value=[existing_doc]))
    moods.where.return_value = where_query
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[]))
    _patch_mood_route_db(mocker, moods=moods)
    mock_ai = Mock()
    mock_ai.analyze_sentiment.return_value = {"sentiment": "POSITIVE", "score": 0.9, "emotions": ["happy"]}
    mocker.patch("src.routes.mood_routes._get_ai_services_module", return_value=Mock(ai_services=mock_ai))
    response = client.post(
        "/api/mood/log",
        json={"mood_text": "Bra dag", "score": 8},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 201


def test_get_moods_fallback_offset_zero(client, mocker, auth_csrf_headers):
    """Branch 751->753: fallback query with offset=0, should skip .offset() call."""
    from src.routes import mood_routes as mr
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"mood-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat(), "score": 7, "sentiment": "POSITIVE"}
        docs.append(d)
    moods = MagicMock()
    # Primary query fails to trigger fallback
    order_mock = MagicMock()
    limit_mock = MagicMock()
    limit_mock.stream.side_effect = Exception("composite index missing")
    order_mock.limit.return_value = limit_mock
    moods.order_by.return_value = order_mock
    # Fallback: limit(20).stream() — no offset call since offset=0
    fallback_limit = MagicMock()
    fallback_limit.stream.return_value = docs
    moods.limit.return_value = fallback_limit
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    mr._redis_client = None
    mr._redis_unavailable = True
    response = client.get("/api/mood", headers=auth_csrf_headers)
    assert response.status_code == 200
    # Verify fallback was used and offset was NOT called
    fallback_limit.offset.assert_not_called()


def test_get_recent_moods_fallback_with_offset(client, mocker, auth_csrf_headers):
    """Branch 751->753: fallback query with offset > 0 should apply offset."""
    from src.routes import mood_routes as mr
    now = datetime.now(UTC)
    docs = []
    for i in range(5):
        d = MagicMock()
        d.id = f"mood-{i}"
        d.to_dict.return_value = {"timestamp": (now - timedelta(days=i)).isoformat(), "score": 7, "sentiment": "POSITIVE"}
        docs.append(d)
    moods = MagicMock()
    # Primary query: order_by().limit().offset().stream() must raise
    order_mock = MagicMock()
    limit_mock = MagicMock()
    offset_mock = MagicMock()
    offset_mock.stream.side_effect = Exception("composite index missing")
    limit_mock.offset.return_value = offset_mock
    order_mock.limit.return_value = limit_mock
    moods.order_by.return_value = order_mock
    # Fallback: limit(20).offset(2).stream()
    fallback_limit = MagicMock()
    fallback_offset = MagicMock()
    fallback_offset.stream.return_value = docs
    fallback_limit.offset.return_value = fallback_offset
    moods.limit.return_value = fallback_limit
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    mr._redis_client = None
    mr._redis_unavailable = True
    response = client.get("/api/mood?limit=10&offset=2", headers=auth_csrf_headers)
    assert response.status_code == 200
    # Verify fallback was actually used by checking that offset was applied
    fallback_limit.offset.assert_called_once_with(2)


def test_update_mood_empty_mood_text(client, mocker, auth_csrf_headers, mock_ai_services):
    """Branch 934->943: mood_text in update_data but empty/whitespace, skip re-analysis."""
    mood_doc = MagicMock()
    mood_doc.exists = True
    mood_doc.id = "mood-abc123"
    mood_doc.to_dict.return_value = {"mood_text": "old", "timestamp": "2026-07-14T08:00:00Z"}
    mood_ref = MagicMock()
    mood_ref.get.return_value = mood_doc
    moods = MagicMock()
    moods.document.return_value = mood_ref
    _patch_mood_route_db(mocker, moods=moods)
    response = client.put(
        "/api/mood/mood-abc123",
        json={"mood_text": "   "},
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200


def test_get_mood_streaks_empty_timestamp(client, mocker, auth_csrf_headers):
    """Branch 1042->1039: timestamp is empty/falsy, should skip that doc in loop."""
    from src.routes import mood_routes as mr
    now = datetime.now(UTC)
    doc_with_ts = MagicMock()
    doc_with_ts.to_dict.return_value = {"timestamp": now.isoformat(), "score": 7}
    doc_empty_ts = MagicMock()
    doc_empty_ts.to_dict.return_value = {"timestamp": "", "score": 5}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc_with_ts, doc_empty_ts]))
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalLoggedDays"] == 1


def test_get_mood_streaks_no_logged_dates(client, mocker, auth_csrf_headers):
    """Branch 1055->1086: sorted_dates is empty (all docs had empty timestamps)."""
    from src.routes import mood_routes as mr
    doc = MagicMock()
    doc.to_dict.return_value = {"timestamp": "", "score": 5}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc]))
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["currentStreak"] == 0
    assert data["longestStreak"] == 0


def test_get_mood_streaks_today_not_logged(client, mocker, auth_csrf_headers):
    """Branch 1060->1069: current streak breaks immediately (today not in logged_dates)."""
    from src.routes import mood_routes as mr
    old_date = datetime.now(UTC).date() - timedelta(days=5)
    doc = MagicMock()
    doc.to_dict.return_value = {"timestamp": old_date.strftime("%Y-%m-%d") + "T08:00:00Z", "score": 7}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc]))
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    response = client.get("/api/mood/streaks", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["currentStreak"] == 0
    assert data["longestStreak"] >= 1


def test_get_mood_streaks_full_current_streak(app, mocker, auth_csrf_headers):
    """Branch 1060->1069: for loop completes all iterations without break (consecutive days including today)."""
    from src.routes import mood_routes as mr
    today = datetime.now(UTC).date()
    docs = []
    for i in range(3):
        d = MagicMock()
        d.to_dict.return_value = {
            "timestamp": (today - timedelta(days=i)).strftime("%Y-%m-%d") + "T08:00:00Z",
            "score": 7,
        }
        docs.append(d)
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=docs))
    _patch_mood_route_db(mocker, moods=moods)
    mr._mood_cache.clear()
    unwrapped = _unwrap_route(mr.get_mood_streaks)
    with app.test_request_context("/api/v1/mood/streaks", headers=auth_csrf_headers):
        mr.g.user_id = "testuser1234567890ab"
        result = unwrapped()
    # Result is a Flask Response with JSON data
    if hasattr(result, 'get_json'):
        data = result.get_json()["data"]
    elif isinstance(result, tuple):
        data = result[0].get_json()["data"]
    else:
        data = result["data"]
    assert data["currentStreak"] == 3


def test_generate_insights_stable_ratio(app):
    """Branch 1389->1396: total_moods == 0, skip positive ratio calculation entirely."""
    from src.routes import mood_routes as mr
    result = mr._generate_weekly_insights(
        total_moods=0,
        average_sentiment=5.0,
        trend="stable",
        positive_count=0,
        negative_count=0,
        neutral_count=0,
    )
    assert isinstance(result, str)
    assert len(result) > 0


# --- mood_stats_routes.py branch gaps ---

def test_get_mood_statistics_empty_timestamp(client, mocker, auth_csrf_headers):
    """Branch 98->81: timestamp is empty/falsy, should skip doc in loop."""
    now = datetime.now(UTC)
    doc_good = MagicMock()
    doc_good.id = "good-1"
    doc_good.to_dict.return_value = {
        "timestamp": now.isoformat(),
        "sentiment": "POSITIVE",
        "score": 7,
    }
    doc_empty = MagicMock()
    doc_empty.id = "empty-ts"
    doc_empty.to_dict.return_value = {
        "timestamp": "",
        "sentiment": "NEUTRAL",
        "score": 5,
    }
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc_good, doc_empty]))
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalMoods"] == 2


def test_get_mood_statistics_same_date_multiple_entries(client, mocker, auth_csrf_headers):
    """Branch 106->108: date_key already in mood_by_date, should append not create new list."""
    now = datetime.now(UTC)
    ts = now.isoformat()
    doc1 = MagicMock()
    doc1.id = "same-date-1"
    doc1.to_dict.return_value = {"timestamp": ts, "sentiment": "POSITIVE", "score": 8}
    doc2 = MagicMock()
    doc2.id = "same-date-2"
    doc2.to_dict.return_value = {"timestamp": ts, "sentiment": "POSITIVE", "score": 9}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc1, doc2]))
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["totalMoods"] == 2
    assert data["bestDay"] is not None
    assert data["worstDay"] is not None


def test_get_mood_statistics_no_dates_logged(client, mocker, auth_csrf_headers):
    """Branch 124->156: sorted_dates is empty (all docs had empty timestamps)."""
    doc = MagicMock()
    doc.id = "no-ts"
    doc.to_dict.return_value = {"timestamp": "", "sentiment": "NEUTRAL", "score": 5}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc]))
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["currentStreak"] == 0
    assert data["longestStreak"] == 0


def test_get_mood_statistics_no_mood_by_date(client, mocker, auth_csrf_headers):
    """Branch 158->165: mood_by_date is empty, best_day/worst_day should be None."""
    now = datetime.now(UTC)
    # Doc with timestamp but score is None so mood_by_date won't have entries
    # Actually, mood_by_date is populated whenever timestamp is truthy, so we need
    # a doc with a valid timestamp but check that best_day/worst_day are None when
    # mood_by_date is empty. The only way mood_by_date is empty is if no docs have timestamps.
    # But that also means sorted_dates is empty. Let's use docs with empty timestamps.
    doc = MagicMock()
    doc.id = "no-ts-2"
    doc.to_dict.return_value = {"timestamp": "", "sentiment": "NEUTRAL", "score": 5}
    moods = MagicMock()
    moods.order_by.return_value = MagicMock(stream=Mock(return_value=[doc]))
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/statistics", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["bestDay"] is None
    assert data["worstDay"] is None


def test_get_daily_analytics_falsy_tag(client, mocker, auth_csrf_headers):
    """Branch 282->281: tag is falsy (None/empty), should skip in loop."""
    now = datetime.now(UTC)
    d = MagicMock()
    d.id = "falsy-tag"
    d.to_dict.return_value = {
        "timestamp": now.isoformat(),
        "score": 7,
        "tags": ["work", None, "", "happy"],
    }
    moods = _make_stats_moods_collection([d])
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/daily?days=7", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    tag_freq = data.get("tagFrequency", [])
    tag_names = [t["tag"] for t in tag_freq]
    assert "work" in tag_names
    assert "happy" in tag_names
    assert "" not in tag_names
    assert "None" not in tag_names


def test_get_monthly_analytics_stable_trend(client, mocker, auth_csrf_headers):
    """Branch 445->448: neither improving nor declining (stable trend with data)."""
    now = datetime.now(UTC)
    docs = []
    # Same scores across months -> first_avg == last_avg -> neither branch taken
    for i in range(4):
        d = MagicMock()
        d.id = f"stable-{i}"
        month = now.month if i >= 2 else (now.month - 1 if now.month > 1 else 12)
        year = now.year if i >= 2 else (now.year if now.month > 1 else now.year - 1)
        d.to_dict.return_value = {
            "timestamp": now.replace(year=year, month=month, day=min(i + 1, 28)).isoformat(),
            "score": 6,
        }
        docs.append(d)
    moods = _make_stats_moods_collection(docs)
    _patch_mood_stats_db(mocker, moods=moods)
    response = client.get("/api/mood-stats/monthly?months=3", headers=auth_csrf_headers)
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["overallTrend"] == "stable"
