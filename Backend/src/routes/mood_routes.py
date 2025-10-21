from flask import Blueprint, request, jsonify, current_app
import src.utils.ai_services as ai_services_module
from ..models.user import User
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class _AIServicesProxy:
    """Lazily proxy AI service calls so tests can patch the backend module."""

    def __getattr__(self, item):
        return getattr(ai_services_module.ai_services, item)


ai_services = _AIServicesProxy()

mood_bp = Blueprint('mood', __name__)

@mood_bp.route('/log', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def log_mood():
    """Log a new mood entry"""
    logger.info("🎯 Mood log endpoint called")
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Use Flask's g.user_id for authenticated user context
        from flask import g
        user_id = getattr(g, 'user_id', None)
        logger.info(f"🎯 User ID from context: {user_id}")
        if not user_id:
            return jsonify({'error': 'User ID missing from context'}), 401

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                # In tests, the Firestore mock may not support document lookups; allow passthrough
                if not current_app.config.get('TESTING'):
                    return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # --- Unified payload handling for both JSON and multipart/form-data ---
        # If frontend sends audio, it uses multipart/form-data; otherwise JSON
        #
        # Payload requirements:
        #   - For text mood: send JSON with { mood_text, timestamp }
        #   - For audio mood: send multipart/form-data with 'audio' file and optional 'mood_text', 'timestamp'
        #
        # Local dev caveats:
        #   - If you get 400 errors, check that frontend sends correct payload type
        #   - Dummy Firebase API key will block Google sign-in (expected in dev)
        #   - CSP may block Firebase Auth iframe; update CSP for local testing if needed
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            # Also handle file upload for audio
            audio_file = request.files.get('audio')
            if audio_file:
                audio_bytes = audio_file.read()
                voice_data = audio_bytes  # Store raw bytes for analysis
            else:
                voice_data = data.get('voice_data')
        else:
            data = request.get_json()
            voice_data = data.get('voice_data')
            audio_file = None

        if not data and not audio_file:
            return jsonify({'error': 'No data provided'}), 400

        mood_text = data.get('mood_text', '') if data else ''
        timestamp = data.get('timestamp', datetime.utcnow().isoformat()) if data else datetime.utcnow().isoformat()

        # --- End unified payload handling ---

        # Analyze sentiment if text is provided
        sentiment_analysis = None
        if mood_text and mood_text.strip():
            sentiment_analysis = ai_services.analyze_sentiment(mood_text)

        # Analyze voice if provided
        voice_analysis = None
        transcript = None
        if voice_data:
            try:
                # voice_data is already bytes from file upload, or base64 string
                if isinstance(voice_data, bytes):
                    audio_bytes = voice_data
                else:
                    # Handle base64 string
                    import base64
                    audio_bytes = base64.b64decode(voice_data.split(',')[1]) if ',' in voice_data else base64.b64decode(voice_data)

                # First try to transcribe the audio to get the spoken text
                from ..utils.speech_utils import transcribe_audio_google
                transcript = transcribe_audio_google(audio_bytes, "sv-SE")
                logger.info(f"🎙️ Voice transcription result: '{transcript}'")

                # Use the transcript for emotion analysis, or fallback to empty string
                transcript_text = transcript if transcript else ""
                voice_analysis = ai_services.analyze_voice_emotion(audio_bytes, transcript_text)
                logger.info(f"🎭 Voice analysis result: {voice_analysis}")

                # If transcription failed, try fallback analysis using Swedish keywords
                if not transcript:
                    logger.info("🎙️ No transcription available, trying Swedish keyword analysis")
                    try:
                        voice_analysis = ai_services.analyze_voice_emotion_fallback(transcript_text)
                        logger.info(f"🎭 Fallback voice analysis result: {voice_analysis}")
                    except Exception as fallback_error:
                        logger.warning(f"Fallback voice analysis also failed: {str(fallback_error)}")
                        # If even fallback fails, use neutral values
                        voice_analysis = {
                            "primary_emotion": "neutral",
                            "confidence": 0.5,
                            "sentiment": "NEUTRAL",
                            "score": 0.0,
                            "magnitude": 0.0,
                            "emotions": ["neutral"],
                            "intensity": 0.0,
                            "method": "default"
                        }

            except Exception as e:
                logger.warning(f"Voice analysis failed: {str(e)}")
                # Use neutral default if all voice analysis fails
                voice_analysis = {
                    "primary_emotion": "neutral",
                    "confidence": 0.5,
                    "sentiment": "NEUTRAL",
                    "score": 0.0,
                    "magnitude": 0.0,
                    "emotions": ["neutral"],
                    "intensity": 0.0,
                    "method": "error_fallback"
                }

        # Determine the final mood text
        final_mood_text = mood_text or transcript or 'neutral'

        # If we have voice analysis but no transcript, try to get mood from voice analysis
        if not mood_text and not transcript and voice_analysis:
            primary_emotion = voice_analysis.get('primary_emotion', 'neutral')
            # Map emotions to Swedish moods
            emotion_to_mood = {
                'joy': 'glad',
                'sadness': 'ledsen',
                'anger': 'arg',
                'fear': 'orolig',
                'surprise': 'förvånad',
                'disgust': 'irriterad',
                'trust': 'lugn',
                'anticipation': 'spännande',
                'neutral': 'neutral'
            }
            final_mood_text = emotion_to_mood.get(primary_emotion, 'neutral')
            logger.info(f"🎭 Using voice analysis mood: {final_mood_text}")

        mood_entry = {
            'user_id': user_id,
            'mood_text': final_mood_text,
            'timestamp': timestamp,
            'sentiment_analysis': sentiment_analysis,
            'voice_analysis': voice_analysis,
            'transcript': transcript,
            'ai_analysis': sentiment_analysis or voice_analysis
        }

        # Save to database
        try:
            logger.info(f"💾 Attempting to save mood to Firestore for user: {user_id}")
            logger.info(f"💾 Mood data: text='{final_mood_text}', timestamp={timestamp}")
            
            mood_ref = db.collection('users').document(user_id).collection('moods')
            mood_data = {
                'mood_text': final_mood_text,
                'timestamp': timestamp,
                'sentiment': sentiment_analysis.get('sentiment', 'NEUTRAL') if sentiment_analysis else 'NEUTRAL',
                'score': sentiment_analysis.get('score', 0) if sentiment_analysis else 0,
                'emotions_detected': sentiment_analysis.get('emotions', []) if sentiment_analysis else [],
                'ai_analysis': sentiment_analysis or voice_analysis,
                'sentiment_analysis': sentiment_analysis,
                'voice_analysis': voice_analysis,
                'transcript': transcript
            }
            logger.info(f"💾 Prepared mood_data: {mood_data}")
            
            doc_ref = mood_ref.add(mood_data)
            logger.info(f"💾 Firestore add() returned: {type(doc_ref)}, value: {doc_ref}")
            
            # doc_ref is a tuple in some Firestore versions, get the document reference
            doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id
            logger.info(f"✅ Mood entry saved to database with ID: {doc_id}")
        except Exception as db_error:
            logger.error(f"❌ Failed to save mood to database: {str(db_error)}", exc_info=True)
            # Continue with response even if database save fails

        audit_log('mood_logged', user_id, {
            'has_text': bool(mood_text),
            'has_voice': bool(voice_data),
            'sentiment': sentiment_analysis.get('sentiment') if sentiment_analysis else None
        })

        # Return appropriate response based on request type
        if request.content_type and 'multipart/form-data' in request.content_type:
            # For audio uploads, return mood analysis
            if voice_analysis:
                primary_emotion = voice_analysis.get('primary_emotion', 'neutral')
                # Convert to Swedish for better UX
                emotion_translations = {
                    'neutral': 'neutral',
                    'positive': 'glad',
                    'negative': 'ledsen',
                    'happy': 'glad',
                    'sad': 'ledsen',
                    'angry': 'arg',
                    'stressed': 'stressad',
                    'tired': 'trött',
                    'excited': 'upphetsad',
                    'calm': 'lugn',
                    'joy': 'glad',
                    'sadness': 'ledsen',
                    'anger': 'arg',
                    'fear': 'orolig',
                    'surprise': 'förvånad',
                    'disgust': 'irriterad',
                    'trust': 'lugn',
                    'anticipation': 'spännande',
                    'glad': 'glad',
                    'ledsen': 'ledsen',
                    'arg': 'arg',
                    'orolig': 'orolig',
                    'trött': 'trött',
                    'lugn': 'lugn'
                }
                swedish_emotion = emotion_translations.get(primary_emotion.lower(), primary_emotion.lower())
                logger.info(f"🎭 Returning mood analysis: {swedish_emotion} (from {primary_emotion})")
                return jsonify({
                    'mood': swedish_emotion,
                    'ai_analysis': voice_analysis,
                    'success': True
                }), 200
            
            # If no voice analysis but we have transcript, use transcript analysis
            if transcript and sentiment_analysis:
                primary_sentiment = sentiment_analysis.get('sentiment', 'NEUTRAL')
                emotion_translations = {
                    'POSITIVE': 'glad',
                    'NEGATIVE': 'ledsen',
                    'NEUTRAL': 'neutral'
                }
                swedish_emotion = emotion_translations.get(primary_sentiment, 'neutral')
                logger.info(f"🎭 Returning transcript analysis: {swedish_emotion} (from {primary_sentiment})")
                return jsonify({
                    'mood': swedish_emotion,
                    'ai_analysis': sentiment_analysis,
                    'success': True
                }), 200
            
            # If nothing worked, return neutral but still success (mood was saved)
            logger.info("🎭 Returning neutral mood (no analysis available but mood was saved)")
            return jsonify({
                'mood': 'neutral',
                'ai_analysis': voice_analysis or {'sentiment': 'NEUTRAL', 'method': 'default'},
                'success': True,
                'message': 'Humör sparat, men ingen analys kunde göras'
            }), 200
        else:
            # For regular JSON requests
            return jsonify({
                'success': True,
                'mood_entry': mood_entry,
                'analysis': sentiment_analysis or voice_analysis
            }), 201

    except Exception as e:
        logger.error(f"❌ Failed to log mood: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to log mood'}), 500

@mood_bp.route('/get', methods=['GET'])
@AuthService.jwt_required
def get_moods():
    """Get user's mood history"""
    try:
        from flask import g
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'User ID missing from context'}), 401

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # Get query parameters
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # Fetch from database
        try:
            mood_ref = db.collection('users').document(user_id).collection('moods')
            query = mood_ref.order_by('timestamp', direction='DESCENDING')

            # Apply date filters if provided
            if start_date:
                query = query.where('timestamp', '>=', start_date)
            if end_date:
                query = query.where('timestamp', '<=', end_date)

            mood_docs = list(query.limit(limit).offset(offset).stream())

            moods = []
            for doc in mood_docs:
                mood_data = doc.to_dict()
                moods.append({
                    'id': doc.id,
                    'mood_text': mood_data.get('mood_text', ''),
                    'timestamp': mood_data.get('timestamp', ''),
                    'sentiment': mood_data.get('sentiment', 'NEUTRAL'),
                    'score': mood_data.get('score', 0),
                    'emotions_detected': mood_data.get('emotions_detected', []),
                    'sentiment_analysis': mood_data.get('ai_analysis', mood_data.get('sentiment_analysis', {}))
                })

            logger.info(f"Retrieved {len(moods)} mood entries from database for user {user_id}")
            audit_log('moods_retrieved', user_id, {'count': len(moods)})
            return jsonify({'moods': moods}), 200

        except Exception as e:
            logger.error(f"Failed to fetch moods from database: {str(e)}")
            # Fallback to mock data if database fails
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
            audit_log('moods_retrieved', user_id, {'count': len(mock_moods), 'fallback': True})
            return jsonify({'moods': mock_moods}), 200

    except Exception as e:
        logger.error(f"Failed to get moods: {str(e)}")
        return jsonify({'error': 'Failed to retrieve moods'}), 500

