"""
Feedback Routes
User feedback collection and management
"""
import logging
import re
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.email_service import EmailService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

# Validation pattern for user IDs
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

feedback_bp = Blueprint("feedback", __name__)
logger = logging.getLogger(__name__)
email_service = EmailService()


def _to_camel_case_feedback(feedback_data: dict) -> dict:
    """Convert feedback data to camelCase for API response"""
    return {
        'id': feedback_data.get('id'),
        'userId': feedback_data.get('user_id'),
        'rating': feedback_data.get('rating'),
        'category': feedback_data.get('category'),
        'message': feedback_data.get('message'),
        'featureRequest': feedback_data.get('feature_request'),
        'bugReport': feedback_data.get('bug_report'),
        'status': feedback_data.get('status'),
        'createdAt': feedback_data.get('created_at'),
        'timestamp': feedback_data.get('timestamp')
    }

@feedback_bp.route("/submit", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
def submit_feedback():
    """Submit user feedback"""
    logger.info("📝 FEEDBACK - SUBMIT endpoint called")
    if request.method == "OPTIONS":
        logger.info("✅ FEEDBACK - OPTIONS preflight")
        # Handle CORS preflight
        return "", 204

    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = input_sanitizer.sanitize(data.get("user_id", "").strip())
        rating = data.get("rating", 0)
        category = input_sanitizer.sanitize(data.get("category", "general"))
        logger.info(f"👤 FEEDBACK - User {user_id}, rating: {rating}, category: {category}")
        message = input_sanitizer.sanitize(data.get("message", "").strip())
        feature_request = input_sanitizer.sanitize(data.get("feature_request", ""))
        bug_report = input_sanitizer.sanitize(data.get("bug_report", ""))

        if not user_id:
            return APIResponse.bad_request('user_id is required')

        # Validate user_id format
        if not USER_ID_PATTERN.match(user_id):
            logger.warning(f"Invalid user_id format: {user_id[:50]}")
            return APIResponse.bad_request('Invalid user_id format')

        if rating < 1 or rating > 5:
            return APIResponse.bad_request('Rating must be between 1 and 5')

        if not message and not feature_request and not bug_report:
            return APIResponse.bad_request('Please provide feedback')

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
            "created_at": datetime.now(UTC).isoformat(),
            "timestamp": data.get("timestamp", datetime.now(UTC).isoformat())
        }
        feedback_ref.set(feedback_data)
        logger.info(f"✅ FEEDBACK - Stored feedback {feedback_ref.id} for user {user_id}")

        # Update user feedback stats
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        user_email = None
        user_name = "User"  # Default value
        if user_doc.exists:
            user_data = user_doc.to_dict()
            user_email = user_data.get("email", "")
            user_name = user_data.get("name") or "Användare"
            feedback_count = user_data.get("feedback_submissions", 0) + 1
            user_ref.update({
                "feedback_submissions": feedback_count,
                "last_feedback_at": datetime.now(UTC).isoformat()
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
                user_email=user_email or "Anonymous",
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

        # Audit log for feedback submission
        audit_log(
            event_type="FEEDBACK_SUBMITTED",
            user_id=user_id,
            details={
                "feedback_id": feedback_ref.id,
                "category": category,
                "rating": rating,
                "has_feature_request": bool(feature_request),
                "has_bug_report": bool(bug_report)
            }
        )

        return APIResponse.success(
            data={'feedbackId': feedback_ref.id},
            message='Feedback submitted successfully'
        )

    except Exception as e:
        logger.exception(f"Error submitting feedback: {e}")
        return APIResponse.error('Internal server error')

@feedback_bp.route("/list", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def list_feedback():
    """List all feedback (admin only)"""
    if request.method == "OPTIONS":
        return "", 204

    try:
        user_id = g.user_id

        # Check if user is admin
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            audit_log(event_type="FEEDBACK_LIST_UNAUTHORIZED", user_id=user_id, details={"reason": "user_not_found"})
            return APIResponse.not_found('User not found')

        user_data = user_doc.to_dict()
        is_admin = user_data.get("role") == "admin" or user_data.get("is_admin", False)

        if not is_admin:
            audit_log(event_type="FEEDBACK_LIST_UNAUTHORIZED", user_id=user_id, details={"reason": "not_admin"})
            logger.warning(f"Non-admin user {user_id} attempted to access feedback list")
            return APIResponse.forbidden('Admin access required')

        status = request.args.get("status", "all")
        category = request.args.get("category", "all")
        limit = min(int(request.args.get("limit", 50)), 200)  # Cap at 200

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
            feedback_list.append(_to_camel_case_feedback(feedback_data))

        return APIResponse.success(
            data={'feedback': feedback_list, 'count': len(feedback_list)},
            message='Feedback list retrieved'
        )

    except Exception as e:
        logger.exception(f"Error listing feedback: {e}")
        return APIResponse.error('Internal server error')

@feedback_bp.route("/stats", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def feedback_stats():
    """Get feedback statistics (admin only)"""
    if request.method == "OPTIONS":
        return "", 204

    try:
        user_id = g.user_id

        # Check if user is admin
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return APIResponse.not_found('User not found')

        user_data = user_doc.to_dict()
        is_admin = user_data.get("role") == "admin" or user_data.get("is_admin", False)

        if not is_admin:
            audit_log(event_type="FEEDBACK_STATS_UNAUTHORIZED", user_id=user_id, details={"reason": "not_admin"})
            return APIResponse.forbidden('Admin access required')

        # Get date range parameters
        days = min(int(request.args.get("days", 30)), 365)  # Cap at 1 year
        start_date = datetime.now(UTC) - timedelta(days=days)

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

        return APIResponse.success(
            data={
                'totalFeedback': total_feedback,
                'averageRating': round(avg_rating, 2),
                'categories': categories,
                'recentCount30Days': total_feedback,
                'dateRangeDays': days
            },
            message='Feedback statistics retrieved'
        )

    except Exception as e:
        logger.exception(f"Error getting feedback stats: {e}")
        return APIResponse.error('Internal server error')

@feedback_bp.route("/my-feedback", methods=["GET", "OPTIONS"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_feedback():
    """Get user's own feedback history"""
    if request.method == "OPTIONS":
        return "", 204

    try:
        # SECURITY: Get user_id from JWT token, not from query params
        user_id = g.user_id

        if not user_id:
            return APIResponse.unauthorized('Authentication required')

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
            feedback_list.append(_to_camel_case_feedback(feedback_data))

        # Sort in memory by created_at (most recent first)
        feedback_list.sort(
            key=lambda x: x.get("createdAt", ""),
            reverse=True
        )

        return APIResponse.success(
            data={'feedback': feedback_list, 'count': len(feedback_list)},
            message='User feedback retrieved'
        )

    except Exception as e:
        logger.exception(f"Error getting user feedback: {e}")
        return APIResponse.error('Internal server error')
