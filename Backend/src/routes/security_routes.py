"""Security and monitoring routes for admin auditing."""

from __future__ import annotations

from flask import Blueprint, request

from ..services.api_key_rotation import get_key_rotation_status
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.security_monitoring import get_security_metrics
from ..services.tamper_detection_service import tamper_detection_service
from ..utils.response_utils import APIResponse
from .admin_routes import require_admin

security_bp = Blueprint('security', __name__)


def _serialize_datetimes(payload):
    from datetime import datetime

    if isinstance(payload, datetime):
        return payload.isoformat()
    if isinstance(payload, dict):
        return {key: _serialize_datetimes(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_serialize_datetimes(value) for value in payload]
    return payload


# CORS OPTIONS handler for all endpoints
@security_bp.route('/key-rotation/status', methods=['OPTIONS'])
@security_bp.route('/tamper/events', methods=['OPTIONS'])
@security_bp.route('/monitoring/metrics', methods=['OPTIONS'])
def handle_options():
    """Handle CORS preflight requests"""
    return APIResponse.success()


@security_bp.route('/key-rotation/status', methods=['GET'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
def key_rotation_status():
    """Return current API key rotation status."""
    status = get_key_rotation_status()
    status['service'] = 'api_key_rotation'
    return APIResponse.success(_serialize_datetimes(status), "Key rotation status retrieved")


@security_bp.route('/tamper/events', methods=['GET'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
def tamper_events():
    """Return recent tamper detection alerts and summary."""
    limit = min(int(request.args.get('limit', 50)), 200)
    events = tamper_detection_service.get_recent_events(limit=limit)
    return APIResponse.success({
        "events": events,
        "summary": tamper_detection_service.get_summary(),
        "activeAlerts": tamper_detection_service.get_active_alerts(),
    }, "Tamper events retrieved")


@security_bp.route('/monitoring/metrics', methods=['GET'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
def monitoring_metrics():
    """Aggregated security monitoring metrics."""
    metrics = get_security_metrics()
    return APIResponse.success(metrics, "Security metrics retrieved")
