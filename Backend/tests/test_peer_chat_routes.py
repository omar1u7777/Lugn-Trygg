"""Peer chat blueprint coverage for rooms, joining, and messaging."""

import uuid
from unittest.mock import MagicMock


def test_get_rooms_includes_member_counts(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes._get_db', return_value=mock_db)
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_collection.stream.return_value = [MagicMock(), MagicMock()]

    response = client.get('/api/peer-chat/rooms')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert len(payload['rooms']) >= 1
    assert all('member_count' in room for room in payload['rooms'])


def test_join_room_creates_presence_and_returns_history(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes._get_db', return_value=mock_db)
    mocker.patch('src.routes.peer_chat_routes._generate_anonymous_name', return_value='AnonFriend')
    mocker.patch('src.routes.peer_chat_routes._generate_avatar', return_value='🌟')
    mocker.patch('src.routes.peer_chat_routes.uuid.uuid4', return_value=uuid.UUID('11111111-2222-3333-4444-555555555555'))

    messages_collection = mock_db.collection('peer_chat_messages')
    messages_collection.stream.return_value = [
        MagicMock(id='msg-1', to_dict=lambda: {'message': 'Hej', 'timestamp': '2025-01-01T00:00:00Z'})
    ]
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc = MagicMock()
    presence_collection.document.return_value = presence_doc

    response = client.post('/api/peer-chat/room/anxiety/join', json={'user_id': 'user-1'})

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['session_id'].startswith('11111111')
    presence_doc.set.assert_called_once()


def test_send_message_requires_session_id(client):
    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'message': 'Hello'},
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'session_id is required'


def test_send_message_rejects_unknown_session(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes._get_db', return_value=mock_db)
    mocker.patch('src.routes.peer_chat_routes._moderate_message', return_value=(True, ''))
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc = MagicMock()
    presence_doc.get.return_value = MagicMock(exists=False)
    presence_collection.document.return_value = presence_doc

    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'session_id': 'missing', 'message': 'Hej'},
    )

    assert response.status_code == 401
    assert 'Invalid session' in response.get_json()['error']


def test_send_message_persists_payload(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes._get_db', return_value=mock_db)
    mocker.patch('src.routes.peer_chat_routes._moderate_message', return_value=(True, ''))
    mocker.patch('src.routes.peer_chat_routes.uuid.uuid4', return_value=uuid.UUID('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'))

    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc = MagicMock()
    presence_doc.get.return_value = MagicMock(exists=True, to_dict=lambda: {'anonymous_name': 'Anon', 'avatar': '🌟'})
    presence_collection.document.return_value = presence_doc

    messages_collection = mock_db.collection('peer_chat_messages')
    message_doc = MagicMock()
    messages_collection.document.return_value = message_doc

    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'session_id': 'session-1', 'message': 'Hej där'},
    )

    assert response.status_code == 200
    assert response.get_json()['success'] is True
    message_doc.set.assert_called_once()
