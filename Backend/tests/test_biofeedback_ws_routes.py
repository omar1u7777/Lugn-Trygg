"""Tests for biofeedback_ws_routes.py's Socket.IO 'connect' handler auth.

BUG FIX: AuthService.verify_token() returns a (user_id, error) tuple, not a
dict. The handler used to do `payload = AuthService.verify_token(token); if
payload: payload.get('user_id')` — a 2-tuple is always truthy, so the check
always passed, then `.get()` on a tuple raised AttributeError (silently
swallowed by the handler's own try/except), meaning request.user_id was NEVER
set for ANY connection, valid token or not.
"""
from unittest.mock import MagicMock, patch


def _capture_connect_handler():
    """Register the biofeedback WS handlers against a fake socketio that just
    records the decorated functions by event name, and return the 'connect'
    handler for direct invocation."""
    import src.routes.biofeedback_ws_routes as bwr

    handlers = {}

    class FakeSocketIO:
        def on(self, event, namespace=None):
            def decorator(fn):
                handlers[event] = fn
                return fn
            return decorator

    with patch.object(bwr, "SOCKETIO_AVAILABLE", True):
        bwr.register_biofeedback_websocket_handlers(FakeSocketIO())

    return handlers["connect"]


def test_connect_with_valid_token_sets_request_user_id():
    import src.routes.biofeedback_ws_routes as bwr

    connect_handler = _capture_connect_handler()

    fake_request = MagicMock()
    fake_request.args.get.return_value = "a-valid-looking-jwt-token"
    fake_request.headers.get.return_value = ""
    fake_request.sid = "sid-1"

    with patch.object(bwr, "request", fake_request), \
            patch("src.services.auth_service.AuthService.verify_token", return_value=("user-123", None)), \
            patch("flask_socketio.join_room"):
        connect_handler()

    assert fake_request.user_id == "user-123"


def test_connect_with_invalid_token_does_not_set_request_user_id():
    """Previously: an invalid/expired token still made `if payload:` true
    (tuple truthiness) and only failed silently inside the except block —
    this must not set request.user_id."""
    import src.routes.biofeedback_ws_routes as bwr

    connect_handler = _capture_connect_handler()

    fake_request = MagicMock(spec=["args", "headers", "sid"])
    fake_request.args.get.return_value = "an-invalid-jwt-token"
    fake_request.headers.get.return_value = ""
    fake_request.sid = "sid-2"

    with patch.object(bwr, "request", fake_request), \
            patch("src.services.auth_service.AuthService.verify_token", return_value=(None, "Token expired")):
        connect_handler()

    assert not hasattr(fake_request, "user_id")