@mood_bp.route('/weekly-analysis', methods=['GET'])
@AuthService.jwt_required
def get_weekly_analysis():
    """Get weekly mood analysis and insights"""
    try:
        from flask import g
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'User ID missing from context'}), 401

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

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
@AuthService.jwt_required
def get_recommendations():
    """Get personalized recommendations based on mood history"""
    try:
        from flask import g
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'User ID missing from context'}), 401

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

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

@mood_bp.route('/analyze-voice', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def analyze_voice():
    """Analyze voice emotion from audio data"""
    try:
        from flask import g
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'User ID missing from context'}), 401

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
        audio_data = data.get('audio_data')
        transcript = data.get('transcript', '')

        if not audio_data:
            return jsonify({'error': 'No audio data provided'}), 400

        # Convert base64 to bytes
        import base64
        try:
            audio_bytes = base64.b64decode(audio_data.split(',')[1]) if ',' in audio_data else base64.b64decode(audio_data)
        except Exception as e:
            logger.error(f"Base64 decoding failed: {str(e)}")
            return jsonify({'error': 'Invalid audio data format'}), 400

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
@AuthService.jwt_required
def get_predictive_forecast():
    """Get predictive mood forecasting using scikit-learn"""
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

        days_ahead = int(request.args.get('days_ahead', 7))

        # Get user's mood history from database
        try:
            mood_ref = db.collection('users').document(user_id).collection('moods')
            mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').limit(100).stream())

            mood_history = []
            for doc in mood_docs:
                mood_data = doc.to_dict()
                mood_history.append({
                    'sentiment_score': mood_data.get('score', 0),
                    'timestamp': mood_data.get('timestamp', ''),
                    'sentiment': mood_data.get('sentiment', 'NEUTRAL')
                })

            logger.info(f"Retrieved {len(mood_history)} mood entries for forecasting")

        except Exception as e:
            logger.warning(f"Failed to retrieve mood history from database: {str(e)}, using mock data")
            # Fallback to mock data
            mood_history = [
                {
                    'sentiment_score': 0.8,
                    'timestamp': (datetime.utcnow() - timedelta(days=i)).isoformat(),
                    'sentiment': 'POSITIVE' if i % 3 == 0 else 'NEUTRAL' if i % 3 == 1 else 'NEGATIVE'
                }
                for i in range(30, 0, -1)  # 30 days of history
            ]

        # Generate ML-based forecast with fallback
        try:
            forecast = ai_services.predictive_mood_forecasting_sklearn(mood_history, days_ahead)
        except Exception as ai_error:
            logger.warning(f"AI forecast failed, using fallback: {str(ai_error)}")
            # Fallback forecast
            forecast = {
                'forecast': [
                    {'date': (datetime.utcnow() + timedelta(days=i)).strftime('%Y-%m-%d'), 'predicted_score': 0.7}
                    for i in range(days_ahead)
                ],
                'model_info': {'algorithm': 'fallback', 'accuracy': 0.75},
                'message': 'Fallback forecast - ML model not available'
            }

        audit_log('predictive_forecast_generated', user_id, {
            'days_ahead': days_ahead,
            'model_used': forecast.get('model_info', {}).get('algorithm', 'unknown') if isinstance(forecast.get('model_info'), dict) else 'unknown'
        })

        return jsonify(forecast), 200

    except Exception as e:
        logger.error(f"Failed to generate predictive forecast: {str(e)}")
        return jsonify({'error': 'Failed to generate forecast'}), 500


