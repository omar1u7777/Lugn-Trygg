"""Security and monitoring routes for admin auditing."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.api_key_rotation import get_key_rotation_status
from ..services.auth_service import AuthService
from ..services.security_monitoring import get_security_metrics
from ..services.tamper_detection_service import tamper_detection_service
from .admin_routes import require_admin

security_bp = Blueprint('security', __name__, url_prefix='/api/security')


def _options_passthrough():
    if request.method == 'OPTIONS':
        return '', 204
    return None


def _serialize_datetimes(payload):
    from datetime import datetime

    if isinstance(payload, datetime):
        return payload.isoformat()
    if isinstance(payload, dict):
        return {key: _serialize_datetimes(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_serialize_datetimes(value) for value in payload]
    return payload


@security_bp.route('/key-rotation/status', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def key_rotation_status():
    """Return current API key rotation status."""
    options_response = _options_passthrough()
    if options_response:
        return options_response

    status = get_key_rotation_status()
    status['service'] = 'api_key_rotation'
    return jsonify(_serialize_datetimes(status))


@security_bp.route('/tamper/events', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def tamper_events():
    """Return recent tamper detection alerts and summary."""
    options_response = _options_passthrough()
    if options_response:
        return options_response

    limit = min(int(request.args.get('limit', 50)), 200)
    events = tamper_detection_service.get_recent_events(limit=limit)
    return jsonify({
        'events': events,
        'summary': tamper_detection_service.get_summary(),
        'active_alerts': tamper_detection_service.get_active_alerts(),
    })


@security_bp.route('/monitoring/metrics', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def monitoring_metrics():
    """Aggregated security monitoring metrics."""
    options_response = _options_passthrough()
    if options_response:
        return options_response

    metrics = get_security_metrics()
    return jsonify(metrics)
