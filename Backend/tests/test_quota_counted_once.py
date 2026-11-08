"""One mood log or chat message uses one unit of the daily quota.

POST /api/v1/mood/log consumes the mood quota before it saves. The app then
calls POST /api/v1/usage/increment/mood to bring its own counter up to date,
and that endpoint consumed the quota a second time: production on 8 November
shows /mood/log at 19:00:33 followed by "mood_log_incremented" at 19:00:34
for the same user. A free user with five logs a day was refused after three.

/usage/increment/chat was already a read of the count, not a second charge;
the chat test below keeps it that way.
"""

import pytest

from src.services.subscription_service import SubscriptionLimitError, SubscriptionService
from tests.test_mood_routes import mock_firestore  # noqa: F401  (fixture)


class DailyUsage:
    """The users/{uid}/usage/daily counter, in memory."""

    def __init__(self):
        self.counts = {'mood_logs': 0, 'chat_messages': 0}

    def consume_quota(self, user_id, usage_type, plan_limits):
        limit_key = {'mood_logs': 'moodLogsPerDay', 'chat_messages': 'chatMessagesPerDay'}[usage_type]
        limit = plan_limits.get(limit_key, -1)
        if limit != -1 and self.counts[usage_type] >= limit:
            raise SubscriptionLimitError(usage_type, limit)
        self.counts[usage_type] += 1
        return {'date': '2026-11-08', **self.counts}

    def get_daily_usage(self, user_id):
        return {'date': '2026-11-08', **self.counts}


@pytest.fixture
def usage(mocker):
    counter = DailyUsage()
    mocker.patch.object(SubscriptionService, 'consume_quota', side_effect=counter.consume_quota)
    mocker.patch.object(SubscriptionService, 'get_daily_usage', side_effect=counter.get_daily_usage)
    mocker.patch('src.routes.usage_routes.audit_log')
    return counter


def test_a_mood_log_and_the_apps_follow_up_use_one_unit(
    client, mock_firestore, mocker, auth_csrf_headers, mock_auth_service, usage  # noqa: F811
):
    mocker.patch('src.services.ai_service.ai_services').analyze_sentiment.return_value = {
        'sentiment': 'POSITIVE', 'score': 0.6, 'emotions': [],
    }

    logged = client.post('/api/mood/log', json={'score': 7, 'note': 'Bra dag'}, headers=auth_csrf_headers)
    synced = client.post('/api/v1/usage/increment/mood', headers=auth_csrf_headers)

    assert logged.status_code == 201
    assert synced.status_code == 200
    assert usage.counts['mood_logs'] == 1
    assert synced.get_json()['data']['mood_logs'] == 1


def test_the_follow_up_is_not_refused_when_the_log_used_the_last_unit(
    client, auth_csrf_headers, mock_auth_service, usage
):
    usage.counts['mood_logs'] = 5  # the free plan's limit, reached by the last /mood/log

    synced = client.post('/api/v1/usage/increment/mood', headers=auth_csrf_headers)

    assert synced.status_code == 200
    assert synced.get_json()['data']['mood_logs'] == 5


def test_the_chat_follow_up_does_not_use_a_unit(client, auth_csrf_headers, mock_auth_service, usage):
    usage.counts['chat_messages'] = 1  # used by /chatbot/chat/stream

    synced = client.post('/api/v1/usage/increment/chat', headers=auth_csrf_headers)

    assert synced.status_code == 200
    assert usage.counts['chat_messages'] == 1
    assert synced.get_json()['data']['chat_messages'] == 1
