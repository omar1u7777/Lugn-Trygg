"""
Audio Routes - Relaxing Sounds API
Provides curated audio tracks for relaxation and meditation
Uses external royalty-free audio sources
"""

from flask import Blueprint, request

from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

audio_bp = Blueprint("audio", __name__)

MAX_SEARCH_RESULTS = 50
MIN_SEARCH_LENGTH = 2
MAX_SEARCH_LENGTH = 100

# Curated audio library using free/royalty-free sources
# These are URLs to royalty-free audio that can be played directly
# Sources: Freesound.org (CC0/CC BY), Pixabay (free license), Mixkit (free)
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
                'url': 'https://cdn.pixabay.com/download/audio/2022/02/10/audio_2064b0c58b.mp3?filename=rain-on-window-117355.mp3',
                'description': 'Mjukt regn mot fönster',
                'license': 'Pixabay License'
            },
            {
                'id': 'ocean-waves',
                'title': 'Havsvågor',
                'title_en': 'Ocean Waves',
                'artist': 'Nature Sounds',
                'duration': '10:00',
                'url': 'https://cdn.pixabay.com/download/audio/2021/09/08/audio_4cfbc74fca.mp3?filename=ocean-waves-112906.mp3',
                'description': 'Lugna havsvågor mot stranden',
                'license': 'Pixabay License'
            },
            {
                'id': 'birds-morning',
                'title': 'Morgon Fågelsång',
                'title_en': 'Morning Birds',
                'artist': 'Nature Sounds',
                'duration': '5:00',
                'url': 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_0625c9ba47.mp3?filename=birds-singing-calm-environment-ambient-sound-127411.mp3',
                'description': 'Fåglar som sjunger i gryningen',
                'license': 'Pixabay License'
            },
            {
                'id': 'river-stream',
                'title': 'Porlande Bäck',
                'title_en': 'River Stream',
                'artist': 'Nature Sounds',
                'duration': '8:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_eba70f0fa5.mp3?filename=stream-116359.mp3',
                'description': 'Lugnt porlande vatten',
                'license': 'Pixabay License'
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
                'artist': 'Ambient Artist',
                'duration': '10:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/04/27/audio_83b37e59f4.mp3?filename=ambient-piano-117682.mp3',
                'description': 'Lugn ambient piano',
                'license': 'Pixabay License'
            },
            {
                'id': 'cosmic-drift',
                'title': 'Kosmisk Drift',
                'title_en': 'Cosmic Drift',
                'artist': 'Space Sounds',
                'duration': '8:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_d5ddd58a67.mp3?filename=ambient-dream-111052.mp3',
                'description': 'Drömmande rymdljud',
                'license': 'Pixabay License'
            },
            {
                'id': 'healing-tones',
                'title': 'Läkande Toner',
                'title_en': 'Healing Tones',
                'artist': 'Wellness Audio',
                'duration': '12:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_5c2fb7e6f0.mp3?filename=relaxing-145038.mp3',
                'description': 'Läkande frekvenser för avslappning',
                'license': 'Pixabay License'
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
                'url': 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_884af4a0f5.mp3?filename=meditation-spa-118826.mp3',
                'description': 'Fredlig zenmusik',
                'license': 'Pixabay License'
            },
            {
                'id': 'breath-focus',
                'title': 'Andningsfokus',
                'title_en': 'Breath Focus',
                'artist': 'Mindfulness Audio',
                'duration': '8:00',
                'url': 'https://cdn.pixabay.com/download/audio/2023/05/16/audio_2c3e4b0e3c.mp3?filename=ambient-relax-151449.mp3',
                'description': 'Musik för andningsövningar',
                'license': 'Pixabay License'
            },
            {
                'id': 'tibetan-bowls',
                'title': 'Tibetanska Skålar',
                'title_en': 'Tibetan Bowls',
                'artist': 'Sound Healing',
                'duration': '15:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_3b5c92da67.mp3?filename=tibetan-bowl-110952.mp3',
                'description': 'Resonerande tibetanska klangskålar',
                'license': 'Pixabay License'
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
                'url': 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_270f49b4e3.mp3?filename=rain-and-thunder-16705.mp3',
                'description': 'Mjukt regn för sömn',
                'license': 'Pixabay License'
            },
            {
                'id': 'white-noise',
                'title': 'Vitt Brus',
                'title_en': 'White Noise',
                'artist': 'Sleep Sounds',
                'duration': '60:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/06/20/audio_37b98b7a1e.mp3?filename=white-noise-117693.mp3',
                'description': 'Lugnande vitt brus',
                'license': 'Pixabay License'
            },
            {
                'id': 'lullaby-piano',
                'title': 'Vaggsång Piano',
                'title_en': 'Lullaby Piano',
                'artist': 'Sleep Music',
                'duration': '20:00',
                'url': 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_ff3b2d2e26.mp3?filename=calm-and-peaceful-piano-loop-129419.mp3',
                'description': 'Mjuk pianomusik för sömn',
                'license': 'Pixabay License'
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
                'url': 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_4e1d8fa5f8.mp3?filename=lofi-study-112191.mp3',
                'description': 'Lo-fi beats för studier',
                'license': 'Pixabay License'
            },
            {
                'id': 'deep-work',
                'title': 'Djupt Arbete',
                'title_en': 'Deep Work',
                'artist': 'Productivity Sounds',
                'duration': '25:00',
                'url': 'https://cdn.pixabay.com/download/audio/2023/02/28/audio_6e5c9c5e9b.mp3?filename=ambient-classical-guitar-144998.mp3',
                'description': 'Lugn musik för fokuserat arbete',
                'license': 'Pixabay License'
            }
        ]
    }
}


@audio_bp.route('/categories', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def get_categories():
    """Get all audio categories with basic info (without tracks)"""
    if request.method == 'OPTIONS':
        return '', 204
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
    except Exception as e:
        return APIResponse.error("Failed to retrieve audio categories", "AUDIO_CATEGORIES_ERROR", 500, str(e))


@audio_bp.route('/category/<category_id>', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def get_category_tracks(category_id: str):
    """Get all tracks for a specific category"""
    if request.method == 'OPTIONS':
        return '', 204
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
    except Exception as e:
        return APIResponse.error("Failed to retrieve category tracks", "CATEGORY_TRACKS_ERROR", 500, str(e))


@audio_bp.route('/all', methods=['GET', 'OPTIONS'])
@audio_bp.route('/library', methods=['GET', 'OPTIONS'])  # Alias for frontend compatibility
@rate_limit_by_endpoint
def get_all_audio():
    """Get complete audio library (all categories with all tracks)"""
    if request.method == 'OPTIONS':
        return '', 204
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
    except Exception as e:
        return APIResponse.error("Failed to retrieve audio library", "AUDIO_LIBRARY_ERROR", 500, str(e))


@audio_bp.route('/track/<track_id>', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def get_track(track_id: str):
    """Get a specific track by ID"""
    if request.method == 'OPTIONS':
        return '', 204
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
    except Exception as e:
        return APIResponse.error("Failed to retrieve track", "TRACK_ERROR", 500, str(e))


@audio_bp.route('/search', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
def search_tracks():
    """Search tracks by title or description"""
    if request.method == 'OPTIONS':
        return '', 204
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
    except Exception as e:
        return APIResponse.error("Failed to search audio tracks", "AUDIO_SEARCH_ERROR", 500, str(e))
