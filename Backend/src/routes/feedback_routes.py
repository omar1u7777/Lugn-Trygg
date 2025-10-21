"""
Feedback Routes
User feedback collection and management
"""
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from src.firebase_config import db

feedback_bp = Blueprint("feedback", __name__)
logger = logging.getLogger(__name__)

@feedback_bp.route("/submit", methods=["POST", "OPTIONS"])
def submit_feedback():
    """Submit user feedback"""
    if request.method == "OPTIONS":
        # Handle CORS preflight
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        rating = data.get("rating", 0)
        category = data.get("category", "general")
        message = data.get("message", "").strip()
        feature_request = data.get("feature_request", "")
        bug_report = data.get("bug_report", "")

        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        if rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5"}), 400

        if not message and not feature_request and not bug_report:
            return jsonify({"error": "Please provide feedback"}), 400

        # Store feedback
        feedback_ref = db.collection("feedback").document()
        feedback_data = {
            "user_id": user_id,
            "rating": rating,
            "category": category,
            "message": message,
            "feature_request": feature_request,
            "bug_report": bug_report,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat())
        }
        feedback_ref.set(feedback_data)

        # Update user feedback stats
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            feedback_count = user_data.get("feedback_submissions", 0) + 1
            user_ref.update({
                "feedback_submissions": feedback_count,
                "last_feedback_at": datetime.now(timezone.utc).isoformat()
            })

        logger.info(f"Feedback submitted by {user_id}: {category} - rating {rating}")

        return jsonify({
            "success": True,
            "message": "Feedback submitted successfully",
            "feedback_id": feedback_ref.id
        }), 200

    except Exception as e:
        logger.exception(f"Error submitting feedback: {e}")
        return jsonify({"error": "Internal server error"}), 500

@feedback_bp.route("/list", methods=["GET"])
def list_feedback():
    """List all feedback (admin only)"""
    try:
        # TODO: Add admin authentication check
        status = request.args.get("status", "all")
        category = request.args.get("category", "all")
        limit = int(request.args.get("limit", 50))

        query = db.collection("feedback").order_by("created_at", direction="DESCENDING")

        if status != "all":
            query = query.where("status", "==", status)

        if category != "all":
            query = query.where("category", "==", category)

        feedback_docs = list(query.limit(limit).stream())

        feedback_list = []
        for doc in feedback_docs:
            feedback_data = doc.to_dict()
            feedback_data["id"] = doc.id
            feedback_list.append(feedback_data)

        return jsonify({
            "feedback": feedback_list,
            "count": len(feedback_list)
        }), 200

    except Exception as e:
        logger.exception(f"Error listing feedback: {e}")
        return jsonify({"error": "Internal server error"}), 500

@feedback_bp.route("/stats", methods=["GET"])
def feedback_stats():
    """Get feedback statistics (admin only)"""
    try:
        # TODO: Add admin authentication check
        feedback_docs = list(db.collection("feedback").stream())

        total_feedback = len(feedback_docs)
        ratings = [doc.to_dict().get("rating", 0) for doc in feedback_docs]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0

        categories = {}
        for doc in feedback_docs:
            category = doc.to_dict().get("category", "general")
            categories[category] = categories.get(category, 0) + 1

        return jsonify({
            "total_feedback": total_feedback,
            "average_rating": round(avg_rating, 2),
            "categories": categories,
            "recent_count_30_days": total_feedback  # TODO: Filter by date
        }), 200

    except Exception as e:
        logger.exception(f"Error getting feedback stats: {e}")
        return jsonify({"error": "Internal server error"}), 500
