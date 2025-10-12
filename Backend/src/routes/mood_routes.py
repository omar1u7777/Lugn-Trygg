from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..utils.ai_services import ai_services
from ..models.user import User
from ..services.audit_service import audit_log
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

mood_bp = Blueprint('mood', __name__)

@mood_bp.route('/log', methods=['POST'])
@jwt_required()
def log_mood():
    """Log a new mood entry"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        mood_text = data.get('mood_text', '')
        voice_data = data.get('voice_data')
        timestamp = data.get('timestamp', datetime.utcnow().isoformat())

        # Analyze sentiment if text is provided
        sentiment_analysis = None
        if mood_text.strip():
            sentiment_analysis = ai_services.analyze_sentiment(mood_text)

        # Analyze voice if provided
        voice_analysis = None
        if voice_data:
            # Convert base64 to bytes if needed
            import base64
            audio_bytes = base64.b64decode(voice_data.split(',')[1]) if ',' in voice_data else base64.b64decode(voice_data)
            voice_analysis = ai_services.analyze_voice_emotion(audio_bytes, mood_text)

        mood_entry = {
            'user_id': user_id,
            'mood_text': mood_text,
            'timestamp': timestamp,
            'sentiment_analysis': sentiment_analysis,
            'voice_analysis': voice_analysis,
            'ai_analysis': sentiment_analysis or voice_analysis
        }

        # In a real implementation, save to database
        # For now, just return the analysis

        audit_log('mood_logged', user_id, {
            'has_text': bool(mood_text),
            'has_voice': bool(voice_data),
            'sentiment': sentiment_analysis.get('sentiment') if sentiment_analysis else None
        })

        return jsonify({
            'success': True,
            'mood_entry': mood_entry,
            'analysis': sentiment_analysis or voice_analysis
        }), 201

    except Exception as e:
        logger.error(f"Failed to log mood: {str(e)}")
        return jsonify({'error': 'Failed to log mood'}), 500

@mood_bp.route('/get', methods=['GET'])
@jwt_required()
def get_moods():
    """Get user's mood history"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get query parameters
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # In a real implementation, fetch from database with filters
        # For now, return mock data
        mock_moods = [
            {
                'id': '1',
                'mood_text': 'Känner mig glad idag!',
                'timestamp': '2024-01-15T10:00:00Z',
                'sentiment_analysis': {
                    'sentiment': 'POSITIVE',
                    'score': 0.8,
                    'emotions': ['joy']
                }
            },
            {
                'id': '2',
                'mood_text': 'Lite stressad över jobbet',
                'timestamp': '2024-01-16T14:30:00Z',
                'sentiment_analysis': {
                    'sentiment': 'NEGATIVE',
                    'score': -0.6,
                    'emotions': ['stress', 'worry']
                }
            }
        ]

        audit_log('moods_retrieved', user_id, {'count': len(mock_moods)})
        return jsonify({'moods': mock_moods}), 200

    except Exception as e:
        logger.error(f"Failed to get moods: {str(e)}")
        return jsonify({'error': 'Failed to retrieve moods'}), 500

