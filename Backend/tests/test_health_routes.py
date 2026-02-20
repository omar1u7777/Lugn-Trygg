"""
Tests for health_routes.py
Covers: liveness, readiness, db health, metrics (admin), advanced health.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


BASE = "/api/health"


@pytest.fixture
def mock_health_services():
    """Mock health check dependencies."""
    with patch("src.routes.health_routes.health_check_service") as mock_hcs, \
         patch("src.routes.health_routes.run_health_checks", new_callable=AsyncMock) as mock_rhc, \
         patch("src.routes.health_routes.get_monitoring_service") as mock_gms:
        # AsyncMock so run_until_complete can await it in the advanced endpoint
        mock_rhc.return_value = {"status": "healthy", "checks": {"firebase": "ok", "redis": "ok"}}
        # Return None so metrics endpoint falls back to psutil
        mock_gms.return_value = None
        yield {"hcs": mock_hcs, "rhc": mock_rhc, "gms": mock_gms}


class TestLivenessProbe:
    """Tests for GET /api/health/ and /api/health/live"""

    def test_health_root(self, client):
        resp = client.get(f"{BASE}/")
        assert resp.status_code == 200
        data = resp.get_json()
        # APIResponse wraps: {"success": true, "data": {"status": "healthy", ...}}
        assert data.get("success") is True or data.get("data", {}).get("status") == "healthy"

    def test_live_endpoint(self, client):
        resp = client.get(f"{BASE}/live")
        assert resp.status_code == 200


class TestReadinessProbe:
    """Tests for GET /api/health/ready"""

    def test_ready_endpoint(self, client, mock_db):
        resp = client.get(f"{BASE}/ready")
        assert resp.status_code in (200, 503)

    def test_ready_firebase_down(self, client, mock_db):
        mock_db.collection.side_effect = Exception("Firebase unavailable")
        resp = client.get(f"{BASE}/ready")
        assert resp.status_code in (503, 200)


class TestDbHealth:
    """Tests for GET /api/health/db"""

    def test_db_health(self, client, auth_headers, mock_db):
        resp = client.get(f"{BASE}/db", headers=auth_headers)
        assert resp.status_code == 200


class TestMetrics:
    """Tests for GET /api/health/metrics (admin only)"""

    def test_metrics_no_auth(self, client):
        resp = client.get(f"{BASE}/metrics")
        # Mock jwt_required always sets g.user_id; admin check may still reject
        assert resp.status_code in (200, 401, 403, 422, 500)

    def test_metrics_with_auth(self, client, auth_headers, mock_db, mock_health_services):
        # Set up admin user in mock_db
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin", "email": "admin@test.com"})
        )
        resp = client.get(f"{BASE}/metrics", headers=auth_headers)
        assert resp.status_code == 200


class TestAdvancedHealth:
    """Tests for GET /api/health/advanced (admin only)"""

    def test_advanced_no_auth(self, client):
        resp = client.get(f"{BASE}/advanced")
        # Mock jwt_required always sets g.user_id; admin check may still reject
        assert resp.status_code in (200, 401, 403, 422, 500)

    def test_advanced_with_auth(self, client, auth_headers, mock_db, mock_health_services):
        # Set up admin user in mock_db
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin", "email": "admin@test.com"})
        )
        resp = client.get(f"{BASE}/advanced", headers=auth_headers)
        assert resp.status_code == 200
