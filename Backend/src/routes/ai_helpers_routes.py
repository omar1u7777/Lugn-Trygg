"""AI helpers routes — text sentiment analysis endpoint."""
import logging

from flask import Blueprint, g, jsonify, request

from src.services.ai_service import ai_services
from src.services.auth_service import AuthService

ai_helpers_bp = Blueprint("ai_helpers", __name__)
logger = logging.getLogger(__name__)

_MAX_TEXT_LEN = 2000


@ai_helpers_bp.route("/analyze-text", methods=["POST"])
@AuthService.jwt_required
def analyze_text():
    """POST /api/v1/ai-helpers/analyze-text — sentiment analysis on free text."""
    body = request.get_json(silent=True) or {}
    text = body.get("text")

    if not text:
        return jsonify({"error": "text is required"}), 400
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "text must be a non-empty string"}), 400
    if len(text) > _MAX_TEXT_LEN:
        return jsonify({"error": f"text exceeds maximum length of {_MAX_TEXT_LEN} characters"}), 400

    try:
        result = ai_services.analyze_sentiment(text.strip())
        return jsonify(result), 200
    except Exception:
        logger.exception("analyze_text: sentiment analysis failed for user %s", getattr(g, "user_id", "unknown"))
        return jsonify({"error": "AI service error"}), 500
