"""
Feedback Routes
User feedback collection and management
"""
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
from src.firebase_config import db
from src.services.email_service import EmailService
from src.services.auth_service import AuthService

feedback_bp = Blueprint("feedback", __name__)
logger = logging.getLogger(__name__)
email_service = EmailService()

@feedback_bp.route("/submit", methods=["POST", "OPTIONS"])
def submit_feedback():
    """Submit user feedback"""
    logger.info("📝 FEEDBACK - SUBMIT endpoint called")
    if request.method == "OPTIONS":
        logger.info("✅ FEEDBACK - OPTIONS preflight")
        # Handle CORS preflight
        return "", 204
    
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        rating = data.get("rating", 0)
        category = data.get("category", "general")
        logger.info(f"👤 FEEDBACK - User {user_id}, rating: {rating}, category: {category}")
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
        logger.info(f"✅ FEEDBACK - Stored feedback {feedback_ref.id} for user {user_id}")

        # Update user feedback stats
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        user_email = None
        user_name = None
        if user_doc.exists:
            user_data = user_doc.to_dict()
            user_email = user_data.get("email", "")
            user_name = user_data.get("name", "Användare")
            feedback_count = user_data.get("feedback_submissions", 0) + 1
            user_ref.update({
                "feedback_submissions": feedback_count,
                "last_feedback_at": datetime.now(timezone.utc).isoformat()
            })

        # Send email notifications
        try:
            # 1. Send confirmation email to user
            if user_email and data.get("allow_contact", False):
                email_service.send_feedback_confirmation(
                    to_email=user_email,
                    user_name=user_name,
                    category=category,
                    rating=rating,
                    feedback_id=feedback_ref.id
                )
            
            # 2. Send notification to admin
            import os
            admin_email = os.getenv("ADMIN_EMAIL", "admin@lugn-trygg.com")
            email_service.send_feedback_admin_notification(
                admin_email=admin_email,
                user_name=user_name,
                user_email=user_email or "Anonym",
                category=category,
                rating=rating,
                message=message,
                feedback_id=feedback_ref.id
            )
            logger.info(f"Feedback emails sent for {feedback_ref.id}")
        except Exception as email_error:
            logger.error(f"Failed to send feedback emails: {email_error}")
            # Don't fail the request if emails fail

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
@AuthService.jwt_required
def list_feedback():
    """List all feedback (admin only)"""
    try:
        # TODO: Add admin authentication check
        status = request.args.get("status", "all")
        category = request.args.get("category", "all")
        limit = int(request.args.get("limit", 50))

        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        from google.cloud.firestore import FieldFilter
        query = db.collection("feedback").order_by("created_at", direction="DESCENDING")

        if status != "all":
            query = query.where(filter=FieldFilter("status", "==", status))

        if category != "all":
            query = query.where(filter=FieldFilter("category", "==", category))

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
@AuthService.jwt_required
def feedback_stats():
    """Get feedback statistics (admin only)"""
    try:
        # Get date range parameters
        days = int(request.args.get("days", 30))
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        from google.cloud.firestore import FieldFilter
        feedback_docs = list(
            db.collection("feedback")
            .where(filter=FieldFilter("created_at", ">=", start_date.isoformat()))
            .stream()
        )

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
            "recent_count_30_days": total_feedback,  # Now properly filtered by date
            "date_range_days": days
        }), 200

    except Exception as e:
        logger.exception(f"Error getting feedback stats: {e}")
        return jsonify({"error": "Internal server error"}), 500

@feedback_bp.route("/my-feedback", methods=["GET"])
def get_user_feedback():
    """Get user's own feedback history"""
    try:
        user_id = request.args.get("user_id", "").strip()
        
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
        
        # Query feedback by user_id
        # NOTE: Removed order_by to avoid requiring a composite index
        # We'll sort in memory instead (simpler for small datasets)
        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        from google.cloud.firestore import FieldFilter
        feedback_docs = list(
            db.collection("feedback")
            .where(filter=FieldFilter("user_id", "==", user_id))
            .stream()
        )
        
        feedback_list = []
        for doc in feedback_docs:
            feedback_data = doc.to_dict()
            feedback_data["id"] = doc.id
            feedback_list.append(feedback_data)
        
        # Sort in memory by created_at (most recent first)
        feedback_list.sort(
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        
        return jsonify({
            "feedback": feedback_list,
            "count": len(feedback_list)
        }), 200
    
    except Exception as e:
        logger.exception(f"Error getting user feedback: {e}")
        return jsonify({"error": "Internal server error"}), 500
