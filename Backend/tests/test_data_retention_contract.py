"""Tests for the GDPR data retention contract.

data_retention_service is what deletes personal data once its retention period
expires. It sat at 27% — the least-covered service in the app, while being the
one that carries a legal obligation rather than a product one.

The bug that motivates most of this is recorded in the service's own comment:
'conversations' was missing from gdpr_retention_days, so the daily sweep
deleted everything EXCEPT the highest-sensitivity data, and verbatim therapy
transcripts accumulated indefinitely. Nothing failed, nothing logged — the
collection simply was not in the dictionary.

The same shape can happen in the other direction: a collection listed in the
config with no matching branch in _delete_expired_data would be swept every
day, delete nothing, and report success. Both directions are pinned below.
"""

from unittest.mock import MagicMock, call, patch

import pytest

from src.services.data_retention_service import DataRetentionService

SEVEN_YEARS_DAYS = 2555


@pytest.fixture
def service():
    return DataRetentionService()


class TestEveryConfiguredCollectionIsActuallyHandled:
    """The config and the delete logic are two lists that must agree. They are
    written 100 lines apart, and drift between them is silent."""

    # Every branch condition in _delete_expired_data, transcribed.
    HANDLED = {
        'moods', 'memories', 'chat_sessions', 'ai_conversations', 'conversations',
        'wellness_activities', 'achievements',      # subcollection branch
        'voice_recordings',                          # field-scrub branch
        'feedback', 'referrals',                     # root + user field branch
        'insights', 'journal_entries',               # native-timestamp branch
        'notifications',                             # notifications branch
    }

    def test_no_configured_collection_is_silently_skipped(self, service):
        configured = set(service.gdpr_retention_days)
        unhandled = configured - self.HANDLED
        assert not unhandled, (
            f"{unhandled} have a retention period but no branch in "
            "_delete_expired_data, so their data is never deleted"
        )

    def test_no_branch_exists_for_a_collection_nobody_configured(self, service):
        configured = set(service.gdpr_retention_days)
        orphaned = self.HANDLED - configured
        assert not orphaned, (
            f"{orphaned} can be deleted but have no retention period, so the "
            "sweep never reaches them"
        )

    def test_the_ai_transcripts_are_covered(self, service):
        # The exact collection whose absence let therapy transcripts pile up.
        assert 'conversations' in service.gdpr_retention_days

    def test_an_unknown_collection_deletes_nothing_rather_than_claiming_to(self, service):
        deleted = service._delete_expired_data('user-1', 'not_a_collection', 30)
        assert deleted == 0


class TestRetentionPeriods:
    CLINICAL = (
        'moods', 'memories', 'chat_sessions', 'conversations', 'journal_entries',
        'voice_recordings', 'insights', 'feedback', 'achievements', 'referrals',
        'wellness_activities', 'ai_conversations',
    )

    @pytest.mark.parametrize("collection", CLINICAL)
    def test_clinical_data_is_kept_the_full_seven_years(self, service, collection):
        # Deleting medical records early is its own compliance failure, not a
        # privacy win — HIPAA sets seven years as the minimum.
        assert service.gdpr_retention_days[collection] == SEVEN_YEARS_DAYS

    def test_notifications_are_not_treated_as_medical_records(self, service):
        # A push notification is not a clinical record and should not be kept
        # for seven years.
        assert service.gdpr_retention_days['notifications'] == 365

    def test_no_period_is_zero_or_negative(self, service):
        for collection, days in service.gdpr_retention_days.items():
            assert days > 0, f"{collection} would delete data immediately"


class TestOneFailureDoesNotStopTheSweep:
    def test_a_collection_that_raises_does_not_abort_the_others(self, service):
        # A single broken collection must not leave the rest of a user's
        # expired data in place: that turns one bug into a standing breach.
        calls = []

        def flaky(user_id, collection_name, retention_days):
            calls.append(collection_name)
            if collection_name == 'moods':
                raise RuntimeError('firestore unavailable')
            return 1

        service._delete_expired_data = flaky

        result = service._process_user_retention('user-1')

        assert len(calls) == len(service.gdpr_retention_days)
        # Everything except the failing one still counted.
        assert result['total_deleted'] == len(service.gdpr_retention_days) - 1

    def test_collections_with_nothing_to_delete_are_not_reported(self, service):
        service._delete_expired_data = MagicMock(return_value=0)

        result = service._process_user_retention('user-1')

        assert result['total_deleted'] == 0
        assert result['collections'] == []

    def test_each_reported_collection_says_what_it_deleted(self, service):
        service._delete_expired_data = MagicMock(return_value=3)

        result = service._process_user_retention('user-1')

        for entry in result['collections']:
            assert entry['deleted'] == 3
            assert entry['retention_days'] == service.gdpr_retention_days[entry['collection']]


