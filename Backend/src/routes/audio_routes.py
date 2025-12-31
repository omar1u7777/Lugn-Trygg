"""
Audio Routes - Relaxing Sounds API
Provides curated audio tracks for relaxation and meditation
Uses external royalty-free audio sources
"""

from flask import Blueprint, jsonify

audio_bp = Blueprint("audio", __name__, url_prefix="/api/audio")

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


@audio_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all audio categories with basic info (without tracks)"""
    try:
        categories = []
        for cat_id, cat_data in AUDIO_LIBRARY.items():
            categories.append({
                'id': cat_data['id'],
                'name': cat_data['name'],
                'name_en': cat_data.get('name_en', cat_data['name']),
                'icon': cat_data['icon'],
                'description': cat_data['description'],
                'track_count': len(cat_data['tracks'])
            })
        
        return jsonify({
            'success': True,
            'categories': categories
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@audio_bp.route('/category/<category_id>', methods=['GET'])
def get_category_tracks(category_id: str):
    """Get all tracks for a specific category"""
    try:
        if category_id not in AUDIO_LIBRARY:
            return jsonify({
                'success': False,
                'error': 'Category not found'
            }), 404
        
        category = AUDIO_LIBRARY[category_id]
        
        return jsonify({
            'success': True,
            'category': {
                'id': category['id'],
                'name': category['name'],
                'name_en': category.get('name_en', category['name']),
                'icon': category['icon'],
                'description': category['description']
            },
            'tracks': category['tracks']
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@audio_bp.route('/all', methods=['GET'])
def get_all_audio():
    """Get complete audio library (all categories with all tracks)"""
    try:
        return jsonify({
            'success': True,
            'library': AUDIO_LIBRARY
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@audio_bp.route('/track/<track_id>', methods=['GET'])
def get_track(track_id: str):
    """Get a specific track by ID"""
    try:
        for category in AUDIO_LIBRARY.values():
            for track in category['tracks']:
                if track['id'] == track_id:
                    return jsonify({
                        'success': True,
                        'track': track,
                        'category': {
                            'id': category['id'],
                            'name': category['name'],
                            'icon': category['icon']
                        }
                    })
        
        return jsonify({
            'success': False,
            'error': 'Track not found'
        }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@audio_bp.route('/search', methods=['GET'])
def search_tracks():
    """Search tracks by title or description"""
    try:
        from flask import request
        query = request.args.get('q', '').lower()
        
        if not query or len(query) < 2:
            return jsonify({
                'success': False,
                'error': 'Search query must be at least 2 characters'
            }), 400
        
        results = []
        for category in AUDIO_LIBRARY.values():
            for track in category['tracks']:
                # Search in title, description, and artist
                searchable = f"{track['title']} {track.get('title_en', '')} {track['description']} {track['artist']}".lower()
                if query in searchable:
                    results.append({
                        **track,
                        'category_id': category['id'],
                        'category_name': category['name'],
                        'category_icon': category['icon']
                    })
        
        return jsonify({
            'success': True,
            'query': query,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
