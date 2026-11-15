"""A mood refused as a duplicate uses no quota and does no analysis.

POST /api/v1/mood/log refuses the same score twice within five minutes. The
check ran last: after the daily quota had been consumed, after the recording
had been uploaded and after the note had been sent for sentiment analysis. A
user who pressed the button twice lost a unit of their daily quota to a log
that was never saved, and waited for a model call whose answer was thrown away.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest

from src.services.subscription_service import SubscriptionService
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)


@pytest.fixture
def moods(mock_firestore, mocker):  # noqa: F811
    """The user's moods collection, with a 7 logged two minutes ago."""
    mocker.patch('src.routes.mood_routes.db', mock_firestore)
    collection = mock_firestore.collection.return_value.document.return_value.collection.return_value
    recent = Mock()
    recent.to_dict.return_value = {
        'score': 7,
        'timestamp': (datetime.now(UTC) - timedelta(minutes=2)).isoformat(),
    }
    collection.where.return_value.order_by.return_value.limit.return_value.stream.return_value = [recent]
    return collection


@pytest.fixture
def quota(mocker):
    return mocker.patch.object(SubscriptionService, 'consume_quota', return_value={'mood_logs': 1})


@pytest.fixture
def ai(mocker):
    services = mocker.patch('src.services.ai_service.ai_services')
    services.analyze_sentiment.return_value = {'sentiment': 'POSITIVE', 'score': 0.5, 'emotions': []}
    return services


def test_a_duplicate_is_refused_without_using_quota_or_analysis(
    client, auth_csrf_headers, mock_auth_service, moods, quota, ai
):
    response = client.post('/api/mood/log', json={'score': 7, 'note': 'Samma igen'}, headers=auth_csrf_headers)

    assert response.status_code == 409
    assert response.get_json()['error'] == 'DUPLICATE_MOOD'
    moods.add.assert_not_called()
    quota.assert_not_called()
    ai.analyze_sentiment.assert_not_called()


def test_a_different_score_is_still_logged(client, auth_csrf_headers, mock_auth_service, moods, quota, ai):
    response = client.post('/api/mood/log', json={'score': 4}, headers=auth_csrf_headers)

    assert response.status_code == 201
    moods.add.assert_called_once()
    quota.assert_called_once()
