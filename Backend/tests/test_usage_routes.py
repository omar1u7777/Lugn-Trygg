"""Tests for usage routes."""


def test_increment_mood_log(client, auth_csrf_headers, mock_auth_service, mocker):
    mocker.patch('src.routes.usage_routes.audit_log')
    response = client.post(
        '/api/v1/usage/increment/mood',
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'mood_logs' in data['data']


def test_increment_chat_message(client, auth_csrf_headers, mock_auth_service, mocker):
    mocker.patch('src.routes.usage_routes.audit_log')
    response = client.post(
        '/api/v1/usage/increment/chat',
        headers=auth_csrf_headers,
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'chat_messages' in data['data']
