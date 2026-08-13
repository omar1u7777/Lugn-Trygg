"""Tests for the crisis escalation delivery contract.

crisis_escalation is what actually reaches a human when someone is in crisis —
SMS to the user, email to their emergency contacts, a push notification. It sat
at 42% coverage with no test file of its own.

The contract these protect is stated in escalate()'s own docstring:

    a channel is appended to channels_used ONLY on confirmed delivery ...
    success requires at least one HUMAN channel delivered — never the dashboard
    write alone. This is what prevents the task queue from marking crisis tasks
    "completed" that no human ever saw.

A dashboard row nobody is looking at is not a rescue. If that invariant ever
breaks, a crisis task gets marked done while the person is still alone with it,
so it is tested from several directions rather than once.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.crisis_escalation import (
    CrisisAlert,
    CrisisEscalationService,
    EscalationChannel,
)


def make_alert(risk_level: str = 'critical', user_id: str = 'testuser1234567890ab') -> CrisisAlert:
    return CrisisAlert(
        user_id=user_id,
        risk_level=risk_level,
        risk_score=0.95,
        detected_indicators=['Nyckelord: ta livet av mig (suicidal)'],
        text_snippet='jag orkar inte mer',
        timestamp=datetime.now(UTC),
        requires_immediate_action=True,
    )


@pytest.fixture
def service():
    """A service with no real providers wired up."""
    with patch.object(CrisisEscalationService, '_init_twilio'), \
         patch.object(CrisisEscalationService, '_init_sendgrid'):
        svc = CrisisEscalationService()
    svc.twilio_client = None
    svc.sendgrid_client = None
    svc.twilio_phone = None
    return svc


def wire(service, *, sms=False, email_delivered=0, sms_delivered=0, push=False,
         dashboard=True, contacts=None, alert_id='alert-1'):
    """Point every outbound call at a stub with a known outcome."""
    service._persist_alert = AsyncMock(return_value=alert_id)
    service._get_user_data = AsyncMock(return_value={
        'phone': '+46700000000',
        'fcm_token': 'token',
        'emergency_contacts': contacts or [],
    })
    service._send_user_sms = AsyncMock(return_value=sms)
    service._notify_emergency_contacts = AsyncMock(return_value={
        'sms_delivered': sms_delivered,
        'email_delivered': email_delivered,
        'errors': [],
    })
    service._send_push_notification = AsyncMock(return_value=push)
    if dashboard:
        service._create_dashboard_alert = AsyncMock()
    else:
        service._create_dashboard_alert = AsyncMock(side_effect=RuntimeError('firestore down'))
    service._log_escalation = AsyncMock()
    service.has_any_human_channel_configured = MagicMock(return_value=True)
    return service


class TestDashboardIsNotARescue:
    @pytest.mark.asyncio
    async def test_dashboard_alone_is_not_success(self, service):
        # Every human channel skipped, dashboard written. The alert exists in a
        # database and has reached nobody.
        wire(service, sms=False, push=False, dashboard=True)

        result = await service.escalate(make_alert())

        assert result.success is False
        assert EscalationChannel.DASHBOARD in result.channels_used

    @pytest.mark.asyncio
    async def test_dashboard_is_not_in_the_human_channels(self, service):
        assert EscalationChannel.DASHBOARD not in service.HUMAN_CHANNELS

    @pytest.mark.asyncio
    @pytest.mark.parametrize("channel_kwargs", [
        {'sms': True},
        {'push': True},
        {'sms_delivered': 1, 'contacts': [{'name': 'Anna', 'phone': '+46700000001'}]},
        {'email_delivered': 1, 'contacts': [{'name': 'Anna', 'email': 'anna@example.com'}]},
    ])
    async def test_any_single_human_delivery_is_success(self, service, channel_kwargs):
        wire(service, **channel_kwargs)

        result = await service.escalate(make_alert())

        assert result.success is True


class TestSkippedChannelsAreRecorded:
    @pytest.mark.asyncio
    async def test_a_skipped_channel_becomes_a_failure_not_silence(self, service):
        # "We didn't send it" has to be visible, or the queue cannot tell the
        # difference between delivered and never attempted.
        wire(service, sms=False, push=False)

        result = await service.escalate(make_alert())

        failed = {channel for channel, _ in result.failures}
        assert EscalationChannel.SMS in failed
        assert EscalationChannel.PUSH in failed

    @pytest.mark.asyncio
    async def test_one_channel_raising_does_not_stop_the_others(self, service):
        wire(service, push=True)
        service._send_user_sms = AsyncMock(side_effect=RuntimeError('twilio exploded'))

        result = await service.escalate(make_alert())

        # The push still went out, so a human was still reached.
        assert result.success is True
        assert EscalationChannel.PUSH in result.channels_used
        assert any('twilio exploded' in reason for _, reason in result.failures)

    @pytest.mark.asyncio
    async def test_a_failing_dashboard_does_not_sink_a_delivered_alert(self, service):
        wire(service, sms=True, dashboard=False)

        result = await service.escalate(make_alert())

        assert result.success is True
        assert EscalationChannel.DASHBOARD not in result.channels_used


class TestNoChannelConfigured:
    @pytest.mark.asyncio
    async def test_it_fails_immediately_rather_than_pretending(self, service):
        wire(service)
        service.has_any_human_channel_configured = MagicMock(return_value=False)

        result = await service.escalate(make_alert())

        assert result.success is False
        assert any(reason == 'no_human_channel_configured' for _, reason in result.failures)

    @pytest.mark.asyncio
    async def test_the_alert_is_still_persisted(self, service):
        # The record has to survive even when nothing can be sent, or the
        # crisis vanishes entirely.
        wire(service)
        service.has_any_human_channel_configured = MagicMock(return_value=False)

        result = await service.escalate(make_alert())

        service._persist_alert.assert_awaited_once()
        assert result.alert_id == 'alert-1'

    @pytest.mark.asyncio
    async def test_it_does_not_attempt_any_send(self, service):
        wire(service)
        service.has_any_human_channel_configured = MagicMock(return_value=False)

        await service.escalate(make_alert())

        service._send_user_sms.assert_not_awaited()
        service._send_push_notification.assert_not_awaited()


class TestRiskLevelGating:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("risk_level", ['critical', 'high'])
    async def test_sms_is_attempted_for_serious_risk(self, service, risk_level):
        wire(service, sms=True)

        await service.escalate(make_alert(risk_level))

        service._send_user_sms.assert_awaited_once()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("risk_level", ['medium', 'low', 'none'])
    async def test_lower_risk_does_not_text_the_user(self, service, risk_level):
        # Texting someone about a crisis they are not in is its own harm.
        wire(service, push=True)

        await service.escalate(make_alert(risk_level))

        service._send_user_sms.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_lower_risk_does_not_contact_next_of_kin(self, service):
        wire(service, push=True, contacts=[{'name': 'Anna', 'phone': '+46700000001'}])

        await service.escalate(make_alert('medium'))

        service._notify_emergency_contacts.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_push_goes_out_at_every_risk_level(self, service):
        wire(service, push=True)

        await service.escalate(make_alert('low'))

        service._send_push_notification.assert_awaited_once()


class TestResultShape:
    @pytest.mark.asyncio
    async def test_channels_are_not_reported_twice(self, service):
        # SMS can be appended twice: once for the user, once for a contact.
        wire(service, sms=True, sms_delivered=1,
             contacts=[{'name': 'Anna', 'phone': '+46700000001'}])

        result = await service.escalate(make_alert())

        assert len(result.channels_used) == len(set(result.channels_used))

    @pytest.mark.asyncio
    async def test_a_crash_mid_escalation_still_returns_a_result(self, service):
        # Callers branch on result.success; an exception escaping here would
        # leave the queue with no verdict at all.
        wire(service)
        service._get_user_data = AsyncMock(side_effect=RuntimeError('firestore down'))

        result = await service.escalate(make_alert())

        assert result.success is False
        assert result.failures

    @pytest.mark.asyncio
    async def test_every_escalation_is_logged(self, service):
        wire(service, sms=True)

        await service.escalate(make_alert())

        service._log_escalation.assert_awaited_once()


class TestEmergencyContactAccounting:
    """_notify_emergency_contacts returns the per-channel counts that decide
    whether escalate() reports success, so its arithmetic is load-bearing."""

    @pytest.fixture
    def sms_service(self, service):
        service.twilio_client = MagicMock()
        service.twilio_phone = '+46700000000'
        service._twilio_create_message = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_counts_one_delivery_per_contact(self, sms_service):
        contacts = [
            {'name': 'Anna', 'phone': '+46700000001'},
            {'name': 'Bo', 'phone': '+46700000002'},
        ]

        result = await sms_service._notify_emergency_contacts(make_alert(), contacts)

        assert result['sms_delivered'] == 2
        assert result['errors'] == []

    @pytest.mark.asyncio
    async def test_one_failing_contact_does_not_block_the_next(self, sms_service):
        # The second person may be the one who actually picks up.
        sms_service._twilio_create_message = MagicMock(
            side_effect=[RuntimeError('invalid number'), None]
        )
        contacts = [
            {'name': 'Anna', 'phone': 'not-a-number'},
            {'name': 'Bo', 'phone': '+46700000002'},
        ]

        result = await sms_service._notify_emergency_contacts(make_alert(), contacts)

        assert result['sms_delivered'] == 1
        assert len(result['errors']) == 1

    @pytest.mark.asyncio
    async def test_a_contact_who_opted_out_of_sms_is_not_texted(self, sms_service):
        contacts = [{'name': 'Anna', 'phone': '+46700000001', 'notify_sms': False}]

        result = await sms_service._notify_emergency_contacts(make_alert(), contacts)

        assert result['sms_delivered'] == 0
        sms_service._twilio_create_message.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_contact_without_a_number_is_not_counted(self, sms_service):
        contacts = [{'name': 'Anna', 'email': 'anna@example.com'}]

        result = await sms_service._notify_emergency_contacts(make_alert(), contacts)

        assert result['sms_delivered'] == 0

    @pytest.mark.asyncio
    async def test_no_contacts_is_not_an_error(self, sms_service):
        result = await sms_service._notify_emergency_contacts(make_alert(), [])

        assert result == {'sms_delivered': 0, 'email_delivered': 0, 'errors': []}

    @pytest.mark.asyncio
    async def test_the_message_does_not_reveal_who_the_user_is(self, sms_service):
        # An emergency contact is not automatically entitled to know that this
        # specific named person is in crisis; the app says "Användaren".
        await sms_service._notify_emergency_contacts(
            make_alert(user_id='someone-identifiable'),
            [{'name': 'Anna', 'phone': '+46700000001'}],
        )

        body = sms_service._twilio_create_message.call_args.kwargs['body']
        assert 'someone-identifiable' not in body
        assert 'Användaren' in body

    @pytest.mark.asyncio
    async def test_critical_tells_the_contact_to_call_112(self, sms_service):
        await sms_service._notify_emergency_contacts(
            make_alert('critical'), [{'name': 'Anna', 'phone': '+46700000001'}]
        )

        body = sms_service._twilio_create_message.call_args.kwargs['body']
        assert '112' in body
        assert 'omedelbart' in body

    @pytest.mark.asyncio
    async def test_high_is_urgent_without_being_an_emergency_call(self, sms_service):
        await sms_service._notify_emergency_contacts(
            make_alert('high'), [{'name': 'Anna', 'phone': '+46700000001'}]
        )

        body = sms_service._twilio_create_message.call_args.kwargs['body']
        assert '112' not in body
        assert 'snarast' in body

    @pytest.mark.asyncio
    async def test_nothing_is_sent_when_twilio_is_not_configured(self, service):
        service.twilio_client = None

        result = await service._notify_emergency_contacts(
            make_alert(), [{'name': 'Anna', 'phone': '+46700000001'}]
        )

        assert result['sms_delivered'] == 0
