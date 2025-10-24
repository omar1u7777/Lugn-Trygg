"""
Unit tests for AuthService (isolated, mocks only)
"""
import pytest
import json
import base64
from datetime import datetime, timezone
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
        self.storage = storage
        self.collection = collection
        self.doc_id = doc_id
    def set(self, data, merge=False):
        coll = self.storage.setdefault(self.collection, {})
        if merge and self.doc_id in coll:
            coll[self.doc_id].update(data)
        else:
            coll[self.doc_id] = data.copy()
    def get(self):
        coll = self.storage.get(self.collection, {})
        data = coll.get(self.doc_id)
        if data is None:
            return FakeDoc(None)
        return FakeDoc(data.copy())
    def delete(self):
        coll = self.storage.get(self.collection, {})
        if self.doc_id in coll:
            del coll[self.doc_id]

class FakeCollection:
    def __init__(self, storage, name):
        self.storage = storage
        self.name = name
    def document(self, doc_id):
        return FakeDocument(self.storage, self.name, doc_id)
    def where(self, field, op, value):
        storage = self.storage
        name = self.name
        class Streamer:
            def __init__(self):
                pass
            def stream(self):
                coll = storage.get(name, {})
                for doc_id, data in coll.items():
                    if data.get(field) == value:
                        yield FakeDoc(data.copy())
        return Streamer()

class FakeDB:
    def __init__(self):
        self.storage = {}
    def collection(self, name):
        return FakeCollection(self.storage, name)

class DummyUserRecord:
    def __init__(self, uid, email):
        self.uid = uid
        self.email = email

class DummyFirebaseCreateUser:
    def __init__(self, uid):
        self.uid = uid

class FakeResponse:
    def __init__(self, status_code=200, data=None):
        self.status_code = status_code
        self._data = data or {}
    def json(self):
        return self._data

class FakeAuditService:
    def __init__(self):
        self.logged = []
    def log_event(self, event_type, user_id, details, **kwargs):
        self.logged.append((event_type, user_id, details))

@pytest.fixture(autouse=True)
def isolate_env(monkeypatch):
    fake_db = FakeDB()
    monkeypatch.setattr(auth_mod, 'db', fake_db)
    monkeypatch.setattr(auth_mod, 'AuditService', lambda: FakeAuditService())
    monkeypatch.setattr(auth_mod, 'convert_email_to_punycode', lambda e: e)
    yield


def test_register_user_success(monkeypatch):
    def fake_create_user(email, password):
        return DummyFirebaseCreateUser(uid='uid-123')
    monkeypatch.setattr(auth_mod.auth, 'create_user', fake_create_user)

    user, err = AuthService.register_user('a@b.com', 'pass')
    assert err is None
    assert user.uid == 'uid-123'


def test_register_user_email_exists(monkeypatch):
    class E(Exception):
        pass
    monkeypatch.setattr(auth_mod.auth, 'EmailAlreadyExistsError', E)
    def raise_exists(email, password):
        raise E('exists')
    monkeypatch.setattr(auth_mod.auth, 'create_user', raise_exists)

    user, err = AuthService.register_user('a@b.com', 'pass')
    assert user is None
    assert 'används redan' in err or 'används' in err


def test_login_user_success(monkeypatch):
    def fake_post(url, json=None):
        return FakeResponse(200, {'idToken': 'id-123', 'refreshToken': 'rt-123'})
    # requests in module expects an object with .post()
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())
    monkeypatch.setattr(auth_mod.auth, 'get_user_by_email', lambda email: DummyUserRecord(uid='uid-123', email=email))

    user, err, access_token, refresh_token = AuthService.login_user('a@b.com', 'pass')
    assert err is None
    assert user.uid == 'uid-123'
    assert access_token is not None
    assert refresh_token == 'rt-123'


def test_login_user_invalid_credentials(monkeypatch):
    def fake_post(url, json=None):
        return FakeResponse(400, {})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())

    user, err, at, rt = AuthService.login_user('a@b.com', 'wrong')
    assert user is None
    assert 'Felaktiga inloggningsuppgifter' in err


def test_refresh_token_success(monkeypatch):
    fake_db = auth_mod.db
    fake_db.collection('refresh_tokens').document('uid-123').set({'firebase_refresh_token': 'rt-abc'})
    def fake_post(url, json=None):
        return FakeResponse(200, {'id_token': 'new-id'})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())

    new_access, err = AuthService.refresh_token('uid-123')
    assert err is None
    assert new_access is not None


def test_refresh_token_missing(monkeypatch):
    new_access, err = AuthService.refresh_token('no-such')
    assert new_access is None
    assert 'Ogiltigt refresh-token' in err


def test_generate_and_verify_token_roundtrip():
    token = AuthService.generate_access_token('test-user-1')
    uid, err = AuthService.verify_token(token)
    assert err is None
    assert uid == 'test-user-1'


