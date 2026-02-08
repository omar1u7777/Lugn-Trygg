"""Unit tests for backup service helpers."""

import gzip
import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from src.services.backup_service import BackupService


def test_create_backup_records_status(tmp_path, mocker):
    service = BackupService(backup_dir=str(tmp_path))
    mocker.patch.object(service, '_backup_collection', return_value=[{'_id': 'doc'}])
    mocker.patch.object(service, '_upload_backup_to_cloud')
    mocker.patch.object(service, '_cleanup_old_backups')

    backup_file = tmp_path / 'daily_test.backup.gz'
    backup_file.write_bytes(b'data')
    mocker.patch.object(service, '_save_backup', return_value=str(backup_file))

    filename = service.create_backup('daily', 'firestore')

    assert filename == str(backup_file)
    assert service.backup_status
    entry = next(iter(service.backup_status.values()))
    assert entry['status'] == 'completed'
    assert entry['filename'] == str(backup_file)


def test_save_backup_persists_compressed_payload(tmp_path):
    service = BackupService(backup_dir=str(tmp_path))
    backup_data = {'backup_id': 'unit-test', 'collections': {'users': [{'id': '1'}]}}

    filename = service._save_backup(backup_data, 'unit-test')

    assert filename
    with gzip.open(filename, 'rb') as handle:
        loaded = json.loads(handle.read().decode('utf-8'))
    assert loaded['backup_id'] == 'unit-test'
    assert 'users' in loaded['collections']


def test_cleanup_old_backups_removes_expired_files(tmp_path):
    service = BackupService(backup_dir=str(tmp_path))
    old_file = tmp_path / 'hourly_old.backup.gz'
    old_file.write_bytes(b'old')
    new_file = tmp_path / 'hourly_new.backup.gz'
    new_file.write_bytes(b'new')

    cutoff = datetime.now(timezone.utc) - timedelta(days=service.backup_schedules['hourly']['retention'] + 1)
    os.utime(old_file, (cutoff.timestamp(), cutoff.timestamp()))

    service._cleanup_old_backups('hourly')

    assert not old_file.exists()
    assert new_file.exists()


def test_create_backup_marks_failure_on_exception(tmp_path, mocker):
    service = BackupService(backup_dir=str(tmp_path))
    mocker.patch.object(service, '_backup_collection', return_value=[])
    mocker.patch.object(service, '_save_backup', side_effect=RuntimeError('disk full'))

    result = service.create_backup('daily')

    assert result is None
    status = next(iter(service.backup_status.values()))
    assert status['status'] == 'failed'
    assert 'disk full' in status['error']


def test_create_backup_survives_cloud_upload_failure(tmp_path, mocker):
    service = BackupService(backup_dir=str(tmp_path))
    mocker.patch.object(service, '_backup_collection', side_effect=lambda col: [{'_id': f'{col}-doc'}])
    mocker.patch.object(service, '_cleanup_old_backups')

    failing_blob = MagicMock()
    failing_blob.upload_from_filename.side_effect = RuntimeError('cloud down')
    mock_bucket = MagicMock()
    mock_bucket.blob.return_value = failing_blob
    service._bucket = mock_bucket

    filename = service.create_backup('daily', 'firestore')

    assert filename is not None
    assert os.path.exists(filename)
    status = next(iter(service.backup_status.values()))
    assert status['status'] == 'completed'


def test_restore_backup_ignores_invalid_collections(tmp_path, mocker):
    service = BackupService(backup_dir=str(tmp_path))
    backup_payload = {
        'backup_id': 'manual_test',
        'collections': {
            'users': [{'_id': 'user-1', 'name': 'Test User'}],
            'moods': {'error': 'corrupt'},
        }
    }
    mocker.patch.object(service, '_load_backup', return_value=backup_payload)
    restore_mock = mocker.patch.object(service, '_restore_collection', return_value=1)

    result = service.restore_backup('manual_test')

    assert result is True
    restore_mock.assert_called_once_with('users', backup_payload['collections']['users'])
