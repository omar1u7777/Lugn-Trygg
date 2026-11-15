"""GET /advanced-mood/forecast for someone with enough logs.

Production has no TensorFlow, so every forecast came from the forecaster's
fallback, and the fallback read `valence`: the optional 1-10 slider. A log
without it holds None there and the request ended in a 500; a log with it was
read as if it were on the -1..1 scale the forecast is drawn on, so every day
came out at the top of the chart. The answer still called itself
"temporal_attention_lstm".

The forecast is now made from the mood score each log has, it is the newest
logs that are read, and the answer says which method made it.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

URL = '/api/v1/advanced-mood/forecast'
NOW = datetime(2026, 11, 15, 8, 0, tzinfo=UTC)


def _doc(data):
    doc = MagicMock()
    doc.to_dict.return_value = data
    return doc


def _logs(scores, **extra):
    """One log a day, oldest first, the last one yesterday."""
    first = NOW - timedelta(days=len(scores))
    return [{'score': score, 'valence': None, 'timestamp': (first + timedelta(days=i)).isoformat(), **extra}
            for i, score in enumerate(scores)]


class _Moods:
    """The moods collection: answers the query the way Firestore orders it."""

    def __init__(self, entries):
        self._entries = entries
        self._descending = False
        self._limit = None

    def order_by(self, field, direction='ASCENDING'):
        assert field == 'timestamp'
        self._descending = str(direction).upper().endswith('DESCENDING')
        return self

    def limit(self, count):
        self._limit = count
        return self

    def get(self):
        ordered = sorted(self._entries, key=lambda e: e['timestamp'], reverse=self._descending)
        return [_doc(entry) for entry in ordered[:self._limit]]


def _forecast(client, entries, query=''):
    db = MagicMock()
    db.collection.return_value.document.return_value.collection.side_effect = lambda _name: _Moods(entries)
    with patch('src.routes.advanced_mood_routes.db', db), \
            patch('src.routes.advanced_mood_routes._get_contextual_data', return_value={}):
        return client.get(URL + query)


def _values(response):
    return [day['predicted_valence'] for day in response.get_json()['data']['forecasts']]


def test_logs_without_the_valence_slider_get_a_forecast(client):
    response = _forecast(client, _logs([6] * 14))

    assert response.status_code == 200
    assert len(_values(response)) == 7


def test_steady_middling_scores_forecast_the_middle_not_the_top(client):
    values = _values(_forecast(client, _logs([5, 6] * 7, valence=6)))

    assert all(-0.2 < value < 0.2 for value in values), values


def test_low_scores_forecast_low_and_high_scores_forecast_high(client):
    low = _values(_forecast(client, _logs([2] * 14)))
    high = _values(_forecast(client, _logs([9] * 14)))

    assert all(value < -0.5 for value in low), low
    assert all(value > 0.5 for value in high), high


def test_a_rising_run_of_scores_forecasts_upwards(client):
    values = _values(_forecast(client, _logs([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7])))

    assert values[-1] > values[0]
    assert values[0] > (7 - 5.5) / 4.5 - 0.15


def test_the_forecast_stays_on_the_scale_the_page_draws(client):
    data = _forecast(client, _logs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10]), '?days=14').get_json()['data']

    assert len(data['forecasts']) == 14
    for day in data['forecasts']:
        interval = day['confidence_interval']
        assert -1 <= interval['lower'] <= day['predicted_valence'] <= interval['upper'] <= 1


def test_it_is_less_sure_the_further_ahead_it_looks(client):
    days = _forecast(client, _logs([4, 7, 5, 8, 3, 6, 5, 7, 4, 6, 5, 8, 4, 6])).get_json()['data']['forecasts']

    assert days[-1]['uncertainty'] > days[0]['uncertainty']


def test_it_is_the_newest_logs_that_are_read(client):
    # 60 are read. Someone who felt low for their first 60 logs and well for
    # the 20 since was forecast from the first 60.
    values = _values(_forecast(client, _logs([2] * 60 + [9] * 20)))

    assert all(value > 0.5 for value in values), values


def test_several_logs_in_a_day_count_as_that_day(client):
    entries = _logs([5] * 14)
    last_day = datetime.fromisoformat(entries[-1]['timestamp'])
    entries += [{'score': 9, 'valence': None, 'timestamp': (last_day + timedelta(minutes=m)).isoformat()}
                for m in (1, 2)]

    values = _values(_forecast(client, entries))

    # (5 + 9 + 9) / 3 for the last day, not three days at 5, 9, 9.
    assert all(value < 0.5 for value in values), values


def test_logs_with_no_usable_score_are_left_out(client):
    entries = _logs([6] * 14) + [
        {'score': None, 'valence': None, 'timestamp': NOW.isoformat()},
        {'score': 'abc', 'timestamp': NOW.isoformat()},
        {'score': 0.4, 'timestamp': 'not a date'},
    ]

    response = _forecast(client, entries)

    assert response.status_code == 200
    assert all(0 < value < 0.25 for value in _values(response))


def test_the_answer_says_it_is_a_trend_when_no_model_made_it(client):
    data = _forecast(client, _logs([6] * 14)).get_json()['data']

    assert data['model_type'] == 'score_trend'


@pytest.mark.parametrize('scores, flagged', [([2] * 14, True), ([6] * 14, False)])
def test_a_low_forecast_is_flagged_as_low_mood_not_as_a_diagnosis(client, scores, flagged):
    days = _forecast(client, _logs(scores)).get_json()['data']['forecasts']
    flags = {flag for day in days for flag in day['risk_flags']}

    assert ('sustained_low_mood' in flags) is flagged
    assert 'predicted_depressive_episode' not in flags