def test_verify_token_special_cases():
    uid, err = AuthService.verify_token('mock-access-token')
    assert uid == 'test-uid-123'
    uid2, err2 = AuthService.verify_token('test-token')
    assert uid2 == 'test-user-id'
    bad_uid, bad_err = AuthService.verify_token('this-is-not-a-token')
    assert bad_uid is None
    assert 'Ogiltigt token' in bad_err


def test_logout_success():
    fake_db = auth_mod.db
    fake_db.collection('refresh_tokens').document('uid-123').set({'firebase_refresh_token': 'x'})
    msg, err = AuthService.logout('uid-123')
    assert msg is not None
    assert err is None


def test_jwt_required_decorator():
    app = Flask(__name__)
    @app.route('/test')
    @AuthService.jwt_required
    def protected():
        return 'ok'

    client = app.test_client()
    resp = client.get('/test', headers={'Authorization': 'Bearer mock-access-token'})
    assert resp.status_code == 200
    assert resp.data == b'ok'
    resp2 = client.get('/test')
    assert resp2.status_code == 401


def test_webauthn_flow(monkeypatch):
    fake_db = auth_mod.db
    user_id = 'user-xyz'
    chal = AuthService.generate_webauthn_challenge(user_id)
    assert 'challenge' in chal
    stored = fake_db.collection('webauthn_challenges').document(user_id).get().to_dict()
    assert stored['challenge'] == chal['challenge']

    client_data = {'challenge': chal['challenge']}
    client_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
    credential_data = {'id': 'cred-1', 'response': {'clientDataJSON': client_b64, 'publicKey': 'pk'}}

    ok = AuthService.register_webauthn_credential(user_id, credential_data)
    assert ok is True
    cred = fake_db.collection('webauthn_credentials').document('cred-1').get().to_dict()
    assert cred['user_id'] == user_id

    fake_db.collection('webauthn_credentials').document('cred-2').set({'user_id': user_id, 'credential_id': 'cred-2'})
    auth_chal = AuthService.authenticate_webauthn(user_id, {})
    assert 'challenge' in auth_chal
    assert isinstance(auth_chal['allowCredentials'], list)

    fake_db.collection('webauthn_challenges').document(user_id).set({'challenge': auth_chal['challenge']})
    client_data2 = {'challenge': auth_chal['challenge']}
    client_b64_2 = base64.b64encode(json.dumps(client_data2).encode()).decode()
    assertion = {'response': {'clientDataJSON': client_b64_2}}
    ok2 = AuthService.verify_webauthn_assertion(user_id, assertion)
    assert ok2 is True


def test_audit_log_does_not_raise(monkeypatch):
    monkeypatch.setattr(auth_mod, 'request', None)
    AuthService._audit_log('TEST', 'u', {'k': 'v'})


def test_login_user_user_not_found(monkeypatch):
    def fake_post(url, json=None):
        return FakeResponse(200, {'idToken': 'id-123', 'refreshToken': 'rt-123'})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())

    class UNF(Exception):
        pass
    monkeypatch.setattr(auth_mod.auth, 'UserNotFoundError', UNF)
    def raise_unf(email):
        raise UNF('no')
    monkeypatch.setattr(auth_mod.auth, 'get_user_by_email', raise_unf)

    user, err, at, rt = AuthService.login_user('a@b.com', 'pass')
    assert user is None
    assert 'Felaktiga inloggningsuppgifter' in err


def test_login_user_fallback_on_requests_exception(monkeypatch):
    def raise_exc(url, json=None):
        raise Exception('boom')
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(raise_exc)})())
    monkeypatch.setattr(auth_mod.auth, 'get_user_by_email', lambda email: DummyUserRecord(uid='uid-999', email=email))

    user, err, at, rt = AuthService.login_user('a@b.com', 'pass')
    assert err is None
    assert user.uid == 'uid-999'
    assert rt == 'mock-refresh-token'


def test_refresh_token_invalid_response(monkeypatch):
    fake_db = auth_mod.db
    fake_db.collection('refresh_tokens').document('uid-123').set({'firebase_refresh_token': 'rt-abc'})
    def fake_post(url, json=None):
        return FakeResponse(400, {})
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(fake_post)})())

    new_access, err = AuthService.refresh_token('uid-123')
    assert new_access is None
    assert 'Ogiltigt refresh-token' in err


def test_refresh_token_exception(monkeypatch):
    fake_db = auth_mod.db
    fake_db.collection('refresh_tokens').document('uid-123').set({'firebase_refresh_token': 'rt-abc'})
    def raise_exc(url, json=None):
        raise Exception('boom')
    monkeypatch.setattr('src.services.auth_service.requests', type('R', (), {'post': staticmethod(raise_exc)})())

    new_access, err = AuthService.refresh_token('uid-123')
    assert new_access is None
    assert 'internt' in err or 'fel' in err.lower()


def test_jwt_required_options_method():
    app = Flask(__name__)
    @app.route('/opt', methods=['OPTIONS', 'GET'])
    @AuthService.jwt_required
    def opt():
        return 'ok'

    client = app.test_client()
    resp = client.open('/opt', method='OPTIONS')
    assert resp.status_code == 204


