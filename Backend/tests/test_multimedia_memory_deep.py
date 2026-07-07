"""TDD tests for multimedia memory routes — deep audit bugs.

Tests written BEFORE fixes to verify bugs exist, then verify fixes work.
Covers:
- BUG 1: .isoformat() crash when created_at is a string (not datetime)
- BUG 2: No content length validation in create endpoint
- BUG 3: order_by without composite index fallback in list endpoint
- BUG 4: get_memory_detail .isoformat() crash on string created_at
"""
import io
import os
import sys
from datetime import UTC, datetime
from unittest.mock import MagicMock

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

TEST_USER_ID = 'testuser1234567890ab'
VALID_MEMORY_ID = 'mem_test_1234567890'
BASE = '/api/v1/memory-unified'


class TestListMultimediaMemoriesCreatedAtString:
    """BUG 1: list_multimedia_memories calls .isoformat() on created_at.
    If Firestore returns a string (stored as ISO string), this crashes.
    """

    def test_list_with_string_created_at(self, client, mock_db, mocker):
        """Should handle created_at stored as string without crashing."""
        mem_doc = MagicMock()
        mem_doc.id = 'mem_001'
        mem_doc.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'A beautiful day',
            'has_audio': False,
            'photo_count': 0,
            'mood': 7,
            'tags': ['Familj'],
            'ai_analysis': {'primary_emotion': 'joy'},
            'created_at': '2025-01-15T10:30:00+00:00',  # String, not datetime
        }

        coll = mock_db.collection('memories')
        coll.where.return_value = coll
        coll.order_by.return_value = coll
        coll.limit.return_value = coll
        coll.stream.return_value = [mem_doc]

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert len(body['data']['memories']) == 1
        assert body['data']['memories'][0]['createdAt'] == '2025-01-15T10:30:00+00:00'

    def test_list_with_datetime_created_at(self, client, mock_db, mocker):
        """Should handle created_at as datetime object (normal case)."""
        dt = datetime(2025, 1, 15, 10, 30, 0, tzinfo=UTC)
        mem_doc = MagicMock()
        mem_doc.id = 'mem_002'
        mem_doc.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'Another day',
            'has_audio': False,
            'photo_count': 0,
            'tags': [],
            'created_at': dt,
        }

        coll = mock_db.collection('memories')
        coll.where.return_value = coll
        coll.order_by.return_value = coll
        coll.limit.return_value = coll
        coll.stream.return_value = [mem_doc]

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert len(body['data']['memories']) == 1

    def test_list_with_missing_created_at(self, client, mock_db, mocker):
        """Should handle missing created_at field gracefully."""
        mem_doc = MagicMock()
        mem_doc.id = 'mem_003'
        mem_doc.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'No timestamp',
            'has_audio': False,
            'photo_count': 0,
            'tags': [],
            # No created_at field
        }

        coll = mock_db.collection('memories')
        coll.where.return_value = coll
        coll.order_by.return_value = coll
        coll.limit.return_value = coll
        coll.stream.return_value = [mem_doc]

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True


class TestCreateMultimediaMemoryContentValidation:
    """BUG 2: No content length validation in create endpoint."""

    def test_create_content_too_long(self, client, csrf_headers, mocker):
        """Content over 5000 chars should return 400."""
        mocker.patch(
            'src.routes.multimedia_memory_routes.input_sanitizer.sanitize',
            side_effect=lambda val, *a, **kw: val,
        )
        long_content = 'x' * 5001
        response = client.post(
            f'{BASE}/create',
            data={'content': long_content},
            content_type='multipart/form-data',
            headers=csrf_headers,
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.get_json()}"
        body = response.get_json()
        assert 'content' in body['message'].lower() or 'long' in body['message'].lower() or 'character' in body['message'].lower()

    def test_create_content_at_limit_accepted(self, client, mock_db, csrf_headers, mocker):
        """Content at exactly 5000 chars should not be rejected for length."""
        mocker.patch('src.routes.multimedia_memory_routes.audit_log')
        mocker.patch(
            'src.routes.multimedia_memory_routes._analyze_multimodal_memory',
            return_value={'primary_emotion': 'neutral', 'themes': [], 'sentiment_score': 0, 'significance': 0.5, 'photo_insights': [], 'emotions': {}},
        )

        content = 'word ' * 1000  # 5000 chars exactly
        response = client.post(
            f'{BASE}/create',
            data={'content': content},
            content_type='multipart/form-data',
            headers=csrf_headers,
        )
        # Should NOT be 400 for content length
        assert response.status_code != 400 or 'long' not in response.get_json().get('message', '').lower()


class TestListMultimediaMemoriesOrderFallback:
    """BUG 3: order_by requires composite index, no fallback like journal_routes has."""

    def test_list_falls_back_when_order_by_fails(self, client, mock_db, mocker):
        """Should fall back to unordered query + Python sort when index is missing."""
        mem1 = MagicMock()
        mem1.id = 'mem_001'
        mem1.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'First',
            'tags': [],
            'created_at': '2025-01-01T10:00:00+00:00',
        }
        mem2 = MagicMock()
        mem2.id = 'mem_002'
        mem2.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'Second',
            'tags': [],
            'created_at': '2025-02-01T10:00:00+00:00',
        }

        coll = mock_db.collection('memories')

        # First call with order_by raises (index missing), second call without order_by works
        query_with_order = MagicMock()
        query_with_order.limit.return_value = query_with_order
        query_with_order.stream.side_effect = Exception('index not found')

        query_without_order = MagicMock()
        query_without_order.limit.return_value = query_without_order
        query_without_order.stream.return_value = [mem1, mem2]

        coll.where.return_value = coll
        coll.order_by.return_value = query_with_order
        coll.limit.return_value = query_without_order

        response = client.get(f'{BASE}/list/{TEST_USER_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert len(body['data']['memories']) == 2


class TestGetMemoryDetailCreatedAtString:
    """BUG 4: get_memory_detail calls .isoformat() on created_at.
    If stored as string, this crashes.
    """

    def test_get_detail_with_string_created_at(self, client, mock_db, mocker):
        """Should handle created_at as string without crashing."""
        mem_doc = MagicMock()
        mem_doc.exists = True
        mem_doc.to_dict.return_value = {
            'user_id': TEST_USER_ID,
            'content': 'Test memory',
            'mood': 5,
            'tags': ['Natur'],
            'location': 'Stockholm',
            'media': {},
            'ai_analysis': {'primary_emotion': 'calm'},
            'created_at': '2025-03-10T14:00:00+00:00',  # String
        }
        mock_db.collection('memories').document.return_value.get.return_value = mem_doc

        response = client.get(f'{BASE}/{VALID_MEMORY_ID}')
        assert response.status_code == 200
        body = response.get_json()
        assert body['success'] is True
        assert body['data']['createdAt'] == '2025-03-10T14:00:00+00:00'
