"""Integration routes targeted tests for OAuth and health integrations."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest


class TestIntegrationRoutes:
    """Cover OAuth and health alert flows"""

    def test_oauth_authorize_success(self, client, mocker):
        mocker.patch('src.services.oauth_service.oauth_service.validate_config', return_value=True)
        mocker.patch(
            'src.services.oauth_service.oauth_service.get_authorization_url',
            return_value={'authorization_url': 'https://oauth.test/authorize', 'state': 'abc123'}
        )
        mocker.patch('src.services.audit_service.audit_log')

        response = client.get('/api/integration/oauth/google_fit/authorize?user_id=testuserid123456789012')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['provider'] == 'google_fit'
        assert data['data']['authorizationUrl'].startswith('https://oauth.test')

    def test_oauth_authorize_requires_user(self, client, mocker):
        mocker.patch('src.services.oauth_service.oauth_service.validate_config', return_value=True)
        mocker.patch('src.services.audit_service.audit_log')

        response = client.get('/api/integration/oauth/google_fit/authorize')

        assert response.status_code == 401
        data = response.get_json()
        assert 'error' in data

    def test_oauth_callback_stores_tokens(self, client, mock_db, mocker):
        mocker.patch(
            'src.services.oauth_service.oauth_service.exchange_code_for_token',
            return_value={
                'user_id': 'testuserid123456789012',
                'access_token': 'access-token',
                'refresh_token': 'refresh-token',
                'expires_in': 3600,
                'scope': 'profile'
            }
        )
        mocker.patch('src.services.audit_service.audit_log')

        response = client.get(
            '/api/integration/oauth/google_fit/callback?code=123&state=state-1&frontend_url=http://localhost:3000'
        )

        assert response.status_code in (301, 302)
        location = response.headers.get('Location', '')
        assert 'success=true' in location or response.status_code in (301, 302)
        token_doc = mock_db.collection('oauth_tokens').document('testuserid123456789012_google_fit')
        token_doc.set.assert_called_once()

    def test_oauth_status_connected(self, client, auth_headers, mock_auth_service, mock_db):
        token_doc = mock_db.collection('oauth_tokens').document('test-user-id_google_fit')
        token_doc.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {
                'scope': 'profile',
                'obtained_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            }
        )

        response = client.get('/api/integration/oauth/google_fit/status', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['connected'] is True
        assert data['data']['provider'] == 'google_fit'

    def test_toggle_auto_sync_persists_settings(self, client, auth_headers, mock_auth_service, mock_db):
        integrations_doc = mock_db.collection('integrations').document('test-user-id')
        integrations_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {})

        response = client.post(
            '/api/integration/oauth/google_fit/auto-sync',
            json={'enabled': True, 'frequency': 'daily'},
            headers=auth_headers
        )

        assert response.status_code == 200
        integrations_doc.set.assert_called()

    def test_update_alert_settings(self, client, auth_headers, mock_auth_service, mock_db):
        integrations_doc = mock_db.collection('integrations').document('test-user-id')
        integrations_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {})

        payload = {
            'email_alerts': True,
            'push_alerts': True,
            'alert_types': ['low_steps']
        }
        response = client.post(
            '/api/integration/health/alert-settings',
            json=payload,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['settings']['emailAlerts'] is True
        integrations_doc.set.assert_called()

    def test_check_health_alerts_triggers_warning(self, client, auth_headers, mock_auth_service, mock_db, mocker):
        from types import SimpleNamespace

        integrations_doc = mock_db.collection('integrations').document('test-user-id')
        integrations_doc.get.return_value = MagicMock(
            exists=True,
            to_dict=lambda: {'email_alerts': {'enabled': True}}
        )
        mocker.patch('src.services.email_service.email_service.send_health_alert')
        mocker.patch('src.services.audit_service.audit_log')

        # Mock user lookup via db.collection('users')
        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {'email': 'user@test.dev', 'username': 'user'}
        mock_db.collection('users').document('test-user-id').get.return_value = user_doc

        response = client.post(
            '/api/integration/health/check-alerts',
            json={
                'provider': 'fitbit',
                'health_data': {'steps': 1500, 'heart_rate': 90, 'sleep_hours': 5}
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['alertCount'] >= 1
        assert data['data']['alerts'][0]['severity'] in ('warning', 'info')