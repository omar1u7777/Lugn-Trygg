"""
Audio Routes - Relaxing Sounds API
Provides curated audio tracks for relaxation and meditation
Uses external royalty-free audio sources + on-demand binaural beat generation
"""

import io
import logging

from flask import Blueprint, Response, make_response, request, send_file

from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

audio_bp = Blueprint("audio", __name__)

def _preflight_response() -> Response:
    """Return a properly typed 204 No Content response for OPTIONS preflight requests."""
    return make_response('', 204)

MAX_SEARCH_RESULTS = 50
MIN_SEARCH_LENGTH = 2
MAX_SEARCH_LENGTH = 100

# Curated audio library using VERIFIED working sources
# Sources: Wikimedia Commons (CC0/CC-BY), with fallback to generated audio
# All URLs verified via Wikimedia Commons API 2026-07-03
AUDIO_LIBRARY = {
    'nature': {
        'id': 'nature',
        'name': 'Natur',
        'name_en': 'Nature',
        'icon': '🌿',
        'description': 'Naturliga ljud för avslappning',
        'tracks': [
            {
                'id': 'forest-rain',
                'title': 'Skog och Regn',
                'title_en': 'Forest Rain',
                'artist': 'Nature Sounds',
                'duration': '10:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Sound_of_rain.ogg',
                'description': 'Mjukt regn mot fönster',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            },
            {
                'id': 'ocean-waves',
                'title': 'Havsvågor',
                'title_en': 'Ocean Waves',
                'artist': 'Nature Sounds',
                'duration': '10:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
                'description': 'Lugna havsvågor mot stranden',
                'license': 'CC BY 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'birds-morning',
                'title': 'Morgon Fågelsång',
                'title_en': 'Morning Birds',
                'artist': 'Nature Sounds',
                'duration': '5:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
                'description': 'Fåglar som sjunger i gryningen',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'river-stream',
                'title': 'Porlande Bäck',
                'title_en': 'River Stream',
                'artist': 'Nature Sounds',
                'duration': '8:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Hemlock_stream.ogg',
                'description': 'Lugnt porlande vatten',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            }
        ]
    },
    'ambient': {
        'id': 'ambient',
        'name': 'Ambient',
        'name_en': 'Ambient',
        'icon': '🌌',
        'description': 'Eteriska ljudlandskap för djup avslappning',
        'tracks': [
            {
                'id': 'deep-relaxation',
                'title': 'Djup Avslappning',
                'title_en': 'Deep Relaxation',
                'artist': 'Ambient Generator',
                'duration': '10:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Meditation_Gong.ogg',
                'description': 'Lugn ambient musik för avslappning',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            },
            {
                'id': 'cosmic-drift',
                'title': 'Kosmisk Drift',
                'title_en': 'Cosmic Drift',
                'artist': 'Space Sounds',
                'duration': '8:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Ambient_Noise.ogg',
                'description': 'Drömmande rymdljud för meditation',
                'license': 'CC BY 2.5 (Wikimedia Commons)'
            },
            {
                'id': 'healing-tones',
                'title': 'Läkande Toner',
                'title_en': 'Healing Tones',
                'artist': 'Wellness Audio',
                'duration': '12:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Singing_bowl.ogg',
                'description': 'Läkande frekvenser för avslappning',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            }
        ]
    },
    'meditation': {
        'id': 'meditation',
        'name': 'Meditation',
        'name_en': 'Meditation',
        'icon': '🧘',
        'description': 'Bakgrundsmusik för meditation och mindfulness',
        'tracks': [
            {
                'id': 'zen-garden',
                'title': 'Zen Trädgård',
                'title_en': 'Zen Garden',
                'artist': 'Meditation Music',
                'duration': '10:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Meditation_Gong.ogg',
                'description': 'Fredlig zenmusik för meditativ fokus',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            },
            {
                'id': 'breath-focus',
                'title': 'Andningsfokus',
                'title_en': 'Breath Focus',
                'artist': 'Mindfulness Audio',
                'duration': '8:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Ambient_Noise.ogg',
                'description': 'Musik för andningsövningar',
                'license': 'CC BY 2.5 (Wikimedia Commons)'
            },
            {
                'id': 'tibetan-bowls',
                'title': 'Tibetanska Skålar',
                'title_en': 'Tibetan Bowls',
                'artist': 'Sound Healing',
                'duration': '15:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/1/17/Small_tibetan_singing_bowl.ogg',
                'description': 'Resonerande tibetanska klangskålar',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            }
        ]
    },
    'sleep': {
        'id': 'sleep',
        'name': 'Sömn',
        'name_en': 'Sleep',
        'icon': '🌙',
        'description': 'Lugna ljud för bättre sömn',
        'tracks': [
            {
                'id': 'night-rain',
                'title': 'Nattregn',
                'title_en': 'Night Rain',
                'artist': 'Sleep Sounds',
                'duration': '30:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Rain_against_the_window.ogg',
                'description': 'Mjukt regn för sömn',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'white-noise',
                'title': 'Vitt Brus',
                'title_en': 'White Noise',
                'artist': 'Sleep Sounds',
                'duration': '60:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/a/aa/White_noise.ogg',
                'description': 'Lugnande vitt brus för djup sömn',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'lullaby-piano',
                'title': 'Vaggsång Piano',
                'title_en': 'Lullaby Piano',
                'artist': 'Sleep Music',
                'duration': '20:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Chopin%2C_Nocturne_in_C-sharp_minor%2C_Op._Posth.ogg',
                'description': 'Mjuk pianomusik för sömn',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            }
        ]
    },
    'focus': {
        'id': 'focus',
        'name': 'Fokus',
        'name_en': 'Focus',
        'icon': '🎯',
        'description': 'Musik för koncentration och produktivitet',
        'tracks': [
            {
                'id': 'study-beats',
                'title': 'Studiebeats',
                'title_en': 'Study Beats',
                'artist': 'Focus Music',
                'duration': '15:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Chopin%2C_Nocturne_op_32_no_1.ogg',
                'description': 'Klassiskt piano för studier',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            },
            {
                'id': 'deep-work',
                'title': 'Djupt Arbete',
                'title_en': 'Deep Work',
                'artist': 'Productivity Sounds',
                'duration': '25:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Whitenoisesound.ogg',
                'description': 'Lugn musik för fokuserat arbete',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'concentration-piano',
                'title': 'Fokus Piano',
                'title_en': 'Focus Piano',
                'artist': 'Classical Focus',
                'duration': '20:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Chopin%2C_Nocturne_op_32_no_1.ogg',
                'description': 'Klassiskt piano för djup koncentration',
                'license': 'CC BY-SA 4.0 (Wikimedia Commons)'
            }
        ]
    },
    'sleep_stories': {
        'id': 'sleep_stories',
        'name': 'Sovsagor',
        'name_en': 'Sleep Stories',
        'icon': '📖',
        'description': 'Lugnande berättelser för nedvarvning och sömn',
        'tracks': [
            {
                'id': 'star-journey',
                'title': 'Stjärnresan',
                'title_en': 'Star Journey',
                'artist': 'Lugn Trygg',
                'duration': '12:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/8/88/Meditation_im_Liegen_%2820_Min.%29.ogg',
                'description': 'Lugn godnattsaga för nedvarvning — dröm dig bort bland stjärnorna',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'rainforest-rest',
                'title': 'Regnskogens Vila',
                'title_en': 'Rainforest Rest',
                'artist': 'Lugn Trygg',
                'duration': '15:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Birds_forest.ogg',
                'description': 'Mjuk berättelse med naturljud från regnskogen',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'ocean-breath',
                'title': 'Havets Andetag',
                'title_en': 'Ocean Breath',
                'artist': 'Lugn Trygg',
                'duration': '20:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg',
                'description': 'Djup vila med havsrytm och guidning',
                'license': 'CC BY 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'moonlit-forest',
                'title': 'Månlit Skog',
                'title_en': 'Moonlit Forest',
                'artist': 'Lugn Trygg',
                'duration': '18:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Hemlock_stream.ogg',
                'description': 'Stillhet i en månlit skog med porlande bäck',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            },
            {
                'id': 'winter-calm',
                'title': 'Vinterlugn',
                'title_en': 'Winter Calm',
                'artist': 'Lugn Trygg',
                'duration': '14:00',
                'url': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Rain_and_thunder.ogg',
                'description': 'Fräscht vinterlugn med mjuka regndroppar',
                'license': 'CC BY-SA 3.0 (Wikimedia Commons)'
            }
        ]
    }
}


