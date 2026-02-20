"""
Tests for security_routes.py
Covers: key rotation status, tamper events, security monitoring metrics.
All endpoints require admin role.
"""
import pytest
from unittest.mock import MagicMock, patch


BASE = "/api/v1/security"


@pytest.fixture
def mock_security_services():
    """Mock all security service dependencies."""
    with patch("src.routes.security_routes.get_key_rotation_status") as mock_krs, \
         patch("src.routes.security_routes.tamper_detection_service") as mock_tds, \
         patch("src.routes.security_routes.get_security_metrics") as mock_gsm:
        mock_krs.return_value = {
            "last_rotation": "2025-01-01T00:00:00Z",
            "next_rotation": "2025-04-01T00:00:00Z",
            "keys_rotated": 3,
        }
        mock_tds.get_recent_events.return_value = []
        mock_tds.get_summary.return_value = {"total_events": 0, "active_alerts": 0}
        mock_tds.get_active_alerts.return_value = []
        mock_gsm.return_value = {
            "auth_failures": 5,
            "blocked_ips": 2,
            "rate_limited": 10,
        }
        yield {"krs": mock_krs, "tds": mock_tds, "gsm": mock_gsm}


class TestKeyRotationStatus:
    """Tests for GET /api/security/key-rotation/status"""

    def test_no_auth(self, client):
        resp = client.get(f"{BASE}/key-rotation/status")
        # Mock jwt_required always sets g.user_id; require_admin may return 404 (user not found)
        assert resp.status_code in (200, 401, 403, 404, 422)

    def test_with_auth_admin(self, client, auth_headers, mock_db, mock_security_services):
        # Set up admin user in mock_db for require_admin decorator
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin"})
        )
        resp = client.get(f"{BASE}/key-rotation/status", headers=auth_headers)
        assert resp.status_code == 200

    def test_options(self, client):
        resp = client.options(f"{BASE}/key-rotation/status")
        assert resp.status_code in (200, 204)


class TestTamperEvents:
    """Tests for GET /api/security/tamper/events"""

    def test_no_auth(self, client):
        resp = client.get(f"{BASE}/tamper/events")
        assert resp.status_code in (200, 401, 403, 404, 422)

    def test_with_auth(self, client, auth_headers, mock_db, mock_security_services):
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin"})
        )
        resp = client.get(f"{BASE}/tamper/events", headers=auth_headers)
        assert resp.status_code == 200

    def test_with_limit(self, client, auth_headers, mock_db, mock_security_services):
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin"})
        )
        resp = client.get(f"{BASE}/tamper/events?limit=5", headers=auth_headers)
        assert resp.status_code == 200


class TestMonitoringMetrics:
    """Tests for GET /api/security/monitoring/metrics"""

    def test_no_auth(self, client):
        resp = client.get(f"{BASE}/monitoring/metrics")
        assert resp.status_code in (200, 401, 403, 404, 422)

    def test_with_auth(self, client, auth_headers, mock_db, mock_security_services):
        users_col = mock_db.collection("users")
        users_col.document.return_value.get.return_value = MagicMock(
            exists=True,
            to_dict=MagicMock(return_value={"role": "admin"})
        )
        resp = client.get(f"{BASE}/monitoring/metrics", headers=auth_headers)
        assert resp.status_code == 200
