"""POST /mood/log answers before the note has been analysed.

A log with a note took about 1.8 s, 1.5 s of it one model call that read the
note for sentiment. Nothing the person sees after logging depends on that
answer: the score they chose is saved as it is, and the crisis check reads the
score and the text itself. The analysis now runs after the response and is
written onto the saved entry when it is done. Until then, and if it never
finishes, the entry carries the sentiment its score gives it.

Two logs still wait for the analysis: one with no score, whose score is made
from it, and one with a recording.
"""

from unittest.mock import MagicMock, Mock

import pytest

from src.services import mood_enrichment
from src.services.subscription_service import SubscriptionService
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)

URL = '/api/mood/log'
ANALYSIS = {'sentiment': 'NEGATIVE', 'score': -0.6, 'emotions': ['sadness']}


@pytest.fixture
def moods(mock_firestore, mocker):  # noqa: F811
    mocker.patch('src.routes.mood_routes.db', mock_firestore)
    mocker.patch.object(SubscriptionService, 'consume_quota', return_value={'mood_logs': 1})
    collection = mock_firestore.collection.return_value.document.return_value.collection.return_value
    collection.where.return_value.order_by.return_value.limit.return_value.stream.return_value = []
    saved = Mock()
    saved.id = 'mood-1'
    collection.add.return_value = (None, saved)
    return collection


@pytest.fixture
def ai(mocker):
    services = mocker.patch('src.services.ai_service.ai_services')
    services.analyze_sentiment.return_value = dict(ANALYSIS)
    return services


@pytest.fixture
def scheduled(mocker):
    return mocker.patch('src.routes.mood_routes.schedule_sentiment_analysis', return_value=True)


@pytest.fixture
def crisis(mocker):
    return mocker.patch('src.services.crisis_signal.escalate_if_in_crisis')


def _post(client, headers, payload):
    return client.post(URL, json=payload, headers=headers)


def test_a_scored_log_with_a_note_is_answered_without_waiting_for_the_analysis(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    response = _post(client, auth_csrf_headers, {'score': 3, 'note': 'Tung dag'})

    assert response.status_code == 201
    ai.analyze_sentiment.assert_not_called()
    scheduled.assert_called_once_with('testuser1234567890ab', 'mood-1', 'Tung dag')


def test_until_the_analysis_is_done_the_entry_has_the_sentiment_of_its_score(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    _post(client, auth_csrf_headers, {'score': 3, 'note': 'Tung dag'})

    saved = moods.add.call_args.args[0]
    assert saved['score'] == 3
    assert saved['sentiment'] == 'NEGATIVE'
    assert saved['note'] == 'Tung dag'


def test_the_crisis_check_does_not_wait_for_the_analysis(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    _post(client, auth_csrf_headers, {'score': 1, 'note': 'Orkar inte mer'})

    crisis.assert_called_once()
    assert crisis.call_args.args[:3] == ('testuser1234567890ab', 'Orkar inte mer', 'mood_log')
    assert crisis.call_args.kwargs == {'mood_score': 1}


def test_a_log_without_a_note_schedules_nothing(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    _post(client, auth_csrf_headers, {'score': 8})

    scheduled.assert_not_called()


def test_a_log_without_a_score_waits_because_its_score_comes_from_the_analysis(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    response = _post(client, auth_csrf_headers, {'mood_text': 'Ledsen', 'note': 'Tung dag'})

    assert response.status_code == 201
    ai.analyze_sentiment.assert_called_once()
    scheduled.assert_not_called()
    assert moods.add.call_args.args[0]['sentiment'] == 'NEGATIVE'


def test_nothing_is_scheduled_for_a_log_that_was_not_saved(
    client, auth_csrf_headers, mock_auth_service, moods, ai, scheduled, crisis
):
    moods.add.side_effect = RuntimeError('firestore down')

    _post(client, auth_csrf_headers, {'score': 3, 'note': 'Tung dag'})

    scheduled.assert_not_called()


# --- what runs after the response -------------------------------------------

@pytest.fixture
def entry(mocker):
    """The saved mood document the analysis is written onto."""
    db = MagicMock()
    document = db.collection.return_value.document.return_value.collection.return_value.document.return_value
    document.get.return_value.exists = True
    document.get.return_value.to_dict.return_value = {'score': 3, 'note': 'Tung dag', 'sentiment': 'NEGATIVE'}
    mocker.patch('src.services.mood_enrichment._get_db', return_value=db)
    mocker.patch('src.services.mood_enrichment._invalidate_caches')
    return document


def test_the_analysis_is_written_onto_the_saved_entry(entry, ai):
    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    entry.update.assert_called_once_with({
        'sentiment': 'NEGATIVE',
        'sentiment_score': -0.6,
        'emotions_detected': ['sadness'],
        'sentiment_analysis': ANALYSIS,
        'ai_analysis': ANALYSIS,
    })


def test_the_users_own_score_is_never_changed(entry, ai):
    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    assert 'score' not in entry.update.call_args.args[0]


def test_lists_that_were_cached_before_the_analysis_are_dropped(entry, ai):
    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    mood_enrichment._invalidate_caches.assert_called_once_with('user-1')


def test_an_entry_deleted_in_the_meantime_is_left_deleted(entry, ai):
    entry.get.return_value.exists = False

    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    entry.update.assert_not_called()


def test_an_entry_analysed_again_in_the_meantime_keeps_its_newer_analysis(entry, ai):
    # Editing an entry's text analyses it at once and stores the result.
    newer = {'sentiment': 'POSITIVE', 'score': 0.7, 'emotions': []}
    entry.get.return_value.to_dict.return_value = {'score': 3, 'note': 'Tung dag', 'sentiment_analysis': newer}

    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    entry.update.assert_not_called()


@pytest.mark.parametrize('result', [None, 'POSITIVE', RuntimeError('model down')])
def test_a_failed_analysis_leaves_the_entry_as_it_was_saved(entry, ai, result):
    if isinstance(result, Exception):
        ai.analyze_sentiment.side_effect = result
    else:
        ai.analyze_sentiment.return_value = result

    mood_enrichment.analyse_saved_mood('user-1', 'mood-1', 'Tung dag')

    entry.update.assert_not_called()


def test_when_too_many_analyses_are_waiting_the_next_one_is_skipped_not_queued(mocker):
    mocker.patch.object(mood_enrichment, 'MAX_WAITING', 0)

    assert mood_enrichment.schedule_sentiment_analysis('user-1', 'mood-1', 'Tung dag') is False
