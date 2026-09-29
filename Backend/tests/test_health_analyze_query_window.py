"""/health/analyze must read a time window, newest-first — not N arbitrary docs.

The route took `days` (documented "Default to last 30 days") and passed it
straight to Firestore as `.limit(days)` with no `order_by`. Two failures:

  * `days` is a window, not a document count — health data can hold several
    entries per day, or none, so 30 documents is not 30 days.
  * with no `order_by`, Firestore returns documents in `__name__` order, which
    is stable and arbitrary. Once a user held more than `days` documents the
    analysis re-read the same subset on every call — frozen as the collection
    grew, so recent entries were never seen, and oldest-first wherever ids
    carry a date or sequence — while presenting the result as current.

Both shapes pass against a mocked Firestore, so these tests pin the query
itself: bounded by a timestamp cutoff and ordered descending on the same field
the range filter uses ('date' for health_data, 'timestamp' for moods). The
index test exists because mocks never raise FAILED_PRECONDITION.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_ID = 'testuser1234567890ab'  # the id conftest's mocked JWT resolves to


def _iso(days_ago: float) -> str:
    return (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()


class _FakeDoc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    def to_dict(self):
        return dict(self._data)


class _FakeQuery:
    """Records how a query was built, then applies it like Firestore would.

    Documents are held as (id, data) pairs and default to __name__ order, which
    is what an unordered query actually returns — the detail that let the stale
    read go unnoticed.
    """

    def __init__(self, docs, calls):
        self._docs = docs
        self.calls = calls

    def where(self, filter=None, **_kwargs):  # noqa: A002 - Firestore's kwarg name
        self.calls['filters'].append((filter.field_path, filter.op_string, filter.value))
        return self

    def order_by(self, field_path, direction='ASCENDING'):
        self.calls['order_by'].append((field_path, direction))
        return self

    def limit(self, count):
        self.calls['limit'].append(count)
        return self

    def stream(self):
        docs = sorted(self._docs)  # __name__ order, Firestore's default
        for field, op, value in self.calls['filters']:
            if op == '==':
                docs = [(i, d) for i, d in docs if d.get(field) == value]
            elif op == '>=':
                docs = [(i, d) for i, d in docs
                        if d.get(field) is not None and d.get(field) >= value]
            else:  # pragma: no cover - the route uses only == and >=
                raise AssertionError(f'unexpected operator {op!r}')
        for field, direction in reversed(self.calls['order_by']):
            docs.sort(key=lambda pair: pair[1].get(field) or '',
                      reverse=direction == 'DESCENDING')
        for count in self.calls['limit']:
            docs = docs[:count]
        return [_FakeDoc(doc_id, data) for doc_id, data in docs]


class _FakeDb:
    """Documents are keyed in the order they were written, as live ids are."""

    def __init__(self, docs_by_collection):
        self._docs = {
            name: [(f'doc-{i:06d}', doc) for i, doc in enumerate(docs)]
            for name, docs in docs_by_collection.items()
        }
        self.queries = {}

    def collection(self, name):
        calls = {'filters': [], 'order_by': [], 'limit': []}
        self.queries[name] = calls
        return _FakeQuery(self._docs.get(name, []), calls)


def _health(days_ago, steps=9000):
    return {'user_id': USER_ID, 'date': _iso(days_ago), 'steps': steps,
            'sleep_hours': 7.5, 'heart_rate': 65, 'calories': 2100}


def _mood(days_ago, score=7):
    return {'user_id': USER_ID, 'timestamp': _iso(days_ago), 'mood_score': score}


@pytest.fixture
def analyze(client, auth_csrf_headers, mock_auth_service, mocker):
    """POST /health/analyze against a fake Firestore; returns (response, db, seen)."""
    from src.routes import integration_routes

    seen = {}
    service = integration_routes.health_analytics_service
    real_analyze = service.analyze_health_mood_correlation

    def _capture(health_data, mood_data):
        seen['health_data'] = health_data
        seen['mood_data'] = mood_data
        return real_analyze(health_data=health_data, mood_data=mood_data)

    mocker.patch.object(service, 'analyze_health_mood_correlation', side_effect=_capture)

    def _run(health_docs=(), mood_docs=(), payload=None):
        fake_db = _FakeDb({'health_data': list(health_docs), 'moods': list(mood_docs)})
        mocker.patch.object(integration_routes, 'db', fake_db)
        response = client.post(
            '/api/integration/health/analyze',
            json=payload if payload is not None else {},
            headers=auth_csrf_headers,
        )
        return response, fake_db, seen

    return _run


class TestAnalyzeQueryWindow:
    def test_queries_are_bounded_by_a_timestamp_cutoff(self, analyze):
        response, fake_db, _ = analyze(
            health_docs=[_health(1), _health(200)],
            mood_docs=[_mood(1), _mood(200)],
            payload={'days': 7},
        )

        assert response.status_code == 200
        expected_cutoff = datetime.now(UTC) - timedelta(days=7)

        for collection, field in (('health_data', 'date'), ('moods', 'timestamp')):
            filters = fake_db.queries[collection]['filters']
            ranges = [f for f in filters if f[0] == field]
            assert ranges, f'{collection} is not filtered on {field}'
            _, op, value = ranges[0]
            assert op == '>='
            cutoff = datetime.fromisoformat(value)
            assert abs((cutoff - expected_cutoff).total_seconds()) < 60, (
                f'{collection} cutoff {cutoff} is not ~7 days back'
            )
            # The user filter must survive alongside the new range filter.
            assert ('user_id', '==', USER_ID) in filters

    def test_queries_are_ordered_newest_first_on_the_filtered_field(self, analyze):
        _, fake_db, _ = analyze(health_docs=[_health(1)], mood_docs=[_mood(1)])

        # Firestore requires the first order_by to match the range filter's
        # field; DESCENDING is what makes the newest entries the ones read.
        assert fake_db.queries['health_data']['order_by'][0] == ('date', 'DESCENDING')
        assert fake_db.queries['moods']['order_by'][0] == ('timestamp', 'DESCENDING')

    def test_days_is_not_used_as_a_document_limit(self, analyze):
        # Three days of history, three entries per day: the old .limit(days)
        # would have cut this to 3 documents per collection.
        health_docs = [_health(day + hour / 24) for day in range(3) for hour in (1, 9, 17)]
        mood_docs = [_mood(day + hour / 24) for day in range(3) for hour in (2, 10, 18)]

        response, fake_db, _ = analyze(health_docs, mood_docs, payload={'days': 3})

        assert response.status_code == 200
        assert response.get_json()['data']['data_points'] == {
            'health_entries': 9,
            'mood_entries': 9,
        }
        for collection in ('health_data', 'moods'):
            assert 3 not in fake_db.queries[collection]['limit'], (
                f'{collection} still limits by the day count'
            )

    def test_recent_entries_are_analysed_not_the_oldest_ones(self, analyze):
        # A year of history, written oldest-first as it accumulates in real use
        # — far more documents than the 30-day default window. Read in
        # __name__ order the analysis would see the oldest year-old entries.
        response, _, seen = analyze(
            health_docs=[_health(d) for d in reversed(range(365))],
            mood_docs=[_mood(d) for d in reversed(range(365))],
        )

        assert response.status_code == 200
        window_start = datetime.now(UTC) - timedelta(days=31)
        analysed = [datetime.fromisoformat(e['date']) for e in seen['health_data']]
        assert analysed, 'no health data reached the analysis'
        assert min(analysed) >= window_start, 'stale entries outside the window were analysed'
        assert max(analysed) >= datetime.now(UTC) - timedelta(days=2), (
            'the newest entry was not analysed'
        )
        assert len(seen['mood_data']) <= 31

    def test_read_volume_stays_capped(self, analyze):
        from src.routes.integration_routes import MAX_ANALYSIS_ENTRIES

        _, fake_db, _ = analyze(health_docs=[_health(1)], mood_docs=[_mood(1)])

        for collection in ('health_data', 'moods'):
            assert fake_db.queries[collection]['limit'] == [MAX_ANALYSIS_ENTRIES]

    @pytest.mark.parametrize('days', [0, -5, 4000, 'thirty', None])
    def test_out_of_range_days_is_rejected(self, analyze, days):
        response, _, _ = analyze(payload={'days': days})

        assert response.status_code == 400


class TestAnalyzeIndexCoverage:
    """Mocked Firestore never raises FAILED_PRECONDITION, so assert the file."""

    @pytest.mark.parametrize(
        ('collection', 'field'),
        [('health_data', 'date'), ('moods', 'timestamp')],
    )
    def test_composite_index_is_declared(self, collection, field):
        with open(REPO_ROOT / 'firestore.indexes.json', encoding='utf-8') as f:
            indexes = json.load(f)['indexes']

        wanted = [
            {'fieldPath': 'user_id', 'order': 'ASCENDING'},
            {'fieldPath': field, 'order': 'DESCENDING'},
        ]
        assert any(
            idx['collectionGroup'] == collection and idx['fields'] == wanted
            for idx in indexes
        ), f'no ({collection}: user_id ==, {field} DESC) index — the query will fail live'
