from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..utils.ai_services import ai_services
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

ai_stories_bp = Blueprint('ai_stories', __name__)

@ai_stories_bp.route('/stories', methods=['GET'])
@AuthService.jwt_required
def get_stories():
    """Get user's AI-generated stories"""
    try:
        user_id = request.user_id

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # In a real implementation, this would fetch from database
        # For now, return mock data
        stories = [
            {
                'id': '1',
                'title': 'Resan genom skogen',
                'content': 'Det var en gång en liten fågel som levde i en stor skog...',
                'mood': 'calm',
                'category': 'healing',
                'duration': 300,  # 5 minutes
                'isFavorite': False,
                'createdAt': datetime.utcnow().isoformat()
            },
            {
                'id': '2',
                'title': 'Stjärnornas visdom',
                'content': 'Högst uppe på berget där stjärnorna dansar...',
                'mood': 'hopeful',
                'category': 'inspiration',
                'duration': 420,  # 7 minutes
                'isFavorite': True,
                'createdAt': datetime.utcnow().isoformat()
            }
        ]

        audit_log('ai_stories_accessed', user_id, {'action': 'list_stories'})
        return jsonify(stories), 200

    except Exception as e:
        logger.error(f"Failed to get AI stories: {str(e)}")
        return jsonify({'error': 'Failed to load stories'}), 500

@ai_stories_bp.route('/stories/generate', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def generate_story():
    """Generate a personalized AI story"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = request.user_id

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        data = request.get_json()
        preferences = data.get('preferences', {})
        mood_context = data.get('mood', 'neutral')

        # Get user's recent mood data for personalization
        # This would typically come from mood logs
        recent_moods = [
            {'sentiment': 'POSITIVE', 'emotions': ['joy', 'hope']},
            {'sentiment': 'NEUTRAL', 'emotions': ['calm']},
            {'sentiment': 'NEGATIVE', 'emotions': ['worry']}
        ]

        # Generate personalized story with fallback
        try:
            story_result = ai_services.generate_personalized_therapeutic_story(
                user_mood_data=recent_moods,
                user_profile={'age_group': 'adult', 'main_concerns': 'stress'},
                locale=preferences.get('language', 'sv')
            )
        except Exception as ai_error:
            logger.warning(f"AI story generation failed, using fallback: {str(ai_error)}")
            story_result = {
                'story': 'Här är en lugnande historia för dig. Föreställ dig att du sitter vid en stilla sjö...',
                'ai_generated': False
            }

        if not story_result.get('ai_generated', False):
            # Fallback story if AI generation fails
            story = {
                'id': f'generated_{user_id}_{len(recent_moods)}',
                'title': 'En lugn stund',
                'content': story_result.get('story', 'Här är en lugnande historia för dig...'),
                'mood': mood_context,
                'category': 'calming',
                'duration': 180,  # 3 minutes
                'isFavorite': False,
                'createdAt': datetime.utcnow().isoformat(),
                'ai_generated': False
            }
        else:
            story = {
                'id': f'ai_generated_{user_id}_{len(recent_moods)}',
                'title': 'Din personliga historia',
                'content': story_result['story'],
                'mood': mood_context,
                'category': 'personalized',
                'duration': 240,  # 4 minutes
                'isFavorite': False,
                'createdAt': datetime.utcnow().isoformat(),
                'ai_generated': True,
                'confidence': story_result.get('confidence', 0.8)
            }

        audit_log('ai_story_generated', user_id, {
            'mood': mood_context,
            'ai_generated': story['ai_generated'],
            'preferences': preferences
        })

        return jsonify(story), 201

    except Exception as e:
        logger.error(f"Failed to generate AI story: {str(e)}")
        return jsonify({'error': 'Failed to generate story'}), 500

@ai_stories_bp.route('/stories/<story_id>/favorite', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def toggle_favorite(story_id):
    """Toggle favorite status for a story"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = request.user_id

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # In a real implementation, this would update the database
        # For now, just return success
        audit_log('story_favorite_toggled', user_id, {'story_id': story_id})
        return jsonify({'success': True, 'message': 'Favorite status updated'}), 200

    except Exception as e:
        logger.error(f"Failed to toggle favorite: {str(e)}")
        return jsonify({'error': 'Failed to update favorite status'}), 500

@ai_stories_bp.route('/stories/<story_id>', methods=['DELETE'])
@AuthService.jwt_required
def delete_story(story_id):
    """Delete a user-generated story"""
    try:
        user_id = request.user_id

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # In a real implementation, this would delete from database
        audit_log('story_deleted', user_id, {'story_id': story_id})
        return jsonify({'success': True, 'message': 'Story deleted'}), 200

    except Exception as e:
        logger.error(f"Failed to delete story: {str(e)}")
        return jsonify({'error': 'Failed to delete story'}), 500

@ai_stories_bp.route('/analytics', methods=['GET'])
@AuthService.jwt_required
def get_story_analytics():
    """Get analytics about user's story engagement"""
    try:
        user_id = request.user_id

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # Mock analytics data
        analytics = {
            'total_stories_listened': 12,
            'favorite_stories': 3,
            'most_listened_category': 'healing',
            'average_session_duration': 180,  # seconds
            'stories_this_week': 2,
            'mood_improvement_correlation': 0.75,  # Correlation between story listening and mood improvement
            'preferred_moods': ['calm', 'hopeful', 'peaceful']
        }

        audit_log('story_analytics_accessed', user_id, {'action': 'view_analytics'})
        return jsonify(analytics), 200

    except Exception as e:
        logger.error(f"Failed to get story analytics: {str(e)}")
        return jsonify({'error': 'Failed to load analytics'}), 500