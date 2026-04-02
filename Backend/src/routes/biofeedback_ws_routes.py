"""
Biofeedback WebSocket Routes - Real-time breathing guidance
Socket.IO endpoints for live HRV data and visual feedback
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, g, request

from src.services.auth_service import AuthService
from src.services.biofeedback_breathing_service import SOCKETIO_AVAILABLE, BreathingPattern, get_biofeedback_service

logger = logging.getLogger(__name__)

biofeedback_ws_bp = Blueprint("biofeedback_ws", __name__)

# WebSocket event handlers (registered if SocketIO available)
def register_biofeedback_websocket_handlers(socketio):
    """Register WebSocket event handlers for biofeedback."""

    if not SOCKETIO_AVAILABLE:
        logger.warning("SocketIO not available - biofeedback WebSocket disabled")
        return

    @socketio.on('connect', namespace='/biofeedback')
    def handle_connect():
        """Client connected to biofeedback namespace."""
        logger.info(f"Client connected to biofeedback: {request.sid}")

        # Verify auth via JWT in query param or header
        try:
            token = request.args.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
            if token:
                from src.services.auth_service import AuthService
                payload = AuthService.verify_token(token)
                if payload:
                    user_id = payload.get('user_id')
                    request.user_id = user_id
                    # Join user-specific room
                    from flask_socketio import join_room
                    join_room(user_id)
                    logger.info(f"User {user_id} joined biofeedback room")
        except Exception as e:
            logger.warning(f"Auth failed for biofeedback connection: {e}")

    @socketio.on('disconnect', namespace='/biofeedback')
    def handle_disconnect():
        """Client disconnected."""
        logger.info(f"Client disconnected from biofeedback: {request.sid}")

    @socketio.on('start_session', namespace='/biofeedback')
    def handle_start_session(data):
        """Start new breathing session with biofeedback."""
        try:
            user_id = getattr(request, 'user_id', None)
            if not user_id:
                return {'error': 'Authentication required'}

            pattern = data.get('pattern', 'coherence')
            duration = data.get('duration', 5)

            service = get_biofeedback_service(socketio)
            session = service.start_session(user_id, pattern, duration)

            logger.info(f"Biofeedback session started: {session.session_id}")

            return {
                'session_id': session.session_id,
                'pattern': session.pattern.value,
                'target_duration': duration,
                'pattern_config': service.patterns.get(session.pattern, {})
            }

        except Exception as e:
            logger.error(f"Failed to start biofeedback session: {e}")
            return {'error': 'Failed to start session'}

    @socketio.on('heart_rate_data', namespace='/biofeedback')
    def handle_heart_rate_data(data):
        """Receive heart rate data from wearable."""
        try:
            user_id = getattr(request, 'user_id', None)
            if not user_id:
                return {'error': 'Authentication required'}

            session_id = data.get('session_id')
            rr_intervals = data.get('rr_intervals', [])  # R-R intervals in ms
            timestamps = data.get('timestamps', [])

            if not session_id or not rr_intervals:
                return {'error': 'Missing data'}

            # Convert timestamps
            from datetime import datetime
            parsed_timestamps = []
            for ts in timestamps:
                if isinstance(ts, str):
                    parsed_timestamps.append(datetime.fromisoformat(ts))
                else:
                    parsed_timestamps.append(datetime.now())

            # Process in service
            service = get_biofeedback_service(socketio)
            feedback = service.process_heart_rate_data(
                session_id, rr_intervals, parsed_timestamps
            )

            # Return immediate acknowledgment
            return {'status': 'processed'}

        except Exception as e:
            logger.error(f"Failed to process heart rate data: {e}")
            return {'error': 'Processing failed'}

    @socketio.on('end_session', namespace='/biofeedback')
    def handle_end_session(data):
        """End breathing session and get summary."""
        try:
            user_id = getattr(request, 'user_id', None)
            session_id = data.get('session_id')

            if not session_id:
                return {'error': 'Missing session_id'}

            service = get_biofeedback_service(socketio)
            summary = service.end_session(session_id)

            return summary

        except Exception as e:
            logger.error(f"Failed to end session: {e}")
            return {'error': 'Failed to end session'}

    @socketio.on('join_room', namespace='/biofeedback')
    def handle_join_room(data):
        """Join user-specific room for targeted updates."""
        try:
            user_id = data.get('user_id')
            if user_id:
                from flask_socketio import join_room
                join_room(user_id)
                return {'status': 'joined', 'room': user_id}
        except Exception as e:
            logger.error(f"Failed to join room: {e}")
            return {'error': 'Join failed'}

    logger.info("✅ Biofeedback WebSocket handlers registered")


# REST API endpoints for biofeedback (fallback when WebSocket unavailable)
@biofeedback_ws_bp.route('/patterns', methods=['GET'])
@AuthService.jwt_required
def get_breathing_patterns():
    """Get available breathing patterns with physiological targets."""
    try:
        service = get_biofeedback_service()

        patterns = []
        for pattern, config in service.patterns.items():
            total_cycle = config['inhale'] + config['hold'] + \
                         config['exhale'] + config['hold_empty']
            breath_rate = 60.0 / total_cycle if total_cycle > 0 else 0

            patterns.append({
                'id': pattern.value,
                'name': pattern.name,
                'description': config.get('description', ''),
                'durations': {
                    'inhale': config['inhale'],
                    'hold': config['hold'],
                    'exhale': config['exhale'],
                    'hold_empty': config['hold_empty']
                },
                'breaths_per_minute': round(breath_rate, 1),
                'target_hrv_resonance': pattern == BreathingPattern.COHERENCE_6BPM,
                'recommended_for': _get_recommendation(pattern)
            })

        return {
            'success': True,
            'patterns': patterns,
            'note': 'Coherence 6bpm optimized for HRV resonance (0.1Hz)'
        }

    except Exception as e:
        logger.error(f"Failed to get patterns: {str(e)[:100]}")
        return {'success': False, 'error': 'Failed to retrieve patterns'}, 500


@biofeedback_ws_bp.route('/start', methods=['POST'])
@AuthService.jwt_required
def start_session_rest():
    """REST endpoint to start session (WebSocket alternative)."""
    try:
        user_id = g.get('user_id')
        data = request.get_json() or {}

        pattern = data.get('pattern', 'coherence')
        duration = data.get('duration', 5)

        service = get_biofeedback_service()
        session = service.start_session(user_id, pattern, duration)

        return {
            'success': True,
            'session_id': session.session_id,
            'pattern': session.pattern.value,
            'ws_namespace': '/biofeedback' if SOCKETIO_AVAILABLE else None
        }

    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        return {'success': False, 'error': str(e)}, 500


@biofeedback_ws_bp.route('/data/<session_id>', methods=['POST'])
@AuthService.jwt_required
def submit_heart_rate_data(session_id: str):
    """REST endpoint to submit HRV data (WebSocket alternative)."""
    try:
        data = request.get_json() or {}
        rr_intervals = data.get('rr_intervals', [])

        if not rr_intervals:
            return {'success': False, 'error': 'No RR intervals provided'}, 400

        # Create timestamps
        timestamps = [datetime.now() - timedelta(seconds=i)
                     for i in range(len(rr_intervals))]

        service = get_biofeedback_service()
        feedback = service.process_heart_rate_data(
            session_id, rr_intervals, timestamps
        )

        return {
            'success': True,
            'feedback': {
                'phase': feedback.phase,
                'phase_progress': feedback.phase_progress,
                'coherence': feedback.coherence_indicator,
                'resonance': feedback.resonance_indicator,
                'guidance': feedback.guidance,
                'visualization': feedback.visualization_data
            }
        }

    except Exception as e:
        logger.error(f"Failed to process data: {e}")
        return {'success': False, 'error': str(e)}, 500


@biofeedback_ws_bp.route('/end/<session_id>', methods=['POST'])
@AuthService.jwt_required
def end_session_rest(session_id: str):
    """REST endpoint to end session (WebSocket alternative)."""
    try:
        service = get_biofeedback_service()
        summary = service.end_session(session_id)

        return {
            'success': True,
            'summary': summary
        }

    except Exception as e:
        logger.error(f"Failed to end session: {e}")
        return {'success': False, 'error': str(e)}, 500


@biofeedback_ws_bp.route('/history', methods=['GET'])
@AuthService.jwt_required
def get_session_history():
    """Get user's breathing session history with HRV trends."""
    try:
        user_id = g.get('user_id')

        from google.cloud.firestore import FieldFilter

        from src.firebase_config import db

        sessions = db.collection('breathing_sessions').where(
            filter=FieldFilter('user_id', '==', user_id)
        ).order_by('start_time', direction='DESCENDING').limit(30)

        history = []
        for doc in sessions.stream():
            data = doc.to_dict()
            history.append({
                'session_id': data.get('session_id'),
                'start_time': data.get('start_time').isoformat() if data.get('start_time') else None,
                'pattern': data.get('pattern'),
                'summary': data.get('summary'),
                'resonance_achieved': data.get('summary', {}).get('resonance_achieved')
            })

        return {
            'success': True,
            'sessions': history,
            'total': len(history)
        }

    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        return {'success': False, 'error': str(e)}, 500


def _get_recommendation(pattern: BreathingPattern) -> list[str]:
    """Get clinical recommendations for each pattern."""
    recommendations = {
        BreathingPattern.COHERENCE_6BPM: [
            'stress_reduction',
            'hrv_optimization',
            'emotional_regulation'
        ],
        BreathingPattern.RELAX_478: [
            'anxiety_relief',
            'panic_prevention',
            'general_relaxation'
        ],
        BreathingPattern.ENERGIZE_555: [
            'focus_enhancement',
            'performance_preparation',
            'energy_boost'
        ],
        BreathingPattern.SLEEP_446: [
            'sleep_onset',
            'insomnia_support',
            'bedtime_routine'
        ]
    }
    return recommendations.get(pattern, [])
