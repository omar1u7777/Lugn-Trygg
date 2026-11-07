"""Crisis escalation from text a person writes: mood logs and memories alike.

The mood-log route itself is covered in test_mood_menu_coverage.py.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.services import crisis_signal
from src.services.crisis_task_queue import CrisisQueueUnavailableError

CRISIS = 'Jag vill inte leva längre'


def _assessment(level='critical'):
    return SimpleNamespace(overall_risk_level=level, risk_score=0.95, active_indicators=[])


@pytest.fixture
def assess(mocker):
    service = MagicMock()
    service.assess_crisis_risk.return_value = _assessment()
    mocker.patch('src.services.crisis_intervention.crisis_intervention_service', service)
    return service.assess_crisis_risk


@pytest.fixture
def enqueue(mocker):
    return mocker.patch('src.services.crisis_task_queue.enqueue_crisis_escalation', return_value='task-1')


@pytest.fixture
def alerts(mocker):
    mocker.patch('src.services.crisis_signal.audit_log')
    return mocker.patch('src.services.crisis_signal.db').collection.return_value.add


def _create_memory(client, headers, **form):
    return client.post('/api/v1/memory-unified/create', data=form, headers=headers,
                       content_type='multipart/form-data')


@pytest.fixture
def memory_route(mocker):
    mocker.patch('src.routes.multimedia_memory_routes.db')
    mocker.patch('src.routes.multimedia_memory_routes.audit_log')


def test_memory_with_crisis_words_is_escalated(client, auth_csrf_headers, mock_auth_service,
                                               memory_route, assess, enqueue, alerts):
    response = _create_memory(client, auth_csrf_headers, content=CRISIS)

    assert response.status_code in (200, 201)
    enqueue.assert_called_once()
    alert = enqueue.call_args.args[0]
    assert alert.risk_level == 'critical'
    assert alert.requires_immediate_action is True
    assert alerts.call_args.args[0]['source'] == 'memory'


def test_memory_with_a_very_low_mood_is_assessed(client, auth_csrf_headers, mock_auth_service,
                                                 memory_route, assess, enqueue, alerts):
    _create_memory(client, auth_csrf_headers, content='En lång dag på jobbet', mood='2')

    assess.assert_called_once()
    assert assess.call_args.args[0]['mood_history'] == [{'sentiment_score': 2}]


def test_ordinary_memory_is_not_assessed(client, auth_csrf_headers, mock_auth_service,
                                         memory_route, assess, enqueue, alerts):
    response = _create_memory(client, auth_csrf_headers, content='En härlig dag i parken', mood='8')

    assert response.status_code in (200, 201)
    assess.assert_not_called()
    enqueue.assert_not_called()


def test_moderate_risk_is_not_escalated(assess, enqueue, alerts):
    assess.return_value = _assessment('medium')

    assert crisis_signal.escalate_if_in_crisis('user-1', CRISIS, 'memory') is None
    enqueue.assert_not_called()
    alerts.assert_not_called()


def test_a_failed_alert_record_does_not_stop_the_escalation(assess, enqueue, alerts):
    alerts.side_effect = RuntimeError('firestore down')

    assert crisis_signal.escalate_if_in_crisis('user-1', CRISIS, 'memory') == 'critical'
    enqueue.assert_called_once()


def test_unavailable_queue_is_logged_not_raised(assess, enqueue, alerts, caplog):
    enqueue.side_effect = CrisisQueueUnavailableError('db down')

    assert crisis_signal.escalate_if_in_crisis('user-1', CRISIS, 'memory') == 'critical'
    assert 'REQUIRES MANUAL REVIEW' in caplog.text
    assert 'user-1' not in caplog.text


@pytest.mark.parametrize('text', ['De får bättre utan mig', 'Jag är en börda', 'Jag har självmordstankar'])
def test_crisis_keywords(text):
    assert crisis_signal.has_crisis_keywords(text)


def test_ordinary_text_has_no_crisis_keywords():
    assert not crisis_signal.has_crisis_keywords('Vi åt middag och skrattade mycket')
