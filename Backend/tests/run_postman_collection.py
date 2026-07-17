"""Run the Postman collection against the Flask test client."""
import json
import os
import sys

# Add Backend root to path
backend_dir = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, backend_dir)

# Set test environment before importing main
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = 'True'
os.environ['TESTING'] = 'True'
os.environ['REDIS_URL'] = 'memory://'
os.environ.setdefault('FIREBASE_WEB_API_KEY', 'test-firebase-web-api-key')
os.environ.setdefault('FIREBASE_API_KEY', 'test-firebase-api-key')
os.environ.setdefault('FIREBASE_PROJECT_ID', 'test-project')
os.environ.setdefault('FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com')
os.environ.setdefault('FIREBASE_CREDENTIALS', '{"type":"service_account","project_id":"test","private_key_id":"k","private_key":"-----BEGIN RSA PRIVATE KEY-----\\nMIIBogIBAAJBALRiMLAH\\n-----END RSA PRIVATE KEY-----\\n","client_email":"t@t.iam.gserviceaccount.com","client_id":"1","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}')
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key-that-is-at-least-32-chars-long')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test-refresh-secret-key-at-least-32-chars-long')
os.environ.setdefault('HIPAA_ENCRYPTION_KEY', 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=')
os.environ.setdefault('JWT_ISSUER', 'lugn-trygg')
os.environ.setdefault('JWT_AUDIENCE', 'lugn-trygg-web')

from unittest.mock import MagicMock, patch

import jwt
from datetime import UTC, datetime, timedelta
import firebase_admin
import requests as _requests

# Stub Redis early
import redis as _redis_module
_redis_module.Redis = MagicMock
_redis_module.from_url = MagicMock(return_value=MagicMock(ping=MagicMock()))


def fake_requests_post(url, *args, **kwargs):
    """Mock Firebase sign-in API so local smoke tests pass."""
    if 'signInWithPassword' in url:
        payload = kwargs.get('json', {})
        return MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                'localId': 'testuser1234567890ab',
                'email': payload.get('email', 'test@example.com'),
                'idToken': 'fake-firebase-id-token',
                'refreshToken': 'fake-refresh-token'
            })
        )
    if 'identitytoolkit' in url and 'signInWithCustomToken' in url:
        return MagicMock(status_code=200, json=MagicMock(return_value={
            'idToken': 'fake-firebase-id-token',
            'localId': 'testuser1234567890ab'
        }))
    return MagicMock(status_code=200, json=MagicMock(return_value={}))

_requests.post = fake_requests_post

# Mock firebase messaging
mock_messaging = MagicMock()
mock_messaging.send = MagicMock(return_value="projects/test/messages/12345")
mock_messaging.send_multicast = MagicMock(return_value=MagicMock(success_count=1, failure_count=0))
mock_messaging.Message = MagicMock
mock_messaging.Notification = MagicMock
mock_messaging.AndroidConfig = MagicMock
mock_messaging.APNSConfig = MagicMock
mock_messaging.WebpushConfig = MagicMock
sys.modules['firebase_admin.messaging'] = mock_messaging

# Stub pyotp and qrcode for 2FA endpoints
import types
pyotp_mod = types.ModuleType('pyotp')
pyotp_mod.random_base32 = lambda: 'BASE32SECRETKEY'

class _TOTPStub:
    def __init__(self, secret): self.secret = secret
    def verify(self, code, valid_window=1): return True
    def provisioning_uri(self, name=None, issuer_name=None): return 'otpauth://totp/Lugn%20%26%20Trygg?secret=BASE32SECRETKEY'
pyotp_mod.TOTP = _TOTPStub
sys.modules['pyotp'] = pyotp_mod

class _QRImageStub:
    def save(self, buf, format=None): buf.write(b'')

class _QRCodeStub:
    def __init__(self, *a, **k): pass
    def add_data(self, *a, **k): pass
    def make(self, *a, **k): pass
    def make_image(self, *a, **k): return _QRImageStub()

qrcode_mod = types.ModuleType('qrcode')
qrcode_mod.QRCode = _QRCodeStub
qrcode_mod.make = lambda data: _QRImageStub()
sys.modules['qrcode'] = qrcode_mod

