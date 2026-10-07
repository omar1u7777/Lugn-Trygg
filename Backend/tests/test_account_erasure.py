"""Erasure of accounts whose deletion grace period has passed.

DELETE /auth/delete-account wrote `hard_delete_after` 30 days out and promised
permanent removal; nothing read the field, so closed accounts kept all their
data indefinitely. These pin the job that now honours it, and the support-side
restore that the 30 days exist for.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from src.services import account_erasure
from src.services.account_erasure import erase_due_accounts, find_due_accounts, restore_account

NOW = datetime(2026, 10, 7, 5, 0, tzinfo=UTC)


def _doc(doc_id, **data):
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = data
    return doc


def _closed(doc_id, days_ago_due, reason='user_requested'):
    return _doc(
        doc_id,
        is_active=False,
        deletion_reason=reason,
        deleted_at=(NOW - timedelta(days=30 + days_ago_due)).isoformat(),
        hard_delete_after=(NOW - timedelta(days=days_ago_due)).isoformat(),
    )


def _db_with(*docs):
    db = MagicMock()
    db.collection.return_value.where.return_value.stream.return_value = list(docs)
    return db


class UserNotFoundError(Exception):
    """Stands in for firebase_admin.auth.UserNotFoundError (matched by name)."""


class TestWhichAccountsAreDue:
    def test_past_grace_period_is_due(self):
        assert find_due_accounts(_db_with(_closed('gone-user', days_ago_due=1)), NOW) == ['gone-user']

    def test_inside_grace_period_is_not(self):
        assert find_due_accounts(_db_with(_closed('fresh-user', days_ago_due=-5)), NOW) == []

    def test_inactive_for_another_reason_is_never_erased(self):
        # A suspended or admin-disabled account is not a deletion request.
        assert find_due_accounts(_db_with(_closed('banned-user', 10, reason='admin_suspended')), NOW) == []

    def test_unreadable_date_is_skipped_not_guessed(self):
        doc = _doc('odd-user', is_active=False, deletion_reason='user_requested', hard_delete_after='soon')
        assert find_due_accounts(_db_with(doc), NOW) == []

    def test_naive_and_z_suffixed_timestamps_are_read_as_utc(self):
        naive = _doc('naive-user', is_active=False, deletion_reason='user_requested',
                     hard_delete_after=(NOW - timedelta(hours=1)).replace(tzinfo=None).isoformat())
        zulu = _doc('zulu-user', is_active=False, deletion_reason='user_requested',
                    hard_delete_after='2026-10-01T00:00:00Z')
        assert find_due_accounts(_db_with(naive, zulu), NOW) == ['naive-user', 'zulu-user']


class TestErasure:
    def _run(self, docs, auth=None, purge=None):
        auth = auth or MagicMock()
        purge = purge or MagicMock()
        with patch('src.firebase_config.db', _db_with(*docs)), \
             patch('src.firebase_config.auth', auth), \
             patch('src.routes.privacy_routes.purge_user_data', purge):
            result = erase_due_accounts(NOW)
        return result, auth, purge

    def test_due_account_loses_sign_in_and_data(self):
        result, auth, purge = self._run([_closed('gone-user', 1), _closed('fresh-user', -3)])

        assert result == {'success': True, 'erased': 1, 'failed': 0}
        auth.delete_user.assert_called_once_with('gone-user')
        purge.assert_called_once_with('gone-user')

    def test_sign_in_record_goes_before_the_data(self):
        # purge_user_data deletes the profile, which is what finds the account
        # next night; the e-mail in Firebase Auth must not outlive it.
        order = []
        auth = MagicMock()
        auth.delete_user.side_effect = lambda uid: order.append('auth')
        purge = MagicMock(side_effect=lambda uid: order.append('purge'))

        self._run([_closed('gone-user', 1)], auth=auth, purge=purge)
        assert order == ['auth', 'purge']

    def test_a_failed_auth_delete_keeps_the_account_queued(self):
        auth = MagicMock()
        auth.delete_user.side_effect = RuntimeError('quota')
        result, _, purge = self._run([_closed('gone-user', 1)], auth=auth)

        purge.assert_not_called()
        assert result['success'] is False
        assert result['failed'] == 1

    def test_an_already_deleted_sign_in_counts_as_done(self):
        auth = MagicMock()
        auth.delete_user.side_effect = UserNotFoundError('gone')
        result, _, purge = self._run([_closed('gone-user', 1)], auth=auth)

        purge.assert_called_once_with('gone-user')
        assert result['success'] is True

    def test_one_failure_does_not_stop_the_rest(self):
        purge = MagicMock(side_effect=[RuntimeError('firestore'), None])
        result, _, _ = self._run([_closed('first-user', 2), _closed('second-user', 1)], purge=purge)

        assert purge.call_count == 2
        assert result == {
            'success': False, 'erased': 1, 'failed': 1,
            'error': '1 account(s) could not be erased: first-us',
        }

    def test_no_database_reports_failure(self):
        with patch('src.firebase_config.db', None):
            assert erase_due_accounts(NOW)['success'] is False


class TestRestore:
    def _db(self, **data):
        db = MagicMock()
        snap = MagicMock(exists=bool(data))
        snap.to_dict.return_value = data
        db.collection.return_value.document.return_value.get.return_value = snap
        return db

    def _restore(self, db, auth=None):
        auth = auth or MagicMock()
        auth.update_user.return_value = SimpleNamespace(email='anna@example.se')
        with patch('src.firebase_config.db', db), patch('src.firebase_config.auth', auth), \
             patch('src.services.audit_service.audit_log'):
            return restore_account('user-1'), auth

    def test_reopens_inside_the_grace_period(self):
        db = self._db(is_active=False, deletion_reason='user_requested',
                      hard_delete_after=(datetime.now(UTC) + timedelta(days=10)).isoformat(),
                      email='deleted_user-1@anonymized.local')
        result, auth = self._restore(db)

        auth.update_user.assert_called_once_with('user-1', disabled=False)
        update = db.collection.return_value.document.return_value.update.call_args[0][0]
        assert update['is_active'] is True
        assert update['email'] == 'anna@example.se'
        assert set(account_erasure.DELETION_MARKER_FIELDS) <= set(update)
        assert result['email'] == 'anna@example.se'

    def test_refuses_after_the_grace_period(self):
        db = self._db(is_active=False, deletion_reason='user_requested',
                      hard_delete_after=(datetime.now(UTC) - timedelta(days=1)).isoformat())
        with pytest.raises(ValueError, match='grace period'):
            self._restore(db)

    def test_refuses_an_account_that_was_not_closed_by_its_owner(self):
        db = self._db(is_active=False, deletion_reason='admin_suspended')
        with pytest.raises(ValueError, match='not closed by its owner'):
            self._restore(db)

    def test_refuses_an_erased_account(self):
        with pytest.raises(LookupError):
            self._restore(self._db())


class TestTheNightlyRunAlertsOnFailure:
    def _run(self, result):
        from src.services.insight_scheduler import InsightNotificationScheduler

        with patch('src.services.account_erasure.erase_due_accounts', return_value=result), \
             patch('src.utils.telemetry.telemetry') as telemetry:
            InsightNotificationScheduler()._run_account_erasure()
        return telemetry

    def test_failure_pages(self):
        telemetry = self._run({'success': False, 'erased': 0, 'failed': 2, 'error': 'x'})
        assert telemetry.critical.call_args[0][0] == 'account_erasure_failed'
        assert not telemetry.event.called

    def test_success_reports_completion(self):
        telemetry = self._run({'success': True, 'erased': 3, 'failed': 0})
        assert not telemetry.critical.called
        assert telemetry.event.call_args[0][0] == 'account_erasure_completed'
