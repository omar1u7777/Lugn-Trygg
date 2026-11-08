"""/users/stats reports days with a mood entry separately from account age.

/profile showed "Dagar aktiv" from accountAge, so it always matched
"Medlem i X dagar" (399 for the tester). An active day is a Swedish calendar
day with at least one mood entry, as the streak on the rewards page counts it.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest


def _mood(timestamp):
    doc = MagicMock()
    doc.to_dict.return_value = {'timestamp': timestamp}
    return doc


@pytest.fixture
def stats_db(mocker):
    db = mocker.patch('src.routes.users_routes.db')
    user_ref = db.collection.return_value.document.return_value
    subcollection = user_ref.collection.return_value
    subcollection.count.return_value.get.return_value = [[MagicMock(value=4)]]
    created = (datetime.now(UTC) - timedelta(days=399, hours=1)).isoformat()
    user_ref.get.return_value.exists = True
    user_ref.get.return_value.to_dict.return_value = {'createdAt': created}
    return subcollection


def _stats(client, auth_headers):
    response = client.get('/api/v1/users/stats', headers=auth_headers)
    assert response.status_code == 200
    body = response.get_json()
    return body.get('data', body)


def test_active_days_count_swedish_days_with_a_mood(client, auth_headers, stats_db):
    stats_db.select.return_value.stream.return_value = [
        _mood('2026-11-07T23:42:51.123456+00:00'),  # 00:42 on 8 November in Sweden
        _mood('2026-11-08T08:00:00+00:00'),
        _mood('2026-11-06T10:00:00+00:00'),
        _mood(datetime(2026, 7, 1, 22, 30, tzinfo=UTC)),  # 00:30 on 2 July
    ]

    stats = _stats(client, auth_headers)

    assert stats['accountAge'] == 399
    assert stats['activeDays'] == 3
    stats_db.select.assert_called_with(['timestamp'])


def test_unreadable_timestamps_are_not_days(client, auth_headers, stats_db):
    stats_db.select.return_value.stream.return_value = [_mood(None), _mood('not a date')]

    assert _stats(client, auth_headers)['activeDays'] == 0


def test_a_failed_read_reports_no_count_rather_than_zero(client, auth_headers, stats_db):
    stats_db.select.return_value.stream.side_effect = RuntimeError('firestore down')

    stats = _stats(client, auth_headers)

    assert stats['activeDays'] is None
    assert stats['accountAge'] == 399
