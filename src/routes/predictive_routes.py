"""
Predictive Analytics Routes for Lugn & Trygg
API endpoints for mood prediction and trend analysis
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.predictive_service import predictive_service
from ..services.audit_service import audit_service
from ..firebase_config import db
import logging

logger = logging.getLogger(__name__)

predictive_bp = Blueprint('predictive', __name__)

@predictive_bp.route('/api/predictive/train', methods=['POST'])
@jwt_required()
def train_predictive_model():
    """
    Train predictive model for user's mood data
    """
    try:
        user_id = get_jwt_identity()

        # Get user's mood entries from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_entries = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_entries.append({
                'timestamp': mood_data.get('timestamp', ''),
                'mood_text': mood_data.get('mood_text', ''),
                'sentiment_score': mood_data.get('score', 0)
            })

        # Convert to dict format
        mood_data = [{
            'timestamp': entry.timestamp.isoformat(),
            'mood_text': entry.mood_text,
            'sentiment_score': entry.sentiment_score
        } for entry in mood_entries]

        # Train model
        result = predictive_service.train_predictive_model(mood_data)

        if result['success']:
            # Log successful training
            audit_service.log_event(
                user_id=user_id,
                action='MODEL_TRAINING',
                resource_type='PREDICTIVE_MODEL',
                details={
                    'model_type': result.get('model_info', {}).get('type', 'unknown'),
                    'performance': result.get('performance', {}),
                    'training_samples': result.get('performance', {}).get('training_samples', 0)
                }
            )

            return jsonify({
                'success': True,
                'message': 'Förutsägelsemodell tränad framgångsrikt',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': result.get('error', 'Kunde inte träna modell'),
                'data': result
            }), 400

    except Exception as e:
        logger.error(f"Error training predictive model: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internt serverfel vid modellträning'
        }), 500

@predictive_bp.route('/api/predictive/predict', methods=['GET'])
@jwt_required()
def get_mood_predictions():
    """
    Get mood predictions for upcoming days
    """
    try:
        user_id = get_jwt_identity()
        days_ahead = int(request.args.get('days', 7))

        # Validate days parameter
        if days_ahead < 1 or days_ahead > 30:
            return jsonify({
                'success': False,
                'message': 'Antal dagar måste vara mellan 1-30'
            }), 400

        # Get user's mood entries from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_entries = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_entries.append({
                'timestamp': mood_data.get('timestamp', ''),
                'mood_text': mood_data.get('mood_text', ''),
                'sentiment_score': mood_data.get('score', 0)
            })

        # Convert to dict format
        mood_data = [{
            'timestamp': entry.timestamp.isoformat(),
            'mood_text': entry.mood_text,
            'sentiment_score': entry.sentiment_score
        } for entry in mood_entries]

        # Generate predictions
        result = predictive_service.predict_mood_trend(mood_data, days_ahead)

        if result['success']:
            # Log prediction request
            audit_service.log_event(
                user_id=user_id,
                action='MOOD_PREDICTION',
                resource_type='PREDICTIVE_ANALYTICS',
                details={
                    'days_predicted': days_ahead,
                    'predictions_count': len(result.get('predictions', []))
                }
            )

            return jsonify({
                'success': True,
                'message': f'Humörprediktioner för {days_ahead} dagar framåt',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': result.get('error', 'Kunde inte generera prediktioner'),
                'data': result
            }), 400

    except Exception as e:
        logger.error(f"Error getting mood predictions: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internt serverfel vid prediktion'
        }), 500

@predictive_bp.route('/api/predictive/crisis-check', methods=['GET'])
@jwt_required()
def check_crisis_risk():
    """
    Check for potential crisis situations based on mood patterns
    """
    try:
        user_id = get_jwt_identity()

        # Get recent mood entries (last 30 days) from Firestore
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.where('timestamp', '>=', thirty_days_ago.isoformat())\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(50)\
            .stream())

        mood_entries = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_entries.append({
                'timestamp': mood_data.get('timestamp', ''),
                'mood_text': mood_data.get('mood_text', ''),
                'sentiment_score': mood_data.get('score', 0)
            })

        # Convert to dict format
        mood_data = [{
            'timestamp': entry.timestamp.isoformat(),
            'mood_text': entry.mood_text,
            'sentiment_score': entry.sentiment_score
        } for entry in mood_entries]

        # Analyze crisis risk
        result = predictive_service.detect_crisis_risk(mood_data)

        # Log crisis check (sensitive operation)
        audit_service.log_event(
            user_id=user_id,
            action='CRISIS_RISK_CHECK',
            resource_type='MENTAL_HEALTH_ANALYSIS',
            details={
                'risk_level': result.get('risk_level', 'unknown'),
                'confidence': result.get('confidence', 0),
                'indicators_count': len(result.get('indicators', []))
            }
        )

        # If high risk, this should trigger additional monitoring/alerts
        if result.get('risk_level') == 'high':
            # In production, this would trigger:
            # 1. Alert to emergency contacts
            # 2. Notification to healthcare provider
            # 3. Increased monitoring
            logger.warning(f"High crisis risk detected for user {user_id}")

        return jsonify({
            'success': True,
            'message': 'Krisrisk analys genomförd',
            'data': result
        }), 200

    except Exception as e:
        logger.error(f"Error checking crisis risk: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internt serverfel vid krisanalys'
        }), 500

@predictive_bp.route('/api/predictive/insights', methods=['GET'])
@jwt_required()
def get_personal_insights():
    """
    Get personalized insights based on mood patterns and predictions
    """
    try:
        user_id = get_jwt_identity()

        # Get user's mood entries for analysis from Firestore
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.order_by('timestamp').stream())

        mood_entries = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_entries.append({
                'timestamp': mood_data.get('timestamp', ''),
                'mood_text': mood_data.get('mood_text', ''),
                'sentiment_score': mood_data.get('score', 0)
            })

        if len(mood_entries) < 7:
            return jsonify({
                'success': False,
                'message': 'Behöver minst 7 humörinlägg för personliga insikter',
                'data': {
                    'insights': [],
                    'recommendations': ['Logga fler humörinlägg för att få personliga insikter']
                }
            }), 400

        # Convert to dict format
        mood_data = [{
            'timestamp': entry.timestamp.isoformat(),
            'mood_text': entry.mood_text,
            'sentiment_score': entry.sentiment_score
        } for entry in mood_entries]

        # Generate insights
        insights = predictive_service.generate_personal_insights(mood_data)

        # Log insights generation
        audit_service.log_event(
            user_id=user_id,
            action='PERSONAL_INSIGHTS',
            resource_type='ANALYTICS',
            details={
                'insights_count': len(insights.get('insights', [])),
                'data_points': len(mood_entries)
            }
        )

        return jsonify({
            'success': True,
            'message': 'Personliga insikter genererade',
            'data': insights
        }), 200

    except Exception as e:
        logger.error(f"Error generating personal insights: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internt serverfel vid insiktsgenerering'
        }), 500

@predictive_bp.route('/api/predictive/trends', methods=['GET'])
@jwt_required()
def get_mood_trends():
    """
    Get detailed mood trend analysis
    """
    try:
        user_id = get_jwt_identity()
        period = request.args.get('period', '30d')  # 7d, 30d, 90d, 1y

        # Parse period
        if period == '7d':
            days = 7
        elif period == '30d':
            days = 30
        elif period == '90d':
            days = 90
        elif period == '1y':
            days = 365
        else:
            days = 30

        # Get mood entries for period from Firestore
        start_date = datetime.utcnow() - timedelta(days=days)
        mood_ref = db.collection('users').document(user_id).collection('moods')
        mood_docs = list(mood_ref.where('timestamp', '>=', start_date.isoformat())\
            .order_by('timestamp')\
            .stream())

        mood_entries = []
        for doc in mood_docs:
            mood_data = doc.to_dict()
            mood_entries.append({
                'timestamp': mood_data.get('timestamp', ''),
                'mood_text': mood_data.get('mood_text', ''),
                'sentiment_score': mood_data.get('score', 0)
            })

        # Convert to dict format
        mood_data = [{
            'timestamp': entry.timestamp.isoformat(),
            'mood_text': entry.mood_text,
            'sentiment_score': entry.sentiment_score
        } for entry in mood_entries]

        # Analyze trends
        trends = predictive_service.analyze_trends(mood_data, period)

        return jsonify({
            'success': True,
            'message': f'Humörtrender för senaste {period}',
            'data': trends
        }), 200

    except Exception as e:
        logger.error(f"Error getting mood trends: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Internt serverfel vid trendanalys'
        }), 500

# Import datetime for date calculations
from datetime import datetime, timedelta