"""
Unit tests for AuditService and PushNotificationService
"""
import pytest
import os
from datetime import datetime, timezone, timedelta
from cryptography.fernet import Fernet

import src.services.audit_service as audit_mod
import src.services.push_notification_service as push_mod
from src.services.audit_service import AuditService
from src.services.push_notification_service import PushNotificationService


class FakeDoc:
    def __init__(self, data=None, doc_id='doc123'):
        self._data = data or {}
        self.exists = bool(data)
        self.id = doc_id
        self.reference = self
    def to_dict(self):
        return self._data
    def delete(self):
        pass

class FakeDocument:
    def __init__(self, storage, collection, doc_id=None):
        self.storage = storage
        self.collection = collection
        self.doc_id = doc_id or 'auto-id'
    def set(self, data, merge=False):
        coll = self.storage.setdefault(self.collection, {})
        coll[self.doc_id] = data.copy()
    def get(self):
        coll = self.storage.get(self.collection, {})
        data = coll.get(self.doc_id)
        if data is None:
            return FakeDoc(None)
        return FakeDoc(data.copy(), self.doc_id)
    def delete(self):
        coll = self.storage.get(self.collection, {})
        if self.doc_id in coll:
            del coll[self.doc_id]

class FakeQuery:
    def __init__(self, storage, collection, filters):
        self.storage = storage
        self.collection = collection
        self.filters = filters
        self._order_by = None
        self._limit_val = None
    def where(self, field, op, value):
        new_filters = self.filters + [(field, op, value)]
        return FakeQuery(self.storage, self.collection, new_filters)
    def order_by(self, field, direction=None):
        self._order_by = (field, direction)
        return self
    def limit(self, n):
        self._limit_val = n
        return self
    def stream(self):
        coll = self.storage.get(self.collection, {})
        results = []
        for doc_id, data in coll.items():
            match = True
            for field, op, value in self.filters:
                if op == '==':
                    if data.get(field) != value:
                        match = False
                        break
                elif op == '<':
                    if not (data.get(field) and data.get(field) < value):
                        match = False
                        break
            if match:
                # create a doc with a reference that can delete itself from storage
                class Ref:
                    def __init__(self, storage, collection, doc_id):
                        self.storage = storage
                        self.collection = collection
                        self.doc_id = doc_id
                    def delete(self):
                        coll2 = self.storage.get(self.collection, {})
                        if self.doc_id in coll2:
                            del coll2[self.doc_id]
                fd = FakeDoc(data.copy(), doc_id)
                fd.reference = Ref(self.storage, self.collection, doc_id)
                results.append(fd)
        if self._order_by:
            field, direction = self._order_by
            reverse = (direction == 'DESCENDING')
            results.sort(key=lambda d: d.to_dict().get(field, ''), reverse=reverse)
        if self._limit_val:
            results = results[:self._limit_val]
        return results

class FakeCollection:
    def __init__(self, storage, name):
        self.storage = storage
        self.name = name
    def document(self, doc_id=None):
        return FakeDocument(self.storage, self.name, doc_id)
    def where(self, field, op, value):
        return FakeQuery(self.storage, self.name, [(field, op, value)])
    def order_by(self, field, direction=None):
        return FakeQuery(self.storage, self.name, []).order_by(field, direction)

class FakeDB:
    def __init__(self):
        self.storage = {}
    def collection(self, name):
        return FakeCollection(self.storage, name)

@pytest.fixture(autouse=True)
def isolate_audit_env(monkeypatch):
    # Set encryption key
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv('HIPAA_ENCRYPTION_KEY', test_key)
    # Replace db
    fake_db = FakeDB()
    monkeypatch.setattr(audit_mod, 'db', fake_db)
    yield


# AuditService tests
def test_audit_service_init_with_env_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv('HIPAA_ENCRYPTION_KEY', test_key)
    service = AuditService()
    assert service.encryption_key == test_key


def test_audit_service_init_without_env_key(monkeypatch):
    """Test that AuditService REQUIRES HIPAA_ENCRYPTION_KEY for production security"""
    monkeypatch.delenv('HIPAA_ENCRYPTION_KEY', raising=False)
    
    # Should raise ValueError - HIPAA key is REQUIRED for production
    with pytest.raises(ValueError) as exc_info:
        service = AuditService()
    
    # Verify error message is clear
    assert "HIPAA_ENCRYPTION_KEY" in str(exc_info.value)
    assert "REQUIRED" in str(exc_info.value)


def test_encrypt_decrypt_roundtrip():
    service = AuditService()
    original = 'sensitive data'
    encrypted = service.encrypt_data(original)
    assert encrypted != original
    decrypted = service.decrypt_data(encrypted)
    assert decrypted == original


