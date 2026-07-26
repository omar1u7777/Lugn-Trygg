"""AI helpers routes — text sentiment analysis endpoint."""
import logging

from flask import Blueprint, g, request

from src.services.ai_service import ai_services
from src.services.auth_service import AuthService
from src.utils.response_utils import APIResponse

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
        return APIResponse.bad_request("text is required")
    if not isinstance(text, str) or not text.strip():
        return APIResponse.bad_request("text must be a non-empty string")
    if len(text) > _MAX_TEXT_LEN:
        return APIResponse.bad_request(f"text exceeds maximum length of {_MAX_TEXT_LEN} characters")

    try:
        result = ai_services.analyze_sentiment(text.strip())
        return APIResponse.success(result, "Text analyzed successfully")
    except Exception:
        logger.exception("analyze_text: sentiment analysis failed for user %s", getattr(g, "user_id", "unknown"))
        return APIResponse.error("AI service error", "AI_SERVICE_ERROR", 500)
