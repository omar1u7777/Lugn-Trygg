"""
Comprehensive tests for notifications_routes.py

All endpoints are registered under /api/v1/notifications in main.py.
OPTIONS requests are intercepted by the global before_request handler -> 204.
Auth is handled by the conftest-patched @AuthService.jwt_required (sets g.user_id).
Responses follow the APIResponse envelope:
  Success -> {"success": true, "data": {...}, "message": "..."}
  Error   -> {"success": false, "error": "CODE", "message": "..."}
"""

import sys

import pytest
from unittest.mock import MagicMock, patch

PREFIX = '/api/v1/notifications'


# ── helpers ──────────────────────────────────────────────────────

def _setup_user(fcm_token=None, exists=True, extra=None):
    """Configure the shared mock db so the 'users' document returns the
    desired state and the 'notifications' collection accepts writes."""
    db = sys.modules['src.firebase_config'].db

    user_data = {}
    if exists:
        user_data = {'fcmToken': fcm_token}
        if extra:
            user_data.update(extra)

    mock_user_doc = MagicMock()
    mock_user_doc.exists = exists
    mock_user_doc.to_dict.return_value = user_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_user_doc
    mock_doc_ref.id = 'test-doc-id'
    mock_doc_ref.set = MagicMock()

    mock_notif_ref = MagicMock()
    mock_notif_ref.set = MagicMock()

    mock_users_col = MagicMock()
    mock_users_col.document.return_value = mock_doc_ref

    mock_notif_col = MagicMock()
    mock_notif_col.document.return_value = mock_notif_ref

    def pick_collection(name):
        if name == 'users':
            return mock_users_col
        if name == 'notifications':
            return mock_notif_col
        col = MagicMock()
        col.document.return_value = MagicMock()
        return col

    db.collection = MagicMock(side_effect=pick_collection)
    return db


# ── OPTIONS (CORS preflight -> 204 via before_request) ───────────

class TestOptions:
    """All OPTIONS requests are intercepted by _handle_cors_preflight -> 204."""

    @pytest.mark.parametrize("path", [
        '/fcm-token',
        '/send-reminder',
        '/schedule-daily',
        '/disable-all',
        '/settings',
    ])
    def test_options_returns_204(self, client, path):
        resp = client.options(f'{PREFIX}{path}')
        assert resp.status_code == 204


# ── POST /fcm-token ─────────────────────────────────────────────