def test_log_event_success():
    service = AuditService()
    service.log_event('TEST_EVENT', 'user-1', {'key': 'value'}, '1.2.3.4', 'Mozilla')
    # Check that entry was stored
    fake_db = audit_mod.db
    coll = fake_db.storage.get('audit_logs', {})
    assert len(coll) > 0
    doc = list(coll.values())[0]
    assert doc['event_type'] == 'TEST_EVENT'
    assert doc['user_id'] == 'user-1'
    assert doc['ip_address'] == '1.2.3.4'


def test_log_event_without_ip_agent():
    service = AuditService()
    service.log_event('EV2', 'user-2', {})
    fake_db = audit_mod.db
    coll = fake_db.storage.get('audit_logs', {})
    doc = list(coll.values())[0]
    assert doc['user_id'] == 'user-2'


def test_apply_retention_policy():
    service = AuditService()
    fake_db = audit_mod.db
    # Create old log
    old_date = (datetime.now(timezone.utc) - timedelta(days=3000)).isoformat()
    fake_db.collection('audit_logs').document('old1').set({'timestamp': old_date, 'event_type': 'OLD'})
    # Create recent log
    recent_date = datetime.now(timezone.utc).isoformat()
    fake_db.collection('audit_logs').document('recent1').set({'timestamp': recent_date, 'event_type': 'RECENT'})
    
    service._apply_retention_policy()
    # Old log should be deleted
    coll = fake_db.storage.get('audit_logs', {})
    # Should only have recent
    assert 'old1' not in coll
    assert 'recent1' in coll


def test_get_audit_trail():
    service = AuditService()
    fake_db = audit_mod.db
    # Add some logs for user
    details_encrypted = service.encrypt_data('{"action":"login"}')
    fake_db.collection('audit_logs').document('l1').set({
        'user_id': 'user-x',
        'event_type': 'LOGIN',
        'details': details_encrypted,
        'timestamp': '2025-01-01T00:00:00'
    })
    fake_db.collection('audit_logs').document('l2').set({
        'user_id': 'user-x',
        'event_type': 'LOGOUT',
        'details': details_encrypted,
        'timestamp': '2025-01-02T00:00:00'
    })
    
    trail = service.get_audit_trail('user-x', limit=10)
    assert len(trail) == 2
    # Details should be decrypted
    assert '{"action":"login"}' in trail[0]['details'] or '{"action":"login"}' in trail[1]['details']


def test_get_audit_trail_decryption_fail():
    service = AuditService()
    fake_db = audit_mod.db
    # Add log with bad encrypted details
    fake_db.collection('audit_logs').document('bad').set({
        'user_id': 'user-y',
        'event_type': 'BAD',
        'details': 'not-valid-encrypted-data',
        'timestamp': '2025-01-01T00:00:00'
    })
    
    trail = service.get_audit_trail('user-y')
    assert len(trail) == 1
    assert trail[0]['details'] == 'Decryption failed'


def test_log_baa_agreement():
    service = AuditService()
    service.log_baa_agreement('user-z', True, '2.0')
    fake_db = audit_mod.db
    coll = fake_db.storage.get('audit_logs', {})
    doc = list(coll.values())[0]
    assert doc['event_type'] == 'BAA_AGREEMENT'


def test_encrypt_sensitive_data():
    service = AuditService()
    data = {
        'email': 'test@example.com',
        'phone': '1234567890',
        'other': 'public'
    }
    encrypted = service.encrypt_sensitive_data(data)
    assert encrypted['email'] != 'test@example.com'
    assert encrypted['other'] == 'public'


def test_decrypt_sensitive_data():
    service = AuditService()
    data = {
        'email': 'test@example.com',
        'other': 'public'
    }
    encrypted = service.encrypt_sensitive_data(data)
    decrypted = service.decrypt_sensitive_data(encrypted)
    assert decrypted['email'] == 'test@example.com'
    assert decrypted['other'] == 'public'


def test_decrypt_sensitive_data_fail(monkeypatch):
    service = AuditService()
    # Data with invalid encrypted field
    data = {'email': 'not-encrypted', 'other': 'public'}
    decrypted = service.decrypt_sensitive_data(data)
    # Should not raise, just warn
    assert 'other' in decrypted


def test_audit_log_function():
    from src.services.audit_service import audit_log
    audit_log('FUNC_EV', 'user-f', {'k': 'v'}, '1.1.1.1', 'Agent')
    fake_db = audit_mod.db
    coll = fake_db.storage.get('audit_logs', {})
    assert len(coll) > 0


# PushNotificationService tests
@pytest.fixture(autouse=True)
def isolate_push_env(monkeypatch):
    # Enable push notifications by default
    monkeypatch.setenv('FCM_ENABLED', 'true')
    yield


def test_push_service_init_enabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'true')
    service = PushNotificationService()
    assert service.enabled is True


def test_push_service_init_disabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'false')
    service = PushNotificationService()
    assert service.enabled is False


