"""A mood log with a score outside 1-10 is refused, not saved as a 5.

POST /api/v1/mood/log turned an invalid score into None and saved the entry
anyway: 11, -3 and "abc" each came back 201, stored as 5 (or whatever the
note's sentiment gave), and pulled the user's average to 5.7. Valence and
arousal were dropped the same way, and JSON `true` was read as a score of 1.

A refused log must not use a unit of the daily quota either: the check runs
before the quota is consumed.
"""

import pytest

from src.services.subscription_service import SubscriptionService
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)


@pytest.fixture
def saved(mock_firestore, mocker):  # noqa: F811
    """The add() the route saves a mood entry with."""
    mocker.patch('src.routes.mood_routes.db', mock_firestore)
    return mock_firestore.collection.return_value.document.return_value.collection.return_value.add


@pytest.fixture
def quota(mocker):
    return mocker.patch.object(SubscriptionService, 'consume_quota', return_value={'mood_logs': 1})


@pytest.fixture(autouse=True)
def sentiment(mocker):
    ai = mocker.patch('src.services.ai_service.ai_services')
    ai.analyze_sentiment.return_value = {'sentiment': 'NEUTRAL', 'score': 0.0, 'emotions': []}
    return ai


@pytest.mark.parametrize('score', [11, -3, 0, 'abc', '7.5', 7.5, True, [], {'v': 5}])
def test_an_invalid_score_is_refused_and_nothing_is_saved(
    client, auth_csrf_headers, mock_auth_service, saved, quota, score
):
    response = client.post('/api/mood/log', json={'score': score, 'note': 'Helt okej dag'},
                           headers=auth_csrf_headers)

    assert response.status_code == 400
    saved.assert_not_called()
    quota.assert_not_called()


@pytest.mark.parametrize('field', ['valence', 'arousal'])
@pytest.mark.parametrize('value', [11, 0, 'abc'])
def test_an_invalid_valence_or_arousal_is_refused(
    client, auth_csrf_headers, mock_auth_service, saved, quota, field, value
):
    response = client.post('/api/mood/log', json={'score': 6, field: value}, headers=auth_csrf_headers)

    assert response.status_code == 400
    saved.assert_not_called()


@pytest.mark.parametrize(('score', 'stored'), [(1, 1), (10, 10), ('7', 7), (7.0, 7)])
def test_a_score_from_1_to_10_is_saved_as_sent(
    client, auth_csrf_headers, mock_auth_service, saved, quota, score, stored
):
    response = client.post('/api/mood/log', json={'score': score}, headers=auth_csrf_headers)

    assert response.status_code == 201
    assert saved.call_args.args[0]['score'] == stored


def test_a_log_without_a_score_is_still_accepted(client, auth_csrf_headers, mock_auth_service, saved, quota):
    # The voice flow sends score '' when there is none (src/api/mood.ts).
    response = client.post('/api/mood/log', json={'score': '', 'mood_text': 'Lugn'}, headers=auth_csrf_headers)

    assert response.status_code == 201
    saved.assert_called_once()
