"""
Daily Insights Routes - API for proactive therapeutic insights
"""

import logging

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.daily_insight_service import generate_daily_insights, get_insight_generator
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

insights_bp = Blueprint("insights", __name__)


@insights_bp.route("/generate/<user_id>", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def generate_insights(user_id: str):
    """
    Trigger insight generation for a user (admin or self).
    Normally run by scheduled job, but can be triggered manually.
    """
    try:
        current_user = g.get('user_id')

        # Users can only generate for themselves
        if user_id != current_user:
            return APIResponse.forbidden("Can only generate insights for yourself")

        # Generate insights
        insights = generate_daily_insights(user_id)

        response_data = {
            'generated_count': len(insights),
            'insights': [
                {
                    'id': i.insight_id,
                    'type': i.insight_type.value,
                    'title': i.title,
                    'message': i.message,
                    'recommendation': i.recommendation,
                    'urgency': i.urgency,
                    'action': i.suggested_action
                }
                for i in insights
            ]
        }

        logger.info(f"Generated {len(insights)} insights for {user_id}")

        return APIResponse.success(
            data=response_data,
            message=f"Generated {len(insights)} personalized insights"
        )

    except Exception as e:
        logger.exception(f"Failed to generate insights: {e}")
        return APIResponse.error("Failed to generate insights", "INSIGHT_ERROR", 500)


@insights_bp.route("/pending/<user_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_pending_insights(user_id: str):
    """Get pending insights for user."""
    try:
        current_user = g.get('user_id')

        if user_id != current_user:
            return APIResponse.forbidden("Unauthorized access")

        generator = get_insight_generator()
        insights = generator.get_pending_insights(user_id)

        return APIResponse.success(
            data={'insights': insights, 'count': len(insights)},
            message=f"Found {len(insights)} pending insights"
        )

    except Exception as e:
        logger.error(f"Failed to fetch insights: {e}")
        return APIResponse.error("Failed to fetch insights")


@insights_bp.route("/dismiss/<insight_id>", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def dismiss_insight(insight_id: str):
    """Mark an insight as dismissed by user."""
    try:
        user_id = g.get('user_id')

        # Verify ownership
        insight_doc = db.collection('insights').document(insight_id).get()
        if not insight_doc.exists:
            return APIResponse.not_found("Insight not found")

        if insight_doc.to_dict().get('user_id') != user_id:
            return APIResponse.forbidden("Unauthorized")

        # Update status
        db.collection('insights').document(insight_id).update({
            'status': 'dismissed',
            'dismissed_at': datetime.now()
        })

        return APIResponse.success(message="Insight dismissed")

    except Exception as e:
        logger.error(f"Failed to dismiss insight: {e}")
        return APIResponse.error("Failed to dismiss insight")


@insights_bp.route("/action/<insight_id>", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def insight_action_taken(insight_id: str):
    """Log that user took action on an insight."""
    try:
        user_id = g.get('user_id')
        data = request.get_json() or {}
        action_taken = data.get('action', 'unknown')

        db.collection('insights').document(insight_id).update({
            'status': 'action_taken',
            'action_taken': action_taken,
            'action_taken_at': datetime.now()
        })

        # Also log for analytics
        from src.services.audit_service import audit_log
        audit_log(
            event_type="INSIGHT_ACTION_TAKEN",
            user_id=user_id,
            details={
                "insight_id": insight_id,
                "action": action_taken
            }
        )

        return APIResponse.success(message="Action recorded")

    except Exception as e:
        logger.error(f"Failed to record action: {e}")
        return APIResponse.error("Failed to record action")


from datetime import datetime
