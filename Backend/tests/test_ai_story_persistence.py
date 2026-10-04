"""What /ai/story keeps, and what it writes the story about.

The 2026-09-29 UI audit found five saved "stories" titled "⚠️
AI-berättelsetjänsten är tillfälligt otillgänglig" and four copies of the same
fallback template: every failed generation was filed in the user's library.
All stories were also labelled "neutral", and the "last two weeks" the story
was written from were the oldest 14 of the 50 moods fetched.
"""

from unittest.mock import MagicMock

import pytest

from src.routes import ai_routes
from src.services.ai.story_generator import StoryGenerator

URL_STORY = '/api/ai/story'
URL_HISTORY = '/api/ai/stories'


def _mood_doc(ts, sentiment):
    d = MagicMock()
    d.to_dict.return_value = {'timestamp': ts, 'sentiment': sentiment, 'score': 5}
    return d


@pytest.fixture
def story_db(mocker):
    db = MagicMock()
    mocker.patch.object(ai_routes, '_get_db', return_value=db)
    mocker.patch.object(ai_routes, '_check_premium_access', return_value=None)
    mocker.patch.object(ai_routes, 'audit_log')
    user = db.collection.return_value.document.return_value
    moods, stories = MagicMock(), MagicMock()
    user.collection.side_effect = lambda name: {'moods': moods, 'stories': stories}[name]
    return moods, stories


def _generate(mocker, result):
    from src.services import ai_service
    return mocker.patch.object(ai_service.ai_services, 'generate_personalized_therapeutic_story',
                               return_value=result)


class TestFallbackStoriesAreNotKept:
    def test_a_fallback_story_is_returned_but_not_saved(
            self, client, auth_csrf_headers, mock_auth_service, mocker, story_db):
        moods, stories = story_db
        moods.order_by.return_value.limit.return_value.stream.return_value = iter([])
        _generate(mocker, {'story': '⚠️ ... Det var en gång en liten fågel', 'ai_generated': False,
                           'model_used': 'fallback', 'mood_summary': {'dominant_mood': 'neutral'}})

        response = client.post(URL_STORY, json={}, headers=auth_csrf_headers)

        body = response.get_json()['data']
        assert response.status_code == 200
        assert body['saved'] is False and body['id'] is None
        stories.document.assert_not_called()

    def test_an_ai_story_is_saved_with_its_mood(
            self, client, auth_csrf_headers, mock_auth_service, mocker, story_db):
        moods, stories = story_db
        moods.order_by.return_value.limit.return_value.stream.return_value = iter([])
        _generate(mocker, {'story': 'En berättelse.', 'ai_generated': True, 'model_used': 'gpt',
                           'mood_summary': {'dominant_mood': 'happy'}})

        response = client.post(URL_STORY, json={}, headers=auth_csrf_headers)

        body = response.get_json()['data']
        assert body['saved'] is True and body['id'].startswith('story_')
        assert body['dominantMood'] == 'happy'
        saved = stories.document.return_value.set.call_args.args[0]
        assert saved['dominant_mood'] == 'happy'

    def test_the_story_is_written_from_the_most_recent_moods(
            self, client, auth_csrf_headers, mock_auth_service, mocker, story_db):
        moods, _ = story_db
        newest_first = [_mood_doc(f'2026-09-{d:02d}', 'NEUTRAL') for d in range(30, 0, -1)]
        moods.order_by.return_value.limit.return_value.stream.return_value = iter(newest_first)
        generate = _generate(mocker, {'story': 's', 'ai_generated': True, 'mood_summary': {}})

        client.post(URL_STORY, json={}, headers=auth_csrf_headers)

        passed = generate.call_args.kwargs['user_mood_data']
        assert passed[-1]['timestamp'] == '2026-09-30', "newest last, so [-14:] is the latest two weeks"


class TestHistory:
    def test_hides_fallback_templates_saved_before_and_returns_the_mood(
            self, client, auth_headers, mock_auth_service, story_db):
        _, stories = story_db

        def doc(doc_id, data):
            d = MagicMock()
            d.id = doc_id
            d.to_dict.return_value = data
            return d

        stories.order_by.return_value.limit.return_value.stream.return_value = iter([
            doc('story_1', {'story_content': '⚠️ AI-berättelsetjänsten ...', 'model_used': 'fallback'}),
            doc('story_2', {'story_content': 'Riktig', 'model_used': 'gpt', 'dominant_mood': 'sad'}),
        ])

        response = client.get(URL_HISTORY, headers=auth_headers)

        listed = response.get_json()['data']['stories']
        assert [s['id'] for s in listed] == ['story_2']
        assert listed[0]['dominantMood'] == 'sad'


class TestDominantMood:
    @pytest.mark.parametrize('sentiments,expected', [
        (['POSITIVE', 'POSITIVE', 'NEUTRAL'], 'happy'),
        (['NEGATIVE', 'NEGATIVE', 'POSITIVE'], 'sad'),
        (['NEUTRAL'], 'neutral'),
    ])
    def test_maps_the_dominant_sentiment_to_a_story_mood(self, sentiments, expected):
        summary = StoryGenerator.analyze_mood_for_story([{'sentiment': s} for s in sentiments])
        assert summary['dominant_mood'] == expected

    def test_no_data(self):
        assert StoryGenerator.analyze_mood_for_story([])['dominant_mood'] == 'neutral'
