"""Exception text stays in the server log and never reaches a client.

An exception message can carry a file path, a Firestore resource name, a
query or a value from another user's record. Each case below makes a code
path fail with such a message and checks the caller gets a fixed text.
"""

import asyncio
from unittest.mock import MagicMock

import pytest

DETAIL = 'projects/lugn-trygg/databases/(default)/documents/users/someone'


def _boom(*_args, **_kwargs):
    raise RuntimeError(DETAIL)


def test_validator_failure_is_reported_without_its_message():
    from src.utils.input_sanitization import input_sanitizer

    result = input_sanitizer.validate_input('x', {'validator': _boom})

    assert result['valid'] is False
    assert DETAIL not in repr(result['errors'])


def test_consent_lookups(mocker):
    from src.services.consent_service import consent_service

    mocker.patch('src.services.consent_service.db', MagicMock(collection=_boom))

    checked = consent_service.check_consent('user-1', 'analytics')
    listed = consent_service.get_user_consents('user-1')

    assert checked['has_consent'] is False and 'error' in checked
    assert 'error' in listed
    assert DETAIL not in repr(checked) + repr(listed)


def test_retention_status(mocker):
    from src.services.data_retention_service import data_retention_service

    mocker.patch.object(data_retention_service, '_count_expired_data', side_effect=_boom)

    status = data_retention_service.get_retention_status('user-1')

    assert DETAIL not in repr(status)


def test_breach_assessment():
    from src.services.breach_notification_service import breach_notification_service

    result = breach_notification_service.detect_potential_breach(MagicMock(get=_boom))

    assert result['is_breach'] is False
    assert DETAIL not in repr(result)


def test_health_mood_correlation(mocker):
    from src.services.health_analytics_service import health_analytics_service

    mocker.patch.object(health_analytics_service, '_match_health_to_mood', side_effect=_boom)

    result = health_analytics_service.analyze_health_mood_correlation([{'d': 1}], [{'d': 1}])

    assert result['status'] == 'error'
    assert DETAIL not in repr(result)


@pytest.mark.parametrize('method', ['train_predictive_model', 'predict_mood_trend', 'detect_crisis_risk'])
def test_predictions(mocker, method):
    from src.services.predictive_service import predictive_service

    mocker.patch.object(predictive_service, 'preprocess_mood_data', side_effect=_boom)
    # Prediction loads a stored model first; make that the step that fails.
    mocker.patch.object(predictive_service, 'models_dir', MagicMock())
    mocker.patch('src.services.predictive_service.joblib.load', side_effect=_boom)

    result = getattr(predictive_service, method)([{'mood_score': 5}])

    assert 'error' in result
    assert DETAIL not in repr(result)


def test_health_checks(mocker):
    from src.services import health_check_service as module

    check = module.HealthCheck('db', _boom)
    asyncio.run(check.run())

    mocker.patch.object(module.psutil, 'cpu_count', side_effect=_boom)
    mocker.patch.object(module.socket, 'create_connection', side_effect=_boom)
    service = module.HealthCheckService()
    system = asyncio.run(service._get_system_info())
    network = service._check_network_connectivity()

    assert check.last_result['status'] == 'unhealthy'
    assert network['connectivity'] is False
    assert DETAIL not in repr(check.last_result) + repr(system) + repr(network)


@pytest.mark.parametrize('process', ['_process_audio_file', '_process_photo_file'])
def test_memory_attachments(process):
    from src.routes import multimedia_memory_routes as routes

    upload = MagicMock(filename='a.mp3' if 'audio' in process else 'a.jpg')
    upload.read.side_effect = _boom
    upload.seek.side_effect = _boom
    upload.stream.read.side_effect = _boom

    result = getattr(routes, process)(upload, 'user-1')

    assert result['success'] is False
    assert DETAIL not in repr(result)


def test_voice_status(client, mocker):
    mocker.patch('src.utils.speech_utils.initialize_google_speech', side_effect=_boom)

    response = client.get('/api/v1/voice/status')

    assert response.status_code == 200
    assert response.get_json()['data']['googleSpeech'] is False
    assert DETAIL not in response.get_data(as_text=True)


@pytest.mark.parametrize('method, path, service_call', [
    ('post', '/api/v1/biofeedback/start', 'start_session'),
    ('post', '/api/v1/biofeedback/data/s-1', 'process_heart_rate_data'),
    ('post', '/api/v1/biofeedback/end/s-1', 'end_session'),
])
def test_biofeedback_rejections(client, auth_csrf_headers, mock_auth_service, mocker, method, path, service_call):
    service = MagicMock()
    getattr(service, service_call).side_effect = ValueError(DETAIL)
    mocker.patch('src.routes.biofeedback_ws_routes.get_biofeedback_service', return_value=service)

    response = getattr(client, method)(path, json={'rr_intervals': [800, 810]}, headers=auth_csrf_headers)

    assert response.status_code == 400
    assert DETAIL not in response.get_data(as_text=True)


def test_database_health_keeps_details_even_in_debug(client, auth_csrf_headers, mock_auth_service, mocker):
    mocker.patch('src.utils.response_utils._DEBUG', True)
    mocker.patch('src.routes.health_routes.db', MagicMock(collection=_boom))

    response = client.get('/api/health/db', headers=auth_csrf_headers)

    assert response.status_code == 503
    assert DETAIL not in response.get_data(as_text=True)


def test_metrics_keep_details_even_in_debug(client, auth_csrf_headers, mock_auth_service, mocker):
    mocker.patch('src.utils.response_utils._DEBUG', True)
    admin = MagicMock(exists=True, to_dict=lambda: {'role': 'admin'})
    mocker.patch('src.routes.health_routes.db').collection.return_value.document.return_value.get.return_value = admin
    mocker.patch('src.routes.health_routes.get_monitoring_service', side_effect=_boom)

    response = client.get('/api/health/metrics', headers=auth_csrf_headers)

    assert response.status_code == 500
    assert DETAIL not in response.get_data(as_text=True)
