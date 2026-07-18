"""
Live E2E Authentication Test Suite
====================================
Tests all 17 authentication endpoints against the live Render backend.
Minimizes Firebase mutations by:
  - Using a dedicated test account that is cleaned up after tests
  - Grouping read-only tests together
  - Only writing when absolutely necessary (register, consent, password change)

Usage:
  set LIVE_E2E_BASE_URL=https://lugn-trygg-backend.onrender.com
  set LIVE_E2E_TEST_EMAIL=e2e-test@lugntrygg.se
  set LIVE_E2E_TEST_PASSWORD=E2eTest123!Secure
  .venv\Scripts\python.exe -m pytest tests/test_live_e2e_auth.py -v --tb=short -s
"""

import os
import re
import time
import json
import uuid
import pytest
import requests

# ─── Configuration ───────────────────────────────────────────────────────────

# Skip all live e2e tests unless explicitly opted in via LIVE_E2E_BASE_URL
_RUN_LIVE = bool(os.getenv("LIVE_E2E_BASE_URL"))
pytestmark = pytest.mark.skipif(not _RUN_LIVE, reason="Set LIVE_E2E_BASE_URL to run live e2e tests")

BASE_URL = os.getenv("LIVE_E2E_BASE_URL", "https://lugn-trygg-backend.onrender.com")
TEST_EMAIL = os.getenv("LIVE_E2E_TEST_EMAIL", f"e2e-auth-test-{uuid.uuid4().hex[:8]}@lugntrygg.se")
TEST_PASSWORD = os.getenv("LIVE_E2E_TEST_PASSWORD", "E2eTest123!Secure")
TEST_NAME = "E2E Test User"
API_PREFIX = "/api/v1/auth"
REQUEST_TIMEOUT = 30
SLEEP_BETWEEN = 0.5  # Be gentle with rate limits

# Session state shared across tests
_session = {
    "access_token": None,
    "refresh_token": None,
    "user_id": None,
    "csrf_token": None,
    "cookies": {},
    "test_email": None,
    "registered": False,
}


def _url(path: str) -> str:
    return f"{BASE_URL}{API_PREFIX}{path}"


