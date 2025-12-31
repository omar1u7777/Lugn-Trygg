from flask import Blueprint, request, jsonify
import logging
from src.utils.ai_services import ai_services

ai_helpers_bp = Blueprint("ai_helpers", __name__)
logger = logging.getLogger(__name__)

@ai_helpers_bp.route("/analyze-text", methods=["POST", "OPTIONS"])
def analyze_text():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = data.get("text", "").strip()

        if not text:
            return jsonify({"error": "Textfältet är tomt"}), 400

        analysis = ai_services.analyze_sentiment(text)

        # Normalize keys returned by ai_services
        response = {
            "sentiment": analysis.get("sentiment"),
            "score": analysis.get("score"),
            "emotions": analysis.get("emotions") or analysis.get("emotions_detected") or [],
            "intensity": analysis.get("intensity"),
            "method": analysis.get("method")
        }

        return jsonify(response), 200

    except Exception as e:
        logger.exception(f"Fel vid textanalys: {e}")
        return jsonify({"error": "Internt serverfel vid textanalys"}), 500
