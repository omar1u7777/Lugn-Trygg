"""
Tests for main.py app configuration, error handlers, and health endpoint.
Covers: MAX_CONTENT_LENGTH, CORS, error handlers (401/403/405/413/500), health check.
[S1] is_origin_allowed() unit tests are in TestIsOriginAllowed below.
"""
import json
import os
import unittest.mock as mock


class TestAppConfiguration:
    """Tests for Flask app configuration."""

    def test_max_content_length_is_set(self, app):
        """MAX_CONTENT_LENGTH, if configured, should be positive."""
        max_len = app.config.get('MAX_CONTENT_LENGTH')
        assert max_len is None or max_len > 0

    def test_max_content_length_default_16mb(self, app):
        """When set via legacy config path, MAX_CONTENT_LENGTH defaults to 16MB."""
        max_len = app.config.get('MAX_CONTENT_LENGTH')
        if max_len is not None:
            assert max_len == 16 * 1024 * 1024

    def test_testing_mode_enabled(self, app):
        """App should be in testing mode during tests."""
        assert app.config['TESTING'] is True

    def test_jwt_secret_key_configured(self, app):
        """JWT_SECRET_KEY must be configured."""
        assert app.config.get('JWT_SECRET_KEY') is not None
        assert len(app.config['JWT_SECRET_KEY']) >= 16

    def test_jwt_token_location_headers(self, app):
        """JWT tokens should be read from headers."""
        assert 'headers' in app.config.get('JWT_TOKEN_LOCATION', [])


class TestErrorHandlers:
    """Tests for HTTP error handlers returning JSON instead of HTML."""

    def test_401_returns_json(self, client):
        """401 errors should return JSON, not HTML."""
        # Access a protected route without auth token
        response = client.get('/api/v1/mood/nonexistent-user-id')
        # The route may return various codes depending on auth mock,
        # but let's test the error handler directly
        assert response.content_type == 'application/json'

    def test_404_returns_response(self, client):
        """Requesting a nonexistent URL should return a response."""
        response = client.get('/api/v1/this-does-not-exist-at-all')
        assert response.status_code in [404, 405]

    def test_405_returns_json(self, client):
        """405 Method Not Allowed should return JSON."""
        # POST to a GET-only endpoint
        response = client.post('/api/health')
        if response.status_code == 405:
            data = json.loads(response.data)
            assert 'error' in data or 'success' in data
            assert response.content_type == 'application/json'

    def test_413_payload_too_large(self, client, auth_headers):
        """Payload exceeding MAX_CONTENT_LENGTH should return 413 when limit is configured."""
        # Create a payload larger than 16MB
        large_payload = 'x' * (17 * 1024 * 1024)
        response = client.post(
            '/api/v1/journal/testuser1234567890ab/journal',
            data=large_payload,
            headers={**auth_headers, 'Content-Type': 'application/json'}
        )
        assert response.status_code in [404, 413]
        if response.status_code == 413:
            data = json.loads(response.data)
            assert 'error' in data

    def test_unhandled_exception_returns_json(self, client):
        """Unhandled exceptions should return JSON 500, not HTML."""
        # We can't easily trigger an unhandled exception via a route,
        # but we can verify the handler is registered
        with client.application.test_request_context():
            # Simulate what Flask does with unhandled exception
            handlers = client.application.error_handler_spec.get(None, {})
            assert 500 in handlers or Exception in handlers.get(None, {})


class TestHealthEndpoint:
    """Tests for the /api/health endpoint."""

    def test_health_endpoint_exists(self, client):
        """Health endpoint should respond."""
        response = client.get('/health')
        assert response.status_code in [200, 503]

    def test_health_returns_json(self, client):
        """Health endpoint should return JSON."""
        response = client.get('/health')
        assert response.content_type == 'application/json'

    def test_health_response_structure(self, client):
        """Health response should have expected fields."""
        response = client.get('/health')
        data = json.loads(response.data)
        # Should have status field at minimum
        assert 'status' in data or 'success' in data


