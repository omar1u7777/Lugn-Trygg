"""Analysis run when a memory is created: its text, its photos, and the two combined."""

import io

import pytest
from PIL import Image

from src.routes.multimedia_memory_routes import _analyze_multimodal_memory
from src.services.memory_analysis_service import MemoryAnalysisService
from src.services.photo_analysis_service import PhotoAnalysisService

HAPPY = 'Idag kände jag mig så glad och tacksam för min familj. Vi hade en underbar dag i parken.'
SAD = 'Jag är så ledsen och ensam, allt känns tungt'


def _jpeg(color):
    buffer = io.BytesIO()
    Image.new('RGB', (64, 64), color=color).save(buffer, format='JPEG')
    return buffer.getvalue()


def _top(emotions):
    return max(emotions, key=emotions.get)


@pytest.fixture(scope='module')
def memories():
    return MemoryAnalysisService()


def test_happy_memory(memories):
    result = memories.analyze_text_memory(HAPPY)

    assert result.sentiment_score > 0
    assert _top(result.emotions) in ('joy', 'gratitude')
    assert 'connection' in result.themes
    assert result.therapeutic_insights


def test_sad_memory(memories):
    result = memories.analyze_text_memory(SAD)

    assert result.sentiment_score < 0
    assert _top(result.emotions) == 'sadness'


def test_calm_photo():
    result = PhotoAnalysisService().analyze_photo(_jpeg('blue'), 'photo-1')

    assert result.dominant_emotion == 'calm'
    assert result.color_mood == 'cool'
    assert 'calm' in result.therapeutic_tags
    assert result.suggested_caption


def test_unreadable_photo_falls_back_to_neutral():
    result = PhotoAnalysisService().analyze_photo(b'not an image', 'photo-2')

    assert result.dominant_emotion == 'neutral'


def test_memory_combines_text_and_photos():
    result = _analyze_multimodal_memory(content=HAPPY, audio_data=None, photos=[{'analysis': {'emotion': 'calm'}}])

    assert result['sentiment_score'] > 0
    assert result['emotions']['calm'] == 0.5
    assert result['photo_insights'] == [{'emotion': 'calm'}]
    assert result['primary_emotion'] in result['emotions']


def test_memory_with_only_photos():
    result = _analyze_multimodal_memory(content='', audio_data=None, photos=[{'analysis': {'emotion': 'calm'}}])

    assert result['primary_emotion'] == 'calm'
    assert result['sentiment_score'] == 0