@mood_bp.route('/weekly-analysis', methods=['GET'])
@jwt_required()
def get_weekly_analysis():
    """Get weekly mood analysis and insights"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get user's recent mood data (mock for now)
        weekly_data = {
            'moods': [
                {'sentiment': 'POSITIVE', 'timestamp': '2024-01-15T10:00:00Z'},
                {'sentiment': 'NEUTRAL', 'timestamp': '2024-01-16T14:30:00Z'},
                {'sentiment': 'NEGATIVE', 'timestamp': '2024-01-17T09:15:00Z'},
            ],
            'memories': [
                {'content': 'En vacker promenad i parken', 'timestamp': '2024-01-15T11:00:00Z'},
                {'content': 'Träffade gamla vänner', 'timestamp': '2024-01-16T16:00:00Z'}
            ]
        }

        # Generate AI-powered insights
        insights = ai_services.generate_weekly_insights(weekly_data, 'sv')

        audit_log('weekly_analysis_generated', user_id, {'insights_generated': insights.get('ai_generated', False)})
        return jsonify(insights), 200

    except Exception as e:
        logger.error(f"Failed to generate weekly analysis: {str(e)}")
        return jsonify({'error': 'Failed to generate analysis'}), 500

@mood_bp.route('/recommendations', methods=['GET'])
@jwt_required()
def get_recommendations():
    """Get personalized recommendations based on mood history"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get current mood from query params or use default
        current_mood = request.args.get('current_mood', 'NEUTRAL')

        # Mock user history
        user_history = [
            {'sentiment': 'POSITIVE', 'timestamp': '2024-01-10T10:00:00Z'},
            {'sentiment': 'NEGATIVE', 'timestamp': '2024-01-12T14:30:00Z'},
            {'sentiment': 'NEUTRAL', 'timestamp': '2024-01-14T09:15:00Z'},
        ]

        # Generate AI recommendations
        recommendations = ai_services.generate_personalized_recommendations(user_history, current_mood)

        audit_log('recommendations_generated', user_id, {
            'current_mood': current_mood,
            'ai_generated': recommendations.get('ai_generated', False)
        })

        return jsonify(recommendations), 200

    except Exception as e:
        logger.error(f"Failed to generate recommendations: {str(e)}")
        return jsonify({'error': 'Failed to generate recommendations'}), 500

@mood_bp.route('/analyze-voice', methods=['POST'])
@jwt_required()
def analyze_voice():
    """Analyze voice emotion from audio data"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        audio_data = data.get('audio_data')
        transcript = data.get('transcript', '')

        if not audio_data:
            return jsonify({'error': 'No audio data provided'}), 400

        # Convert base64 to bytes
        import base64
        audio_bytes = base64.b64decode(audio_data.split(',')[1]) if ',' in audio_data else base64.b64decode(audio_data)

        # Analyze voice emotion
        analysis = ai_services.analyze_voice_emotion(audio_bytes, transcript)

        audit_log('voice_analyzed', user_id, {
            'has_transcript': bool(transcript),
            'primary_emotion': analysis.get('primary_emotion')
        })

        return jsonify(analysis), 200

    except Exception as e:
        logger.error(f"Failed to analyze voice: {str(e)}")
        return jsonify({'error': 'Failed to analyze voice'}), 500

@mood_bp.route('/predictive-forecast', methods=['GET'])
@jwt_required()
def get_predictive_forecast():
    """Get predictive mood forecasting using scikit-learn"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        days_ahead = int(request.args.get('days_ahead', 7))

        # Get user's mood history (mock data for now)
        mood_history = [
            {
                'sentiment_score': 0.8,
                'timestamp': (datetime.utcnow() - timedelta(days=i)).isoformat(),
                'sentiment': 'POSITIVE' if i % 3 == 0 else 'NEUTRAL' if i % 3 == 1 else 'NEGATIVE'
            }
            for i in range(30, 0, -1)  # 30 days of history
        ]

        # Generate ML-based forecast
        forecast = ai_services.predictive_mood_forecasting_sklearn(mood_history, days_ahead)

        audit_log('predictive_forecast_generated', user_id, {
            'days_ahead': days_ahead,
            'model_used': forecast.get('model_info', {}).get('algorithm', 'unknown')
        })

        return jsonify(forecast), 200

    except Exception as e:
        logger.error(f"Failed to generate predictive forecast: {str(e)}")
        return jsonify({'error': 'Failed to generate forecast'}), 500

@mood_bp.route('/crisis-detection', methods=['POST'])
@jwt_required()
def detect_crisis():
    """Detect potential crisis indicators in user input"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        text = data.get('text', '')

        if not text.strip():
            return jsonify({'error': 'No text provided'}), 400

        # Detect crisis indicators
        crisis_analysis = ai_services.detect_crisis_indicators(text)

        # Log crisis detection (important for safety)
        audit_log('crisis_detected', user_id, {
            'risk_level': crisis_analysis['risk_level'],
            'indicators': crisis_analysis['indicators'],
            'requires_attention': crisis_analysis['requires_immediate_attention']
        })

        return jsonify(crisis_analysis), 200

    except Exception as e:
        logger.error(f"Failed to detect crisis: {str(e)}")
        return jsonify({'error': 'Failed to analyze text'}), 500
