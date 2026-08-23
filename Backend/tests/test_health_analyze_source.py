"""/health/analyze must read the health data the sync route actually writes.

sync_health_data_oauth stores every sync under health_data/{user_id}/{provider},
with the metrics nested in a 'data' map. The analysis route instead queried
top-level health_data documents for flat 'steps'/'sleep_hours'/... fields keyed
on 'date'. Nothing writes those -- health_data/{user_id} exists only as the
implicit parent of the subcollections, a document that never appears in query
results -- so the read returned nothing on every call and the endpoint could
only ever report insufficient data.
"""

from unittest.mock import MagicMock

import pytest


def _synced_doc():
    """A document in the shape sync_health_data_oauth writes."""
    doc = MagicMock()
    doc.to_dict.return_value = {
        'user_id': 'testuser1234567890ab',
        'provider': 'google_fit',
        'data': {
            'steps': 8500,
            'sleep_hours': 7.5,
            'heart_rate': 62,
            'calories': 2100,
        },
        'date_range': {
            'start': '2025-10-13T20:35:05.666541',
            'end': '2025-10-20T20:35:05.666541',
        },
        'synced_at': '2025-10-20T20:35:05.666541',
    }
    return doc


def _mood_doc(score):
    """A document in the shape the mood logging path writes."""
    doc = MagicMock()
    doc.to_dict.return_value = {
        'user_id': 'testuser1234567890ab',
        'score': score,
        'timestamp': '2025-10-20T21:42:51.261426',
    }
    return doc


@pytest.fixture
def captured_analysis(mocker):
    """Capture the data /health/analyze hands to the analytics service."""
    mocker.patch('src.routes.integration_routes.audit_log')
    return mocker.patch(
        'src.routes.integration_routes.health_analytics_service.analyze_health_mood_correlation',
        return_value={'patterns': [], 'days_analyzed': 0},
    )


class TestHealthAnalyzeSource:
    def test_reads_the_provider_subcollections_not_top_level_documents(
        self, client, mock_db, auth_csrf_headers, captured_analysis
    ):
        health_parent = mock_db.collection('health_data').document('testuser1234567890ab')
        provider_ref = MagicMock()
        provider_ref.order_by.return_value.limit.return_value.stream.return_value = [_synced_doc()]
        health_parent.collections.return_value = [provider_ref]

        response = client.post('/api/integration/health/analyze', json={'days': 30}, headers=auth_csrf_headers)

        assert response.status_code == 200
        assert response.get_json()['data']['data_points']['health_entries'] == 1

        # Scoped through health_data/<uid>/<provider>, never a top-level filter.
        health_parent.collections.assert_called_once()
        mock_db.collection('health_data').where.assert_not_called()

    def test_unwraps_the_metrics_from_the_nested_data_map(
        self, client, mock_db, auth_csrf_headers, captured_analysis
    ):
        health_parent = mock_db.collection('health_data').document('testuser1234567890ab')
        provider_ref = MagicMock()
        provider_ref.order_by.return_value.limit.return_value.stream.return_value = [_synced_doc()]
        health_parent.collections.return_value = [provider_ref]

        client.post('/api/integration/health/analyze', json={'days': 30}, headers=auth_csrf_headers)

        entry = captured_analysis.call_args.kwargs['health_data'][0]
        assert entry['steps'] == 8500
        assert entry['sleep_hours'] == 7.5
        assert entry['heart_rate'] == 62
        assert entry['calories'] == 2100
        # A sync covers a range; its end dates the metrics it carries.
        assert entry['date'] == '2025-10-20T20:35:05.666541'

    def test_mood_score_falls_back_to_the_score_field(
        self, client, mock_db, auth_csrf_headers, captured_analysis
    ):
        moods = mock_db.collection('moods')
        moods.where.return_value.limit.return_value.stream.return_value = [_mood_doc(4)]

        client.post('/api/integration/health/analyze', json={'days': 30}, headers=auth_csrf_headers)

        assert captured_analysis.call_args.kwargs['mood_data'][0]['mood_score'] == 4

    def test_out_of_range_days_does_not_reach_firestore(
        self, client, mock_db, auth_csrf_headers, captured_analysis
    ):
        health_parent = mock_db.collection('health_data').document('testuser1234567890ab')
        provider_ref = MagicMock()
        provider_ref.order_by.return_value.limit.return_value.stream.return_value = []
        health_parent.collections.return_value = [provider_ref]

        response = client.post(
            '/api/integration/health/analyze', json={'days': 100000}, headers=auth_csrf_headers
        )

        assert response.status_code == 200
        provider_ref.order_by.return_value.limit.assert_called_once_with(30)