def test_webauthn_register_no_challenge():
    ok = AuthService.register_webauthn_credential('no-user', {'id': 'x', 'response': {'clientDataJSON': ''}})
    assert ok is False


def test_webauthn_register_bad_client_data(monkeypatch):
    fake_db = auth_mod.db
    fake_db.collection('webauthn_challenges').document('u1').set({'challenge': 'abc'})
    client_data = {'challenge': 'different'}
    client_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
    credential_data = {'id': 'cred-x', 'response': {'clientDataJSON': client_b64, 'publicKey': 'pk'}}
    ok = AuthService.register_webauthn_credential('u1', credential_data)
    assert ok is False


def test_verify_webauthn_assertion_no_challenge():
    ok = AuthService.verify_webauthn_assertion('no-user', {'response': {'clientDataJSON': ''}})
    assert ok is False


def test_authenticate_webauthn_exception(monkeypatch):
    def bad_collection(name):
        raise Exception('db fail')
    monkeypatch.setattr(auth_mod, 'db', type('DB', (), {'collection': staticmethod(bad_collection)})())
    res = AuthService.authenticate_webauthn('u', {})
    assert res is None


def test_audit_log_with_request(monkeypatch):
    class Req:
        remote_addr = '1.2.3.4'
        headers = {'User-Agent': 'pytest'}
    monkeypatch.setattr(auth_mod, 'request', Req())
    AuthService._audit_log('EV', 'u', {'k': 'v'})


# --- Extra coverage for uncovered lines ---
def test_register_webauthn_credential_challenge_missing(monkeypatch):
    fake_db = auth_mod.db
    # No challenge stored
    ok = AuthService.register_webauthn_credential('no-user', {'id': 'x', 'response': {'clientDataJSON': ''}})
    assert ok is False

def test_register_webauthn_credential_bad_client_data(monkeypatch):
    fake_db = auth_mod.db
    # Store a challenge
    fake_db.collection('webauthn_challenges').document('u1').set({'challenge': 'abc'})
    # client sends different challenge
    client_data = {'challenge': 'different'}
    client_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
    credential_data = {'id': 'cred-x', 'response': {'clientDataJSON': client_b64, 'publicKey': 'pk'}}
    ok = AuthService.register_webauthn_credential('u1', credential_data)
    assert ok is False

def test_register_webauthn_credential_exception(monkeypatch):
    # Patch db.collection to raise
    monkeypatch.setattr(auth_mod, 'db', type('DB', (), {'collection': staticmethod(lambda name: (_ for _ in ()).throw(Exception('fail')) )})())
    ok = AuthService.register_webauthn_credential('u2', {'id': 'x', 'response': {'clientDataJSON': ''}})
    assert ok is False

def test_authenticate_webauthn_exception(monkeypatch):
    monkeypatch.setattr(auth_mod, 'db', type('DB', (), {'collection': staticmethod(lambda name: (_ for _ in ()).throw(Exception('fail')) )})())
    res = AuthService.authenticate_webauthn('u', {})
    assert res is None

def test_verify_webauthn_assertion_challenge_missing(monkeypatch):
    fake_db = auth_mod.db
    ok = AuthService.verify_webauthn_assertion('no-user', {'response': {'clientDataJSON': ''}})
    assert ok is False

def test_verify_webauthn_assertion_bad_client_data(monkeypatch):
    fake_db = auth_mod.db
    fake_db.collection('webauthn_challenges').document('u1').set({'challenge': 'abc'})
    client_data = {'challenge': 'different'}
    client_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
    assertion = {'response': {'clientDataJSON': client_b64}}
    ok = AuthService.verify_webauthn_assertion('u1', assertion)
    assert ok is False

def test_verify_webauthn_assertion_exception(monkeypatch):
    monkeypatch.setattr(auth_mod, 'db', type('DB', (), {'collection': staticmethod(lambda name: (_ for _ in ()).throw(Exception('fail')) )})())
    ok = AuthService.verify_webauthn_assertion('u2', {'response': {'clientDataJSON': ''}})
    assert ok is False


def test_jwt_required_invalid_header(monkeypatch):
    app = Flask(__name__)
    @app.route('/jwt2')
    @AuthService.jwt_required
    def protected():
        return 'ok'
    client = app.test_client()
    # No header
    resp = client.get('/jwt2')
    assert resp.status_code == 401
    # Bad header
    resp2 = client.get('/jwt2', headers={'Authorization': 'Token xyz'})
    assert resp2.status_code == 401

def test_audit_log_error(monkeypatch):
    # Patch AuditService.log_event to raise
    class BadAudit:
        def log_event(self, *a, **k):
            raise Exception('fail')
    monkeypatch.setattr(auth_mod, 'AuditService', lambda: BadAudit())
    # Patch request to None
    monkeypatch.setattr(auth_mod, 'request', None)
    # Should not raise
    AuthService._audit_log('E', 'u', {'k': 'v'})
