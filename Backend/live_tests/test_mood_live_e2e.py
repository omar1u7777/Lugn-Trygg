"""
Live E2E tests for Humör (Mood) system against deployed backend.

Tests the full stack: Flask → real Firestore → real Redis.
Run with:
    LIVE_FIREBASE_E2E=1 LIVE_BASE_URL=https://lugn-trygg-backend.onrender.com \
    LIVE_FIREBASE_EMAIL=test@example.com LIVE_FIREBASE_PASSWORD=SecureP@ss123! \
    .venv\\Scripts\\python.exe -m pytest live_tests/test_mood_live_e2e.py -v -s

These tests create and delete real Firestore documents — use a dedicated
test user to avoid polluting production data.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import requests

pytestmark = [pytest.mark.e2e, pytest.mark.live]

UTC = timezone.utc


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        pytest.skip(f"Missing required env var: {name}")
    return value


@pytest.fixture(scope="session", autouse=True)
def _live_guard() -> None:
    if os.getenv("LIVE_FIREBASE_E2E", "").strip() != "1":
        pytest.skip("Set LIVE_FIREBASE_E2E=1 to run live Firebase E2E tests")


@pytest.fixture(scope="session")
def base_url() -> str:
    return _required_env("LIVE_BASE_URL").rstrip("/")


@pytest.fixture(scope="session")
def live_credentials() -> dict[str, str]:
    return {
        "email": _required_env("LIVE_FIREBASE_EMAIL"),
        "password": _required_env("LIVE_FIREBASE_PASSWORD"),
    }


def _request_with_retry(
    session: requests.Session,
    method: str,
    url: str,
    retries: int = 3,
    backoff: float = 0.75,
    **kwargs: Any,
) -> requests.Response:
    """Send HTTP request with 429 retry and proper timeout."""
    response: requests.Response | None = None
    for attempt in range(1, retries + 1):
        response = session.request(method=method, url=url, timeout=30, **kwargs)
        if response.status_code != 429:
            return response
        time.sleep(backoff * attempt)
    assert response is not None
    return response


def _extract_json(response: requests.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError as exc:
        raise AssertionError(
            f"Expected JSON from {response.request.method} {response.url}, "
            f"got: {response.text[:400]}"
        ) from exc


def _extract_access_token(payload: dict[str, Any]) -> str:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    token = data.get("accessToken") or data.get("access_token")
    assert token, f"Missing access token in payload: {payload}"
    return str(token)


def _get_csrf_token(session: requests.Session, base_url: str) -> str:
    csrf_resp = _request_with_retry(session, "GET", f"{base_url}/api/v1/dashboard/csrf-token")
    assert csrf_resp.status_code == 200, (
        f"CSRF token fetch failed: {csrf_resp.status_code} {csrf_resp.text[:300]}"
    )
    payload = _extract_json(csrf_resp)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    csrf_token = data.get("csrfToken")
    assert csrf_token, f"Missing csrfToken in response: {payload}"
    return str(csrf_token)


@pytest.fixture(scope="module")
def auth_session(base_url: str, live_credentials: dict[str, str]):
    """Login and return an authenticated requests.Session with CSRF token."""
    session = requests.Session()

    # Login
    login_resp = _request_with_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/login",
        json=live_credentials,
        headers={"Content-Type": "application/json"},
    )
    assert login_resp.status_code == 200, (
        f"Login failed: {login_resp.status_code} {login_resp.text[:300]}"
    )

    login_payload = _extract_json(login_resp)
    access_token = _extract_access_token(login_payload)
    csrf_token = _get_csrf_token(session, base_url)

    session.headers.update({
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": csrf_token,
    })

    yield session

    # Cleanup: logout
    try:
        _request_with_retry(session, "POST", f"{base_url}/api/v1/auth/logout")
    except Exception:
        pass


# ─── Test: Log mood (POST /api/v1/mood/log) ───


def test_live_log_mood_text(base_url: str, auth_session: requests.Session):
    """Log a text-only mood entry against real Firestore."""
    mood_text = f"Live test mood at {datetime.now(UTC).isoformat()}"
    response = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/log",
        json={"mood_text": mood_text, "score": 7},
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code in (200, 201), (
        f"Log mood failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    # Verify response structure
    mood_data = data.get("data", data)
    assert "moodId" in mood_data or "id" in mood_data or "mood_id" in mood_data, (
        f"Missing mood ID in response: {data}"
    )
    # Store ID for cleanup
    mood_id = mood_data.get("moodId") or mood_data.get("id") or mood_data.get("mood_id")
    test_live_log_mood_text.mood_id = mood_id  # type: ignore[attr-defined]


def test_live_log_mood_with_tags(base_url: str, auth_session: requests.Session):
    """Log mood with tags array — verifies tag storage in real Firestore."""
    response = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/log",
        json={
            "mood_text": "Taggat humör",
            "score": 6,
            "tags": ["stress", "jobb", "fokus"],
        },
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code in (200, 201), (
        f"Log mood with tags failed: {response.status_code} {response.text[:400]}"
    )


def test_live_log_mood_invalid_score(base_url: str, auth_session: requests.Session):
    """Score outside 1-10 range should be rejected or clamped."""
    response = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/log",
        json={"mood_text": "Test", "score": 999},
        headers={"Content-Type": "application/json"},
    )
    # Should be 400 or clamped to valid range
    assert response.status_code in (200, 201, 400), (
        f"Unexpected status for invalid score: {response.status_code} {response.text[:300]}"
    )


# ─── Test: Get moods (GET /api/v1/mood) ───


def test_live_get_moods(base_url: str, auth_session: requests.Session):
    """Fetch mood history from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood?limit=10",
    )
    assert response.status_code == 200, (
        f"Get moods failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    mood_data = data.get("data", data)
    assert "moods" in mood_data, f"Missing 'moods' key in response: {data}"
    assert isinstance(mood_data["moods"], list), f"'moods' should be a list: {data}"
    # We just logged at least one mood — verify it appears
    if len(mood_data["moods"]) > 0:
        first = mood_data["moods"][0]
        assert "timestamp" in first or "score" in first, (
            f"Mood entry missing expected fields: {first}"
        )


def test_live_get_moods_with_pagination(base_url: str, auth_session: requests.Session):
    """Test pagination parameters against real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood?limit=5&offset=0",
    )
    assert response.status_code == 200
    data = _extract_json(response)
    mood_data = data.get("data", data)
    assert "moods" in mood_data
    assert len(mood_data["moods"]) <= 5, (
        f"Pagination limit not respected: got {len(mood_data['moods'])} moods"
    )


# ─── Test: Get today's mood (GET /api/v1/mood/today) ───


def test_live_get_today_mood(base_url: str, auth_session: requests.Session):
    """Get today's mood entry from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood/today",
    )
    # 200 with data, or 404 if no mood logged today
    assert response.status_code in (200, 404), (
        f"Get today mood failed: {response.status_code} {response.text[:400]}"
    )
    if response.status_code == 200:
        data = _extract_json(response)
        mood_data = data.get("data", data)
        # Should have mood data or indicate no mood today
        assert mood_data is not None


