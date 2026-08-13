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

from unittest.mock import MagicMock, patch

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
