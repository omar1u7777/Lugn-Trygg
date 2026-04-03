"""Peer chat blueprint coverage for rooms, joining, and messaging."""

from unittest.mock import MagicMock


def test_get_rooms_includes_member_counts(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    # The route queries peer_chat_presence per room via .where().where().stream()
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_collection.where.return_value = presence_collection
    presence_collection.stream.return_value = [MagicMock(), MagicMock()]

    response = client.get('/api/peer-chat/rooms')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    rooms = payload['data']['rooms']
    assert len(rooms) >= 1
    assert all('memberCount' in room for room in rooms)


def test_join_room_creates_presence_and_returns_session(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)
    mocker.patch('src.routes.peer_chat_routes._generate_anonymous_name', return_value='AnonFriend')
    mocker.patch('src.routes.peer_chat_routes._generate_avatar', return_value='🌟')

    import uuid as _uuid
    fixed_uuid = _uuid.UUID('11111111-2222-3333-4444-555555555555')
    mocker.patch('src.routes.peer_chat_routes.uuid.uuid4', return_value=fixed_uuid)

    # Messages collection – route queries .where().order_by().limit().stream()
    messages_collection = mock_db.collection('peer_chat_messages')
    messages_collection.where.return_value = messages_collection
    messages_collection.order_by.return_value = messages_collection
    messages_collection.limit.return_value = messages_collection
    messages_collection.stream.return_value = [
        MagicMock(id='msg-1', to_dict=lambda: {'message': 'Hej', 'timestamp': '2025-01-01T00:00:00Z'}),
    ]

    # Presence document written on join
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc = MagicMock()
    presence_collection.document.return_value = presence_doc

    response = client.post('/api/peer-chat/room/anxiety/join', json={'user_id': 'user-1'})

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['sessionId'].startswith('11111111')
    presence_doc.set.assert_called_once()


def test_send_message_requires_session_id(client):
    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'message': 'Hello'},
    )

    assert response.status_code == 400
    assert response.get_json()['message'] == 'session_id is required'


def test_send_message_rejects_unknown_session(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc_ref = MagicMock()
    presence_doc_ref.get.return_value = MagicMock(exists=False)
    presence_collection.document.return_value = presence_doc_ref

    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'session_id': 'missing', 'message': 'Hej'},
    )

    assert response.status_code == 403
    assert 'Invalid session' in response.get_json()['message']


def test_send_message_persists_payload(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    import uuid as _uuid
    mocker.patch(
        'src.routes.peer_chat_routes.uuid.uuid4',
        return_value=_uuid.UUID('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
    )

    # Presence doc exists with identity data
    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc_ref = MagicMock()
    presence_doc_ref.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {
            'anonymous_name': 'Anon',
            'avatar': '🌟',
            'user_id': 'testuser1234567890ab',
            'room_id': 'anxiety',
        },
    )
    presence_collection.document.return_value = presence_doc_ref

    # Messages collection – route writes the new message doc
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


def test_send_message_rejects_cross_room_session(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc_ref = MagicMock()
    presence_doc_ref.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {
            'anonymous_name': 'Anon',
            'avatar': '🌟',
            'user_id': 'testuser1234567890ab',
            'room_id': 'depression',
        },
    )
    presence_collection.document.return_value = presence_doc_ref

    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'session_id': 'session-1', 'message': 'Hej där'},
    )

    assert response.status_code == 403
    assert 'different room' in response.get_json()['message']


def test_send_message_rejects_external_links(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc_ref = MagicMock()
    presence_doc_ref.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {
            'anonymous_name': 'Anon',
            'avatar': '🌟',
            'user_id': 'testuser1234567890ab',
            'room_id': 'anxiety',
        },
    )
    presence_collection.document.return_value = presence_doc_ref

    response = client.post(
        '/api/peer-chat/room/anxiety/send',
        json={'session_id': 'session-1', 'message': 'Kolla https://example.com'},
    )

    assert response.status_code == 400
    assert 'external links' in response.get_json()['message']


def test_get_messages_requires_session_id(client):
    response = client.get('/api/peer-chat/room/anxiety/messages')

    assert response.status_code == 400
    assert response.get_json()['message'] == 'session_id is required'


def test_presence_requires_session_id(client):
    response = client.get('/api/peer-chat/room/anxiety/presence')

    assert response.status_code == 400
    assert response.get_json()['message'] == 'session_id is required'


def test_like_rejects_session_not_owned(client, mocker, mock_db):
    mocker.patch('src.routes.peer_chat_routes.db', mock_db)

    presence_collection = mock_db.collection('peer_chat_presence')
    presence_doc_ref = MagicMock()
    presence_doc_ref.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {
            'user_id': 'someone-else',
        },
    )
    presence_collection.document.return_value = presence_doc_ref

    response = client.post(
        '/api/peer-chat/message/msg-1/like',
        json={'session_id': 'session-1'},
    )

    assert response.status_code == 403
    assert response.get_json()['message'] == 'Session does not belong to you'