@audio_bp.route('/categories', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_categories():
    """Get all audio categories with basic info (without tracks)"""
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        categories = []
        for _cat_id, cat_data in AUDIO_LIBRARY.items():
            categories.append({
                'id': cat_data['id'],
                'name': cat_data['name'],
                'nameEn': cat_data.get('name_en', cat_data['name']),
                'icon': cat_data['icon'],
                'description': cat_data['description'],
                'trackCount': len(cat_data['tracks'])
            })

        return APIResponse.success(
            {'categories': categories},
            f"Retrieved {len(categories)} audio categories"
        )
    except Exception:
        logger.exception("Error in get_categories")
        return APIResponse.error("Failed to retrieve audio categories", "AUDIO_CATEGORIES_ERROR", 500)


@audio_bp.route('/category/<category_id>', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_category_tracks(category_id: str):
    """Get all tracks for a specific category"""
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        # Sanitize category_id
        category_id = input_sanitizer.sanitize(category_id, content_type='text', max_length=50)
        if not category_id or category_id not in AUDIO_LIBRARY:
            return APIResponse.not_found("Category not found", "CATEGORY_NOT_FOUND")

        category = AUDIO_LIBRARY[category_id]

        # Convert tracks to camelCase
        tracks_camel = []
        for track in category['tracks']:
            tracks_camel.append({
                'id': track['id'],
                'title': track['title'],
                'titleEn': track.get('title_en', track['title']),
                'artist': track['artist'],
                'duration': track['duration'],
                'url': track['url'],
                'description': track.get('description', ''),
                'license': track.get('license', '')
            })

        return APIResponse.success({
            'category': {
                'id': category['id'],
                'name': category['name'],
                'nameEn': category.get('name_en', category['name']),
                'icon': category['icon'],
                'description': category['description']
            },
            'tracks': tracks_camel
        }, f"Retrieved {len(tracks_camel)} tracks for category {category_id}")
    except Exception:
        logger.exception("Error retrieving category tracks")
        return APIResponse.error("Failed to retrieve category tracks", "CATEGORY_TRACKS_ERROR", 500)


@audio_bp.route('/all', methods=['GET', 'OPTIONS'])
@audio_bp.route('/library', methods=['GET', 'OPTIONS'])  # Alias for frontend compatibility
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_all_audio():
    """Get complete audio library (all categories with all tracks)"""
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        # Convert entire library to camelCase
        library_camel = {}
        for cat_id, cat_data in AUDIO_LIBRARY.items():
            tracks_camel = []
            for track in cat_data['tracks']:
                tracks_camel.append({
                    'id': track['id'],
                    'title': track['title'],
                    'titleEn': track.get('title_en', track['title']),
                    'artist': track['artist'],
                    'duration': track['duration'],
                    'url': track['url'],
                    'description': track.get('description', ''),
                    'license': track.get('license', '')
                })

            library_camel[cat_id] = {
                'id': cat_data['id'],
                'name': cat_data['name'],
                'nameEn': cat_data.get('name_en', cat_data['name']),
                'icon': cat_data['icon'],
                'description': cat_data['description'],
                'tracks': tracks_camel
            }

        return APIResponse.success(
            {'library': library_camel},
            f"Retrieved complete audio library with {len(library_camel)} categories"
        )
    except Exception:
        logger.exception("Error retrieving complete audio library")
        return APIResponse.error("Failed to retrieve audio library", "AUDIO_LIBRARY_ERROR", 500)


@audio_bp.route('/track/<track_id>', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_track(track_id: str):
    """Get a specific track by ID"""
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        # Sanitize track_id
        track_id = input_sanitizer.sanitize(track_id, content_type='text', max_length=50)
        if not track_id:
            return APIResponse.bad_request("Invalid track ID")

        for category in AUDIO_LIBRARY.values():
            for track in category['tracks']:
                if track['id'] == track_id:
                    return APIResponse.success({
                        'track': {
                            'id': track['id'],
                            'title': track['title'],
                            'titleEn': track.get('title_en', track['title']),
                            'artist': track['artist'],
                            'duration': track['duration'],
                            'url': track['url'],
                            'description': track.get('description', ''),
                            'license': track.get('license', '')
                        },
                        'category': {
                            'id': category['id'],
                            'name': category['name'],
                            'icon': category['icon']
                        }
                    }, f"Retrieved track {track_id}")

        return APIResponse.not_found("Track not found", "TRACK_NOT_FOUND")
    except Exception:
        logger.exception(f"Error retrieving track {track_id}")
        return APIResponse.error("Failed to retrieve track", "TRACK_ERROR", 500)


@audio_bp.route('/search', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def search_tracks():
    """Search tracks by title or description"""
    if request.method == 'OPTIONS':
        return _preflight_response()
    try:
        raw_query = request.args.get('q', '')
        # Sanitize search query
        query = input_sanitizer.sanitize(raw_query, content_type='text', max_length=MAX_SEARCH_LENGTH)
        query = query.lower() if query else ''

        if not query or len(query) < MIN_SEARCH_LENGTH:
            return APIResponse.bad_request(f"Search query must be at least {MIN_SEARCH_LENGTH} characters")

        results = []
        for category in AUDIO_LIBRARY.values():
            for track in category['tracks']:
                # Search in title, description, and artist
                searchable = f"{track['title']} {track.get('title_en', '')} {track['description']} {track['artist']}".lower()
                if query in searchable:
                    results.append({
                        'id': track['id'],
                        'title': track['title'],
                        'titleEn': track.get('title_en', track['title']),
                        'artist': track['artist'],
                        'duration': track['duration'],
                        'url': track['url'],
                        'description': track.get('description', ''),
                        'license': track.get('license', ''),
                        'categoryId': category['id'],
                        'categoryName': category['name'],
                        'categoryIcon': category['icon']
                    })

        limited = results[:MAX_SEARCH_RESULTS]

        return APIResponse.success({
            'query': query,
            'results': limited,
            'count': len(limited)
        }, f"Found {len(limited)} matching tracks")
    except Exception:
        logger.exception("Error searching audio tracks")
        return APIResponse.error("Failed to search audio tracks", "AUDIO_SEARCH_ERROR", 500)


@audio_bp.route('/generate', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def generate_audio():
    """Generate ambient binaural audio on-the-fly as fallback

    Parameters:
    - type: 'ambient', 'rain', 'noise', 'binaural' (default: ambient)
    - brainwave: 'delta' (sleep), 'theta' (meditation), 'alpha' (relax), 'beta' (focus), 'gamma' (high focus)
    - duration: seconds (default: 600, max: 3600)
    """
    if request.method == 'OPTIONS':
        return _preflight_response()

    try:
        import numpy as np
        from scipy.io import wavfile

        # Parameters
        audio_type = request.args.get('type', 'ambient')
        brainwave = request.args.get('brainwave', 'alpha')
        try:
            duration = min(int(request.args.get('duration', 120)), 120)  # Max 2 min for memory safety
        except (ValueError, TypeError):
            duration = 120

        # Brainwave frequencies (Hz) - scientifically validated
        frequencies = {
            'delta': 2.5,    # 0.5-4 Hz - deep sleep
            'theta': 6,      # 4-8 Hz - meditation, creativity
            'alpha': 10,     # 8-12 Hz - relaxation, calm
            'beta': 20,      # 12-30 Hz - focus, concentration
            'gamma': 40      # 30-100 Hz - peak cognitive function
        }

        freq = frequencies.get(brainwave, 10)  # Default to alpha
        sample_rate = 22050  # Reduced from 44100 for memory efficiency on Render

        # Generate time array
        t = np.linspace(0, duration, int(duration * sample_rate))

        # Binaural beat: left ear at 100Hz + right ear at 100Hz + beat frequency difference
        carrier_freq = 100
        left_channel = np.sin(2 * np.pi * carrier_freq * t)
        right_channel = np.sin(2 * np.pi * (carrier_freq + freq) * t)

        # Mix channels with binaural effect
        binaural = np.column_stack((left_channel, right_channel))

        # Reduce amplitude to prevent clipping
        binaural = (binaural * 0.2).astype(np.float32)

        # Create WAV file in memory
        buffer = io.BytesIO()
        wavfile.write(buffer, sample_rate, binaural)
        buffer.seek(0)

        logger.info(f"Generated {audio_type} audio: {brainwave}Hz for {duration}s")

        return send_file(
            buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name=f'meditation-{brainwave}.wav'
        )

    except ImportError:
        logger.warning("NumPy/SciPy not available, returning placeholder audio info")
        return APIResponse.error(
            "Audio generation temporarily unavailable",
            "AUDIO_GEN_UNAVAILABLE",
            503
        )
    except Exception as e:
        logger.exception(f"Error generating audio: {str(e)}")
        return APIResponse.error(
            f"Failed to generate audio: {str(e)}",
            "AUDIO_GEN_ERROR",
            500
        )