class TestBatching:
    """Firestore rejects a batch over 500 writes, so a user with more expired
    documents than that must not lose the whole sweep to one rejected commit."""

    def _fake_db(self, doc_count):
        docs = [MagicMock() for _ in range(doc_count)]
        batch = MagicMock()
        db = MagicMock()
        db.batch.return_value = batch
        stream = MagicMock()
        stream.stream.return_value = docs
        db.collection.return_value.document.return_value.collection.return_value.where.return_value = stream
        return db, batch

    @pytest.mark.parametrize("doc_count,expected_commits", [
        (0, 0),
        (1, 1),
        (500, 1),
        (501, 2),
        (1200, 3),
    ])
    def test_commits_are_split_at_the_firestore_limit(self, service, doc_count, expected_commits):
        db, batch = self._fake_db(doc_count)

        with patch('src.services.data_retention_service.db', db):
            deleted = service._delete_expired_data('user-1', 'moods', SEVEN_YEARS_DAYS)

        assert deleted == doc_count
        assert batch.commit.call_count == expected_commits


class PagedUsers:
    """Builds a mock users collection that pages the way Firestore does."""

    @staticmethod
    def _doc(doc_id):
        d = MagicMock()
        d.id = doc_id
        return d

    def _paged_collection(self, pages):
        """Build a users collection whose .stream() returns `pages` in order.

        A page may be an Exception instance, meaning that page raises.
        """
        query = MagicMock()
        query.order_by.return_value = query
        query.limit.return_value = query
        query.start_after.return_value = query

        calls = iter(pages)

        def stream(**kwargs):
            # Production passes a deadline; a mock that refuses kwargs would
            # hide a regression that removed it.
            assert 'timeout' in kwargs, "every Firestore call must run on a deadline"
            assert kwargs['timeout'] > 0
            # An explicit retry keeps the library off its own gapic_callable
            # ._retry lookup, which is the line that raised
            # "'_UnaryStreamMultiCallable' object has no attribute '_retry'".
            assert kwargs.get('retry') is not None, "every call must carry an explicit retry"
            page = next(calls)
            if isinstance(page, Exception):
                raise page
            return iter([self._doc(i) for i in page])

        query.stream.side_effect = stream
        return query


