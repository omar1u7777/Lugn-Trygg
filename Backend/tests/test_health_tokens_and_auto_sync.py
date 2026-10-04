"""OAuth grants are encrypted at rest, and auto-sync actually runs.

oauth_tokens held Google Fit / Fitbit / Samsung access and refresh tokens in
plaintext. And the integrations page promised a sync "var 24:e timme" with an
auto-sync toggle that was stored and never read.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from cryptography.fernet import Fernet

from src.services import health_sync_service as hs
from src.utils import token_crypto as tc


@pytest.fixture
def keys(monkeypatch):
    primary, previous = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    monkeypatch.setenv('API_KEY_ENCRYPTION_KEY', primary)
    monkeypatch.delenv('API_KEY_ENCRYPTION_KEY_PREVIOUS', raising=False)
    monkeypatch.delenv('HIPAA_ENCRYPTION_KEY', raising=False)
    return primary, previous


class TestTokenCrypto:
    def test_round_trip_and_nothing_readable_at_rest(self, keys):
        sealed = tc.seal('ya29.secret-access')
        assert sealed.startswith('enc:v1:') and 'secret' not in sealed
        assert tc.unseal(sealed) == 'ya29.secret-access'

    def test_legacy_plaintext_still_reads(self, keys):
        assert tc.unseal('ya29.plain') == 'ya29.plain'

    def test_none_and_already_sealed_are_left_alone(self, keys):
        sealed = tc.seal('x')
        assert tc.seal(None) is None
        assert tc.seal(sealed) == sealed

    def test_survives_key_rotation(self, keys, monkeypatch):
        old_key, new_key = keys[0], Fernet.generate_key().decode()
        sealed_with_old = tc.seal('refresh-1')
        monkeypatch.setenv('API_KEY_ENCRYPTION_KEY', new_key)
        monkeypatch.setenv('API_KEY_ENCRYPTION_KEY_PREVIOUS', old_key)
        assert tc.unseal(sealed_with_old) == 'refresh-1'

    def test_falls_back_to_the_hipaa_key(self, monkeypatch):
        monkeypatch.delenv('API_KEY_ENCRYPTION_KEY', raising=False)
        monkeypatch.delenv('API_KEY_ENCRYPTION_KEY_PREVIOUS', raising=False)
        monkeypatch.setenv('HIPAA_ENCRYPTION_KEY', Fernet.generate_key().decode())
        assert tc.unseal(tc.seal('t')) == 't'

    def test_wrong_key_is_an_error_not_garbage(self, keys, monkeypatch):
        sealed = tc.seal('t')
        monkeypatch.setenv('API_KEY_ENCRYPTION_KEY', Fernet.generate_key().decode())
        with pytest.raises(tc.TokenCryptoError):
            tc.unseal(sealed)


def _token_doc(data, exists=True):
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = data
    return doc


@pytest.fixture
def db(mocker):
    db = MagicMock()
    mocker.patch.object(hs, '_db', return_value=db)
    return db


class TestSyncProvider:
    def test_not_connected(self, db, keys):
        db.collection.return_value.document.return_value.get.return_value = _token_doc({}, exists=False)
        with pytest.raises(hs.NotConnected):
            hs.sync_provider('uid', 'fitbit')

    def test_seals_a_legacy_plaintext_grant_on_first_use(self, db, keys, mocker):
        token_ref = db.collection.return_value.document.return_value
        token_ref.get.return_value = _token_doc({
            'access_token': 'plain-access', 'refresh_token': 'plain-refresh',
            'expires_at': (datetime.now(UTC) + timedelta(hours=1)).isoformat()})
        fetch = mocker.patch.object(hs, '_fetch', return_value={'steps': 1000})

        result = hs.sync_provider('uid', 'fitbit', days_back=2)

        assert fetch.call_args.args[:2] == ('fitbit', 'plain-access')
        update = token_ref.update.call_args.args[0]
        assert tc.unseal(update['access_token']) == 'plain-access'
        assert tc.unseal(update['refresh_token']) == 'plain-refresh'
        assert 'plain' not in update['access_token']
        assert result['data'] == {'steps': 1000}

    def test_refreshes_an_expired_grant_and_keeps_a_rotated_refresh_token(self, db, keys, mocker):
        token_ref = db.collection.return_value.document.return_value
        token_ref.get.return_value = _token_doc({
            'access_token': tc.seal('old-access'), 'refresh_token': tc.seal('old-refresh'),
            'expires_at': (datetime.now(UTC) - timedelta(minutes=1)).isoformat()})
        mocker.patch('src.services.oauth_service.oauth_service.refresh_access_token',
                     return_value={'access_token': 'new-access', 'refresh_token': 'new-refresh',
                                   'expires_in': 3600})
        fetch = mocker.patch.object(hs, '_fetch', return_value={})

        hs.sync_provider('uid', 'google_fit')

        assert fetch.call_args.args[1] == 'new-access'
        update = token_ref.update.call_args.args[0]
        assert tc.unseal(update['refresh_token']) == 'new-refresh'

    def test_a_sealed_current_grant_is_not_rewritten(self, db, keys, mocker):
        token_ref = db.collection.return_value.document.return_value
        token_ref.get.return_value = _token_doc({
            'access_token': tc.seal('a'), 'refresh_token': tc.seal('r'),
            'expires_at': (datetime.now(UTC) + timedelta(hours=1)).isoformat()})
        mocker.patch.object(hs, '_fetch', return_value={})
        hs.sync_provider('uid', 'samsung')
        token_ref.update.assert_not_called()


def _integration(uid, auto_sync):
    doc = MagicMock()
    doc.id = uid
    doc.to_dict.return_value = {'auto_sync': auto_sync}
    return doc


class TestRunAutoSync:
    def test_syncs_only_enabled_providers_and_records_last_sync(self, db, mocker):
        on = _integration('u1', {'fitbit': {'enabled': True}, 'google_fit': {'enabled': False}})
        off = _integration('u2', {'fitbit': {'enabled': False}})
        db.collection.return_value.select.return_value.stream.return_value = iter([on, off])
        sync = mocker.patch.object(hs, 'sync_provider', return_value={})

        stats = hs.run_auto_sync()

        sync.assert_called_once_with('u1', 'fitbit', days_back=hs.AUTO_SYNC_DAYS_BACK)
        assert stats['users'] == 1 and stats['synced'] == 1
        written = on.reference.set.call_args
        assert 'lastSync' in written.args[0]['auto_sync']['fitbit']
        assert written.kwargs == {'merge': True}

    def test_one_failure_does_not_stop_the_others(self, db, mocker):
        docs = [_integration(f'u{i}', {'fitbit': {'enabled': True}}) for i in range(3)]
        db.collection.return_value.select.return_value.stream.return_value = iter(docs)
        mocker.patch.object(hs, 'sync_provider',
                            side_effect=[RuntimeError('provider 500'), hs.NotConnected('fitbit'), {}])

        stats = hs.run_auto_sync()

        assert stats == {'users': 3, 'synced': 1, 'failed': 1, 'disconnected': 1, 'stopped_early': 0}

    def test_stops_at_the_budget(self, db, mocker):
        docs = [_integration(f'u{i}', {'fitbit': {'enabled': True}}) for i in range(5)]
        db.collection.return_value.select.return_value.stream.return_value = iter(docs)
        mocker.patch.object(hs, 'sync_provider', return_value={})
        ticks = iter([0, 0, 1, 100, 100, 100])

        stats = hs.run_auto_sync(budget_seconds=10, clock=lambda: next(ticks))

        assert stats['stopped_early'] == 1 and stats['users'] == 2
