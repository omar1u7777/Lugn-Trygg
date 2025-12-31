import logging
from flask import Blueprint, jsonify, request

from src.routes import chatbot_routes

chat_alias_bp = Blueprint("chat_alias", __name__)
logger = logging.getLogger(__name__)


@chat_alias_bp.route("/message", methods=["POST", "OPTIONS"])
def proxy_chat_message():
    """Expose legacy /api/chat/message endpoint by delegating to the main chatbot handler."""
    if request.method == 'OPTIONS':
        return '', 204

    logger.debug("Proxying legacy /api/chat/message request to /api/chatbot/chat")
    return chatbot_routes.chat_with_ai()


@chat_alias_bp.route("/history", methods=["GET", "OPTIONS"])
def proxy_chat_history():
    """Expose legacy /api/chat/history endpoint while requiring explicit user context."""
    if request.method == 'OPTIONS':
        return '', 204

    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        # Legacy integrations sometimes omit user_id; respond with 404 to match test expectations.
        return jsonify({"error": "user_id kravs for historik"}), 404

    logger.debug("Proxying legacy /api/chat/history request to /api/chatbot/history")
    return chatbot_routes.get_chat_history()