class TestOneBrokenStreamDoesNotAbortTheWholeSweep(PagedUsers):
    """The user enumeration used to be a single lazy `.stream()` sitting
    outside every inner handler.

    Firestore streams are consumed lazily, so a mid-iteration failure surfaced
    in the caller's `for` loop, escaped the per-user and per-collection
    handlers, hit the top-level `except`, and abandoned every remaining user.

    It happened. On 2026-08-15 the sweep died with "'_UnaryStreamMultiCallable'
    object has no attribute '_retry'" — a google-cloud-firestore/grpcio
    incompatibility in the library's own stream-retry path, newly reachable
    once the missing composite indexes were deployed and the sweep finally got
    far enough to stream.
    """

    def test_pages_through_all_users(self, service):
        users = self._paged_collection([['u1', 'u2'], ['u3']])
        with patch('src.services.data_retention_service.db') as mock_db:
            mock_db.collection.return_value = users
            assert list(service._iter_user_ids(page_size=2)) == ['u1', 'u2', 'u3']

    def test_stops_cleanly_on_a_short_final_page(self, service):
        """A page shorter than the limit is the last one — do not query again."""
        users = self._paged_collection([['u1']])
        with patch('src.services.data_retention_service.db') as mock_db:
            mock_db.collection.return_value = users
            assert list(service._iter_user_ids(page_size=10)) == ['u1']
        assert users.stream.call_count == 1

    def test_a_failing_page_yields_what_it_read_then_raises(self, service):
        """Users read before the failure are still handed over — then it raises.

        Raising matters as much as yielding. Returning quietly would end the
        generator, which the caller cannot distinguish from reaching the last
        page, and the caller responds to that by CLEARING the resume cursor.
        A timed-out page would then look like a completed sweep.
        """
        from src.services.data_retention_service import RetentionEnumerationError

        boom = RuntimeError("'_UnaryStreamMultiCallable' object has no attribute '_retry'")
        users = self._paged_collection([['u1', 'u2'], boom])
        seen = []
        with patch('src.services.data_retention_service.db') as mock_db:
            mock_db.collection.return_value = users
            with pytest.raises(RetentionEnumerationError):
                for uid in service._iter_user_ids(page_size=2):
                    seen.append(uid)
        assert seen == ['u1', 'u2']

    def test_a_failing_first_page_raises_rather_than_looping(self, service):
        """Without an id to resume from, retrying would re-request forever."""
        from src.services.data_retention_service import RetentionEnumerationError

        users = self._paged_collection([RuntimeError('transport died')])
        with patch('src.services.data_retention_service.db') as mock_db:
            mock_db.collection.return_value = users
            with pytest.raises(RetentionEnumerationError):
                list(service._iter_user_ids(page_size=2))
        assert users.stream.call_count == 1

    def test_a_failed_enumeration_keeps_the_resume_cursor(self, service):
        """The position must survive, or the users after it are skipped again."""
        users = self._paged_collection([['u1'], RuntimeError('transport died')])
        with patch('src.services.data_retention_service.db') as mock_db,              patch.object(service, '_read_cursor', return_value=None),              patch.object(service, '_write_cursor') as write_cursor,              patch.object(service, '_process_user_retention',
                          return_value={'total_deleted': 0, 'collections': []}),              patch('src.services.data_retention_service.audit_service'):
            mock_db.collection.return_value = users
            service.USER_PAGE_SIZE = 1
            result = service.apply_retention_policy()

        assert result['success'] is False
        cleared = [c for c in write_cursor.call_args_list if c.args[0] is None]
        assert not cleared, "clearing the cursor would skip everyone after u1"


    def test_one_user_raising_does_not_stop_the_others(self, service):
        """Pre-existing guarantee — kept pinned now that enumeration changed."""
        users = self._paged_collection([['ok1', 'bad', 'ok2']])

        def per_user(uid):
            if uid == 'bad':
                raise RuntimeError('this user explodes')
            return {'total_deleted': 1, 'collections': [{'collection': 'moods'}]}

        with patch('src.services.data_retention_service.db') as mock_db, \
             patch.object(service, '_process_user_retention', side_effect=per_user), \
             patch('src.services.data_retention_service.audit_service'):
            mock_db.collection.return_value = users
            result = service.apply_retention_policy()

        assert result['success'] is True
        assert result['total_deleted'] == 2


class TestAFailedSweepAlertsInsteadOfReportingSuccess:
    """apply_retention_policy REPORTS failure, it does not raise.

    _run_data_retention's telemetry.critical sat in an `except` block that
    therefore could never fire. A sweep that crashed emitted
    "data_retention_completed, total_deleted=0" — the same signal a healthy
    sweep emits on a day when nothing had expired.

    That is why 17 days of failed GDPR deletion produced no alert. The verdict
    has to be read, the way the crisis queue reads escalate()'s success flag
    rather than trusting that the call returned.
    """

    def _run(self, retention_result):
        from src.services.insight_scheduler import InsightNotificationScheduler

        with patch(
            'src.services.data_retention_service.DataRetentionService.apply_retention_policy',
            return_value=retention_result,
        ), patch('src.utils.telemetry.telemetry') as telemetry:
            InsightNotificationScheduler()._run_data_retention()
        return telemetry

    def test_failure_emits_critical_and_no_completion_event(self):
        telemetry = self._run({
            'success': False,
            'error': "'_UnaryStreamMultiCallable' object has no attribute '_retry'",
            'total_deleted': 0,
            'collections_processed': [],
        })

        assert telemetry.critical.called, "a failed sweep must page, not log quietly"
        assert telemetry.critical.call_args[0][0] == 'data_retention_failed'

        completed = [c for c in telemetry.event.call_args_list
                     if c[0] and c[0][0] == 'data_retention_completed']
        assert completed == [], "a failed sweep must not report completion"

    def test_success_still_emits_the_completion_event(self):
        telemetry = self._run({
            'success': True,
            'total_deleted': 12,
            'collections_processed': [{'collection': 'notifications', 'deleted': 12}],
        })

        assert not telemetry.critical.called
        assert telemetry.event.call_args[0][0] == 'data_retention_completed'

    def test_a_healthy_sweep_that_deleted_nothing_is_not_an_alert(self):
        """Zero deletions is normal on a day when nothing had expired."""
        telemetry = self._run({
            'success': True,
            'total_deleted': 0,
            'collections_processed': [],
        })

        assert not telemetry.critical.called
        assert telemetry.event.call_args[0][0] == 'data_retention_completed'