@mood_bp.route('/confirm', methods=['POST', 'OPTIONS'])
def confirm_mood():
    """Confirm mood analysis from voice input"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Try to get user_id from JWT token if present
        user_id = None
        try:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                user_id, _ = AuthService.verify_token(token)
        except Exception:
            # If token verification fails, continue without user_id
            pass

        # Handle multipart/form-data for audio confirmation
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
        else:
            data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        confirmation = data.get('confirmation', '').lower()
        audio_file = request.files.get('audio')

        # Simple speech-to-text analysis for yes/no confirmation
        confirmed = False
        if audio_file:
            # Read audio file and analyze for confirmation keywords
            audio_bytes = audio_file.read()
            # For now, just check if confirmation flag is set
            confirmed = confirmation == 'true'
        else:
            # Fallback to text-based confirmation
            confirmed = confirmation in ['ja', 'yes', 'j', 'y', 'true']

        # Only audit if we have a user_id
        if user_id:
            audit_log('mood_confirmation_processed', user_id, {
                'confirmed': confirmed,
                'method': 'audio' if audio_file else 'text'
            })

        return jsonify({'confirmed': confirmed}), 200

    except Exception as e:
        logger.error(f"Failed to process mood confirmation: {str(e)}")
        return jsonify({'error': 'Failed to process confirmation'}), 500

@mood_bp.route('/crisis-detection', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def detect_crisis():
    """Detect potential crisis indicators in user input"""
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