def test_send_referral_success_notification_disabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'false')
    service = PushNotificationService()
    result = service.send_referral_success_notification('token', 'Alice', 'Bob', 5)
    assert result['success'] is False
    assert 'disabled' in result['error']


def test_send_referral_success_notification_no_token():
    service = PushNotificationService()
    result = service.send_referral_success_notification('', 'Alice', 'Bob', 5)
    assert result['success'] is False
    assert 'No FCM token' in result['error']


def test_send_referral_success_notification_success(monkeypatch):
    service = PushNotificationService()
    # Mock messaging.send
    monkeypatch.setattr(push_mod.messaging, 'send', lambda msg: 'msg-id-123')
    result = service.send_referral_success_notification('valid-token', 'Alice', 'Bob', 5)
    assert result['success'] is True
    assert result['message_id'] == 'msg-id-123'


def test_send_referral_success_notification_exception(monkeypatch):
    service = PushNotificationService()
    def raise_exc(msg):
        raise Exception('FCM error')
    monkeypatch.setattr(push_mod.messaging, 'send', raise_exc)
    result = service.send_referral_success_notification('token', 'Alice', 'Bob', 5)
    assert result['success'] is False
    assert 'FCM error' in result['error']


def test_send_tier_upgrade_notification_disabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'false')
    service = PushNotificationService()
    result = service.send_tier_upgrade_notification('token', 'Gold', 4)
    assert result['success'] is False


def test_send_tier_upgrade_notification_success(monkeypatch):
    service = PushNotificationService()
    monkeypatch.setattr(push_mod.messaging, 'send', lambda msg: 'tier-msg')
    result = service.send_tier_upgrade_notification('token', 'Gold', 4)
    assert result['success'] is True
    assert result['message_id'] == 'tier-msg'


def test_send_tier_upgrade_notification_exception(monkeypatch):
    service = PushNotificationService()
    def raise_exc(msg):
        raise Exception('fail')
    monkeypatch.setattr(push_mod.messaging, 'send', raise_exc)
    result = service.send_tier_upgrade_notification('token', 'Platinum', 8)
    assert result['success'] is False


def test_send_reward_redemption_notification_disabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'false')
    service = PushNotificationService()
    result = service.send_reward_redemption_notification('token', 'Free Month')
    assert result['success'] is False


def test_send_reward_redemption_notification_success(monkeypatch):
    service = PushNotificationService()
    monkeypatch.setattr(push_mod.messaging, 'send', lambda msg: 'reward-msg')
    result = service.send_reward_redemption_notification('token', 'Free Month', '🎁')
    assert result['success'] is True


def test_send_bulk_notifications_disabled(monkeypatch):
    monkeypatch.setenv('FCM_ENABLED', 'false')
    service = PushNotificationService()
    result = service.send_bulk_notifications(['t1', 't2'], 'Title', 'Body')
    assert result['success'] is False


def test_send_bulk_notifications_empty_tokens():
    service = PushNotificationService()
    result = service.send_bulk_notifications([], 'Title', 'Body')
    assert result['success'] is False


def test_send_bulk_notifications_success(monkeypatch):
    service = PushNotificationService()
    class FakeBatchResponse:
        success_count = 3
        failure_count = 1
    monkeypatch.setattr(push_mod.messaging, 'send_multicast', lambda msg: FakeBatchResponse())
    
    tokens = ['t1', 't2', 't3', 't4']
    result = service.send_bulk_notifications(tokens, 'Hello', 'World', {'k': 'v'})
    assert result['success'] is True
    assert result['total_success'] == 3
    assert result['total_failure'] == 1


def test_send_bulk_notifications_large_batch(monkeypatch):
    service = PushNotificationService()
    class FakeBatchResponse:
        success_count = 500
        failure_count = 0
    monkeypatch.setattr(push_mod.messaging, 'send_multicast', lambda msg: FakeBatchResponse())
    
    # Send 1200 tokens (should split into 3 batches of 500, 500, 200)
    tokens = [f't{i}' for i in range(1200)]
    result = service.send_bulk_notifications(tokens, 'Bulk', 'Test')
    assert result['success'] is True
    assert result['total_success'] == 1500  # 3 batches * 500


def test_send_bulk_notifications_exception(monkeypatch):
    service = PushNotificationService()
    def raise_exc(msg):
        raise Exception('bulk fail')
    monkeypatch.setattr(push_mod.messaging, 'send_multicast', raise_exc)
    
    result = service.send_bulk_notifications(['t1'], 'Title', 'Body')
    assert result['success'] is False
    assert 'bulk fail' in result['error']


def test_push_notification_service_singleton():
    from src.services.push_notification_service import push_notification_service
    assert push_notification_service is not None
    assert isinstance(push_notification_service, PushNotificationService)
