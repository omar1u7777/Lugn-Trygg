"""Pseudonymous user references in logs."""

import logging

from src.utils.log_ref import log_ref

UID = 'AbCdEf0123456789XyZw0123'


def test_stable_and_short():
    assert log_ref(UID) == log_ref(UID)
    assert log_ref(UID).startswith('u:') and len(log_ref(UID)) == 14


def test_reveals_no_part_of_the_uid():
    ref = log_ref(UID)
    # Not even the 8-character prefix the logs used to print.
    assert UID[:8] not in ref and UID[:4].lower() not in ref


def test_different_users_differ():
    assert log_ref(UID) != log_ref(UID[::-1])


def test_depends_on_the_server_secret(monkeypatch):
    monkeypatch.setenv('JWT_SECRET_KEY', 'one-secret-that-is-at-least-32-characters')
    first = log_ref(UID)
    monkeypatch.setenv('JWT_SECRET_KEY', 'another-secret-that-is-at-least-32-chars')
    assert log_ref(UID) != first


def test_missing_id():
    assert log_ref(None) == log_ref('') == 'u:-'


def test_crisis_contact_logs_name_no_one(caplog):
    """Emergency contacts are third parties; their names stay out of logs."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from src.services.crisis_escalation import CrisisEscalationService

    service = CrisisEscalationService.__new__(CrisisEscalationService)
    service.twilio_client = MagicMock()
    service.twilio_phone = '+46700000000'
    service.sendgrid_client = None
    service._twilio_create_message = MagicMock(side_effect=RuntimeError("'To' number +46701234567 is not valid"))
    alert = SimpleNamespace(risk_level='high', timestamp=None)

    with caplog.at_level(logging.INFO):
        result = asyncio.run(service._notify_emergency_contacts(
            alert, [{'name': 'Annika Svensson', 'phone': '+46701234567', 'notify_email': False}]
        ))

    logged = caplog.text + ' '.join(result['errors'])
    assert 'Ann' not in logged
    assert '+4670' not in logged


def test_critical_heart_rate_warning_logs_no_reading_and_no_uid(caplog):
    from unittest.mock import MagicMock

    from src.services.biofeedback_breathing_service import BiofeedbackBreathingService

    service = BiofeedbackBreathingService()
    service.hrv_analyzer.calculate_hrv_metrics = MagicMock(return_value=MagicMock(heart_rate=187.0))
    session = service.start_session(UID)

    with caplog.at_level(logging.WARNING):
        service.process_heart_rate_data(session.session_id, [800.0], [None])

    assert 'heart rate' in caplog.text.lower()
    assert '187' not in caplog.text
    assert UID[:8] not in caplog.text