class TestSaveFcmToken:

    def test_success(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': 'dGVzdF90b2tlbl8xMjM0NTY3ODkwYWJjZGVm'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['tokenSaved'] is True
        assert 'Token saved' in data['message']

    def test_missing_token_field(self, client, auth_headers):
        resp = client.post(f'{PREFIX}/fcm-token', json={}, headers=auth_headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False

    def test_empty_string_token(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': ''},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_null_token(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': None},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_no_json_body(self, client, auth_headers):
        resp = client.post(f'{PREFIX}/fcm-token', headers=auth_headers)
        assert resp.status_code == 400

    def test_invalid_json(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            data='not-json',
            content_type='application/json',
            headers=auth_headers,
        )
        # silent=True -> {}, no fcmToken -> 400
        assert resp.status_code == 400

    def test_long_token_accepted(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': 'x' * 600},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_special_chars_token(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': 'token_with-special.chars:123/abc='},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_db_unavailable_returns_503(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.post(
                f'{PREFIX}/fcm-token',
                json={'fcmToken': 'valid'},
                headers=auth_headers,
            )
        assert resp.status_code == 503
        data = resp.get_json()
        assert data['success'] is False
        assert data['error'] == 'DB_ERROR'

    def test_firestore_write_exception(self, client, auth_headers):
        db = sys.modules['src.firebase_config'].db
        db.collection.side_effect = Exception('Firestore down')
        resp = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': 'valid'},
            headers=auth_headers,
        )
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['success'] is False
        assert data['error'] == 'SAVE_ERROR'


# ── POST /send-reminder ─────────────────────────────────────────

class TestSendReminder:

    def test_success(self, client, auth_headers):
        _setup_user(fcm_token='test-fcm-token-123')
        resp = client.post(
            f'{PREFIX}/send-reminder',
            json={'message': 'Check your mood', 'type': 'mood_check'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['sent'] is True
        assert 'notificationId' in data['data']

    def test_user_not_found(self, client, auth_headers):
        _setup_user(exists=False)
        resp = client.post(
            f'{PREFIX}/send-reminder',
            json={'type': 'reminder'},
            headers=auth_headers,
        )
        assert resp.status_code == 404
        data = resp.get_json()
        assert data['success'] is False

    def test_no_fcm_token_returns_sent_false(self, client, auth_headers):
        _setup_user(fcm_token=None, exists=True)
        resp = client.post(
            f'{PREFIX}/send-reminder',
            json={'type': 'daily'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['sent'] is False
        assert data['data']['reason'] == 'no_token'

    def test_empty_body_uses_defaults(self, client, auth_headers):
        _setup_user(fcm_token='tok')
        resp = client.post(f'{PREFIX}/send-reminder', json={}, headers=auth_headers)
        assert resp.status_code == 200

    def test_no_json_body(self, client, auth_headers):
        _setup_user(fcm_token='tok')
        resp = client.post(f'{PREFIX}/send-reminder', headers=auth_headers)
        assert resp.status_code == 200

    def test_db_unavailable(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.post(
                f'{PREFIX}/send-reminder',
                json={'type': 'daily'},
                headers=auth_headers,
            )
        assert resp.status_code == 503
        data = resp.get_json()
        assert data['error'] == 'DB_ERROR'

    def test_fcm_firebase_error(self, client, auth_headers):
        """FirebaseError during messaging.send -> FCM_ERROR 500."""
        from firebase_admin.exceptions import FirebaseError

        _setup_user(fcm_token='tok')
        with patch(
            'src.routes.notifications_routes.messaging.send',
            side_effect=FirebaseError(code='internal', message='boom'),
        ):
            resp = client.post(
                f'{PREFIX}/send-reminder',
                json={'type': 'daily'},
                headers=auth_headers,
            )
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['error'] == 'FCM_ERROR'

    def test_generic_exception(self, client, auth_headers):
        db = sys.modules['src.firebase_config'].db
        db.collection.side_effect = Exception('unexpected')
        resp = client.post(
            f'{PREFIX}/send-reminder',
            json={'type': 'daily'},
            headers=auth_headers,
        )
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['error'] == 'SEND_ERROR'

    def test_unicode_message(self, client, auth_headers):
        _setup_user(fcm_token='tok')
        resp = client.post(
            f'{PREFIX}/send-reminder',
            json={'message': 'Dags för humörkoll! \U0001f60a'},
            headers=auth_headers,
        )
        assert resp.status_code == 200


# ── POST /schedule-daily ─────────────────────────────────────────

class TestScheduleDaily:

    def test_enable_with_time(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/schedule-daily',
            json={'enabled': True, 'time': '09:00'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['enabled'] is True
        assert data['data']['time'] == '09:00'
        assert 'enabled' in data['message'].lower()

    def test_disable(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/schedule-daily',
            json={'enabled': False, 'time': '08:00'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['data']['enabled'] is False
        assert 'disabled' in data['message'].lower()

    def test_empty_body_defaults(self, client, auth_headers):
        """Empty JSON -> enabled=True, time='09:00'."""
        resp = client.post(f'{PREFIX}/schedule-daily', json={}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['data']['enabled'] is True
        assert data['data']['time'] == '09:00'

    def test_invalid_time_format(self, client, auth_headers):
        resp = client.post(
            f'{PREFIX}/schedule-daily',
            json={'time': 'not-a-time'},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False

    def test_db_unavailable(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.post(
                f'{PREFIX}/schedule-daily',
                json={'enabled': True, 'time': '09:00'},
                headers=auth_headers,
            )
        assert resp.status_code == 503

    def test_exception(self, client, auth_headers):
        db = sys.modules['src.firebase_config'].db
        db.collection.side_effect = Exception('boom')
        resp = client.post(
            f'{PREFIX}/schedule-daily',
            json={'enabled': True, 'time': '09:00'},
            headers=auth_headers,
        )
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['error'] == 'SCHEDULE_ERROR'


# ── POST /disable-all ────────────────────────────────────────────

class TestDisableAll:

    def test_success(self, client, auth_headers):
        resp = client.post(f'{PREFIX}/disable-all', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['allDisabled'] is True
        assert 'disabled' in data['message'].lower()

    def test_db_unavailable(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.post(f'{PREFIX}/disable-all', headers=auth_headers)
        assert resp.status_code == 503

    def test_exception(self, client, auth_headers):
        db = sys.modules['src.firebase_config'].db
        db.collection.side_effect = Exception('boom')
        resp = client.post(f'{PREFIX}/disable-all', headers=auth_headers)
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['error'] == 'DISABLE_ERROR'


# ── GET & POST /settings ─────────────────────────────────────────

class TestNotificationSettings:

    def test_get_existing_user(self, client, auth_headers):
        _setup_user(
            fcm_token='tok',
            exists=True,
            extra={
                'dailyRemindersEnabled': True,
                'reminderTime': '10:00',
                'lastReminderSent': '2025-01-01',
            },
        )
        resp = client.get(f'{PREFIX}/settings', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        settings = data['data']['settings']
        assert settings['dailyRemindersEnabled'] is True
        assert settings['reminderTime'] == '10:00'
        assert settings['hasFcmToken'] is True

    def test_get_nonexistent_user_returns_defaults(self, client, auth_headers):
        _setup_user(exists=False)
        resp = client.get(f'{PREFIX}/settings', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        settings = data['data']['settings']
        assert settings['dailyRemindersEnabled'] is False
        assert settings['reminderTime'] == '09:00'
        assert settings['hasFcmToken'] is False
        assert settings['lastReminderSent'] is None

    def test_post_full_update(self, client, auth_headers):
        _setup_user(exists=True)
        resp = client.post(
            f'{PREFIX}/settings',
            json={'dailyRemindersEnabled': True, 'reminderTime': '20:00'},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['data']['updated'] is True

    def test_post_partial_update_enabled_only(self, client, auth_headers):
        _setup_user(exists=True)
        resp = client.post(
            f'{PREFIX}/settings',
            json={'dailyRemindersEnabled': False},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['data']['updated'] is True

    def test_post_invalid_time(self, client, auth_headers):
        _setup_user(exists=True)
        resp = client.post(
            f'{PREFIX}/settings',
            json={'reminderTime': 'bad'},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert data['success'] is False

    def test_post_empty_body(self, client, auth_headers):
        _setup_user(exists=True)
        resp = client.post(f'{PREFIX}/settings', json={}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['data']['updated'] is True

    def test_db_unavailable_get(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.get(f'{PREFIX}/settings', headers=auth_headers)
        assert resp.status_code == 503

    def test_db_unavailable_post(self, client, auth_headers):
        with patch('src.routes.notifications_routes.db', None):
            resp = client.post(
                f'{PREFIX}/settings',
                json={'dailyRemindersEnabled': True},
                headers=auth_headers,
            )
        assert resp.status_code == 503

    def test_exception(self, client, auth_headers):
        db = sys.modules['src.firebase_config'].db
        db.collection.side_effect = Exception('fail')
        resp = client.get(f'{PREFIX}/settings', headers=auth_headers)
        assert resp.status_code == 500
        data = resp.get_json()
        assert data['error'] == 'SETTINGS_ERROR'


# ── Integration / cross-endpoint tests ───────────────────────────

class TestIntegration:

    def test_save_token_then_send_reminder(self, client, auth_headers):
        resp1 = client.post(
            f'{PREFIX}/fcm-token',
            json={'fcmToken': 'integration-token'},
            headers=auth_headers,
        )
        assert resp1.status_code == 200

        _setup_user(fcm_token='integration-token')
        resp2 = client.post(
            f'{PREFIX}/send-reminder',
            json={'type': 'mood_check'},
            headers=auth_headers,
        )
        assert resp2.status_code == 200
        assert resp2.get_json()['data']['sent'] is True

    def test_schedule_then_disable(self, client, auth_headers):
        resp1 = client.post(
            f'{PREFIX}/schedule-daily',
            json={'enabled': True, 'time': '09:00'},
            headers=auth_headers,
        )
        assert resp1.status_code == 200

        resp2 = client.post(f'{PREFIX}/disable-all', headers=auth_headers)
        assert resp2.status_code == 200

    def test_multiple_token_saves(self, client, auth_headers):
        for i in range(5):
            resp = client.post(
                f'{PREFIX}/fcm-token',
                json={'fcmToken': f'token-{i}'},
                headers=auth_headers,
            )
            assert resp.status_code == 200