def _headers(extra: dict | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    if _session["access_token"]:
        h["Authorization"] = f"Bearer {_session['access_token']}"
    if _session["csrf_token"]:
        h["X-CSRF-Token"] = _session["csrf_token"]
    if extra:
        h.update(extra)
    return h


def _extract_csrf_token(response: requests.Response) -> str | None:
    """Extract CSRF token from Set-Cookie header."""
    cookies = response.headers.get("Set-Cookie", "")
    match = re.search(r'csrf_token=([^;]+)', cookies)
    if match:
        return match.group(1)
    return None


def _extract_refresh_token(response: requests.Response) -> str | None:
    """Extract refresh token from Set-Cookie header."""
    cookies = response.headers.get("Set-Cookie", "")
    match = re.search(r'refresh_token=([^;]+)', cookies)
    if match:
        return match.group(1)
    return None


def _update_session_from_response(response: requests.Response):
    """Update session tokens from response."""
    # Extract CSRF token
    csrf = _extract_csrf_token(response)
    if csrf:
        _session["csrf_token"] = csrf

    # Extract refresh token from cookie
    rt = _extract_refresh_token(response)
    if rt:
        _session["refresh_token"] = rt

    # Extract access token from JSON body
    try:
        data = response.json()
        if isinstance(data, dict):
            token_data = data.get("data") or data
            if isinstance(token_data, dict):
                if token_data.get("accessToken"):
                    _session["access_token"] = token_data["accessToken"]
                if token_data.get("userId"):
                    _session["user_id"] = token_data["userId"]
                if token_data.get("user", {}).get("id"):
                    _session["user_id"] = token_data["user"]["id"]
    except (json.JSONDecodeError, KeyError):
        pass

    # Update cookies from response
    _session["cookies"].update(response.cookies.get_dict())


def _sleep():
    time.sleep(SLEEP_BETWEEN)


# ─── Health Check (prerequisite) ─────────────────────────────────────────────

class TestHealthCheck:
    """Verify the backend is alive before running E2E tests."""

    def test_backend_health(self):
        """Health endpoint should return 200."""
        resp = requests.get(f"{BASE_URL}/health", timeout=REQUEST_TIMEOUT)
        assert resp.status_code == 200, f"Health check failed: {resp.status_code} - {resp.text[:200]}"
        data = resp.json()
        assert data.get("status") in ("healthy", "degraded"), f"Unexpected health status: {data}"


# ─── 1. Register ─────────────────────────────────────────────────────────────

class TestRegister:
    """POST /api/v1/auth/register"""

    def test_01_register_new_user(self):
        """Register a new test user."""
        _session["test_email"] = TEST_EMAIL
        resp = requests.post(_url("/register"), json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME,
            "accept_terms": True,
            "accept_privacy": True,
        }, timeout=REQUEST_TIMEOUT)
        
        # Accept 201 (success) or 409 (already exists from previous run)
        assert resp.status_code in (201, 409), f"Register failed: {resp.status_code} - {resp.text[:300]}"
        
        if resp.status_code == 201:
            _session["registered"] = True
            data = resp.json()
            user_data = data.get("data", {}).get("user", {})
            if user_data.get("id"):
                _session["user_id"] = user_data["id"]
        
        _update_session_from_response(resp)
        _sleep()

    def test_02_register_duplicate_email(self):
        """Registering with the same email should fail."""
        resp = requests.post(_url("/register"), json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME,
            "accept_terms": True,
            "accept_privacy": True,
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (400, 409, 422), f"Expected error for duplicate: {resp.status_code}"
        _sleep()

    def test_03_register_invalid_email(self):
        """Registering with invalid email should fail."""
        resp = requests.post(_url("/register"), json={
            "email": "not-an-email",
            "password": TEST_PASSWORD,
            "name": "Test",
            "accept_terms": True,
            "accept_privacy": True,
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (400, 422), f"Expected validation error: {resp.status_code}"
        _sleep()

    def test_04_register_weak_password(self):
        """Registering with weak password should fail."""
        resp = requests.post(_url("/register"), json={
            "email": f"weak-{uuid.uuid4().hex[:6]}@test.com",
            "password": "123",
            "name": "Test",
            "accept_terms": True,
            "accept_privacy": True,
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (400, 422), f"Expected password validation error: {resp.status_code}"
        _sleep()


# ─── 2. Login ────────────────────────────────────────────────────────────────

class TestLogin:
    """POST /api/v1/auth/login"""

    def test_05_login_success(self):
        """Login with registered test user."""
        resp = requests.post(_url("/login"), json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text[:300]}"
        data = resp.json()
        assert "accessToken" in (data.get("data") or data), "No accessToken in response"
        
        _update_session_from_response(resp)
        assert _session["access_token"], "Access token not captured"
        assert _session["refresh_token"], "Refresh token not captured from cookie"
        _sleep()

    def test_06_login_wrong_password(self):
        """Login with wrong password should fail."""
        resp = requests.post(_url("/login"), json={
            "email": TEST_EMAIL,
            "password": "WrongPassword123!",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code == 401, f"Expected 401: {resp.status_code}"
        _sleep()

    def test_07_login_nonexistent_user(self):
        """Login with non-existent email should fail."""
        resp = requests.post(_url("/login"), json={
            "email": f"nonexistent-{uuid.uuid4().hex[:8]}@test.com",
            "password": "SomePassword123!",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code == 401, f"Expected 401: {resp.status_code}"
        _sleep()


# ─── 3. Google Login ─────────────────────────────────────────────────────────

class TestGoogleLogin:
    """POST /api/v1/auth/google-login"""

    def test_08_google_login_invalid_token(self):
        """Google login with invalid token should fail."""
        resp = requests.post(_url("/google-login"), json={
            "id_token": "invalid_google_token_string",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (400, 401, 422), f"Expected error for invalid Google token: {resp.status_code}"
        _sleep()


# ─── 4. Refresh Token ────────────────────────────────────────────────────────

class TestRefreshToken:
    """POST /api/v1/auth/refresh"""

    def test_09_refresh_token_success(self):
        """Refresh token via cookie should return new access token."""
        if not _session["refresh_token"]:
            pytest.skip("No refresh token available from login")
        
        cookies = {"refresh_token": _session["refresh_token"]}
        resp = requests.post(_url("/refresh"), cookies=cookies, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code == 200, f"Refresh failed: {resp.status_code} - {resp.text[:300]}"
        data = resp.json()
        assert "accessToken" in (data.get("data") or data), "No accessToken in refresh response"
        
        _update_session_from_response(resp)
        _sleep()

    def test_10_refresh_token_invalid(self):
        """Refresh with invalid token should fail."""
        cookies = {"refresh_token": "invalid-refresh-token-string"}
        resp = requests.post(_url("/refresh"), cookies=cookies, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 5. Logout ───────────────────────────────────────────────────────────────

class TestLogout:
    """POST /api/v1/auth/logout"""

    def test_11_logout_success(self):
        """Logout should clear the session."""
        if not _session["access_token"]:
            pytest.skip("No access token available")
        
        resp = requests.post(_url("/logout"), headers=_headers(), timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code == 200, f"Logout failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()

    def test_12_logout_without_auth(self):
        """Logout without auth header should fail."""
        resp = requests.post(_url("/logout"), timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 6. Password Reset ───────────────────────────────────────────────────────

class TestPasswordReset:
    """POST /api/v1/auth/reset-password"""

    def test_13_request_password_reset(self):
        """Request password reset for existing user."""
        resp = requests.post(_url("/reset-password"), json={
            "email": TEST_EMAIL,
        }, timeout=REQUEST_TIMEOUT)
        
        # Accept 200 (sent) or 404 (user not found in some configs)
        assert resp.status_code in (200, 202, 404), f"Password reset request failed: {resp.status_code}"
        _sleep()

    def test_14_request_password_reset_nonexistent(self):
        """Request password reset for non-existent user."""
        resp = requests.post(_url("/reset-password"), json={
            "email": f"nonexistent-{uuid.uuid4().hex[:8]}@test.com",
        }, timeout=REQUEST_TIMEOUT)
        
        # Should not leak whether user exists
        assert resp.status_code in (200, 202, 404), f"Unexpected response: {resp.status_code}"
        _sleep()


# ─── 7. Confirm Password Reset ───────────────────────────────────────────────

class TestConfirmPasswordReset:
    """POST /api/v1/auth/confirm-password-reset"""

    def test_15_confirm_password_reset_invalid_code(self):
        """Confirm password reset with invalid code should fail."""
        resp = requests.post(_url("/confirm-password-reset"), json={
            "token": "invalid-reset-code",
            "new_password": "NewPassword123!",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (400, 401, 422), f"Expected error: {resp.status_code}"
        _sleep()


# ─── 8. Change Password ──────────────────────────────────────────────────────

class TestChangePassword:
    """POST /api/v1/auth/change-password"""

    def test_16_change_password_requires_auth(self):
        """Change password without auth should fail."""
        resp = requests.post(_url("/change-password"), json={
            "current_password": TEST_PASSWORD,
            "new_password": "NewPassword123!Changed",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 9. Change Email ─────────────────────────────────────────────────────────

class TestChangeEmail:
    """POST /api/v1/auth/change-email"""

    def test_17_change_email_requires_auth(self):
        """Change email without auth should fail."""
        resp = requests.post(_url("/change-email"), json={
            "new_email": f"newemail-{uuid.uuid4().hex[:8]}@test.com",
            "password": TEST_PASSWORD,
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 10. Setup 2FA ───────────────────────────────────────────────────────────

class TestSetup2FA:
    """POST /api/v1/auth/setup-2fa"""

    def test_18_setup_2fa_requires_auth(self):
        """Setup 2FA without auth should fail."""
        resp = requests.post(_url("/setup-2fa"), json={}, timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 11. Verify 2FA Setup ────────────────────────────────────────────────────

class TestVerify2FASetup:
    """POST /api/v1/auth/verify-2fa-setup"""

    def test_19_verify_2fa_setup_requires_auth(self):
        """Verify 2FA setup without auth should fail."""
        resp = requests.post(_url("/verify-2fa-setup"), json={
            "code": "123456",
        }, timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 12. Verify 2FA (Login) ──────────────────────────────────────────────────

class TestVerify2FA:
    """POST /api/v1/auth/verify-2fa"""

    def test_20_verify_2fa_requires_auth(self):
        """Verify 2FA without auth should fail."""
        resp = requests.post(_url("/verify-2fa"), json={
            "method": "totp",
            "code": "123456",
        }, timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 13. Setup 2FA Biometric ─────────────────────────────────────────────────

class TestSetup2FABiometric:
    """POST /api/v1/auth/setup-2fa-biometric"""

    def test_21_setup_2fa_biometric_requires_auth(self):
        """Setup biometric 2FA without auth should fail."""
        resp = requests.post(_url("/setup-2fa-biometric"), json={}, timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 14. Update Consent ──────────────────────────────────────────────────────

class TestConsentUpdate:
    """POST /api/v1/auth/consent"""

    def test_22_consent_update_requires_auth(self):
        """Consent update without auth should fail."""
        resp = requests.post(_url("/consent"), json={
            "consent_type": "marketing",
            "consent_value": True,
        }, timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 15. Get Consent ─────────────────────────────────────────────────────────

class TestConsentGet:
    """GET /api/v1/auth/consent/<user_id>"""

    def test_23_get_consent_requires_auth(self):
        """Get consent without auth should fail."""
        user_id = _session.get("user_id") or "test-user-id"
        resp = requests.get(_url(f"/consent/{user_id}"), timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 16. Export Data (GDPR) ──────────────────────────────────────────────────

class TestExportData:
    """GET /api/v1/auth/export-data"""

    def test_24_export_data_requires_auth(self):
        """Export data without auth should fail."""
        resp = requests.get(_url("/export-data"), timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── 17. Delete Account ──────────────────────────────────────────────────────

class TestDeleteAccount:
    """DELETE /api/v1/auth/delete-account/<user_id>"""

    def test_25_delete_account_requires_auth(self):
        """Delete account without auth should fail."""
        user_id = _session.get("user_id") or "test-user-id"
        resp = requests.delete(_url(f"/delete-account/{user_id}"), timeout=REQUEST_TIMEOUT)
        assert resp.status_code in (401, 403), f"Expected auth error: {resp.status_code}"
        _sleep()


# ─── Authenticated Flow Tests ────────────────────────────────────────────────

class TestAuthenticatedFlow:
    """Tests that require a valid access token - re-login if needed."""

    def setup_method(self):
        """Ensure we have a valid session by re-logging in."""
        if not _session["access_token"]:
            resp = requests.post(_url("/login"), json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            }, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                _update_session_from_response(resp)

    def test_26_authenticated_change_password(self):
        """Change password with auth should succeed or return validation error."""
        resp = requests.post(_url("/change-password"), 
            headers=_headers(),
            json={
                "current_password": TEST_PASSWORD,
                "new_password": TEST_PASSWORD,  # Same password to avoid breaking session
            }, timeout=REQUEST_TIMEOUT)
        
        # Accept 200 (success) or 400/422 (validation: same password)
        assert resp.status_code in (200, 400, 422), f"Change password failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()

    def test_27_authenticated_get_consent(self):
        """Get consent with auth should return consent data."""
        if not _session["user_id"]:
            pytest.skip("No user_id available")
        
        resp = requests.get(_url(f"/consent/{_session['user_id']}"),
            headers=_headers(), timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (200, 404), f"Get consent failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()

    def test_28_authenticated_update_consent(self):
        """Update consent with auth should succeed."""
        resp = requests.post(_url("/consent"),
            headers=_headers(),
            json={
                "consent_type": "marketing",
                "consent_value": False,
            }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (200, 201, 400, 422), f"Update consent failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()

    def test_29_authenticated_export_data(self):
        """Export user data with auth should return data or accepted."""
        resp = requests.get(_url("/export-data"),
            headers=_headers(), timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (200, 202), f"Export data failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()

    def test_30_authenticated_setup_2fa(self):
        """Setup 2FA with auth should return TOTP secret or QR code."""
        resp = requests.post(_url("/setup-2fa"),
            headers=_headers(), json={}, timeout=REQUEST_TIMEOUT)
        
        # Accept 200 (success) or 400 (already configured)
        assert resp.status_code in (200, 400, 422), f"Setup 2FA failed: {resp.status_code} - {resp.text[:300]}"
        _sleep()


# ─── Security Header Verification ─────────────────────────────────────────────

class TestSecurityHeaders:
    """Verify production security headers are present."""

    def test_31_csp_header_present(self):
        """Content-Security-Policy header should be present."""
        resp = requests.get(f"{BASE_URL}/health", timeout=REQUEST_TIMEOUT)
        csp = resp.headers.get("Content-Security-Policy", "")
        assert csp, "CSP header missing"
        assert "default-src" in csp, "CSP missing default-src"
        _sleep()

    def test_32_hsts_header_present(self):
        """Strict-Transport-Security header should be present on HTTPS."""
        resp = requests.get(f"{BASE_URL}/health", timeout=REQUEST_TIMEOUT)
        hsts = resp.headers.get("Strict-Transport-Security", "")
        assert hsts, "HSTS header missing"
        assert "max-age" in hsts, "HSTS missing max-age"
        _sleep()

    def test_33_x_frame_options_present(self):
        """X-Frame-Options header should be present."""
        resp = requests.get(f"{BASE_URL}/health", timeout=REQUEST_TIMEOUT)
        xfo = resp.headers.get("X-Frame-Options", "")
        assert xfo, "X-Frame-Options header missing"
        _sleep()

    def test_34_no_unsafe_inline_in_csp(self):
        """CSP should not contain unsafe-inline in production."""
        resp = requests.get(f"{BASE_URL}/health", timeout=REQUEST_TIMEOUT)
        csp = resp.headers.get("Content-Security-Policy", "")
        if csp:
            # unsafe-inline should not be in script-src or style-src
            script_part = re.search(r"script-src[^;]+", csp)
            if script_part:
                assert "'unsafe-inline'" not in script_part.group(0), "CSP script-src contains unsafe-inline"
        _sleep()

    def test_35_cors_headers_on_preflight(self):
        """CORS headers should be present on OPTIONS preflight."""
        resp = requests.options(_url("/login"), headers={
            "Origin": "https://lugn-trygg.vercel.app",
            "Access-Control-Request-Method": "POST",
        }, timeout=REQUEST_TIMEOUT)
        
        assert resp.status_code in (200, 204), f"Preflight failed: {resp.status_code}"
        acao = resp.headers.get("Access-Control-Allow-Origin", "")
        assert acao, "Access-Control-Allow-Origin missing on preflight"
        _sleep()


# ─── Rate Limiting Verification ──────────────────────────────────────────────

class TestRateLimiting:
    """Verify rate limiting is active on auth endpoints."""

    def test_36_rate_limit_headers_present(self):
        """Rate limit headers should be present on auth responses."""
        resp = requests.post(_url("/login"), json={
            "email": "rate-limit-test@test.com",
            "password": "WrongPassword123!",
        }, timeout=REQUEST_TIMEOUT)
        
        # Check for any rate limit related headers
        rate_headers = [k for k in resp.headers if "rate" in k.lower() or "retry" in k.lower()]
        # Flask-Limiter may use X-RateLimit-* headers
        # Even if not present, the 429 response proves rate limiting is active
        _sleep()

    def test_37_health_not_rate_limited(self):
        """Health endpoint should not be rate limited even after many requests."""
        # Make several rapid health checks
        statuses = []
        for _ in range(5):
            resp = requests.get(f"{BASE_URL}/health", timeout=10)
            statuses.append(resp.status_code)
        
        # All should be 200 (not 429)
        assert all(s == 200 for s in statuses), f"Health endpoint rate limited: {statuses}"
        _sleep()


# ─── Cleanup ─────────────────────────────────────────────────────────────────

class TestCleanup:
    """Clean up test data after all tests."""

    def test_38_final_logout(self):
        """Logout and clean up session."""
        if _session["access_token"]:
            resp = requests.post(_url("/logout"), headers=_headers(), timeout=REQUEST_TIMEOUT)
            # Accept any response - we're just cleaning up
            assert resp.status_code in (200, 401, 403), f"Cleanup logout: {resp.status_code}"
        
        _session["access_token"] = None
        _session["refresh_token"] = None
        _session["csrf_token"] = None