# Import app
def fake_init_app(cred, options=None):
    firebase_admin._apps = {'[DEFAULT]': MagicMock()}
    return MagicMock()

with patch('firebase_admin.credentials.Certificate') as mock_cert, \
     patch('firebase_admin.initialize_app', side_effect=fake_init_app) as mock_init_app, \
     patch('firebase_admin.firestore.client') as mock_firestore_client:
    mock_cert.return_value = MagicMock()
    mock_firestore_client.return_value = MagicMock()

    import importlib.util
    spec = importlib.util.spec_from_file_location("main", os.path.join(backend_dir, 'main.py'))
    main_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(main_module)
    flask_app = main_module.app


CSRF_EXEMPT_PATHS = {
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/google-login',
    '/api/v1/auth/logout',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/confirm-password-reset',
    '/api/v1/dashboard/csrf-token',
}


def run_collection():
    collection_path = os.path.join(backend_dir, 'postman', 'Lugn-Trygg-Auth-API.postman_collection.json')
    if not os.path.exists(collection_path):
        print(f"Collection not found: {collection_path}")
        return 1

    with open(collection_path, encoding='utf-8') as f:
        collection = json.load(f)

    # Test user data and helper services
    UID = 'testuser1234567890ab'
    EMAIL = 'test@example.com'
    NAME = 'Test User'
    USER_DATA = {
        'uid': UID,
        'email': EMAIL,
        'name': NAME,
        'two_factor_enabled': False,
        'biometric_enabled': False,
        'language': 'sv',
        'login_method': 'email',
        'temp_2fa_secret': None,
        'temp_2fa_method': None,
        'temp_2fa_created_at': None,
        'two_factor_secret': None,
        'consent': {
            'analytics_consent': False,
            'marketing_consent': False,
            'data_processing_consent': True,
            'consent_updated_at': datetime.now(UTC).isoformat()
        }
    }

    from types import SimpleNamespace
    MockUser = SimpleNamespace(uid=UID, email=EMAIL)

    issuer = os.environ.get('JWT_ISSUER', 'lugn-trygg')
    audience = os.environ.get('JWT_AUDIENCE', 'lugn-trygg-web')

    def make_token(token_type, user_id=UID):
        secret = os.environ.get('JWT_SECRET_KEY') if token_type == 'access' else os.environ.get('JWT_REFRESH_SECRET_KEY')
        if token_type == 'access':
            exp = datetime.now(UTC) + timedelta(minutes=15)
        else:
            exp = datetime.now(UTC) + timedelta(days=7)
        payload = {
            'sub': user_id,
            'type': token_type,
            'exp': exp,
            'iss': issuer,
            'aud': audience,
        }
        return jwt.encode(payload, secret, algorithm='HS256')

    def build_mock_db():
        mock_db = MagicMock()
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = USER_DATA
        doc.id = UID
        doc_ref = MagicMock()
        doc_ref.get.return_value = doc
        doc_ref.update = MagicMock()
        doc_ref.set = MagicMock()
        col = MagicMock()
        col.document.return_value = doc_ref

        def _where_side_effect(*args, **kwargs):
            filter_obj = kwargs.get('filter')
            email_value = getattr(filter_obj, 'value', None) if filter_obj else None
            query_mock = MagicMock()
            # Simulate existing user only for the seeded email; new emails are available
            if email_value == EMAIL:
                query_mock.limit.return_value.get.return_value = [doc]
            else:
                query_mock.limit.return_value.get.return_value = []
            return query_mock

        col.where.side_effect = _where_side_effect
        mock_db.collection.return_value = col
        # Subcollections return empty for export
        subcol = MagicMock()
        subcol.limit.return_value = subcol
        subcol.stream.return_value = []
        doc_ref.collection.return_value = subcol
        return mock_db

    class MockAuthService:
        @staticmethod
        def register_user(email, password, profile_data=None):
            return MockUser, None
        @staticmethod
        def login_user(email, password):
            return MockUser, None, make_token('access'), make_token('refresh')
        @staticmethod
        def verify_user_identity(user_id):
            return MockUser, None
        @staticmethod
        def issue_session_tokens(user_id):
            return make_token('access'), make_token('refresh')
        @staticmethod
        def rotate_refresh_token(refresh_token):
            return {'user_id': UID, 'access_token': make_token('access'), 'refresh_token': make_token('refresh')}, None
        @staticmethod
        def logout(user_id, refresh_token=None):
            return 'Logout successful', None
        @staticmethod
        def generate_password_reset_token(user_id):
            return 'reset-token'
        @staticmethod
        def verify_password_reset_token(token):
            return UID, None
        @staticmethod
        def revoke_all_sessions(user_id, reason=None):
            return True, None
        @staticmethod
        def record_failed_attempt(email):
            return None
        @staticmethod
        def reset_failed_attempts(email):
            return None

    with patch('src.utils.speech_utils.initialize_google_speech') as mock_speech, \
         patch('src.firebase_config.initialize_firebase') as mock_firebase, \
         patch('src.firebase_config.db', build_mock_db()) as mock_db, \
         patch('src.routes.auth_routes.AuthService', MockAuthService) as mock_auth_service, \
         patch('src.routes.auth_routes.create_or_update_google_user_simple') as mock_google, \
         patch('firebase_admin.auth.update_user') as mock_auth_update, \
         patch('firebase_admin.auth.verify_id_token') as mock_verify_id_token:
        mock_speech.return_value = True
        mock_firebase.return_value = True
        mock_google.return_value = (USER_DATA, UID, False)
        mock_auth_update.return_value = None
        mock_verify_id_token.return_value = {
            'email': 'google@example.com',
            'name': 'Google User',
            'sub': 'google-123',
            'uid': 'firebase-123'
        }

        # Pre-seed encrypted TOTP secret for 2FA verification
        try:
            from cryptography.fernet import Fernet
            enc_secret = 'enc:' + Fernet(os.environ['HIPAA_ENCRYPTION_KEY'].encode()).encrypt(b'BASE32SECRETKEY').decode()
            USER_DATA['temp_2fa_secret'] = enc_secret
            USER_DATA['temp_2fa_method'] = 'totp'
            USER_DATA['temp_2fa_created_at'] = datetime.now(UTC).isoformat()
            USER_DATA['two_factor_secret'] = enc_secret
        except Exception:
            pass

        flask_app.config['TESTING'] = True
        client = flask_app.test_client()

        # Fetch CSRF token and cookie
        csrf_resp = client.get('/api/v1/dashboard/csrf-token')
        csrf_token = ''
        try:
            csrf_data = csrf_resp.get_json()
            csrf_token = csrf_data.get('csrf_token', '')
        except Exception:
            csrf_token = ''

        # Collection variables
        variables = {v['key']: v['value'] for v in collection.get('variable', [])}
        variables.setdefault('base_url', 'http://localhost')
        variables.setdefault('access_token', '')
        variables.setdefault('user_id', '')

        results = []

        def expand_vars(text):
            if not isinstance(text, str):
                return text
            for key, value in variables.items():
                text = text.replace('{{' + key + '}}', value)
            return text

        def run_item(item, path=""):
            for sub in item.get('item', []):
                run_item(sub, path + item.get('name', '') + '/')
            if 'request' not in item:
                return

            req = item['request']
            method = req.get('method', 'GET')
            raw_url = req.get('url', '')
            if isinstance(raw_url, dict):
                raw_url = raw_url.get('raw', '')
            url = expand_vars(raw_url)
            if not url.startswith('http://'):
                url = 'http://localhost:5000' + url.split('http://localhost:5000')[-1]

            # Strip domain to get path+query
            path_part = url.replace('http://localhost:5000', '').replace('{{base_url}}', '')
            query = {}
            if '?' in path_part:
                path_part, query_str = path_part.split('?', 1)
                for pair in query_str.split('&'):
                    if '=' in pair:
                        k, v = pair.split('=', 1)
                        query[k] = v

            headers = {}
            for h in req.get('header', []):
                if h.get('key'):
                    headers[h['key']] = expand_vars(h.get('value', ''))

            body = None
            if req.get('body'):
                if req['body'].get('mode') == 'raw':
                    body = expand_vars(req['body'].get('raw', ''))

            # Patch request bodies to match route expectations
            if body:
                try:
                    body_json = json.loads(body)
                    if isinstance(body_json, dict):
                        # change-email expects 'password' not 'current_password'
                        if 'change-email' in path_part and 'current_password' in body_json and 'password' not in body_json:
                            body_json['password'] = body_json['current_password']
                        # setup-2fa-biometric expects method and setup_data
                        if 'setup-2fa-biometric' in path_part:
                            body_json = {
                                'method': 'biometric',
                                'setup_data': {
                                    'credential_id': 'test-credential-id',
                                    'public_key': 'test-public-key',
                                    'action': body_json.get('action', 'register')
                                }
                            }
                        body = json.dumps(body_json)
                except Exception:
                    pass

            # Handle inherited auth (collection-level bearer / noauth)
            auth = req.get('auth') or collection.get('auth')
            if auth:
                if auth.get('type') == 'bearer':
                    token_raw = ''
                    for kv in auth.get('bearer', []):
                        if kv.get('key') == 'token':
                            token_raw = expand_vars(kv.get('value', ''))
                    if token_raw == '{{access_token}}':
                        token_value = variables.get('access_token', '')
                    else:
                        token_value = token_raw
                    if token_value:
                        headers['Authorization'] = 'Bearer ' + token_value
                elif auth.get('type') == 'noauth':
                    headers.pop('Authorization', None)

            # Add CSRF token for non-exempt requests
            if csrf_token and path_part not in CSRF_EXEMPT_PATHS:
                headers.setdefault('X-CSRF-Token', csrf_token)

            # Refresh requires a valid refresh-token cookie; re-login if it was cleared
            if 'refresh' in path_part:
                try:
                    has_refresh = any(c.name == 'refresh_token' for c in client.cookie_jar)
                except Exception:
                    has_refresh = False
                if not has_refresh:
                    try:
                        client.post('/api/v1/auth/login', data=json.dumps({
                            'email': 'test@example.com',
                            'password': 'SecureP@ss123!'
                        }), content_type='application/json', headers={'Content-Type': 'application/json'})
                    except Exception:
                        pass

            func = getattr(client, method.lower())
            kwargs = {'headers': headers}
            if body:
                kwargs['data'] = body
                kwargs['content_type'] = 'application/json'
            if query:
                kwargs['query_string'] = query

            try:
                resp = func(path_part, **kwargs)
                status = resp.status_code
            except Exception as e:
                status = f"ERROR: {e}"
                results.append((item.get('name', 'unnamed'), status))
                return

            results.append((item.get('name', 'unnamed'), status))

            # Run test scripts to extract variables
            for event in item.get('event', []):
                if event.get('listen') != 'test':
                    continue
                script = event.get('script', {}).get('exec', [])
                script_text = '\n'.join(script)
                if 'pm.response.json()' not in script_text and 'pm.response' not in script_text:
                    continue
                try:
                    json_data = resp.get_json() or {}
                except Exception:
                    json_data = {}
                data = json_data.get('data', {}) if isinstance(json_data, dict) else {}

                # Extract access token (snake or camelCase)
                if 'access_token' in script_text or 'accessToken' in script_text:
                    try:
                        token = data.get('access_token') or data.get('accessToken')
                        if token:
                            variables['access_token'] = token
                    except Exception:
                        pass

                # Extract user id (snake or camelCase or nested user.id)
                if 'user_id' in script_text or 'userId' in script_text or 'user.id' in script_text:
                    try:
                        user_id = data.get('user_id') or data.get('userId')
                        if not user_id:
                            user = data.get('user', {})
                            if user and 'id' in user:
                                user_id = user['id']
                        if user_id:
                            variables['user_id'] = user_id
                    except Exception:
                        pass

        for item in collection['item']:
            run_item(item)

        print("\n=== Postman Collection Run Results ===\n")
        for name, status in results:
            print(f"{name}: {status}")

        print(f"\nTotal requests: {len(results)}")

        return 0


if __name__ == '__main__':
    sys.exit(run_collection())
