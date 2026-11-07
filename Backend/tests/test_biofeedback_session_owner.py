"""A biofeedback session can be fed and ended only by the user who started it."""

from types import SimpleNamespace

import pytest

from src.services.biofeedback_breathing_service import BiofeedbackBreathingService

ME = 'testuser1234567890ab'  # the user the test client is signed in as
SOMEONE_ELSE = 'otheruser1234567890ab'


@pytest.fixture
def service(mocker):
    fresh = BiofeedbackBreathingService()
    mocker.patch('src.routes.biofeedback_ws_routes.get_biofeedback_service', return_value=fresh)
    return fresh


def test_ownership_check():
    service = BiofeedbackBreathingService()
    mine = service.start_session(ME).session_id

    assert service.owned_by_another_user(mine, ME) is False
    assert service.owned_by_another_user(mine, SOMEONE_ELSE) is True
    # Unknown sessions (e.g. lost in a restart) are not someone else's.
    assert service.owned_by_another_user('breath_unknown', ME) is False


@pytest.mark.parametrize('action', ['data', 'end'])
def test_rest_refuses_another_users_session(client, auth_csrf_headers, mock_auth_service, service, action):
    theirs = service.start_session(SOMEONE_ELSE).session_id

    response = client.post(
        f'/api/v1/biofeedback/{action}/{theirs}', json={'rr_intervals': [800, 810]}, headers=auth_csrf_headers
    )

    assert response.status_code == 404
    assert theirs in service.active_sessions
    assert service.session_data[theirs] == []


@pytest.mark.parametrize('action', ['data', 'end'])
def test_rest_serves_the_owner(client, auth_csrf_headers, mock_auth_service, service, action):
    mine = service.start_session(ME).session_id

    response = client.post(
        f'/api/v1/biofeedback/{action}/{mine}', json={'rr_intervals': [800, 810]}, headers=auth_csrf_headers
    )

    assert response.status_code == 200


def _websocket_handlers(mocker, user_id):
    """The Socket.IO handlers, called as `user_id` would reach them."""
    handlers = {}

    class FakeSocketIO:
        def on(self, event, namespace=None):
            def register(handler):
                handlers[event] = handler
                return handler
            return register

    from src.routes import biofeedback_ws_routes as routes

    mocker.patch.object(routes, 'SOCKETIO_AVAILABLE', True)
    mocker.patch.object(routes, 'request', SimpleNamespace(user_id=user_id, sid='sid-1'))
    routes.register_biofeedback_websocket_handlers(FakeSocketIO())
    return handlers


def test_websocket_refuses_another_users_session(mocker, service):
    theirs = service.start_session(SOMEONE_ELSE).session_id
    handlers = _websocket_handlers(mocker, ME)

    fed = handlers['heart_rate_data']({'session_id': theirs, 'rr_intervals': [800, 810]})
    ended = handlers['end_session']({'session_id': theirs})

    assert 'error' in fed and 'error' in ended
    assert theirs in service.active_sessions
    assert service.session_data[theirs] == []


def test_websocket_end_requires_sign_in(mocker, service):
    mine = service.start_session(ME).session_id
    handlers = _websocket_handlers(mocker, None)

    assert handlers['end_session']({'session_id': mine}) == {'error': 'Authentication required'}
    assert mine in service.active_sessions