class TestAKilledSweepStillMakesProgress(PagedUsers):
    """The sweep needs ~19.5 minutes and runs inside a Gunicorn worker that
    recycles on max_requests. Five consecutive nights:

        2026-08-19  died after 12.7 min, 6 pages
        2026-08-20  died after 12.8 min, 6 pages
        2026-08-21  COMPLETED in 19.4 min, 1499 users
        2026-08-22  worker recycled after 11.5 min, 5 pages
        2026-08-23  worker recycled after 14.4 min, 6 pages

    The 20-minute budget never fired once, not even on 08-23, which was the
    first night it ran in production. A budget can only stop a sweep that is
    still alive to read it. And since the resume position was written only on
    a clean stop, each of the four killed runs discarded every user it had
    processed; the next run began at the top and died in the same place.

    A killed process cannot log, so all three were indistinguishable from
    nothing happening at all.
    """

    def _sweep(self, service, users, *, page_size, interrupted=False):
        """Run a full sweep against `users`, with the durable state mocked."""
        with patch('src.services.data_retention_service.db') as mock_db,              patch.object(service, '_read_cursor', return_value=None),              patch.object(service, '_previous_run_was_interrupted', return_value=interrupted),              patch.object(service, '_write_cursor') as write_cursor,              patch.object(service, '_process_user_retention',
                          return_value={'total_deleted': 0, 'collections': []}),              patch('src.services.data_retention_service.audit_service'),              patch('src.utils.telemetry.telemetry') as telemetry:
            mock_db.collection.return_value = users
            service.USER_PAGE_SIZE = page_size
            result = service.apply_retention_policy()
        return result, write_cursor, telemetry

    def test_the_position_is_durable_before_the_sweep_ends(self, service):
        """The whole failure was that progress existed only in memory."""
        users = self._paged_collection([['u1', 'u2'], ['u3']])
        _, write_cursor, _ = self._sweep(service, users, page_size=2)

        assert write_cursor.call_args_list[0] == call('u2', in_progress=True),             "a sweep killed after u2 must resume at u2, not start over"

    def test_finishing_clears_the_position_and_the_flag(self, service):
        """Otherwise the next run would resume near the end and skip everyone."""
        users = self._paged_collection([['u1', 'u2'], ['u3']])
        result, write_cursor, _ = self._sweep(service, users, page_size=2)

        assert result['success'] is True
        assert write_cursor.call_args_list[-1] == call(None, in_progress=False)

    def test_an_unfinished_previous_run_is_reported(self, service):
        """The only trace a killed sweep leaves is the flag. Read it, or the
        silence stays indistinguishable from health."""
        users = self._paged_collection([['u1']])
        _, _, telemetry = self._sweep(service, users, page_size=2, interrupted=True)

        assert telemetry.critical.call_count == 1
        assert telemetry.critical.call_args.args[0] == 'data_retention_interrupted'

    def test_a_clean_previous_run_is_not_reported(self, service):
        """An alarm that fires every night is one nobody reads."""
        users = self._paged_collection([['u1']])
        _, _, telemetry = self._sweep(service, users, page_size=2, interrupted=False)

        assert telemetry.critical.call_count == 0

    def test_clearing_the_flag_leaves_the_position_alone(self, service):
        """End to end against one stored document, because the alarm reading
        what the checkpoint wrote is the entire mechanism — mocking both halves
        would pin nothing.

        _clear_in_progress runs on the path where enumeration failed, which is
        exactly the path whose promise is that the position survives untouched.
        """
        stored: dict = {}

        def _set(payload, merge=False):
            if not merge:
                stored.clear()
            stored.update(payload)

        snap = MagicMock()
        snap.exists = True
        snap.to_dict.side_effect = lambda: dict(stored)
        ref = MagicMock()
        ref.set.side_effect = _set
        ref.get.return_value = snap

        with patch('src.services.data_retention_service.db') as mock_db:
            mock_db.collection.return_value.document.return_value = ref

            service._write_cursor('u9', in_progress=True)
            assert service._previous_run_was_interrupted() is True
            assert service._read_cursor() == 'u9'

            service._clear_in_progress()
            assert service._previous_run_was_interrupted() is False
            assert service._read_cursor() == 'u9'
