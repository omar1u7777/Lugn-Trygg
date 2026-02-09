"""
Onboarding Routes
Real backend implementation for user onboarding and goal tracking
"""

import logging
from datetime import UTC, datetime

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

onboarding_bp = Blueprint('onboarding', __name__)
logger = logging.getLogger(__name__)

# Allowed wellness goals
ALLOWED_GOALS: list[str] = [
    'Hantera stress',
    'Bättre sömn',
    'Ökad fokusering',
    'Mental klarhet',
    'Ångesthantering',
    'Självkänsla',
    'Relationsstöd',
    'Arbetsbalans'
]


@onboarding_bp.route('/goals/<user_id>', methods=['OPTIONS'])
@onboarding_bp.route('/status/<user_id>', methods=['OPTIONS'])
@onboarding_bp.route('/skip/<user_id>', methods=['OPTIONS'])
def handle_options(user_id: str):
    """Handle CORS preflight requests."""
    return APIResponse.success()


@onboarding_bp.route('/goals/<user_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_user_goals(user_id: str):
    """Save user's wellness goals from onboarding."""
    try:
        # Verify user owns this data
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized('User ID missing from context')
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to modify other users' goals")

        data = request.get_json(silent=True) or {}
        goals = data.get('goals', [])

        if not goals or not isinstance(goals, list):
            return APIResponse.bad_request("Goals array is required", "GOALS_REQUIRED")

        # Validate goals against allowed list
        validated_goals = [goal for goal in goals if goal in ALLOWED_GOALS]

        if not validated_goals:
            return APIResponse.bad_request("No valid goals provided", "NO_VALID_GOALS")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        logger.info(f"💾 Saving {len(validated_goals)} goals for user {user_id[:8]}")

        # Save to Firestore (always camelCase: wellnessGoals)
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'wellnessGoals': validated_goals,
            'onboarding_completed': True,
            'onboarding_completed_at': datetime.now(UTC),
            'updated_at': datetime.now(UTC)
        })

        logger.info(f"✅ Goals saved successfully for user {user_id[:8]}: {validated_goals}")

        # Track analytics
        audit_log('onboarding_completed', user_id, {
            'goals': validated_goals,
            'goal_count': len(validated_goals)
        })

        return APIResponse.success({
            'goals': validated_goals,
            'onboardingCompleted': True
        }, "Goals saved successfully")

    except Exception as e:
        logger.exception(f"Error saving user goals: {e}")
        return APIResponse.error("Failed to save goals", "SAVE_ERROR", 500)


@onboarding_bp.route('/goals/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_goals(user_id: str):
    """Get user's wellness goals."""
    try:
        # Verify user owns this data
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized('User ID missing from context')
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to view other users' goals")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Get from Firestore
        user_doc = db.collection('users').document(user_id).get()

        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict() or {}
        # Always read camelCase, fallback to underscore for legacy
        goals = user_data.get('wellnessGoals', []) or user_data.get('wellness_goals', [])
        onboarding_completed = user_data.get('onboarding_completed', False)

        return APIResponse.success({
            'goals': goals,
            'onboardingCompleted': onboarding_completed
        }, "Goals retrieved successfully")

    except Exception as e:
        logger.exception(f"Error getting user goals: {e}")
        return APIResponse.error("Failed to fetch goals", "FETCH_ERROR", 500)


@onboarding_bp.route('/goals/<user_id>', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_user_goals(user_id: str):
    """Update user's wellness goals."""
    try:
        # Verify user owns this data
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized('User ID missing from context')
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to modify other users' goals")

        data = request.get_json(silent=True) or {}
        goals = data.get('goals', [])

        if not isinstance(goals, list):
            return APIResponse.bad_request("Goals must be an array", "INVALID_FORMAT")

        # Validate goals against allowed list
        validated_goals = [goal for goal in goals if goal in ALLOWED_GOALS]

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        logger.info(f"🔄 Updating goals for user {user_id[:8]}")

        # Update in Firestore (always camelCase: wellnessGoals)
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'wellnessGoals': validated_goals,
            'updated_at': datetime.now(UTC)
        })

        logger.info(f"✅ Goals updated for user {user_id[:8]}: {validated_goals}")
        audit_log('goals_updated', user_id, {'goals': validated_goals})

        return APIResponse.success({
            'goals': validated_goals
        }, "Goals updated successfully")

    except Exception as e:
        logger.exception(f"Error updating user goals: {e}")
        return APIResponse.error("Failed to update goals", "UPDATE_ERROR", 500)


@onboarding_bp.route('/status/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_onboarding_status(user_id: str):
    """Get user's onboarding status."""
    try:
        # Verify user owns this data
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized('User ID missing from context')
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to view other users' status")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        # Get from Firestore
        user_doc = db.collection('users').document(user_id).get()

        if not user_doc.exists:
            return APIResponse.not_found("User not found")

        user_data = user_doc.to_dict() or {}
        wellness_goals = user_data.get('wellnessGoals', []) or user_data.get('wellness_goals', [])

        return APIResponse.success({
            'onboardingCompleted': user_data.get('onboarding_completed', False),
            'onboardingCompletedAt': user_data.get('onboarding_completed_at'),
            'wellnessGoals': wellness_goals,
            'goalsCount': len(wellness_goals)
        }, "Onboarding status retrieved")

    except Exception as e:
        logger.exception(f"Error getting onboarding status: {e}")
        return APIResponse.error("Failed to fetch onboarding status", "FETCH_ERROR", 500)


@onboarding_bp.route('/skip/<user_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def skip_onboarding(user_id: str):
    """Mark onboarding as skipped (still set completed flag)."""
    try:
        # Verify user owns this data
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized('User ID missing from context')
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if db is None:
            return APIResponse.error("Database connection unavailable", "DB_ERROR", 503)

        logger.info(f"⏭️  User {user_id[:8]} skipped onboarding")

        # Mark as completed but without goals
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'onboarding_completed': True,
            'onboarding_skipped': True,
            'onboarding_completed_at': datetime.now(UTC),
            'updated_at': datetime.now(UTC)
        })

        # Track analytics
        audit_log('onboarding_skipped', user_id, {
            'skipped': True
        })

        return APIResponse.success({
            'onboardingCompleted': True,
            'skipped': True
        }, "Onboarding skipped")

    except Exception as e:
        logger.exception(f"Error skipping onboarding: {e}")
        return APIResponse.error("Failed to skip onboarding", "SKIP_ERROR", 500)
