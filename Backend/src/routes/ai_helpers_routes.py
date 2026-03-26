import logging
from typing import Any

from flask import Blueprint, Response, jsonify, make_response, request

from src.services.ai_service import ai_services
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint

MAX_TEXT_LENGTH = 4000

ai_helpers_bp = Blueprint("ai_helpers", __name__)
logger = logging.getLogger(__name__)


def _preflight_response() -> Response:
    """Return typed empty response for OPTIONS requests."""
    return make_response('', 204)

@ai_helpers_bp.route("/analyze-text", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def analyze_text():
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        data = request.get_json(force=True, silent=True) or {}
        if not isinstance(data, dict):
            return jsonify({"error": "Ogiltigt request-format"}), 400

        text_value = data.get("text", "")
        if not isinstance(text_value, str):
            return jsonify({"error": "Text måste vara en sträng"}), 400

        text = text_value.strip()

        if not text:
            return jsonify({"error": "Textfältet är tomt"}), 400
        if len(text) > MAX_TEXT_LENGTH:
            return jsonify({"error": f"Text får vara max {MAX_TEXT_LENGTH} tecken"}), 400

        analysis: Any = ai_services.analyze_sentiment(text) or {}
        if not isinstance(analysis, dict):
            analysis = {}

        # Normalize keys returned by ai_services
        response = {
            "sentiment": analysis.get("sentiment"),
            "score": analysis.get("score"),
            "emotions": analysis.get("emotions") or analysis.get("emotions_detected") or [],
            "intensity": analysis.get("intensity"),
            "method": analysis.get("method")
        }

        return jsonify(response), 200

    except Exception:
        logger.exception("Fel vid textanalys")
        return jsonify({"error": "Internt serverfel vid textanalys"}), 500
