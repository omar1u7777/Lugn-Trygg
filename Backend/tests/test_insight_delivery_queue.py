"""The insight push queue used to retry undeliverable insights forever.

_send_notification returned a bool, and _send_pending_notifications only ever
marked an insight when that bool was True. A user with no FCM token fails
identically in every window, so the insight was never marked and never left the
queue.

That is not merely wasted work. The queue is read with

    .where(status == 'pending').where(notification_sent == False).limit(100)

so once 100 permanently undeliverable insights accumulate they fill the entire
batch and no deliverable insight is ever reached again. Head-of-line blocking
with a countable horizon.

Observed in production on 2026-08-23: identical warning bursts at 08:15, 10:42,
14:20 and 16:47, each repeating the same ~9 user ids, one of them three times
per burst.

It reaches further than daily insights. trigger_immediate_insight writes its
high-urgency crisis check-in into this same queue, so a starved queue delays
the notification sent to someone the crisis detector just flagged.
"""

from unittest.mock import MagicMock, patch

import pytest

from src.services.insight_scheduler import InsightNotificationScheduler


@pytest.fixture
def scheduler():
    return InsightNotificationScheduler()


def _insight_doc(doc_id: str, user_id: str):
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {
        'insight_id': doc_id,
        'user_id': user_id,
        'title': 'Insikt',
        'message': 'text',
        'urgency': 'low',
    }
    return doc


def _user_doc(exists: bool, fcm_token: str | None):
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = {'fcm_token': fcm_token} if exists else {}
    return doc


def _run_window(scheduler, insights, user_doc, send_effect=None):
    """Run one delivery window and report what the queue did with each insight.

    `send_effect` overrides firebase messaging.send, and has to be explicit:
    firebase_admin is mocked in this environment, so an un-patched send
    SUCCEEDS and every insight would look delivered.
    """
    query = MagicMock()
    query.where.return_value = query
    query.limit.return_value = query
    query.stream.return_value = iter(insights)

    generator = MagicMock()

    def collection(name):
        if name == 'insights':
            return query
        users = MagicMock()
        users.document.return_value.get.return_value = user_doc
        return users

    with patch('src.services.insight_scheduler.db') as db, \
         patch('src.services.insight_scheduler.get_insight_generator', return_value=generator), \
         patch.object(scheduler, '_is_optimal_time', return_value=True), \
         patch('firebase_admin.messaging.send') as send:
        if send_effect is not None:
            send.side_effect = send_effect
        db.collection.side_effect = collection
        scheduler._send_pending_notifications()

    return generator


class TestAnUndeliverableInsightLeavesTheQueue:
    def test_a_user_with_no_fcm_token_is_retired(self, scheduler):
        """The exact production case: same ids, every window, forever."""
        generator = _run_window(
            scheduler,
            [_insight_doc('i1', 'u1')],
            _user_doc(exists=True, fcm_token=None),
        )

        generator.mark_insight_undeliverable.assert_called_once()
        assert generator.mark_insight_undeliverable.call_args.args[0] == 'i1'
        generator.mark_insight_sent.assert_not_called()

    def test_a_deleted_user_is_retired(self, scheduler):
        """No future window can deliver to a user who no longer exists."""
        generator = _run_window(
            scheduler,
            [_insight_doc('i2', 'gone')],
            _user_doc(exists=False, fcm_token=None),
        )

        generator.mark_insight_undeliverable.assert_called_once()
        assert generator.mark_insight_undeliverable.call_args.args[0] == 'i2'

    def test_retiring_does_not_claim_the_notification_was_sent(self, scheduler):
        """mark_insight_sent would record a delivery that never happened."""
        generator = _run_window(
            scheduler,
            [_insight_doc('i3', 'u3')],
            _user_doc(exists=True, fcm_token=None),
        )

        generator.mark_insight_sent.assert_not_called()

    def test_every_undeliverable_insight_in_a_batch_is_retired(self, scheduler):
        """The starvation itself: a batch of these must not survive a window.

        With batch_size = 100, leaving them costs one queue slot each. Retiring
        every one of them is what keeps the horizon from being reached.
        """
        generator = _run_window(
            scheduler,
            [_insight_doc(f'i{n}', f'u{n}') for n in range(5)],
            _user_doc(exists=True, fcm_token=None),
        )

        assert generator.mark_insight_undeliverable.call_count == 5


class TestATransientFailureStaysInTheQueue:
    def test_a_send_error_is_not_retired(self, scheduler):
        """Retiring on a transient fault would discard a deliverable insight.

        This is why the outcome has three values rather than two: 'failed' and
        'can never succeed' need opposite handling.
        """
        generator = _run_window(
            scheduler,
            [_insight_doc('i4', 'u4')],
            _user_doc(exists=True, fcm_token='tok_123'),
            send_effect=RuntimeError('FCM unavailable'),
        )

        generator.mark_insight_undeliverable.assert_not_called()
        generator.mark_insight_sent.assert_not_called()

    def test_a_successful_send_is_marked_sent(self, scheduler):
        """The path that must keep working, pinned beside the two that changed."""
        generator = _run_window(
            scheduler,
            [_insight_doc('i5', 'u5')],
            _user_doc(exists=True, fcm_token='tok_123'),
        )

        generator.mark_insight_sent.assert_called_once_with('i5')
        generator.mark_insight_undeliverable.assert_not_called()

    def test_the_three_outcomes_are_distinct(self, scheduler):
        """A bool cannot express the distinction this queue depends on."""
        assert len({
            scheduler.DELIVERED,
            scheduler.UNDELIVERABLE,
            scheduler.DEFERRED,
        }) == 3
