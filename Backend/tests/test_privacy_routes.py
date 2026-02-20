"""Privacy routes tests covering settings, exports, and deletion flows."""

import json
from unittest.mock import MagicMock

TEST_USER_ID = 'testuser1234567890ab'


def test_get_privacy_settings_returns_defaults(client, auth_headers, mock_auth_service, mock_db):
    user_doc = mock_db.collection('users').document(TEST_USER_ID)
    user_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {})

    response = client.get(f'/api/privacy/settings/{TEST_USER_ID}', headers=auth_headers)

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['data']['settings']['encryptLocalStorage'] is True
    assert payload['data']['settings']['dataRetentionDays'] == 365


def test_update_privacy_settings_filters_allowed_keys(client, auth_headers, mock_auth_service, mock_db):
    user_doc = mock_db.collection('users').document(TEST_USER_ID)

    payload = {
        'settings': {
            'encryptLocalStorage': False,
            'shareAnonymizedData': True,
            'unknown': 'ignored'
        }
    }

    response = client.put(
        f'/api/privacy/settings/{TEST_USER_ID}',
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 200
    user_doc.update.assert_called_once()
    update_payload = user_doc.update.call_args.args[0]['privacy_settings']
    assert 'unknown' not in update_payload
    assert update_payload['shareAnonymizedData'] is True


def test_export_user_data_streams_json_file(client, auth_headers, mock_auth_service, mock_db, mocker):
    user_doc = mock_db.collection('users').document(TEST_USER_ID)
    user_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {'privacy_settings': {}})
    mocker.patch('google.cloud.firestore.FieldFilter', side_effect=lambda *args, **kwargs: MagicMock())

    response = client.post(f'/api/privacy/export/{TEST_USER_ID}', headers=auth_headers)

    assert response.status_code == 200
    assert response.mimetype == 'application/json'
    export_payload = json.loads(response.data.decode('utf-8'))
    assert export_payload['exportMetadata']['userId'] == TEST_USER_ID


def test_delete_user_data_requires_confirmation(client, auth_headers, mock_auth_service):
    response = client.delete(f'/api/privacy/delete/{TEST_USER_ID}', headers=auth_headers)

    assert response.status_code == 400
    assert 'Confirmation required' in response.get_json()['message']


def test_delete_user_data_executes_full_cleanup(client, auth_headers, mock_auth_service, mock_db, mocker):
    mocker.patch('src.routes.privacy_routes._delete_collection', return_value=0)
    mocker.patch('src.services.audit_service.audit_log')
    mock_db.collection('users').document(TEST_USER_ID).get.return_value = MagicMock(exists=True, to_dict=lambda: {})

    response = client.delete(
        f'/api/privacy/delete/{TEST_USER_ID}?confirm=delete%20my%20data',
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['data']['summary']['userId'] == TEST_USER_ID
    assert payload['message'].startswith('All your data')
    mock_db.collection('users').document(TEST_USER_ID).delete.assert_called_once()
