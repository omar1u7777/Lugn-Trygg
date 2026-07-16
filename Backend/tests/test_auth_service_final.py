"""
Final coverage tests for auth_service.py

These tests exercise the real `jwt_required` decorator that is patched in
conftest.py for route tests.  The module is reloaded to get a fresh
AuthService class with the unpatched decorator.
"""
import importlib
import os
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from flask import Flask


@pytest.fixture
def fresh_auth_service():
    """Reload auth_service so jwt_required is NOT patched by conftest."""
    import src.services.auth_service as auth_service_module

    importlib.reload(auth_service_module)
    return auth_service_module


@pytest.fixture
def token(fresh_auth_service):
    """Return a valid access token for the real jwt_required decorator."""
    user_id = "testuser1234567890ab"
    payload = {
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "sub": user_id,
        "type": "access",
        "iss": fresh_auth_service.JWT_ISSUER,
        "aud": fresh_auth_service.JWT_AUDIENCE,
    }
    return jwt.encode(payload, fresh_auth_service.JWT_SECRET_KEY, algorithm="HS256")


@pytest.fixture
def client(fresh_auth_service):
    """Create a minimal Flask app with one protected route."""
    app = Flask(__name__)

    @app.route("/protected", methods=["GET", "OPTIONS"])
    @fresh_auth_service.AuthService.jwt_required
    def protected():
        return {"ok": True}

    return app.test_client()


class TestJwtRequiredDecoratorReal:
    """Cover auth_service.py lines 564-586 (jwt_required)."""

    def test_options_fast_path(self, client):
        """Line 569-570: OPTIONS preflight returns 204."""
        resp = client.options("/protected")
        assert resp.status_code == 204

    def test_missing_authorization_header(self, client):
        """Line 574-575: no Authorization header returns 401."""
        resp = client.get("/protected")
        assert resp.status_code == 401

    def test_non_bearer_authorization(self, client):
        """Line 574-575: non-Bearer prefix returns 401."""
        resp = client.get("/protected", headers={"Authorization": "Basic xyz"})
        assert resp.status_code == 401

    def test_invalid_token(self, client):
        """Line 578-580: verify_token returns error -> 401."""
        resp = client.get("/protected", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401

    def test_valid_token(self, client, token):
        """Lines 583-585: valid token sets g.user_id and proceeds."""
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

    def test_jwt_required_independent_of_routes(self, fresh_auth_service):
        """Ensure the decorator object itself is a real callable."""
        decorator = fresh_auth_service.AuthService.jwt_required
        assert callable(decorator)

        def dummy():
            return "ok"

        wrapped = decorator(dummy)
        assert callable(wrapped)
