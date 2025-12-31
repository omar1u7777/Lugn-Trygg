"""
Onboarding Routes
Real backend implementation for user onboarding and goal tracking
"""

from flask import Blueprint, request, jsonify, g
from ..services.auth_service import AuthService
from ..firebase_config import db
from datetime import datetime, timezone
import logging
from typing import Dict, List, Any

onboarding_bp = Blueprint('onboarding', __name__)
logger = logging.getLogger(__name__)


@onboarding_bp.route('/goals/<user_id>', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def save_user_goals(user_id: str):
    """Save user's wellness goals from onboarding"""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Verify user owns this data
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        goals = data.get('goals', [])
        
        if not goals or not isinstance(goals, list):
            return jsonify({'error': 'Goals array required'}), 400
        
        # Validate goals (only allowed wellness goals)
        allowed_goals = [
            'Hantera stress',
            'Bättre sömn',
            'Ökad fokusering',
            'Mental klarhet',
            'Ångesthantering',
            'Självkänsla',
            'Relationsstöd',
            'Arbetsbalans'
        ]
        
        validated_goals = [g for g in goals if g in allowed_goals]
        
        if not validated_goals:
            return jsonify({'error': 'No valid goals provided'}), 400
        
        logger.info(f"💾 Saving {len(validated_goals)} goals for user {user_id}")
        
        # Save to Firestore (always camelCase: wellnessGoals)
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'wellnessGoals': validated_goals,
            'onboarding_completed': True,
            'onboarding_completed_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })
        
        logger.info(f"✅ Goals saved successfully for user {user_id}: {validated_goals}")
        
        # Track analytics
        from ..services.audit_service import audit_log
        audit_log('onboarding_completed', user_id, {
            'goals': validated_goals,
            'goal_count': len(validated_goals)
        })
        
        return jsonify({
            'message': 'Goals saved successfully',
            'goals': validated_goals,
            'onboarding_completed': True
        }), 200
        
    except Exception as e:
        logger.exception(f"Error saving user goals: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@onboarding_bp.route('/goals/<user_id>', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
def get_user_goals(user_id: str):
    """Get user's wellness goals"""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Verify user owns this data
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        # Always read camelCase, fallback to underscore for legacy
        goals = user_data.get('wellnessGoals', []) or user_data.get('wellness_goals', [])
        onboarding_completed = user_data.get('onboarding_completed', False)

        return jsonify({
            'goals': goals,
            'onboarding_completed': onboarding_completed
        }), 200
        
    except Exception as e:
        logger.exception(f"Error getting user goals: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@onboarding_bp.route('/goals/<user_id>', methods=['PUT', 'OPTIONS'])
@AuthService.jwt_required
def update_user_goals(user_id: str):
    """Update user's wellness goals"""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Verify user owns this data
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        goals = data.get('goals', [])
        
        if not isinstance(goals, list):
            return jsonify({'error': 'Goals must be an array'}), 400
        
        # Validate goals
        allowed_goals = [
            'Hantera stress',
            'Bättre sömn',
            'Ökad fokusering',
            'Mental klarhet',
            'Ångesthantering',
            'Självkänsla',
            'Relationsstöd',
            'Arbetsbalans'
        ]
        
        validated_goals = [g for g in goals if g in allowed_goals]
        
        logger.info(f"🔄 Updating goals for user {user_id}")
        
        # Update in Firestore (always camelCase: wellnessGoals)
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'wellnessGoals': validated_goals,
            'updated_at': datetime.now(timezone.utc)
        })
        
        logger.info(f"✅ Goals updated for user {user_id}: {validated_goals}")
        
        return jsonify({
            'message': 'Goals updated successfully',
            'goals': validated_goals
        }), 200
        
    except Exception as e:
        logger.exception(f"Error updating user goals: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@onboarding_bp.route('/status/<user_id>', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
def get_onboarding_status(user_id: str):
    """Get user's onboarding status"""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Verify user owns this data
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        
        return jsonify({
            'onboarding_completed': user_data.get('onboarding_completed', False),
            'onboarding_completed_at': user_data.get('onboarding_completed_at'),
            'wellness_goals': user_data.get('wellness_goals', []),
            'goals_count': len(user_data.get('wellness_goals', []))
        }), 200
        
    except Exception as e:
        logger.exception(f"Error getting onboarding status: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@onboarding_bp.route('/skip/<user_id>', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def skip_onboarding(user_id: str):
    """Mark onboarding as skipped (still set completed flag)"""
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Verify user owns this data
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        logger.info(f"⏭️  User {user_id} skipped onboarding")
        
        # Mark as completed but without goals
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'onboarding_completed': True,
            'onboarding_skipped': True,
            'onboarding_completed_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })
        
        # Track analytics
        from ..services.audit_service import audit_log
        audit_log('onboarding_skipped', user_id, {
            'skipped': True
        })
        
        return jsonify({
            'message': 'Onboarding marked as completed',
            'onboarding_completed': True,
            'skipped': True
        }), 200
        
    except Exception as e:
        logger.exception(f"Error skipping onboarding: {e}")
        return jsonify({'error': 'Internal server error'}), 500
