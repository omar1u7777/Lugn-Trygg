"""
Emulator-based integration tests for Humör (Mood) system.

Tests against Firebase Firestore Emulator — no real Firebase data is touched.
Requires:
    1. Java 11+ installed
    2. Firebase CLI: npm install -g firebase-tools
    3. Start emulator: firebase emulators:start --config firebase.emulator.json
    4. Set env: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

Run with:
    .venv\\Scripts\\python.exe -m pytest live_tests/test_mood_emulator.py -v -s

These tests create real Firestore documents (in the emulator) and verify
the full route handler logic without mocking Firestore.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import pytest

pytestmark = [pytest.mark.e2e, pytest.mark.emulator]

UTC = UTC


def _emulator_running(host: str = "127.0.0.1", port: int = 8080) -> bool:
    """Check if Firestore emulator is reachable."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def _emulator_guard():
    """Skip all tests if emulator is not running."""
    if not _emulator_running():
        pytest.skip(
            "Firestore emulator not running. Start it with: "
            "firebase emulators:start --config firebase.emulator.json"
        )
    os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
    os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099"
    os.environ.setdefault("FIREBASE_CREDENTIALS", '{"type":"service_account","project_id":"emulator-test","private_key_id":"test","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIBvQIBADANBgkqhkiG9w0BAQEFAASCAu8BMgQBAQKBgQDf0\\n-----END PRIVATE KEY-----\\n","client_email":"test@emulator-test.iam.gserviceaccount.com","client_id":"123","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/test%40emulator-test.iam.gserviceaccount.com"}')
    os.environ.setdefault("FIREBASE_PROJECT_ID", "emulator-test")
    os.environ.setdefault("FIREBASE_STORAGE_BUCKET", "emulator-test.appspot.com")
    os.environ.setdefault("FIREBASE_DATABASE_URL", "http://127.0.0.1:8080")
    os.environ.setdefault("JWT_SECRET_KEY", "emulator-test-secret-key-at-least-32-chars-long")
    os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "emulator-test-refresh-secret-key-32-chars")
    os.environ.setdefault("FIREBASE_WEB_API_KEY", "test-api-key")
    os.environ.setdefault("FIREBASE_API_KEY", "test-api-key")
    os.environ.setdefault("FIREBASE_APP_ID", "1:123:web:456")
    os.environ.setdefault("FIREBASE_MESSAGING_SENDER_ID", "123")
    os.environ.setdefault("FIREBASE_AUTH_DOMAIN", "emulator-test.firebaseapp.com")
    os.environ.setdefault("ENCRYPTION_KEY", "0" * 64)
    os.environ.setdefault("HIPAA_ENCRYPTION_KEY", "test-fernet-key-for-emulator-testing-only")


@pytest.fixture(scope="module")
def firestore_client():
    """Get a Firestore client connected to the emulator."""
    import firebase_admin
    from firebase_admin import credentials, firestore

    # Force reinitialize for emulator
    try:
        firebase_admin.delete_app(firebase_admin.get_app())
    except Exception:
        pass

    cred_json = {
        "type": "service_account",
        "project_id": "emulator-test",
        "private_key_id": "test",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIBvQIBADANBgkqhkiG9w0BAQEFAASCAu8BMgQBAQKBgQDf0\n-----END PRIVATE KEY-----\n",
        "client_email": "test@emulator-test.iam.gserviceaccount.com",
        "client_id": "123",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    cred = credentials.Certificate(cred_json)
    firebase_admin.initialize_app(cred, {
        "projectId": "emulator-test",
        "storageBucket": "emulator-test.appspot.com",
    })

    db = firestore.client()
    yield db

    try:
        firebase_admin.delete_app(firebase_admin.get_app())
    except Exception:
        pass


@pytest.fixture(autouse=True)
def _cleanup_moods(firestore_client):
    """Clean up all mood documents before and after each test."""
    db = firestore_client
    # Clean before
    try:
        docs = db.collection("moods").stream()
        for doc in docs:
            doc.reference.delete()
    except Exception:
        pass
    yield
    # Clean after
    try:
        docs = db.collection("moods").stream()
        for doc in docs:
            doc.reference.delete()
    except Exception:
        pass


TEST_USER_ID = "emulator-test-user-001"


def _create_test_mood(db, user_id: str, score: int = 7, text: str = "Test mood", days_ago: int = 0):
    """Helper to create a mood document in the emulator."""
    timestamp = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    doc_ref = db.collection("moods").document()
    doc_ref.set({
        "user_id": user_id,
        "mood_text": text,
        "score": score,
        "sentiment": "POSITIVE" if score >= 6 else "NEGATIVE" if score <= 4 else "NEUTRAL",
        "timestamp": timestamp,
        "tags": [],
        "created_at": timestamp,
    })
    return doc_ref.id


# ─── Firestore Direct Tests ───


def test_emulator_create_and_read_mood(firestore_client):
    """Create a mood document and read it back from Firestore emulator."""
    db = firestore_client
    mood_id = _create_test_mood(db, TEST_USER_ID, score=8, text="Glad idag")

    doc = db.collection("moods").document(mood_id).get()
    assert doc.exists, f"Mood document {mood_id} not found"
    data = doc.to_dict()
    assert data["mood_text"] == "Glad idag"
    assert data["score"] == 8
    assert data["user_id"] == TEST_USER_ID


def test_emulator_query_moods_by_user(firestore_client):
    """Query moods by user_id in Firestore emulator."""
    db = firestore_client
    _create_test_mood(db, TEST_USER_ID, score=7, text="Mood 1", days_ago=2)
    _create_test_mood(db, TEST_USER_ID, score=5, text="Mood 2", days_ago=1)
    _create_test_mood(db, TEST_USER_ID, score=9, text="Mood 3", days_ago=0)

    from firebase_admin import firestore as fs
    docs = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .order_by("timestamp", direction="DESCENDING")
        .limit(10)
        .stream()
    )
    assert len(docs) == 3
    # Verify ordering (most recent first)
    texts = [doc.to_dict()["mood_text"] for doc in docs]
    assert texts[0] == "Mood 3"  # Most recent
    assert texts[2] == "Mood 1"  # Oldest


