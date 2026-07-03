"""Unit tests for auth bug fixes (Bugs 2-8)."""
import base64, json, pytest
from flask import Flask
import src.services.auth_service as auth_mod
from src.services.auth_service import AuthService


class FakeDoc:
    def __init__(self, data=None):
        self._data = data or {}
        self.exists = bool(data)
    def to_dict(self):
        return self._data

class FakeDocument:
    def __init__(self, storage, collection, doc_id):
        self.storage, self.collection, self.doc_id = storage, collection, doc_id
    def set(self, data, merge=False):
        coll = self.storage.setdefault(self.collection, {})
        if merge and self.doc_id in coll:
            coll[self.doc_id].update(data)
        else:
            coll[self.doc_id] = data.copy()
    def get(self):
        coll = self.storage.get(self.collection, {})
        data = coll.get(self.doc_id)
        return FakeDoc(None) if data is None else FakeDoc(data.copy())
    def delete(self):
        coll = self.storage.get(self.collection, {})
        self.doc_id in coll and coll.pop(self.doc_id)

class FakeCollection:
    def __init__(self, storage, name):
        self.storage, self.name = storage, name
    def document(self, doc_id):
        return FakeDocument(self.storage, self.name, doc_id)
    def where(self, field, op, value):
        storage, name = self.storage, self.name
        class S:
            def stream(self_inner):
                for _, d in storage.get(name, {}).items():
                    yield FakeDoc(d.copy())
        return S()

class FakeDB:
    def __init__(self):
        self.storage = {}
    def collection(self, name):
        return FakeCollection(self.storage, name)

class DummyUserRecord:
    def __init__(self, uid, email):
        self.uid, self.email = uid, email

class FakeResponse:
    def __init__(self, status_code=200, data=None):
        self.status_code = status_code
        self._data = data or {}
    def json(self):
        return self._data

class FakeAuditService:
    def __init__(self):
        self.logged = []
    def log_event(self, event_type, user_id, details, **kw):
        self.logged.append((event_type, user_id, details))

@pytest.fixture(autouse=True)
def isolate_env(monkeypatch):
    fake_db = FakeDB()
    monkeypatch.setattr(auth_mod, 'db', fake_db)
    monkeypatch.setattr(auth_mod, '_db', fake_db)
    monkeypatch.setattr(auth_mod, 'AuditService', lambda: FakeAuditService())
    monkeypatch.setattr(auth_mod, 'convert_email_to_punycode', lambda e: e)
    yield


# Bug 2: login_user only records failed attempts for credential errors
def test_login_network_error_no_failed_attempt(monkeypatch):
    calls = []
    monkeypatch.setattr(AuthService, 'record_failed_attempt', staticmethod(lambda e: calls.append(e)))
    def raise_net(url, json=None, timeout=None):
        raise ConnectionError('Connection refused')
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(raise_net)})())
    u, err, at, rt = AuthService.login_user('victim@example.com', 'pass')
    assert u is None and err is not None
    assert len(calls) == 0, "Network error must not record failed attempt"

def test_login_invalid_password_records_attempt(monkeypatch):
    calls = []
    monkeypatch.setattr(AuthService, 'record_failed_attempt', staticmethod(lambda e: calls.append(e)))
    def fake_post(url, json=None, timeout=None):
        return FakeResponse(400, {'error': {'message': 'INVALID_PASSWORD'}})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())
    u, err, at, rt = AuthService.login_user('user@example.com', 'wrong')
    assert u is None
    assert len(calls) == 1, "Credential error should record failed attempt"

def test_login_email_not_found_records_attempt(monkeypatch):
    calls = []
    monkeypatch.setattr(AuthService, 'record_failed_attempt', staticmethod(lambda e: calls.append(e)))
    def fake_post(url, json=None, timeout=None):
        return FakeResponse(400, {'error': {'message': 'EMAIL_NOT_FOUND'}})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())
    u, err, at, rt = AuthService.login_user('none@example.com', 'pass')
    assert u is None
    assert len(calls) == 1


# Bug 3: login_with_id_token verifies token before lockout check
def test_lockout_uses_verified_email(monkeypatch):
    monkeypatch.setattr(auth_mod.firebase_auth, 'verify_id_token', lambda t: {'uid': 'uid-1', 'email': 'verified@x.com'})
    monkeypatch.setattr(auth_mod.firebase_auth, 'get_user', lambda uid: DummyUserRecord(uid, 'verified@x.com'))
    lockout_emails = []
    def fake_lockout(email):
        lockout_emails.append(email)
        return False, None
    monkeypatch.setattr(AuthService, 'check_account_lockout', staticmethod(fake_lockout))
    u, err, at, rt = AuthService.login_with_id_token('token')
    assert err is None
    assert lockout_emails == ['verified@x.com']

