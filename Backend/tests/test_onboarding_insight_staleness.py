"""The "log N more times" insight states the current count, and goes once it is met.

It is a snapshot: on 6 November one entry in the 14-day window gave "Logga
ditt mående 2 gång(er) till", and it stayed pending for a week while the user
logged more, shown to someone with 128 entries. /daily-insights only asks for
new insights when nothing is pending, so it also kept the real ones away.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2

USER = 'user123'
ONBOARDING_ID = f'{USER}_onboarding_20261106'


def _onboarding_doc(created_at):
    doc = MagicMock()
    doc.to_dict.return_value = {
        'insight_id': ONBOARDING_ID,
        'user_id': USER,
        'status': 'pending',
        'insight_type': 'checkin',
        'domain': 'behavioral_activation',
        'title': 'Kom igång med daglig loggning',
        'message': 'Bra start! Logga ditt mående en gång till för att börja se dina första insikter.',
        'recommendation': 'Logga ditt mående 2 gång(er) till för att aktivera insikter',
        'created_at': created_at,
    }
    return doc


@pytest.fixture
def generator(mocker):
    db = mocker.patch('src.services.daily_insight_service_v2.db')
    insights = db.collection.return_value
    insights.where.return_value.limit.return_value.stream.return_value = [
        _onboarding_doc(datetime.now(UTC) - timedelta(days=1)),
    ]
    gen = DailyInsightGeneratorV2()
    gen.db_mock = db
    return gen


def _moods(count):
    return [{'id': f'm{i}', 'mood_score': 5} for i in range(count)]


def test_a_met_request_is_retired_rather_than_shown(generator, mocker):
    mocker.patch.object(generator, '_fetch_memories', return_value=_moods(3))

    pending = generator.get_pending_insights(USER)

    assert pending == []
    update = generator.db_mock.collection.return_value.document.return_value.update
    update.assert_called_once()
    assert update.call_args.args[0]['status'] == 'superseded'


def test_an_unmet_request_states_the_current_count(generator, mocker):
    mocker.patch.object(generator, '_fetch_memories', return_value=_moods(2))
    mocker.patch.object(generator, '_count_all_moods', return_value=128)

    [insight] = generator.get_pending_insights(USER)

    assert 'en gång till' in insight['recommendation']
    assert '14 dagarna' in insight['message']
    assert 'Bra start' not in insight['message']


def test_a_user_with_older_logs_is_told_what_is_counted(mocker):
    db = mocker.patch('src.services.daily_insight_service_v2.db')
    db.collection.return_value.document.return_value.get.return_value.exists = False

    insight = DailyInsightGeneratorV2()._generate_onboarding_insight(USER, 1, total_count=128)

    assert '14 dagarna' in insight.message
    assert 'Välkommen' not in insight.message and 'Bra start' not in insight.message
    assert 'Kom igång' not in insight.title
    assert '2 gånger till' in insight.recommendation


def test_an_onboarding_insight_does_not_hold_back_todays_insights(generator):
    stream = generator.db_mock.collection.return_value.where.return_value.limit.return_value.stream
    stream.return_value = [_onboarding_doc(datetime.now(UTC))]

    assert generator._already_generated_today(USER) == []