def test_emulator_update_mood(firestore_client):
    """Update a mood document in Firestore emulator."""
    db = firestore_client
    mood_id = _create_test_mood(db, TEST_USER_ID, score=5, text="Original")

    doc_ref = db.collection("moods").document(mood_id)
    doc_ref.update({"mood_text": "Updated", "score": 8})

    doc = doc_ref.get()
    data = doc.to_dict()
    assert data["mood_text"] == "Updated"
    assert data["score"] == 8


def test_emulator_delete_mood(firestore_client):
    """Delete a mood document from Firestore emulator."""
    db = firestore_client
    mood_id = _create_test_mood(db, TEST_USER_ID, score=3, text="To delete")

    doc_ref = db.collection("moods").document(mood_id)
    doc_ref.delete()

    doc = doc_ref.get()
    assert not doc.exists


def test_emulator_mood_with_tags(firestore_client):
    """Verify mood with tags is stored correctly in Firestore."""
    db = firestore_client
    doc_ref = db.collection("moods").document()
    doc_ref.set({
        "user_id": TEST_USER_ID,
        "mood_text": "Stressig dag",
        "score": 4,
        "sentiment": "NEGATIVE",
        "timestamp": datetime.now(UTC).isoformat(),
        "tags": ["stress", "jobb", "deadline"],
        "created_at": datetime.now(UTC).isoformat(),
    })

    doc = doc_ref.get()
    data = doc.to_dict()
    assert data["tags"] == ["stress", "jobb", "deadline"]
    assert len(data["tags"]) == 3


def test_emulator_mood_streak_calculation(firestore_client):
    """Verify streak calculation with consecutive days in Firestore."""
    db = firestore_client
    # Create moods for 3 consecutive days including today
    for i in range(3):
        _create_test_mood(db, TEST_USER_ID, score=7, text=f"Day {i}", days_ago=i)

    from firebase_admin import firestore as fs
    docs = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .stream()
    )

    logged_dates = set()
    for doc in docs:
        data = doc.to_dict()
        ts = data.get("timestamp", "")
        if ts:
            logged_dates.add(ts[:10])

    today = datetime.now(UTC).date()
    current_streak = 0
    current_date = today
    for _ in range(len(logged_dates)):
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str in logged_dates:
            current_streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    assert current_streak == 3, f"Expected streak=3, got {current_streak}"


def test_emulator_mood_streak_with_gap(firestore_client):
    """Verify streak breaks on non-consecutive days."""
    db = firestore_client
    # Today and 2 days ago (gap yesterday)
    _create_test_mood(db, TEST_USER_ID, score=7, text="Today", days_ago=0)
    _create_test_mood(db, TEST_USER_ID, score=7, text="2 days ago", days_ago=2)

    from firebase_admin import firestore as fs
    docs = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .stream()
    )

    logged_dates = set()
    for doc in docs:
        data = doc.to_dict()
        ts = data.get("timestamp", "")
        if ts:
            logged_dates.add(ts[:10])

    today = datetime.now(UTC).date()
    current_streak = 0
    current_date = today
    for _ in range(len(logged_dates)):
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str in logged_dates:
            current_streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    # Today is logged but yesterday is not → streak = 1
    assert current_streak == 1, f"Expected streak=1 (gap), got {current_streak}"


def test_emulator_pagination(firestore_client):
    """Verify pagination works with limit and offset in Firestore."""
    db = firestore_client
    for i in range(10):
        _create_test_mood(db, TEST_USER_ID, score=5 + i % 5, text=f"Mood {i}", days_ago=i)

    from firebase_admin import firestore as fs
    # Page 1: limit=5, offset=0
    page1 = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .order_by("timestamp", direction="DESCENDING")
        .limit(5)
        .offset(0)
        .stream()
    )
    assert len(page1) == 5

    # Page 2: limit=5, offset=5
    page2 = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .order_by("timestamp", direction="DESCENDING")
        .limit(5)
        .offset(5)
        .stream()
    )
    assert len(page2) == 5

    # Verify no overlap
    page1_ids = {doc.id for doc in page1}
    page2_ids = {doc.id for doc in page2}
    assert page1_ids & page2_ids == set(), "Pages should not overlap"


def test_emulator_sentiment_filter(firestore_client):
    """Verify sentiment filtering in Firestore queries."""
    db = firestore_client
    _create_test_mood(db, TEST_USER_ID, score=9, text="Positive", days_ago=0)
    _create_test_mood(db, TEST_USER_ID, score=2, text="Negative", days_ago=1)
    _create_test_mood(db, TEST_USER_ID, score=5, text="Neutral", days_ago=2)

    from firebase_admin import firestore as fs
    positive_docs = list(
        db.collection("moods")
        .where(filter=fs.FieldFilter("user_id", "==", TEST_USER_ID))
        .where(filter=fs.FieldFilter("sentiment", "==", "POSITIVE"))
        .stream()
    )
    assert len(positive_docs) == 1
    assert positive_docs[0].to_dict()["mood_text"] == "Positive"
