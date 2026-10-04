"""/health/analyze must read where the app writes.

It queried top-level health_data documents for flat metrics nothing writes
(syncs live in health_data/{uid}/{provider}/{id} with metrics under 'data'),
and a top-level 'moods' collection nothing writes (moods live in
users/{uid}/moods, rated in 'score'). Both reads matched nothing for anyone,
and 'days' went into .limit() as a document count rather than a window.
"""

from unittest.mock import MagicMock

import pytest

from src.routes import integration_routes as ir


def _doc(data):
    d = MagicMock()
    d.to_dict.return_value = data
    return d


def _query(docs):
    q = MagicMock()
    q.where.return_value = q
    q.order_by.return_value = q
    q.limit.return_value = q
    q.stream.return_value = iter(docs)
    return q


class TestReadSyncedHealth:
    def test_reads_every_provider_subcollection_and_unwraps_metrics(self, mocker):
        fitbit = _query([_doc({
            'data': {'steps': 8000, 'sleep_hours': 7.5, 'heart_rate': 62},
            'synced_at': '2026-09-30T08:00:00+00:00',
            'date_range': {'start': '2026-09-29', 'end': '2026-09-30'},
        })])
        google = _query([_doc({'data': {'steps': 4000}, 'synced_at': '2026-09-29T08:00:00+00:00'})])
        db = mocker.patch.object(ir, 'db')
        db.collection.return_value.document.return_value.collections.return_value = [fitbit, google]

        rows = ir._read_synced_health('uid', '2026-09-01T00:00:00+00:00')

        assert rows[0] == {'date': '2026-09-30', 'steps': 8000, 'sleep_hours': 7.5,
                           'heart_rate': 62, 'calories': 0}
        assert rows[1]['date'] == '2026-09-29T08:00:00+00:00', "falls back to synced_at"
        assert rows[1]['steps'] == 4000
        db.collection.assert_called_with('health_data')
        db.collection.return_value.document.assert_called_with('uid')

    def test_applies_the_window_to_every_provider(self, mocker):
        provider = _query([])
        db = mocker.patch.object(ir, 'db')
        db.collection.return_value.document.return_value.collections.return_value = [provider]

        ir._read_synced_health('uid', 'CUTOFF')

        field_filter = provider.where.call_args.kwargs['filter']
        assert (field_filter.field_path, field_filter.op_string, field_filter.value) == \
            ('synced_at', '>=', 'CUTOFF')

    def test_a_read_failure_degrades_to_no_data(self, mocker):
        db = mocker.patch.object(ir, 'db')
        db.collection.side_effect = RuntimeError('unavailable')
        assert ir._read_synced_health('uid', 'c') == []


class TestReadMoodsSince:
    def test_reads_the_users_subcollection_and_the_score_field(self, mocker):
        moods = _query([_doc({'timestamp': '2026-09-30T09:00:00+00:00', 'score': 8})])
        db = mocker.patch.object(ir, 'db')
        db.collection.return_value.document.return_value.collection.return_value = moods

        rows = ir._read_moods_since('uid', 'CUTOFF')

        assert rows == [{'date': '2026-09-30T09:00:00+00:00', 'mood_score': 8}]
        db.collection.assert_called_with('users')
        db.collection.return_value.document.return_value.collection.assert_called_with('moods')
        field_filter = moods.where.call_args.kwargs['filter']
        assert (field_filter.field_path, field_filter.op_string, field_filter.value) == \
            ('timestamp', '>=', 'CUTOFF')


class TestAnalyzeRoute:
    URL = '/api/integration/health/analyze'

    @pytest.mark.parametrize('days', ['30', -1, 0, 366, True, 2.5])
    def test_rejects_a_days_value_that_is_not_a_sane_window(
            self, client, auth_csrf_headers, mock_auth_service, days):
        response = client.post(self.URL, json={'days': days}, headers=auth_csrf_headers)
        assert response.status_code == 400

    def test_passes_both_sources_to_the_correlation(
            self, client, auth_csrf_headers, mock_auth_service, mocker):
        health = [{'date': '2026-09-30', 'steps': 1}]
        moods = [{'date': '2026-09-30T09:00:00+00:00', 'mood_score': 8}]
        read_health = mocker.patch.object(ir, '_read_synced_health', return_value=health)
        mocker.patch.object(ir, '_read_moods_since', return_value=moods)
        analyze = mocker.patch.object(ir.health_analytics_service, 'analyze_health_mood_correlation',
                                      return_value={'patterns': []})
        mocker.patch.object(ir, 'audit_log')

        response = client.post(self.URL, json={'days': 7}, headers=auth_csrf_headers)

        assert response.status_code == 200
        analyze.assert_called_once_with(health_data=health, mood_data=moods)
        assert response.get_json()['data']['data_points'] == {'health_entries': 1, 'mood_entries': 1}
        cutoff = read_health.call_args.args[1]
        assert cutoff < ir.datetime.now(ir.UTC).isoformat()
