"""Tests for what the real-time crisis monitor offers a user, and where it
sends the alert.

crisis_monitor sat at 46%. Two things in it are worth pinning.

The intervention payloads are the literal thing a person in crisis is shown
mid-conversation — the buttons offering 112 and Krisjouren. A typo in a number
here means someone reaching for help dials nothing, and no type checker or
linter would notice.

And _escalate_crisis used to call the escalation service directly and discard
the result, which is the exact loss mode the durable queue exists to prevent.
It routes through the queue now; these make sure it stays that way.
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from src.services.crisis_monitor import CrisisMonitorWebSocket, SessionContext

# The numbers a Swedish user in crisis needs. 112 is emergency services;
# 90101 is Mind's Självmordslinjen.
EMERGENCY_NUMBER = '112'
CRISIS_LINE_NUMBER = '90101'


@pytest.fixture
def monitor():
    return CrisisMonitorWebSocket(socketio=None)


def phone_numbers(intervention: dict) -> set[str]:
    return {
        action['number']
        for action in intervention['actions']
        if action.get('type') == 'phone'
    }


class TestCriticalIntervention:
    def test_it_offers_emergency_services(self, monitor):
        assert EMERGENCY_NUMBER in phone_numbers(monitor._get_critical_intervention())

    def test_it_offers_the_crisis_line(self, monitor):
        assert CRISIS_LINE_NUMBER in phone_numbers(monitor._get_critical_intervention())

    def test_it_says_the_person_is_not_alone(self, monitor):
        # The wording is the intervention. Losing this line turns a message
        # written for someone in crisis into a menu.
        assert 'inte ensam' in monitor._get_critical_intervention()['content']

    def test_it_offers_something_to_do_right_now(self, monitor):
        # Not everyone in crisis will phone anyone. There has to be a door
        # that is not a call.
        actions = monitor._get_critical_intervention()['actions']
        assert any(a.get('type') == 'exercise' for a in actions)


class TestHighRiskIntervention:
    def test_it_still_offers_a_human(self, monitor):
        assert CRISIS_LINE_NUMBER in phone_numbers(monitor._get_high_risk_intervention())

    def test_it_does_not_dial_112_for_a_non_emergency(self, monitor):
        # Pointing someone at emergency services when they are struggling but
        # not in danger is how people stop reaching out at all.
        assert EMERGENCY_NUMBER not in phone_numbers(monitor._get_high_risk_intervention())

    def test_it_points_at_the_safety_plan(self, monitor):
        ids = {a['id'] for a in monitor._get_high_risk_intervention()['actions']}
        assert 'safety_plan' in ids


class TestActionsAreRenderable:
    """The client renders these blind. A missing field is a button that does
    nothing, shown to someone who needed it to work."""

    @pytest.mark.parametrize("getter", ['_get_critical_intervention', '_get_high_risk_intervention'])
    def test_every_action_has_what_the_client_needs(self, monitor, getter):
        intervention = getattr(monitor, getter)()

        assert intervention['type']
        assert intervention['content'].strip()
        assert intervention['actions']

        for action in intervention['actions']:
            assert action['id']
            assert action['label'].strip()
            assert action['type']

    @pytest.mark.parametrize("getter", ['_get_critical_intervention', '_get_high_risk_intervention'])
    def test_every_phone_action_actually_has_a_number(self, monitor, getter):
        for action in getattr(monitor, getter)()['actions']:
            if action.get('type') == 'phone':
                assert action.get('number'), f"{action['id']} offers a call with no number"
                assert action['number'].isdigit()

    @pytest.mark.parametrize("getter", ['_get_critical_intervention', '_get_high_risk_intervention'])
    def test_action_ids_are_unique(self, monitor, getter):
        ids = [a['id'] for a in getattr(monitor, getter)()['actions']]
        assert len(ids) == len(set(ids))

    def test_critical_is_not_a_quieter_offer_than_high_risk(self, monitor):
        # If these ever invert, the more serious state offers less help.
        critical = monitor._get_critical_intervention()
        high = monitor._get_high_risk_intervention()
        assert len(phone_numbers(critical)) >= len(phone_numbers(high))


class TestEscalationGoesThroughTheDurableQueue:
    def _session(self):
        return SessionContext(
            user_id='testuser1234567890ab',
            session_id='session-1',
            started_at=datetime.now(UTC),
            messages=[{'role': 'user', 'content': 'jag orkar inte mer'}],
        )

    def _risk(self, level='critical'):
        risk = MagicMock()
        risk.risk_level = level
        risk.semantic_score = 0.95
        risk.semantic_indicators = ['suicidal']
        return risk

    @pytest.mark.asyncio
    async def test_the_alert_is_enqueued_not_sent_directly(self, monitor):
        # Calling the escalation service inline and discarding the result is
        # the loss mode the queue was built to remove: a worker recycle
        # mid-call drops the alert with no retry and no alarm.
        with patch('src.services.crisis_task_queue.enqueue_crisis_escalation') as enqueue:
            await monitor._escalate_crisis(self._session(), self._risk())

        enqueue.assert_called_once()

    @pytest.mark.asyncio
    async def test_the_queued_alert_carries_the_risk(self, monitor):
        with patch('src.services.crisis_task_queue.enqueue_crisis_escalation') as enqueue:
            await monitor._escalate_crisis(self._session(), self._risk())

        alert = enqueue.call_args.args[0]
        assert alert.risk_level == 'critical'
        assert alert.requires_immediate_action is True
        assert alert.user_id == 'testuser1234567890ab'

    @pytest.mark.asyncio
    async def test_high_risk_is_not_marked_immediate(self, monitor):
        with patch('src.services.crisis_task_queue.enqueue_crisis_escalation') as enqueue:
            await monitor._escalate_crisis(self._session(), self._risk('high'))

        assert enqueue.call_args.args[0].requires_immediate_action is False

    @pytest.mark.asyncio
    async def test_a_session_with_no_messages_does_not_crash(self, monitor):
        session = self._session()
        session.messages = []

        with patch('src.services.crisis_task_queue.enqueue_crisis_escalation') as enqueue:
            await monitor._escalate_crisis(session, self._risk())

        assert enqueue.call_args.args[0].text_snippet == ''

    @pytest.mark.asyncio
    async def test_an_unavailable_queue_is_logged_as_critical(self, monitor, caplog):
        # If the alert cannot even be queued, that has to be loud. Silence
        # here means a crisis nobody will ever look at.
        from src.services.crisis_task_queue import CrisisQueueUnavailableError

        with patch('src.services.crisis_task_queue.enqueue_crisis_escalation',
                   side_effect=CrisisQueueUnavailableError('firestore down')):
            with caplog.at_level('CRITICAL'):
                await monitor._escalate_crisis(self._session(), self._risk())

        assert any(record.levelname == 'CRITICAL' for record in caplog.records)
