"""
Test Consent API Integration
Verifies consent service endpoints work correctly
"""

import os
import sys
from unittest.mock import MagicMock

# Add Backend directory to sys.path (one level up from tests/)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest


@pytest.fixture
def mock_consent_service(mocker):
    """Mock consent_service so tests don't require a real Firestore connection."""
    mock = MagicMock()
    mock.get_user_consents.return_value = {}
    mock.grant_consent.return_value = True
    mock.withdraw_consent.return_value = True
    mock.validate_feature_access.return_value = {
        'access_granted': True,
        'missing_consents': []
    }
    mock.check_consent.return_value = {'has_consent': True}
    mocker.patch('src.routes.consent_routes.consent_service', mock)
    return mock


def test_consent_get_error_response(client, auth_headers, mock_auth_service, mock_consent_service):
    """GET /api/v1/consent should return 404 when consent_service returns an error."""
    mock_consent_service.get_user_consents.return_value = {'error': 'Firestore unavailable'}
    response = client.get('/api/v1/consent', headers=auth_headers)
    assert response.status_code == 404


def test_consent_get_with_auth(client, auth_headers, mock_auth_service, mock_consent_service):
    """GET /api/v1/consent with auth should return 200 and consent list."""
    response = client.get('/api/v1/consent', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'data' in data


def test_consent_bulk_grant(client, auth_headers, mock_auth_service, mock_consent_service):
    """POST /api/v1/consent (bulk) should grant multiple consents."""
    consent_data = {
        'terms_of_service': True,
        'privacy_policy': True,
        'data_processing_consent': True,
        'ai_analysis_consent': True,
        'marketing_consent': False,
        'analytics_consent': True
    }
    response = client.post('/api/v1/consent', json=consent_data, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'data' in data
    assert 'granted' in data['data']


def test_consent_grant_single(client, auth_headers, mock_auth_service, mock_consent_service):
    """POST /api/v1/consent/<type> should grant a single consent."""
    response = client.post(
        '/api/v1/consent/analytics',
        json={'version': '1.0'},
        headers=auth_headers
    )
    assert response.status_code == 200


def test_consent_check(client, auth_headers, mock_auth_service, mock_consent_service):
    """GET /api/v1/consent/check/<type> should return consent status."""
    response = client.get('/api/v1/consent/check/analytics', headers=auth_headers)
    assert response.status_code == 200


def test_consent_validate_feature(client, auth_headers, mock_auth_service, mock_consent_service):
    """GET /api/v1/consent/validate/<feature> should return access validation."""
    response = client.get('/api/v1/consent/validate/mood_logging', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'data' in data


def test_consent_withdraw(client, auth_headers, mock_auth_service, mock_consent_service):
    """DELETE /api/v1/consent/<type> should withdraw consent."""
    response = client.delete('/api/v1/consent/marketing', headers=auth_headers)
    assert response.status_code == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

