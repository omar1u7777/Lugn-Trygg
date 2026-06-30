"""
QA Test Suite - Shared Fixtures
===============================
Shared fixtures for the complete QA test suite covering:
- Humör (Mood tracking)
- AI Stöd (AI support)
- Klinisk bedömning (Clinical assessment)
- Dagliga insikter (Daily insights)

Provides mock Redis, mock Firestore, Flask test client, and auth helpers.
Designed for CI/CD pipelines (GitHub Actions).
"""

import json
import os
import sys
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest

# Ensure backend path is available
backend_dir = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, backend_dir)


# ---------------------------------------------------------------------------
# Redis Mock Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_redis_client():
    """Create a fully functional in-memory Redis mock for testing.

    Supports: get, set, setex, delete, ping, scan, exists, expire, ttl
    """
    store: dict[str, str] = {}
    ttls: dict[str, float] = {}

    client = MagicMock()
    client.ping = Mock(return_value=True)

    def _get(key):
        return store.get(key)

    def _set(key, value, ex=None, **kwargs):
        store[key] = str(value)
        if ex:
            ttls[key] = datetime.now(UTC).timestamp() + ex
        return True

    def _setex(key, ttl, value):
        store[key] = str(value)
        ttls[key] = datetime.now(UTC).timestamp() + ttl
        return True

    def _delete(*keys):
        deleted = 0
        for key in keys:
            if key in store:
                del store[key]
                ttls.pop(key, None)
                deleted += 1
        return deleted

    def _exists(key):
        return 1 if key in store else 0

    def _scan(cursor=0, match=None, count=100):
        matched = []
        for key in store:
            if match and '*' in match:
                import fnmatch
                if fnmatch.fnmatch(key, match):
                    matched.append(key)
            elif match and key == match:
                matched.append(key)
            elif not match:
                matched.append(key)
        return (0, matched)

    def _expire(key, ttl):
        ttls[key] = datetime.now(UTC).timestamp() + ttl
        return True

    def _ttl(key):
        if key not in ttls:
            return -1
        remaining = ttls[key] - datetime.now(UTC).timestamp()
        return int(remaining) if remaining > 0 else -2

    client.get = Mock(side_effect=_get)
    client.set = Mock(side_effect=_set)
    client.setex = Mock(side_effect=_setex)
    client.delete = Mock(side_effect=_delete)
    client.exists = Mock(side_effect=_exists)
    client.scan = Mock(side_effect=_scan)
    client.expire = Mock(side_effect=_expire)
    client.ttl = Mock(side_effect=_ttl)

    # Expose store for test assertions
    client._store = store

    return client


@pytest.fixture
def mock_redis_down():
    """Simulate Redis being unavailable (connection refused)."""
    import redis
    client = MagicMock()
    client.ping = Mock(side_effect=redis.ConnectionError("Connection refused"))
    client.get = Mock(side_effect=redis.ConnectionError("Connection refused"))
    client.set = Mock(side_effect=redis.ConnectionError("Connection refused"))
    client.setex = Mock(side_effect=redis.ConnectionError("Connection refused"))
    return client


# ---------------------------------------------------------------------------
# Firestore Mock Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_firestore_moods():
    """Mock Firestore with pre-populated mood entries for testing.

    Returns a mock db with users/{uid}/moods subcollection containing
    5 mood entries spanning the last 7 days.
    """
    now = datetime.now(UTC)
    mood_entries = []
    for i in range(5):
        mood_entries.append({
            'id': f'mood_{i}',
            'mood_text': ['Glad', 'Neutral', 'Bra', 'Orolig', 'Ledsen'][i],
            'score': [9, 5, 7, 3, 2][i],
            'timestamp': (now - timedelta(days=i)).isoformat(),
            'sentiment': ['POSITIVE', 'NEUTRAL', 'POSITIVE', 'NEGATIVE', 'NEGATIVE'][i],
            'sentiment_score': [0.8, 0.0, 0.6, -0.5, -0.7][i],
            'tags': [['nature', 'exercise'], ['work'], ['social'], [], ['stress']][i],
            'note': f'Mood entry {i}',
            'valence': [8, 5, 7, 3, 2][i],
            'arousal': [6, 4, 5, 7, 3][i],
        })

    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_query = MagicMock()
    mock_query.stream.return_value = [
        Mock(id=e['id'], to_dict=Mock(return_value={k: v for k, v in e.items() if k != 'id'}))
        for e in mood_entries
    ]
    mock_collection.order_by.return_value = mock_query
    mock_collection.where.return_value = mock_collection
    mock_collection.limit.return_value = mock_collection

    mock_user_doc = MagicMock()
    mock_user_doc.collection.return_value = mock_collection
    mock_users = MagicMock()
    mock_users.document.return_value = mock_user_doc
    mock_db.collection.return_value = mock_users

    return mock_db, mood_entries


@pytest.fixture
def mock_firestore_empty():
    """Mock Firestore that returns empty results (no mood entries)."""
    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_query = MagicMock()
    mock_query.stream.return_value = []
    mock_collection.order_by.return_value = mock_query
    mock_collection.where.return_value = mock_collection
    mock_collection.limit.return_value = mock_collection

    mock_user_doc = MagicMock()
    mock_user_doc.collection.return_value = mock_collection
    mock_users = MagicMock()
    mock_users.document.return_value = mock_user_doc
    mock_db.collection.return_value = mock_users

    return mock_db


# ---------------------------------------------------------------------------
# Auth Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def no_auth_headers():
    """Return empty headers (no Authorization) for testing 401 responses."""
    return {}


@pytest.fixture
def invalid_auth_headers():
    """Return invalid Authorization header for testing 401 responses."""
    return {"Authorization": "Bearer invalid-token-abc123"}


# ---------------------------------------------------------------------------
# Test Data Factories
# ---------------------------------------------------------------------------

@pytest.fixture
def make_mood_data():
    """Factory for creating valid mood log payloads."""
    def _make(
        score: int = 5,
        mood_text: str = "Neutral",
        note: str = "",
        tags: list[str] | None = None,
        valence: int = 5,
        arousal: int = 5,
    ) -> dict:
        return {
            'score': score,
            'mood_text': mood_text,
            'note': note,
            'tags': tags or [],
            'valence': valence,
            'arousal': arousal,
            'timestamp': datetime.now(UTC).isoformat(),
        }
    return _make


@pytest.fixture
def make_phq9_data():
    """Factory for creating PHQ-9 assessment payloads (9 questions, 0-3 each)."""
    def _make(answers: list[int] | None = None) -> dict:
        if answers is None:
            answers = [0] * 9
        return {'responses': {f'q{i+1}': a for i, a in enumerate(answers)}}
    return _make


@pytest.fixture
def make_gad7_data():
    """Factory for creating GAD-7 assessment payloads (7 questions, 0-3 each)."""
    def _make(answers: list[int] | None = None) -> dict:
        if answers is None:
            answers = [0] * 7
        return {'responses': {f'q{i+1}': a for i, a in enumerate(answers)}}
    return _make
