"""
AI Music Routes - API for AI-generated ambient soundscapes
Provides real-time generated binaural beats, isochronic tones, and procedural ambient music
"""

import logging

from flask import Blueprint, Response, g, request, stream_with_context

from src.services.ai_music_service import SoundscapeType, get_ai_music_service
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

ai_music_bp = Blueprint("ai_music", __name__)


@ai_music_bp.route('/soundscapes', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_available_soundscapes():
    """Get list of available AI-generated soundscape types."""
    try:
        service = get_ai_music_service()
        soundscapes = service.get_available_soundscapes()

        return APIResponse.success(
            data={'soundscapes': soundscapes},
            message=f"Found {len(soundscapes)} AI soundscape types"
        )

    except Exception as e:
        logger.error(f"Failed to get soundscapes: {e}")
        return APIResponse.error("Failed to retrieve soundscapes", "AI_MUSIC_ERROR", 500)


@ai_music_bp.route('/generate', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def generate_soundscape():
    """
    Generate AI-powered soundscape.
    
    Request body:
    {
        "type": "deep_sleep|meditation|focus|anxiety_relief|nature_sim|cosmic",
        "duration": 300,  # seconds (default 5 min, max 20 min)
        "mood": "anxious|stressed|tired"  # optional - for adaptive generation
    }
    
    Returns track metadata and audio URL.
    """
    try:
        user_id = g.get('user_id')
        data = request.get_json() or {}

        # Validate type
        soundscape_type_str = data.get('type', 'meditation')
        try:
            soundscape_type = SoundscapeType(soundscape_type_str)
        except ValueError:
            return APIResponse.error(
                f"Invalid soundscape type: {soundscape_type_str}",
                "INVALID_TYPE",
                400
            )

        # Validate duration (5 min default, max 20 min to prevent abuse)
        duration = data.get('duration', 300)
        if not isinstance(duration, int) or duration < 60 or duration > 1200:
            return APIResponse.error(
                "Duration must be between 60 and 1200 seconds",
                "INVALID_DURATION",
                400
            )

        # Optional mood for adaptive generation
        target_mood = data.get('mood')

        # Generate
        service = get_ai_music_service()
        track = service.generate_soundscape(
            user_id=user_id,
            soundscape_type=soundscape_type,
            duration=duration,
            target_mood=target_mood
        )

        # Return metadata
        return APIResponse.success(
            data={
                'track_id': track.track_id,
                'type': track.soundscape_type.value,
                'duration_seconds': track.duration_seconds,
                'parameters': {
                    'binaural_frequency': track.parameters.binaural_freq,
                    'carrier_frequency': track.parameters.carrier_freq,
                    'brainwave_state': _get_brainwave_description(track.parameters.binaural_freq)
                },
                'audio_url': f"/api/v1/ai-music/stream/{track.track_id}",
                'download_url': f"/api/v1/ai-music/download/{track.track_id}",
                'created_at': track.created_at.isoformat()
            },
            message="AI soundscape generated successfully"
        )

    except Exception as e:
        logger.exception(f"Failed to generate soundscape: {e}")
        return APIResponse.error("Failed to generate soundscape", "GENERATION_ERROR", 500)


@ai_music_bp.route('/stream/<track_id>', methods=['GET'])
@AuthService.jwt_required
def stream_soundscape(track_id: str):
    """Stream AI-generated soundscape audio (WAV format)."""
    try:
        service = get_ai_music_service()
        track = service.get_track(track_id)

        if not track or not track.audio_data:
            return APIResponse.not_found("Track not found or expired")

        # Stream the audio
        def generate():
            yield track.audio_data

        return Response(
            stream_with_context(generate()),
            mimetype='audio/wav',
            headers={
                'Content-Disposition': f'inline; filename={track_id}.wav',
                'Content-Length': len(track.audio_data),
                'X-Track-Type': track.soundscape_type.value,
                'X-Duration': str(track.duration_seconds)
            }
        )

    except Exception as e:
        logger.error(f"Failed to stream soundscape: {e}")
        return APIResponse.error("Failed to stream audio", "STREAM_ERROR", 500)


@ai_music_bp.route('/download/<track_id>', methods=['GET'])
@AuthService.jwt_required
def download_soundscape(track_id: str):
    """Download AI-generated soundscape as WAV file."""
    try:
        service = get_ai_music_service()
        track = service.get_track(track_id)

        if not track or not track.audio_data:
            return APIResponse.not_found("Track not found or expired")

        return Response(
            track.audio_data,
            mimetype='audio/wav',
            headers={
                'Content-Disposition': f'attachment; filename=lugn-trygg_{track.soundscape_type.value}_{track_id}.wav',
                'Content-Length': len(track.audio_data)
            }
        )

    except Exception as e:
        logger.error(f"Failed to download soundscape: {e}")
        return APIResponse.error("Failed to download audio", "DOWNLOAD_ERROR", 500)


@ai_music_bp.route('/preview/<soundscape_type>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def preview_soundscape(soundscape_type: str):
    """
    Generate a short (30 second) preview of a soundscape type.
    Useful for users to sample before generating full track.
    """
    try:
        user_id = g.get('user_id')

        # Validate type
        try:
            st = SoundscapeType(soundscape_type)
        except ValueError:
            return APIResponse.error("Invalid soundscape type", "INVALID_TYPE", 400)

        # Generate 30-second preview
        service = get_ai_music_service()
        track = service.generate_soundscape(
            user_id=user_id,
            soundscape_type=st,
            duration=30,
            target_mood=None
        )

        # Stream directly
        return Response(
            track.audio_data,
            mimetype='audio/wav',
            headers={
                'Content-Disposition': 'inline',
                'Content-Length': len(track.audio_data),
                'X-Preview': 'true',
                'X-Track-Type': soundscape_type
            }
        )

    except Exception as e:
        logger.error(f"Failed to generate preview: {e}")
        return APIResponse.error("Failed to generate preview", "PREVIEW_ERROR", 500)


@ai_music_bp.route('/brainwave-info', methods=['GET'])
def get_brainwave_info():
    """Get educational information about brainwave frequencies."""
    info = {
        'delta': {
            'frequency': '0.5-4 Hz',
            'state': 'Deep sleep',
            'description': 'Delta-vågor förekommer under djup sömn och är förknippade med fysisk återhämtning och läkning.',
            'benefits': [
                'Djup avslappning',
                'Förbättrad sömnkvalitet',
                'Fysisk återhämtning',
                'Immunförsvarsförstärkning'
            ],
            'research': 'Studier av Dr. Gerald Oster och Dr. Jeffrey Thompson visar att delta-stimulering kan förbättra sömnen.'
        },
        'theta': {
            'frequency': '4-8 Hz',
            'state': 'Meditation / Creativity',
            'description': 'Theta-vågor är associerade med djup meditation, kreativitet och tillgång till det undermedvetna.',
            'benefits': [
                'Fördjupad meditation',
                'Ökad kreativitet',
                'Ångestreduktion',
                'Förbättrat lärande'
            ],
            'research': 'Dr. Alfred Tomatis arbete visar att theta-stimulering kan förbättra kreativt tänkande.'
        },
        'alpha': {
            'frequency': '8-13 Hz',
            'state': 'Relaxed awareness',
            'description': 'Alpha-vågor dominerar när vi är avslappnade men vakna - "the now"-tillståndet.',
            'benefits': [
                'Stressreduktion',
                'Förbättrat fokus',
                'Mindre ångest',
                'Bättre inlärning'
            ],
            'research': 'Alpha-stimulering har visat sig minska stresshormoner som kortisol.'
        },
        'beta': {
            'frequency': '13-30 Hz',
            'state': 'Active thinking',
            'description': 'Beta-vågor dominerar vid aktivt tänkande, problemlösning och fokuserad uppmärksamhet.',
            'benefits': [
                'Ökad alerthet',
                'Förbättrad kognition',
                'Problemlösningsförmåga',
                'Fokuserad uppmärksamhet'
            ],
            'research': 'Beta-stimulering kan förbättra kognitiv prestanda vid uppgifter som kräver fokus.'
        },
        'gamma': {
            'frequency': '30-100 Hz',
            'state': 'Peak concentration',
            'description': 'Gamma-vågor är associerade med peak performance, insikt och högre medvetandetillstånd.',
            'benefits': [
                'Peak performance',
                'Djup insikt',
                'Förbättrat minne',
                'Högre medvetande'
            ],
            'research': 'Gamma-aktivitet är förknippad med transcendentala upplevelser och peak states.'
        }
    }

    return APIResponse.success(
        data=info,
        message="Brainwave frequency information"
    )


@ai_music_bp.route('/adaptive-recommendation', methods=['POST'])
@AuthService.jwt_required
def get_adaptive_recommendation():
    """
    Get AI soundscape recommendation based on current mood/state.
    
    Request body:
    {
        "current_mood": "anxious|stressed|tired|energetic|calm",
        "time_of_day": "morning|afternoon|evening|night",
        "activity": "working|relaxing|meditating|sleeping"
    }
    """
    try:
        data = request.get_json() or {}

        mood = data.get('current_mood', 'neutral')
        time_of_day = data.get('time_of_day', 'afternoon')
        activity = data.get('activity', 'relaxing')

        # Recommendation logic
        recommendations = _get_adaptive_recommendation(mood, time_of_day, activity)

        return APIResponse.success(
            data=recommendations,
            message="Personalized soundscape recommendations"
        )

    except Exception as e:
        logger.error(f"Failed to get recommendation: {e}")
        return APIResponse.error("Failed to generate recommendation", "REC_ERROR", 500)


def _get_brainwave_description(freq: float) -> str:
    """Get brainwave state description for a frequency."""
    if freq <= 4:
        return "Delta (Deep sleep)"
    elif freq <= 8:
        return "Theta (Meditation)"
    elif freq <= 13:
        return "Alpha (Relaxation)"
    elif freq <= 30:
        return "Beta (Focus)"
    else:
        return "Gamma (Peak)"


def _get_adaptive_recommendation(mood: str, time_of_day: str, activity: str) -> dict:
    """Generate adaptive soundscape recommendation."""

    # Mood-based mapping
    mood_mapping = {
        'anxious': {
            'type': 'anxiety_relief',
            'reason': 'Theta/alpha stimulation helps activate the parasympathetic nervous system',
            'priority': 1
        },
        'stressed': {
            'type': 'anxiety_relief',
            'reason': 'Reduces cortisol levels and promotes relaxation',
            'priority': 1
        },
        'tired': {
            'type': 'focus',
            'reason': 'Alpha/beta waves increase alertness without overstimulation',
            'priority': 2
        },
        'depressed': {
            'type': 'meditation',
            'reason': 'Theta waves can help access positive emotional states',
            'priority': 1
        },
        'energetic': {
            'type': 'focus',
            'reason': 'Channel energy into productive focus',
            'priority': 3
        },
        'calm': {
            'type': 'meditation',
            'reason': 'Maintain and deepen relaxed state',
            'priority': 2
        }
    }

    # Time-based adjustments
    time_mapping = {
        'morning': 'focus',
        'afternoon': 'focus',
        'evening': 'meditation',
        'night': 'deep_sleep'
    }

    # Activity-based
    activity_mapping = {
        'working': 'focus',
        'relaxing': 'meditation',
        'meditating': 'meditation',
        'sleeping': 'deep_sleep',
        'exercising': 'cosmic'
    }

    # Combine factors
    mood_rec = mood_mapping.get(mood, {'type': 'meditation', 'reason': 'General wellness'})
    time_rec = time_mapping.get(time_of_day, 'meditation')
    activity_rec = activity_mapping.get(activity, 'meditation')

    # Priority: mood > activity > time
    final_type = mood_rec['type']
    if mood == 'neutral' or mood not in mood_mapping:
        final_type = activity_rec
    if activity == 'relaxing' and time_of_day in ['evening', 'night']:
        final_type = time_rec

    return {
        'recommended_soundscape': final_type,
        'reasoning': mood_rec.get('reason', 'Personalized for your state'),
        'alternatives': [
            time_rec,
            activity_rec,
            'nature_sim'  # Always a safe fallback
        ],
        'parameters': {
            'suggested_duration': 600 if final_type == 'deep_sleep' else 300,
            'volume': 0.6 if mood in ['anxious', 'stressed'] else 0.7,
            'use_headphones': True  # For binaural beats
        }
    }
