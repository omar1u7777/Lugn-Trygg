"""Generated soundscapes: the synthesis layers, the stored track, the recommendations."""

import io
import wave

import numpy as np
import pytest

from src.routes.ai_music_routes import _get_adaptive_recommendation
from src.services.ai_music_service import (
    AIMusicGenerationService,
    BrainwaveFrequency,
    NeuralAmbientSynthesizer,
    SoundscapeType,
)

SECONDS = 2


@pytest.fixture(scope='module')
def synth():
    return NeuralAmbientSynthesizer()


@pytest.mark.parametrize('layer', [
    lambda s: s.generate_binaural_beat(SECONDS, BrainwaveFrequency.ALPHA.value, 200),
    lambda s: s.generate_isochronic_tone(SECONDS, BrainwaveFrequency.ALPHA.value, 200),
    lambda s: s.generate_fractal_ambient(SECONDS, complexity=4),
    lambda s: s.generate_procedural_nature(SECONDS, 'rain'),
    lambda s: s.generate_procedural_nature(SECONDS, 'waves'),
    lambda s: s.generate_procedural_nature(SECONDS, 'wind'),
    # Under 5 s this crashed: its fades were a fixed 2-5 s long.
    lambda s: s.generate_harmonic_drone(SECONDS, root_freq=110),
], ids=['binaural', 'isochronic', 'fractal', 'rain', 'waves', 'wind', 'drone'])
def test_each_layer_is_stereo_and_as_long_as_asked(synth, layer):
    audio = layer(synth)

    assert audio.shape == (SECONDS * synth.sample_rate, 2)
    assert np.isfinite(audio).all()
    assert np.abs(audio).max() > 0


def test_binaural_beat_differs_between_ears(synth):
    audio = synth.generate_binaural_beat(SECONDS, BrainwaveFrequency.ALPHA.value, 200)

    assert not np.allclose(audio[:, 0], audio[:, 1])


@pytest.mark.parametrize('band, low, high', [
    (BrainwaveFrequency.DELTA, 0.5, 4),
    (BrainwaveFrequency.THETA, 4, 8),
    (BrainwaveFrequency.ALPHA, 8, 13),
    (BrainwaveFrequency.BETA, 13, 30),
    (BrainwaveFrequency.GAMMA, 30, 100),
])
def test_brainwave_targets_sit_in_their_bands(band, low, high):
    assert low <= band.value <= high


def test_generated_track_is_stored_and_plays(mocker):
    service = AIMusicGenerationService()
    mocker.patch.object(service, '_save_track_metadata')

    track = service.generate_soundscape(
        user_id='user-1', soundscape_type=SoundscapeType.MEDITATION, duration=3, target_mood='anxious'
    )

    assert service.get_track(track.track_id) is track
    assert track.duration_seconds == 3
    with wave.open(io.BytesIO(track.audio_data)) as played:
        assert played.getnchannels() == 2
        assert played.getnframes() == 3 * played.getframerate()


def test_anxious_listeners_get_a_lower_volume():
    service = AIMusicGenerationService()

    anxious = service._get_parameters(SoundscapeType.MEDITATION, 'anxious')
    default = service._get_parameters(SoundscapeType.MEDITATION, None)

    assert anxious.volume < default.volume


@pytest.mark.parametrize('mood, time_of_day, activity', [
    ('anxious', 'evening', 'relaxing'),
    ('tired', 'morning', 'working'),
    ('neutral', 'night', 'sleeping'),
])
def test_recommendation_alternatives_are_distinct_and_new(mood, time_of_day, activity):
    recommendation = _get_adaptive_recommendation(mood, time_of_day, activity)
    alternatives = recommendation['alternatives']

    assert len(alternatives) == len(set(alternatives))
    assert recommendation['recommended_soundscape'] not in alternatives
    assert 'nature_sim' in alternatives or recommendation['recommended_soundscape'] == 'nature_sim'


def test_anxious_evening_relaxation_keeps_anxiety_relief_on_offer():
    recommendation = _get_adaptive_recommendation('anxious', 'evening', 'relaxing')

    assert recommendation['recommended_soundscape'] == 'meditation'
    assert 'anxiety_relief' in recommendation['alternatives']
