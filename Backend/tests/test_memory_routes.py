"""Tests for memory routes (voice memories/audio recordings).

Route: /api/v1/memory (blueprint prefix registered in main.py)
Auth:  @AuthService.jwt_required → sets g.user_id = 'testuser1234567890ab' (via conftest)
DB:    from src.firebase_config import db  (shared mock in conftest)
Store: from firebase_admin import storage  (must patch src.routes.memory_routes.storage)
"""
import io
import os
import sys

import pytest
from unittest.mock import MagicMock, Mock, patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# The user_id set by conftest's mock jwt_required
TEST_USER_ID = 'testuser1234567890ab'

# A user_id that passes _validate_user_id (^[a-zA-Z0-9]{20,128}$)
VALID_USER_ID = TEST_USER_ID

# A memory_id that passes _validate_memory_id (^[a-zA-Z0-9_-]{10,100}$)
VALID_MEMORY_ID = 'mem_test_1234567890'

# Base URL for memory routes
BASE = '/api/v1/memory'


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_storage():
    """Return a pre-configured mock for firebase_admin.storage."""
    mock_stor = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_bucket.exists.return_value = True
    mock_bucket.blob.return_value = mock_blob
    mock_blob.exists.return_value = True
    mock_blob.generate_signed_url.return_value = 'https://signed-url.example.com/file'
    mock_stor.bucket.return_value = mock_bucket
    return mock_stor, mock_bucket, mock_blob


# ============================================================================
# OPTIONS requests — intercepted by main.py before_request → 204, empty body
# ============================================================================