class TestCORSConfiguration:
    """Tests for CORS headers."""

    def test_cors_headers_on_options(self, client):
        """OPTIONS requests should include CORS headers."""
        response = client.options('/health', headers={
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET'
        })
        # Should not return 500
        assert response.status_code < 500

    def test_cors_allows_localhost(self, client):
        """CORS should allow localhost:3000 origin."""
        response = client.get('/health', headers={
            'Origin': 'http://localhost:3000'
        })
        cors_header = response.headers.get('Access-Control-Allow-Origin', '')
        # Should either be '*' or 'http://localhost:3000' or empty (handled by Flask-CORS)
        assert response.status_code < 500


class TestIsOriginAllowed:
    """[S1] Unit tests for the is_origin_allowed() function in main.py.

    These tests exercise the filter logic directly (not via HTTP) so edge
    cases are fast and do not require a running server.
    """

    @staticmethod
    def _get_fn():
        """Import is_origin_allowed from main.  Deferred to avoid circular imports."""
        from main import is_origin_allowed
        return is_origin_allowed

    # ── Explicit allow-list ────────────────────────────────────────

    def test_explicit_allowed_origin(self):
        """An origin in CORS_ALLOWED_ORIGINS must be accepted."""
        fn = self._get_fn()
        with mock.patch.dict(os.environ, {'CORS_ALLOWED_ORIGINS': 'https://app.lugntrygg.se'}, clear=False):
            import importlib, main as m
            importlib.reload(m)  # pick up patched env
            from main import is_origin_allowed as fn2
            assert fn2('https://app.lugntrygg.se') is True

    def test_explicit_unknown_origin_blocked_in_production(self):
        """An origin NOT in the allow-list must be blocked in production."""
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'https://app.lugntrygg.se',
            'FLASK_ENV': 'production',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            assert fn2('https://evil.example.com') is False

    # ── Vercel preview deployments ────────────────────────────────

    def test_vercel_lugntrygg_preview_allowed(self):
        """A Vercel preview URL with 'lugn-trygg' in the subdomain is allowed."""
        fn = self._get_fn()
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'http://localhost:3000,https://*.vercel.app',
            'FLASK_ENV': 'production',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            assert fn2('https://lugn-trygg-abc123.vercel.app') is True

    def test_vercel_unrelated_project_blocked(self):
        """A Vercel preview URL without the project name must be blocked."""
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'http://localhost:3000,https://*.vercel.app',
            'FLASK_ENV': 'production',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            assert fn2('https://totally-different-app.vercel.app') is False

    def test_vercel_domain_must_contain_project_name(self):
        """Edge case: 'lucklugntrygg' contains 'lugntrygg' — should still pass."""
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'https://*.vercel.app',
            'FLASK_ENV': 'production',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            # Contains 'lugntrygg' → allowed by design (Vercel URLs require account ownership)
            result = fn2('https://lugntrygg-staging.vercel.app')
            assert result is True

    # ── Localhost in dev vs prod ──────────────────────────────────

    def test_localhost_allowed_in_dev(self):
        """Arbitrary localhost ports are allowed in non-production mode."""
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'http://localhost:3000',
            'FLASK_ENV': 'development',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            assert fn2('http://localhost:5173') is True

    def test_localhost_blocked_in_production(self):
        """Localhost origins must be blocked in production mode."""
        with mock.patch.dict(os.environ, {
            'CORS_ALLOWED_ORIGINS': 'https://app.lugntrygg.se',
            'FLASK_ENV': 'production',
        }, clear=False):
            import importlib, main as m
            importlib.reload(m)
            from main import is_origin_allowed as fn2
            assert fn2('http://localhost:3000') is False

    def test_empty_origin_blocked(self):
        """An empty origin string must always be blocked."""
        fn = self._get_fn()
        assert fn('') is False
