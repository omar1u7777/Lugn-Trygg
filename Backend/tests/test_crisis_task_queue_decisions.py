"""Tests for what the crisis task queue decides after an escalation attempt.

This is the layer directly downstream of crisis_escalation. The escalation
service is careful to report success only when a human was actually reached
(see test_crisis_escalation_delivery.py) — but that care is worth nothing if
the queue then marks the task completed anyway.

So these cover the queue's verdict, not its plumbing: what it writes when an
escalation succeeds, fails, times out, or comes back malformed, and whether an
exhausted crisis stays visible instead of quietly disappearing.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from src.services import crisis_task_queue as queue_module
from src.services.crisis_task_queue import (
    BASE_RETRY_DELAY_SECONDS,
    CLAIM_LEASE_SECONDS,
    EXECUTION_TIMEOUT_SECONDS,
    MAX_ATTEMPTS,
    CrisisTaskWorker,
)


def make_task(attempts: int = 1) -> dict:
    return {
        'user_id': 'testuser1234567890ab',
        'risk_level': 'critical',
        'risk_score': 0.95,
        'detected_indicators': ['suicidal'],
        'text_snippet': 'jag orkar inte mer',
        'alert_timestamp': datetime.now(UTC),
        'requires_immediate_action': True,
        'attempts': attempts,
    }


class Escalation:
    """Stand-in for EscalationResult."""

    def __init__(self, success, channels=(), failures=()):
        self.success = success
        self.channels_used = [MagicMock(value=c) for c in channels]
        self.failures = list(failures)


@pytest.fixture
def worker():
    q = CrisisTaskWorker()
    q.worker_id = 'worker-1'
    return q


def run_task(worker, escalation_outcome, task=None):
    """Execute one attempt and return the payload the queue tried to write."""
    written = {}

    def capture(db, doc_id, worker_id, update_payload):
        written.update(update_payload)
        return True

    service = MagicMock()
    if isinstance(escalation_outcome, Exception):
        async def _raise(_alert):
            raise escalation_outcome
        service.escalate = _raise
    else:
        async def _return(_alert):
            return escalation_outcome
        service.escalate = _return

    worker._finalize_if_still_owned = capture

    with patch.object(queue_module, 'get_crisis_escalation_service', return_value=service, create=True), \
         patch('src.services.crisis_escalation.get_crisis_escalation_service', return_value=service), \
         patch.object(queue_module, 'telemetry', MagicMock(), create=True):
        worker._execute_task(MagicMock(), 'task-1', task or make_task())

    return written


class TestTheVerdictFollowsTheEscalation:
    def test_a_delivered_escalation_completes_the_task(self, worker):
        written = run_task(worker, Escalation(True, channels=['sms']))

        assert written['status'] == 'completed'
        assert written['channels_used'] == ['sms']

    def test_an_undelivered_escalation_does_not_complete_the_task(self, worker):
        # crisis_escalation reports success=False when only the dashboard was
        # written. Completing here would close a crisis nobody saw.
        written = run_task(worker, Escalation(False, channels=['dashboard']))

        assert written['status'] != 'completed'
        assert written['status'] == 'pending'

    def test_a_malformed_result_is_treated_as_failure(self, worker):
        # getattr(result, "success", False) — an object without the attribute
        # must fall to the safe side rather than look delivered.
        written = run_task(worker, object())

        assert written['status'] != 'completed'

    def test_a_timeout_is_a_failure_not_a_delivery(self, worker):
        written = run_task(worker, TimeoutError())

        assert written['status'] != 'completed'
        assert 'timed out' in written['last_error']

    def test_an_exception_is_a_failure_not_a_delivery(self, worker):
        written = run_task(worker, RuntimeError('twilio exploded'))

        assert written['status'] != 'completed'
        assert 'twilio exploded' in written['last_error']


class TestRetryAndExhaustion:
    def test_a_failed_attempt_is_rescheduled(self, worker):
        written = run_task(worker, Escalation(False), task=make_task(attempts=1))

        assert written['status'] == 'pending'
        assert written['next_attempt_at'] is not None

    @pytest.mark.parametrize("attempts,expected_delay", [
        (1, BASE_RETRY_DELAY_SECONDS),
        (2, BASE_RETRY_DELAY_SECONDS * 2),
        (3, BASE_RETRY_DELAY_SECONDS * 4),
    ])
    def test_the_backoff_grows(self, worker, attempts, expected_delay):
        before = datetime.now(UTC)
        written = run_task(worker, Escalation(False), task=make_task(attempts=attempts))

        delay = (written['next_attempt_at'] - before).total_seconds()
        assert expected_delay - 1 <= delay <= expected_delay + 2

    def test_the_last_attempt_fails_the_task_rather_than_retrying_forever(self, worker):
        written = run_task(worker, Escalation(False), task=make_task(attempts=MAX_ATTEMPTS))

        assert written['status'] == 'failed'
        assert written['failed_at'] is not None

    def test_a_terminal_task_stops_being_due(self, worker):
        # Firestore range queries exclude null fields; leaving next_attempt_at
        # set would keep re-serving a task nobody will retry.
        for outcome, attempts in ((Escalation(True, ['sms']), 1), (Escalation(False), MAX_ATTEMPTS)):
            written = run_task(worker, outcome, task=make_task(attempts=attempts))
            assert written['next_attempt_at'] is None
            assert written['lease_expires_at'] is None

    def test_an_exhausted_crisis_keeps_its_reason(self, worker):
        # Someone has to be able to see why nobody was reached.
        written = run_task(worker, Escalation(False, failures=[('sms', 'no phone')]),
                           task=make_task(attempts=MAX_ATTEMPTS))

        assert written['last_error']


class TestReclaimedTasksAreNotClobbered:
    def test_a_reclaimed_task_is_left_alone(self, worker):
        # If another worker already finalized this task, a late write here
        # would flip a legitimate 'completed' back to 'pending' and send the
        # notifications a second time.
        worker._finalize_if_still_owned = MagicMock(return_value=False)
        service = MagicMock()

        async def _ok(_alert):
            return Escalation(True, ['sms'])
        service.escalate = _ok

        with patch('src.services.crisis_escalation.get_crisis_escalation_service', return_value=service), \
             patch.object(queue_module, 'telemetry', MagicMock(), create=True):
            worker._execute_task(MagicMock(), 'task-1', make_task())

        worker._finalize_if_still_owned.assert_called_once()


class TestTimingInvariants:
    def test_execution_cannot_outlive_its_lease(self):
        # The whole duplicate-execution race this module guards against comes
        # back the moment an attempt can still be in flight after the lease
        # expires and a second worker reclaims the task.
        assert EXECUTION_TIMEOUT_SECONDS < CLAIM_LEASE_SECONDS

    def test_retries_are_bounded(self):
        assert 1 < MAX_ATTEMPTS <= 10

    def test_the_backoff_never_outruns_a_crisis(self):
        # Total wait across all retries, worst case. A crisis escalation that
        # first reaches someone hours later is not an escalation.
        total = sum(BASE_RETRY_DELAY_SECONDS * (2 ** (i - 1)) for i in range(1, MAX_ATTEMPTS))
        assert total < 600, f"retries would span {total}s before giving up"
