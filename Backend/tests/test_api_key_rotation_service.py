import importlib
import json

import pytest
from cryptography.fernet import Fernet


@pytest.fixture
def api_key_rotation_module(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv('API_KEY_ENCRYPTION_KEY', raising=False)
    monkeypatch.delenv('API_KEY_ENCRYPTION_KEY_PREVIOUS', raising=False)
    monkeypatch.setenv('FLASK_ENV', 'testing')

    import src.services.api_key_rotation as api_key_rotation

    return importlib.reload(api_key_rotation)


def test_does_not_create_master_key_file_without_env(api_key_rotation_module, tmp_path):
    keys_dir = tmp_path / 'keys'

    api_key_rotation_module.APIKeyRotationService(keys_dir=str(keys_dir))

    assert not (keys_dir / '.master.key').exists()


def test_requires_api_key_encryption_key_in_production(api_key_rotation_module, monkeypatch, tmp_path):
    keys_dir = tmp_path / 'keys'
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.delenv('API_KEY_ENCRYPTION_KEY', raising=False)

    with pytest.raises(RuntimeError, match='API_KEY_ENCRYPTION_KEY must be set in production'):
        api_key_rotation_module.APIKeyRotationService(keys_dir=str(keys_dir))


def test_reencrypts_key_metadata_with_new_env_key(api_key_rotation_module, monkeypatch, tmp_path):
    old_key = Fernet.generate_key().decode('ascii')
    new_key = Fernet.generate_key().decode('ascii')
    keys_dir = tmp_path / 'keys'

    monkeypatch.setenv('API_KEY_ENCRYPTION_KEY', old_key)
    old_service = api_key_rotation_module.APIKeyRotationService(keys_dir=str(keys_dir))
    rotation_result = old_service.rotate_key('api_key')
    assert rotation_result['success'] is True

    key_file = keys_dir / 'api_key.key'
    with key_file.open(encoding='utf-8') as handle:
        first_payload = json.load(handle)

    monkeypatch.setenv('API_KEY_ENCRYPTION_KEY', new_key)
    monkeypatch.setenv('API_KEY_ENCRYPTION_KEY_PREVIOUS', old_key)
    new_service = api_key_rotation_module.APIKeyRotationService(keys_dir=str(keys_dir))

    assert new_service.get_key('api_key') == rotation_result['new_key']

    with key_file.open(encoding='utf-8') as handle:
        second_payload = json.load(handle)

    assert second_payload['encrypted_key'] != first_payload['encrypted_key']