class TestMemoryOptions:
    """All OPTIONS preflight requests are handled by main.py's before_request handler."""

    def test_options_upload(self, client):
        response = client.options(f'{BASE}/upload')
        assert response.status_code == 204

    def test_options_list(self, client):
        response = client.options(f'{BASE}/list/{VALID_USER_ID}')
        assert response.status_code == 204

    def test_options_get(self, client):
        response = client.options(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 204

    def test_options_base(self, client):
        response = client.options(BASE)
        assert response.status_code == 204


# ============================================================================
# Root placeholder — GET /api/v1/memory → 404
# ============================================================================

class TestMemoryRoot:
    """The root GET endpoint returns 404 (placeholder)."""

    def test_root_returns_404(self, client):
        response = client.get(BASE)
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False


# ============================================================================
# Upload — POST /api/v1/memory/upload
# ============================================================================

class TestMemoryUpload:
    """Tests for memory upload functionality."""

    def test_upload_missing_audio_file(self, client):
        """POST without 'audio' field → 400."""
        response = client.post(
            f'{BASE}/upload',
            data={},
            content_type='multipart/form-data',
        )
        assert response.status_code == 400
        body = response.get_json()
        assert body['success'] is False
        assert 'Audio file required' in body['message']

    def test_upload_invalid_file_type(self, client, mocker):
        """POST with non-audio file → 400."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        data = {'audio': (io.BytesIO(b'data'), 'notes.txt')}
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 400
        body = response.get_json()
        assert 'MP3, WAV' in body['message']

    def test_upload_file_too_large(self, client, mocker):
        """POST with >10 MB file → 400."""
        # Patch validation so we get past the user_id check
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        large = b'x' * (11 * 1024 * 1024)
        data = {
            'audio': (io.BytesIO(large), 'big.mp3'),
            'user_id': TEST_USER_ID,
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 400
        body = response.get_json()
        assert 'File too large' in body['message']

    def test_upload_invalid_user_id(self, client, mocker):
        """Invalid user_id according to validation should return 400."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=False)
        data = {'audio': (io.BytesIO(b'audio'), 'test.mp3')}
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 400
        body = response.get_json()
        assert 'Invalid user ID' in body['message']

    def test_upload_forbidden_other_user(self, client, mocker):
        """form user_id != g.user_id → 403."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        data = {
            'audio': (io.BytesIO(b'audio'), 'test.mp3'),
            'user_id': 'some_other_user_id_12345',
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 403
        body = response.get_json()
        assert 'only upload to your own account' in body['message']

    def test_upload_success_mp3(self, client, mock_db, mocker):
        """Successful MP3 upload → 200 with fileUrl and memoryId."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        mock_stor, mock_bucket, mock_blob = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        data = {
            'audio': (io.BytesIO(b'fake mp3 data'), 'recording.mp3'),
            'user_id': TEST_USER_ID,
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert 'fileUrl' in body['data']
        assert 'memoryId' in body['data']
        assert 'Memory uploaded successfully' in body['message']

    def test_upload_success_wav(self, client, mock_db, mocker):
        """Successful WAV upload → 200."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        mock_stor, _, _ = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        data = {
            'audio': (io.BytesIO(b'fake wav data'), 'recording.wav'),
            'user_id': TEST_USER_ID,
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 200

    def test_upload_success_m4a(self, client, mock_db, mocker):
        """Successful M4A upload → 200."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        mock_stor, _, _ = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        data = {
            'audio': (io.BytesIO(b'fake m4a data'), 'recording.m4a'),
            'user_id': TEST_USER_ID,
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 200

    def test_upload_success_no_form_user_id(self, client, mock_db, mocker):
        """Upload without form user_id uses g.user_id → 200."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        mock_stor, _, _ = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        data = {'audio': (io.BytesIO(b'audio bytes'), 'voice.mp3')}
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert 'fileUrl' in body['data']

    def test_upload_storage_error(self, client, mocker):
        """Storage exception during upload → 500."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        mock_stor = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_bucket.exists.return_value = True
        mock_bucket.blob.return_value = mock_blob
        mock_blob.upload_from_file.side_effect = Exception('Storage unavailable')
        mock_stor.bucket.return_value = mock_bucket
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        data = {
            'audio': (io.BytesIO(b'audio'), 'test.mp3'),
            'user_id': TEST_USER_ID,
        }
        response = client.post(
            f'{BASE}/upload',
            data=data,
            content_type='multipart/form-data',
        )
        assert response.status_code == 500
        body = response.get_json()
        assert body['success'] is False
        assert 'Failed to upload memory' in body['message']


# ============================================================================
# List — GET /api/v1/memory/list/<user_id>
# ============================================================================

class TestMemoryList:
    """Tests for listing memories."""

    def test_list_invalid_user_id(self, client):
        """user_id that fails regex → 400."""
        response = client.get(f'{BASE}/list/bad!')
        assert response.status_code == 400
        body = response.get_json()
        assert 'Invalid user ID' in body['message']

    def test_list_forbidden_other_user(self, client, mocker):
        """user_id in URL ≠ g.user_id → 403."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch('src.routes.memory_routes.audit_log')
        response = client.get(f'{BASE}/list/anothervaliduser1234567890')
        assert response.status_code == 403
        body = response.get_json()
        assert 'only view your own memories' in body['message']

    def test_list_empty(self, client, mock_db, mocker):
        """List when user has no memories → 200 with empty list."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        # mock_db already returns empty stream by default
        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert body['data']['memories'] == []

    def test_list_success_with_memories(self, client, mock_db, mocker):
        """List with existing memories → 200 with sorted list."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        mem1 = MagicMock()
        mem1.id = 'mem_001'
        mem1.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': f'memories/{TEST_USER_ID}/20250101120000.mp3',
            'timestamp': '20250101120000',
            'created_at': '2025-01-01T12:00:00+00:00',
        }
        mem2 = MagicMock()
        mem2.id = 'mem_002'
        mem2.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': f'memories/{TEST_USER_ID}/20250202120000.mp3',
            'timestamp': '20250202120000',
            'created_at': '2025-02-02T12:00:00+00:00',
        }

        # Set up the collection mock chain
        coll = mock_db.collection('memories')
        coll.where.return_value = coll
        coll.limit.return_value = coll
        coll.stream.return_value = [mem1, mem2]

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        memories = body['data']['memories']
        assert len(memories) == 2
        # Should be sorted descending by timestamp
        assert memories[0]['id'] == 'mem_002'
        assert memories[1]['id'] == 'mem_001'

    def test_list_db_error(self, client, mock_db, mocker):
        """Database exception → 500."""
        mocker.patch('src.routes.memory_routes._validate_user_id', return_value=True)
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        # Make the collection.where raise
        coll = mock_db.collection('memories')
        coll.where.side_effect = Exception('Firestore unavailable')

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 500
        body = response.get_json()
        assert body['success'] is False
        assert 'Failed to fetch memories' in body['message']


# ============================================================================
# Get — GET /api/v1/memory/get/<memory_id>
# ============================================================================

class TestMemoryGet:
    """Tests for getting a signed URL for a specific memory."""

    def test_get_invalid_memory_id(self, client, mocker):
        """Invalid memory_id format → 400."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        response = client.get(f'{BASE}/get/bad!')
        assert response.status_code == 400
        body = response.get_json()
        assert 'Invalid memory ID' in body['message']

    def test_get_not_found(self, client, mock_db, mocker):
        """Memory document doesn't exist → 404."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        doc_snap = MagicMock()
        doc_snap.exists = False
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 404
        body = response.get_json()
        assert 'Memory not found' in body['message']

    def test_get_forbidden_other_user(self, client, mock_db, mocker):
        """Memory belongs to another user → 403."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes.audit_log')

        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': 'another_user_abcdef1234',
            'file_path': 'memories/another_user_abcdef1234/20250101120000.mp3',
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 403
        body = response.get_json()
        assert 'only view your own memories' in body['message']

    def test_get_missing_file_path(self, client, mock_db, mocker):
        """Memory doc exists but file_path is empty → 404."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': '',
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 404
        body = response.get_json()
        assert 'File path missing' in body['message']

    def test_get_invalid_file_path(self, client, mock_db, mocker):
        """file_path with traversal attempt → 400."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': '../../../etc/passwd',
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 400
        body = response.get_json()
        assert 'Invalid file path' in body['message']

    def test_get_file_not_in_storage(self, client, mock_db, mocker):
        """File not found in Firebase Storage → 404."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes._validate_file_path', return_value=True)

        file_path = f'memories/{VALID_USER_ID}/20250101120000.mp3'
        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': file_path,
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        mock_stor, mock_bucket, mock_blob = _mock_storage()
        mock_blob.exists.return_value = False
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 404
        body = response.get_json()
        assert 'File not found in storage' in body['message']

    def test_get_success(self, client, mock_db, mocker):
        """Successful retrieval → 200 with signed URL."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes._validate_file_path', return_value=True)

        file_path = f'memories/{VALID_USER_ID}/20250101120000.mp3'
        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': file_path,
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        mock_stor, mock_bucket, mock_blob = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert 'url' in body['data']
        assert 'memoryId' in body['data']
        assert 'Signed URL generated' in body['message']

    def test_get_db_error(self, client, mock_db, mocker):
        """Database exception → 500."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        mock_db.collection('memories').document.return_value.get.side_effect = Exception('DB down')

        response = client.get(f'{BASE}/get/{VALID_MEMORY_ID}')
        assert response.status_code == 500
        body = response.get_json()
        assert body['success'] is False
        assert 'Failed to fetch memory' in body['message']


# ============================================================================
# Delete — DELETE /api/v1/memory/list/<memory_id>
# ============================================================================

class TestMemoryDelete:
    """Tests for deleting a memory."""

    def test_delete_invalid_memory_id(self, client, mocker):
        """Invalid memory_id → 400."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        response = client.delete(f'{BASE}/list/bad!')
        assert response.status_code == 400
        body = response.get_json()
        assert 'Invalid memory ID' in body['message']

    def test_delete_not_found(self, client, mock_db, mocker):
        """Memory doesn't exist → 404."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        doc_snap = MagicMock()
        doc_snap.exists = False
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.delete(f'{BASE}/list/{VALID_MEMORY_ID}')
        assert response.status_code == 404
        body = response.get_json()
        assert 'Memory not found' in body['message']

    def test_delete_forbidden_other_user(self, client, mock_db, mocker):
        """Memory belongs to another user → 403."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes.audit_log')

        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': 'another_user_abcdef1234',
            'file_path': 'memories/another_user_abcdef1234/20250101120000.mp3',
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        response = client.delete(f'{BASE}/list/{VALID_MEMORY_ID}')
        assert response.status_code == 403
        body = response.get_json()
        assert 'only delete your own memories' in body['message']

    def test_delete_success(self, client, mock_db, mocker):
        """Successful delete → 200."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes.audit_log')

        file_path = f'memories/{VALID_USER_ID}/20250101120000.mp3'
        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': file_path,
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        mock_stor, mock_bucket, mock_blob = _mock_storage()
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        response = client.delete(f'{BASE}/list/{VALID_MEMORY_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert body['data']['deleted'] == VALID_MEMORY_ID
        assert 'Memory deleted successfully' in body['message']

    def test_delete_success_storage_cleanup_error(self, client, mock_db, mocker):
        """Delete succeeds even when storage cleanup fails (logged as warning)."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        mocker.patch('src.routes.memory_routes.audit_log')

        file_path = f'memories/{VALID_USER_ID}/20250101120000.mp3'
        doc_snap = MagicMock()
        doc_snap.exists = True
        doc_snap.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'file_path': file_path,
        }
        mock_db.collection('memories').document.return_value.get.return_value = doc_snap

        mock_stor = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.delete.side_effect = Exception('Storage error')
        mock_bucket.blob.return_value = mock_blob
        mock_stor.bucket.return_value = mock_bucket
        mocker.patch('src.routes.memory_routes.storage', mock_stor)

        response = client.delete(f'{BASE}/list/{VALID_MEMORY_ID}')
        # Should still succeed — storage error is caught
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True

    def test_delete_db_error(self, client, mock_db, mocker):
        """Database exception → 500."""
        mocker.patch(
            'src.routes.memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )

        mock_db.collection('memories').document.return_value.get.side_effect = Exception('DB error')

        response = client.delete(f'{BASE}/list/{VALID_MEMORY_ID}')
        assert response.status_code == 500
        body = response.get_json()
        assert body['success'] is False
        assert 'Failed to delete memory' in body['message']


# ============================================================================
# Path traversal protection
# ============================================================================

class TestPathTraversalProtection:
    """Unexpected deep paths return 404."""

    def test_unknown_subpath(self, client):
        response = client.get(f'{BASE}/unknown/deep/path')
        assert response.status_code == 404


# ============================================================================
# Unit tests for helper functions
# ============================================================================

class TestAllowedFileFunction:
    """Tests for the allowed_file utility function."""

    def test_mp3_allowed(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('test.mp3') is True

    def test_wav_allowed(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('test.wav') is True

    def test_m4a_allowed(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('test.m4a') is True

    def test_txt_rejected(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('test.txt') is False

    def test_exe_rejected(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('test.exe') is False

    def test_no_extension_rejected(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('noextension') is False

    def test_case_insensitive(self):
        from src.routes.memory_routes import allowed_file
        assert allowed_file('TEST.MP3') is True
        assert allowed_file('test.WAV') is True
        assert allowed_file('file.M4A') is True


class TestValidateUserIdFunction:
    """Tests for _validate_user_id."""

    def test_valid_alphanumeric_20_chars(self):
        from src.routes.memory_routes import _validate_user_id
        assert _validate_user_id('abcdefghij1234567890') is True

    def test_too_short(self):
        from src.routes.memory_routes import _validate_user_id
        assert _validate_user_id('short') is False

    def test_contains_hyphens(self):
        from src.routes.memory_routes import _validate_user_id
        assert _validate_user_id('test-user-id-123456') is False

    def test_empty_string(self):
        from src.routes.memory_routes import _validate_user_id
        assert _validate_user_id('') is False

    def test_none(self):
        from src.routes.memory_routes import _validate_user_id
        assert _validate_user_id(None) is False


class TestValidateMemoryIdFunction:
    """Tests for _validate_memory_id."""

    def test_valid_memory_id(self):
        from src.routes.memory_routes import _validate_memory_id
        assert _validate_memory_id('mem_test_1234567890') is True

    def test_hyphens_allowed(self):
        from src.routes.memory_routes import _validate_memory_id
        assert _validate_memory_id('user-id_20250101') is True

    def test_too_short(self):
        from src.routes.memory_routes import _validate_memory_id
        assert _validate_memory_id('short') is False

    def test_empty(self):
        from src.routes.memory_routes import _validate_memory_id
        assert _validate_memory_id('') is False


class TestValidateFilePathFunction:
    """Tests for _validate_file_path."""

    def test_valid_path(self):
        from src.routes.memory_routes import _validate_file_path
        assert _validate_file_path('memories/abcdefghij1234567890/20250101120000.mp3') is True

    def test_traversal_rejected(self):
        from src.routes.memory_routes import _validate_file_path
        assert _validate_file_path('../../../etc/passwd') is False

    def test_empty_rejected(self):
        from src.routes.memory_routes import _validate_file_path
        assert _validate_file_path('') is False

    def test_absolute_path_rejected(self):
        from src.routes.memory_routes import _validate_file_path
        assert _validate_file_path('/memories/user/file.mp3') is False