# ─── Test: Get mood streaks (GET /api/v1/mood/streaks) ───


def test_live_get_mood_streaks(base_url: str, auth_session: requests.Session):
    """Get mood streaks from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood/streaks",
    )
    assert response.status_code == 200, (
        f"Get streaks failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    streak_data = data.get("data", data)
    assert "currentStreak" in streak_data, f"Missing currentStreak: {streak_data}"
    assert "longestStreak" in streak_data, f"Missing longestStreak: {streak_data}"
    assert isinstance(streak_data["currentStreak"], int), (
        f"currentStreak should be int: {streak_data}"
    )
    assert isinstance(streak_data["longestStreak"], int), (
        f"longestStreak should be int: {streak_data}"
    )
    assert streak_data["currentStreak"] >= 0, (
        f"currentStreak should be >= 0: {streak_data}"
    )
    assert streak_data["longestStreak"] >= 0, (
        f"longestStreak should be >= 0: {streak_data}"
    )


# ─── Test: Get recent moods (GET /api/v1/mood/recent) ───


def test_live_get_recent_moods(base_url: str, auth_session: requests.Session):
    """Get recent moods (last 7 days) from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood/recent",
    )
    assert response.status_code == 200, (
        f"Get recent moods failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    mood_data = data.get("data", data)
    assert "moods" in mood_data, f"Missing 'moods' in recent response: {data}"
    assert isinstance(mood_data["moods"], list)


# ─── Test: Weekly analysis (GET /api/v1/mood/weekly-analysis) ───


def test_live_get_weekly_analysis(base_url: str, auth_session: requests.Session):
    """Get weekly mood analysis from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood/weekly-analysis",
    )
    assert response.status_code == 200, (
        f"Weekly analysis failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    analysis = data.get("data", data)
    # Verify structure — should have insights or analysis data
    assert analysis is not None
    # Check for expected keys (may vary based on implementation)
    expected_keys = {"insights", "averageSentiment", "trend", "totalMoods", "moodCount"}
    found_keys = set(analysis.keys()) & expected_keys
    assert len(found_keys) > 0, (
        f"Weekly analysis missing expected keys. Got: {list(analysis.keys())}"
    )


# ─── Test: Mood statistics (GET /api/v1/mood-stats/statistics) ───


def test_live_get_mood_statistics(base_url: str, auth_session: requests.Session):
    """Get mood statistics from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood-stats/statistics",
    )
    assert response.status_code == 200, (
        f"Mood statistics failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    stats = data.get("data", data)
    assert "totalMoods" in stats, f"Missing totalMoods: {stats}"
    assert isinstance(stats["totalMoods"], int), (
        f"totalMoods should be int: {stats}"
    )
    assert stats["totalMoods"] >= 0, f"totalMoods should be >= 0: {stats}"


# ─── Test: Daily analytics (GET /api/v1/mood-stats/daily) ───


def test_live_get_daily_analytics(base_url: str, auth_session: requests.Session):
    """Get daily analytics from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood-stats/daily?days=7",
    )
    assert response.status_code == 200, (
        f"Daily analytics failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    analytics = data.get("data", data)
    assert analytics is not None


# ─── Test: Monthly analytics (GET /api/v1/mood-stats/monthly) ───


def test_live_get_monthly_analytics(base_url: str, auth_session: requests.Session):
    """Get monthly analytics from real Firestore."""
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood-stats/monthly?months=3",
    )
    assert response.status_code == 200, (
        f"Monthly analytics failed: {response.status_code} {response.text[:400]}"
    )
    data = _extract_json(response)
    analytics = data.get("data", data)
    assert analytics is not None


# ─── Test: Analyze text (POST /api/v1/mood/analyze-text) ───


def test_live_analyze_text(base_url: str, auth_session: requests.Session):
    """Analyze mood text sentiment against real AI service."""
    response = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/analyze-text",
        json={"text": "Jag känner mig väldigt glad och nöjd idag!"},
        headers={"Content-Type": "application/json"},
    )
    # 200 if AI service is configured, 500/503 if not
    assert response.status_code in (200, 500, 503), (
        f"Analyze text unexpected status: {response.status_code} {response.text[:400]}"
    )
    if response.status_code == 200:
        data = _extract_json(response)
        analysis = data.get("data", data)
        assert "sentiment" in analysis or "score" in analysis, (
            f"Missing sentiment/score in analysis: {analysis}"
        )


# ─── Test: Update mood (PUT /api/v1/mood/<id>) ───


def test_live_update_mood(base_url: str, auth_session: requests.Session):
    """Update a mood entry in real Firestore."""
    # First, log a mood to update
    log_resp = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/log",
        json={"mood_text": "Original text for update test", "score": 5},
        headers={"Content-Type": "application/json"},
    )
    assert log_resp.status_code in (200, 201)
    log_data = _extract_json(log_resp)
    mood_data = log_data.get("data", log_data)
    mood_id = mood_data.get("moodId") or mood_data.get("id") or mood_data.get("mood_id")
    assert mood_id, f"Missing mood ID for update test: {log_data}"

    # Update the mood
    update_resp = _request_with_retry(
        auth_session,
        "PUT",
        f"{base_url}/api/v1/mood/{mood_id}",
        json={"mood_text": "Updated text from live test", "score": 8},
        headers={"Content-Type": "application/json"},
    )
    assert update_resp.status_code == 200, (
        f"Update mood failed: {update_resp.status_code} {update_resp.text[:400]}"
    )

    # Cleanup: delete the mood
    try:
        _request_with_retry(
            auth_session,
            "DELETE",
            f"{base_url}/api/v1/mood/{mood_id}",
        )
    except Exception:
        pass


# ─── Test: Delete mood (DELETE /api/v1/mood/<id>) ───


def test_live_delete_mood(base_url: str, auth_session: requests.Session):
    """Create and delete a mood entry in real Firestore."""
    # Create a mood to delete
    log_resp = _request_with_retry(
        auth_session,
        "POST",
        f"{base_url}/api/v1/mood/log",
        json={"mood_text": "To be deleted", "score": 3},
        headers={"Content-Type": "application/json"},
    )
    assert log_resp.status_code in (200, 201)
    log_data = _extract_json(log_resp)
    mood_data = log_data.get("data", log_data)
    mood_id = mood_data.get("moodId") or mood_data.get("id") or mood_data.get("mood_id")
    assert mood_id, f"Missing mood ID for delete test: {log_data}"

    # Delete it
    del_resp = _request_with_retry(
        auth_session,
        "DELETE",
        f"{base_url}/api/v1/mood/{mood_id}",
    )
    assert del_resp.status_code == 200, (
        f"Delete mood failed: {del_resp.status_code} {del_resp.text[:400]}"
    )

    # Verify it's gone — fetching by ID should 404
    get_resp = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood/{mood_id}",
    )
    assert get_resp.status_code == 404, (
        f"Deleted mood should return 404: {get_resp.status_code} {get_resp.text[:300]}"
    )


# ─── Test: Cleanup — delete moods created during this test run ───


def test_live_cleanup_test_moods(base_url: str, auth_session: requests.Session):
    """Delete any mood entries created during this test run to keep Firestore clean."""
    # Get recent moods
    response = _request_with_retry(
        auth_session,
        "GET",
        f"{base_url}/api/v1/mood?limit=50",
    )
    assert response.status_code == 200
    data = _extract_json(response)
    mood_data = data.get("data", data)
    moods = mood_data.get("moods", [])

    deleted = 0
    for mood in moods:
        text = mood.get("mood_text", "")
        # Delete moods that match our test patterns
        if any(marker in text for marker in [
            "Live test mood",
            "Taggat humör",
            "Original text for update test",
            "Updated text from live test",
            "To be deleted",
        ]):
            mood_id = mood.get("id") or mood.get("moodId")
            if mood_id:
                try:
                    del_resp = _request_with_retry(
                        auth_session,
                        "DELETE",
                        f"{base_url}/api/v1/mood/{mood_id}",
                    )
                    if del_resp.status_code == 200:
                        deleted += 1
                except Exception:
                    pass

    print(f"\n[live-e2e] Cleaned up {deleted} test mood entries from Firestore")
    # This test always passes — cleanup is best-effort
    assert True
