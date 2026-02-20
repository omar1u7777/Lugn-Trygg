"""
Tests for docs_routes.py
Covers: Swagger UI, ReDoc, OpenAPI spec, health, test-auth page.
"""
import pytest
from unittest.mock import patch, MagicMock


BASE = "/api/docs"


@pytest.fixture
def mock_swagger():
    """Mock swagger config."""
    with patch("src.routes.docs_routes.get_openapi_spec") as mock_spec, \
         patch("src.routes.docs_routes.get_openapi_yaml") as mock_yaml:
        mock_spec.return_value = {
            "openapi": "3.0.0",
            "info": {"title": "Lugn & Trygg API", "version": "1.0.0"},
            "paths": {},
        }
        mock_yaml.return_value = "openapi: '3.0.0'\ninfo:\n  title: Lugn & Trygg API"
        yield {"spec": mock_spec, "yaml": mock_yaml}


class TestSwaggerUI:
    """Tests for GET /api/docs/"""

    def test_swagger_ui(self, client, mock_swagger):
        resp = client.get(f"{BASE}/")
        assert resp.status_code == 200
        assert b"html" in resp.data.lower() or resp.content_type.startswith("text/html")


class TestReDoc:
    """Tests for GET /api/docs/redoc"""

    def test_redoc_ui(self, client, mock_swagger):
        resp = client.get(f"{BASE}/redoc")
        assert resp.status_code == 200


class TestOpenAPISpec:
    """Tests for GET /api/docs/openapi.json and /api/docs/openapi.yaml"""

    def test_openapi_json(self, client, mock_swagger):
        resp = client.get(f"{BASE}/openapi.json")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "openapi" in data

    def test_openapi_yaml(self, client, mock_swagger):
        resp = client.get(f"{BASE}/openapi.yaml")
        assert resp.status_code == 200


class TestDocsHealth:
    """Tests for GET /api/docs/health"""

    def test_docs_health(self, client, mock_swagger):
        resp = client.get(f"{BASE}/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "status" in data


class TestTestAuth:
    """Tests for GET /api/docs/test-auth"""

    def test_test_auth_dev(self, client, mock_swagger):
        """In dev mode, should return HTML page."""
        resp = client.get(f"{BASE}/test-auth")
        assert resp.status_code in (200, 403)
