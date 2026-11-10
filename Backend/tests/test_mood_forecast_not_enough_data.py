"""GET /advanced-mood/forecast for someone who has not logged enough yet.

Fewer than 14 mood entries came back as 400 with "Need at least 14 mood
entries for LSTM forecast, got 4", and /mood/forecast showed that sentence as
it came, in a Swedish app. Not having logged enough yet is where every new
user starts, not a bad request: the answer is now a success that says how many
entries are needed and how many there are, and the page words it itself.
"""

from unittest.mock import MagicMock, patch

URL = '/api/v1/advanced-mood/forecast'


def _doc(data):
    doc = MagicMock()
    doc.to_dict.return_value = data
    return doc


def _db_with_moods(count):
    moods = [_doc({'score': 6, 'valence': 6, 'timestamp': f'2026-11-{day:02d}T08:00:00+00:00'})
             for day in range(1, count + 1)]
    db = MagicMock()
    user = db.collection.return_value.document.return_value
    user.collection.return_value.order_by.return_value.limit.return_value.get.return_value = moods
    return db


def test_too_few_entries_is_an_answer_not_an_error(client):
    with patch('src.routes.advanced_mood_routes.db', _db_with_moods(4)):
        response = client.get(URL)

    assert response.status_code == 200
    data = response.get_json()['data']
    assert data['insufficient_data'] is True
    assert data['entries_required'] == 14
    assert data['entries_logged'] == 4
    assert data['forecasts'] == []


def test_thirteen_entries_is_still_too_few(client):
    with patch('src.routes.advanced_mood_routes.db', _db_with_moods(13)):
        data = client.get(URL).get_json()['data']

    assert data['insufficient_data'] is True
    assert data['entries_logged'] == 13
