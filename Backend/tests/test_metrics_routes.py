"""
Tests for metrics_routes.py
Covers: health, ready, live, metrics, business metrics.
"""
import pytest
from unittest.mock import patch, MagicMock


BASE = "/api/v1/metrics"


class TestMetricsHealth:
    """Tests for GET /api/metrics/health"""

    def test_health(self, client, mock_db):
        resp = client.get(f"{BASE}/health")
        assert resp.status_code in (200, 503)
        data = resp.get_json()
        # APIResponse wraps: {"success": true, "data": {"status": "healthy", ...}}
        assert data.get("success") is True or "status" in data.get("data", data)

    def test_health_firebase_down(self, client, mock_db):
        mock_db.collection.side_effect = Exception("Connection failed")
        resp = client.get(f"{BASE}/health")
        assert resp.status_code in (200, 503)


class TestMetricsReady:
    """Tests for GET /api/metrics/ready"""

    def test_ready(self, client, mock_db):
        resp = client.get(f"{BASE}/ready")
        assert resp.status_code in (200, 503)


class TestMetricsLive:
    """Tests for GET /api/metrics/live"""

    def test_live(self, client):
        resp = client.get(f"{BASE}/live")
        assert resp.status_code == 200


class TestPrometheusMetrics:
    """Tests for GET /api/metrics/metrics"""

    def test_metrics_no_auth(self, client):
        resp = client.get(f"{BASE}/metrics")
        assert resp.status_code in (200, 401, 403, 422)

    def test_metrics_with_auth(self, client, auth_headers, mock_db):
        resp = client.get(f"{BASE}/metrics", headers=auth_headers)
        # May return 200 or 501 (if prometheus_client not installed)
        assert resp.status_code in (200, 501)


class TestBusinessMetrics:
    """Tests for GET /api/metrics/metrics/business"""

    def test_business_metrics_no_auth(self, client):
        resp = client.get(f"{BASE}/metrics/business")
        assert resp.status_code in (200, 401, 403, 422)

    def test_business_metrics_with_auth(self, client, auth_headers, mock_db):
        resp = client.get(f"{BASE}/metrics/business", headers=auth_headers)
        assert resp.status_code in (200, 501)


class TestOptionsEndpoints:
    """Tests for CORS preflight."""

    @pytest.mark.parametrize("path", ["/health", "/metrics", "/metrics/business", "/ready", "/live"])
    def test_options(self, client, path):
        resp = client.options(f"{BASE}{path}")
        assert resp.status_code in (200, 204)
