"""
Live Firebase E2E validation for auth hardening.

This module is intentionally isolated from tests/conftest.py because that test
harness mocks Firebase services by design. Run only in staging/live-like
environments with dedicated test credentials.
"""

from __future__ import annotations

import os
import time
from typing import Any

import pytest
import requests

pytestmark = [pytest.mark.e2e, pytest.mark.live]


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


def _request_with_429_retry(
    session: requests.Session,
    method: str,
    url: str,
    retries: int = 3,
    backoff_seconds: float = 0.75,
    **kwargs: Any,
) -> requests.Response:
    response: requests.Response | None = None
    for attempt in range(1, retries + 1):
        response = session.request(method=method, url=url, timeout=20, **kwargs)
        if response.status_code != 429:
            return response
        time.sleep(backoff_seconds * attempt)

    assert response is not None
    return response


def _extract_json(response: requests.Response) -> dict[str, Any]:
    try:
        return response.json()
    except ValueError as exc:
        raise AssertionError(
            f"Expected JSON response from {response.request.method} {response.url}, got: {response.text[:400]}"
        ) from exc


def _extract_access_token(payload: dict[str, Any]) -> str:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    token = data.get("accessToken") or data.get("access_token")
    assert token, f"Missing access token in payload: {payload}"
    return str(token)


def _get_csrf_token(session: requests.Session, base_url: str) -> str:
    csrf_response = _request_with_429_retry(session, "GET", f"{base_url}/api/v1/dashboard/csrf-token")
    assert csrf_response.status_code == 200, (
        "Failed to obtain CSRF token. "
        f"Status={csrf_response.status_code}, body={csrf_response.text[:300]}"
    )
    payload = _extract_json(csrf_response)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    csrf_token = data.get("csrfToken")
    assert csrf_token, f"Missing csrfToken field in response payload: {payload}"
    assert session.cookies.get("csrf_token"), "Expected csrf_token cookie after CSRF bootstrap"
    return str(csrf_token)


def test_live_firebase_login_refresh_logout_flow(base_url: str, live_credentials: dict[str, str]) -> None:
    session = requests.Session()

    login_response = _request_with_429_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/login",
        json=live_credentials,
        headers={"Content-Type": "application/json"},
    )
    assert login_response.status_code == 200, (
        "Login failed against live Firebase. "
        f"Status={login_response.status_code}, body={login_response.text[:300]}"
    )

    login_payload = _extract_json(login_response)
    access_token = _extract_access_token(login_payload)
    assert access_token

    refresh_cookie_before = session.cookies.get("refresh_token")
    assert refresh_cookie_before, "Missing refresh_token cookie after login"

    login_set_cookie = login_response.headers.get("Set-Cookie", "")
    assert "refresh_token=" in login_set_cookie
    assert "HttpOnly" in login_set_cookie
    assert "SameSite=Strict" in login_set_cookie
    if base_url.lower().startswith("https://"):
        assert "Secure" in login_set_cookie

    csrf_token = _get_csrf_token(session, base_url)

    refresh_without_csrf = _request_with_429_retry(session, "POST", f"{base_url}/api/v1/auth/refresh")
    assert refresh_without_csrf.status_code == 403, (
        "Refresh without CSRF should be blocked. "
        f"Status={refresh_without_csrf.status_code}, body={refresh_without_csrf.text[:300]}"
    )

    refresh_with_csrf = _request_with_429_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert refresh_with_csrf.status_code == 200, (
        "Refresh with CSRF should succeed. "
        f"Status={refresh_with_csrf.status_code}, body={refresh_with_csrf.text[:300]}"
    )

    refreshed_payload = _extract_json(refresh_with_csrf)
    refreshed_access_token = _extract_access_token(refreshed_payload)
    assert refreshed_access_token

    refresh_cookie_after = session.cookies.get("refresh_token")
    assert refresh_cookie_after, "Missing rotated refresh_token cookie"
    assert refresh_cookie_after != refresh_cookie_before, "Refresh token did not rotate"

    logout_without_csrf = _request_with_429_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {refreshed_access_token}"},
    )
    assert logout_without_csrf.status_code == 403, (
        "Logout without CSRF should be blocked. "
        f"Status={logout_without_csrf.status_code}, body={logout_without_csrf.text[:300]}"
    )

    csrf_token_for_logout = _get_csrf_token(session, base_url)
    logout_with_csrf = _request_with_429_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/logout",
        headers={
            "Authorization": f"Bearer {refreshed_access_token}",
            "X-CSRF-Token": csrf_token_for_logout,
        },
    )
    assert logout_with_csrf.status_code == 200, (
        "Logout with CSRF should succeed. "
        f"Status={logout_with_csrf.status_code}, body={logout_with_csrf.text[:300]}"
    )

    refresh_after_logout = _request_with_429_retry(
        session,
        "POST",
        f"{base_url}/api/v1/auth/refresh",
        headers={"X-CSRF-Token": csrf_token_for_logout},
    )
    assert refresh_after_logout.status_code in (401, 403), (
        "Refresh after logout should be denied. "
        f"Status={refresh_after_logout.status_code}, body={refresh_after_logout.text[:300]}"
    )