def test_locked_account_rejected_after_verification(monkeypatch):
    monkeypatch.setattr(auth_mod.firebase_auth, 'verify_id_token', lambda t: {'uid': 'uid-l', 'email': 'locked@x.com'})
    monkeypatch.setattr(AuthService, 'check_account_lockout', staticmethod(lambda e: (True, 'Locked 15 min')))
    u, err, at, rt = AuthService.login_with_id_token('token')
    assert u is None
    assert 'locked' in err.lower()


# Bug 4: login_with_id_token does not record failed attempts with unverified email
def test_bad_id_token_no_failed_attempt(monkeypatch):
    calls = []
    monkeypatch.setattr(AuthService, 'record_failed_attempt', staticmethod(lambda e: calls.append(e)))
    monkeypatch.setattr(auth_mod.firebase_auth, 'verify_id_token', lambda t: (_ for _ in ()).throw(Exception('bad token')))
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b'=').decode()
    payload = base64.urlsafe_b64encode(json.dumps({"email": "victim@x.com"}).encode()).rstrip(b'=').decode()
    crafted = f"{header}.{payload}.fake"
    u, err, at, rt = AuthService.login_with_id_token(crafted)
    assert u is None and err is not None
    assert len(calls) == 0, "Must not record failed attempt with unverified email"


# Bug 5: verify_token checks token type claim
def test_verify_token_rejects_refresh_as_access():
    from datetime import datetime, timedelta, UTC
    import jwt as pyjwt
    from src.config import JWT_REFRESH_SECRET_KEY
    payload = {"sub": "test-user-12345678", "type": "refresh", "exp": datetime.now(UTC) + timedelta(hours=1)}
    refresh_tok = pyjwt.encode(payload, JWT_REFRESH_SECRET_KEY, algorithm="HS256")
    uid, err = AuthService.verify_token(refresh_tok)
    assert uid is None, "Refresh token must not pass as access token"

def test_verify_token_accepts_valid_access_token():
    tok = AuthService.generate_access_token('test-user-12345678')
    uid, err = AuthService.verify_token(tok)
    assert err is None
    assert uid == 'test-user-12345678'

def test_verify_token_rejects_wrong_type_claim():
    from datetime import datetime, timedelta, UTC
    import jwt as pyjwt
    from src.config import JWT_SECRET_KEY
    payload = {"sub": "test-user-12345678", "type": "refresh", "exp": datetime.now(UTC) + timedelta(hours=1)}
    tok = pyjwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
    uid, err = AuthService.verify_token(tok)
    assert uid is None, "Token with type != 'access' must be rejected"
    assert err is not None


# Bug 6: ConfirmPasswordResetRequest only in schemas/auth.py
def test_confirm_password_reset_not_in_auth_service():
    assert not hasattr(auth_mod, 'ConfirmPasswordResetRequest'), \
        "ConfirmPasswordResetRequest should only exist in schemas/auth.py"

def test_confirm_password_reset_in_schemas():
    from src.schemas.auth import ConfirmPasswordResetRequest
    assert hasattr(ConfirmPasswordResetRequest, 'model_fields')
    assert 'token' in ConfirmPasswordResetRequest.model_fields
    assert 'new_password' in ConfirmPasswordResetRequest.model_fields


# Bug 7: TOTP encryption fails hard when key is missing
def test_encrypt_totp_secret_raises_without_key(monkeypatch):
    import src.routes.auth_routes as routes_mod
    monkeypatch.setattr(routes_mod, '_get_totp_cipher', lambda: None)
    with pytest.raises(RuntimeError, match="HIPAA_ENCRYPTION_KEY"):
        routes_mod._encrypt_totp_secret("JBSWY3DPEHPK3PXP")


# Bug 8: generate_password_reset_token uses top-level imports
def test_generate_password_reset_token_uses_top_level_imports():
    import inspect
    src = inspect.getsource(AuthService.generate_password_reset_token)
    assert 'import secrets' not in src, "Shadowed 'import secrets' should be removed"
    assert 'from datetime' not in src, "Shadowed 'from datetime' should be removed"
