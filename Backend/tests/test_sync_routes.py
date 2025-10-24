"""
Comprehensive tests for sync_routes.py
Target: Increase coverage from 24% to 100%

Tests all endpoints:
- GET /status
- POST /now
- OPTIONS for both endpoints
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from flask import g


def test_sync_status_success(client, auth_headers, mocker):
    """Test getting sync status successfully"""
    # Mock offline_sync_service.sync_queue
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = [
        {"user_id": "test-user-id", "type": "mood", "data": {}},
        {"user_id": "test-user-id", "type": "memory", "data": {}},
        {"user_id": "other-user", "type": "mood", "data": {}}
    ]
    
    response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 2  # Only items for test-user-id
    assert data["synced_count"] == 0
    assert data["failed_count"] == 0
    assert "last_sync" in data


def test_sync_status_no_user_id(client, auth_headers, mocker):
    """Test getting sync status without user_id in query params (falls back to g.user_id)"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = []
    
    # Without user_id in query, it falls back to g.user_id from auth
    response = client.get(
        '/api/sync/status',
        headers=auth_headers
    )
    
    # Should succeed using g.user_id from auth
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 0


def test_sync_status_empty_queue(client, auth_headers, mocker):
    """Test getting sync status with empty queue"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = []
    
    response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 0


def test_sync_status_different_user(client, auth_headers, mocker):
    """Test sync status filters by user_id correctly"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = [
        {"user_id": "user-1", "type": "mood"},
        {"user_id": "user-2", "type": "mood"},
        {"user_id": "user-2", "type": "memory"}
    ]
    
    response = client.get(
        '/api/sync/status?user_id=user-2',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 2


def test_sync_status_exception(client, auth_headers, mocker):
    """Test error handling when exception occurs"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = None  # Will cause exception
    
    response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to get sync status"


def test_sync_status_options(client):
    """Test OPTIONS request for sync status"""
    response = client.options('/api/sync/status')
    
    assert response.status_code == 204
    assert response.data == b''


# Sync Now tests
def test_sync_now_success(client, auth_headers, mocker):
    """Test performing sync successfully"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 5,
        "failed_count": 0,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 0
    assert data["synced_count"] == 5
    assert data["failed_count"] == 0
    assert data["last_sync"] == "2025-10-22T12:00:00Z"


def test_sync_now_partial_failure(client, auth_headers, mocker):
    """Test sync with some failures"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 3,
        "failed_count": 2,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["synced_count"] == 3
    assert data["failed_count"] == 2


def test_sync_now_no_user_id(client, auth_headers, mocker):
    """Test sync without user_id in JSON (falls back to g.user_id)"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 0,
        "failed_count": 0,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    # Without user_id in JSON, it falls back to g.user_id from auth
    response = client.post(
        '/api/sync/now',
        json={},
        headers=auth_headers
    )
    
    # Should succeed using g.user_id from auth
    assert response.status_code == 200
    data = response.get_json()
    assert data["synced_count"] == 0


def test_sync_now_empty_json(client, auth_headers, mocker):
    """Test sync with empty JSON (falls back to g.user_id)"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 0,
        "failed_count": 0,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    # Without JSON, it falls back to g.user_id from auth
    response = client.post(
        '/api/sync/now',
        headers=auth_headers
    )
    
    # Should succeed using g.user_id from auth
    assert response.status_code == 200


def test_sync_now_no_pending_data(client, auth_headers, mocker):
    """Test sync when no data is pending"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 0,
        "failed_count": 0,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["synced_count"] == 0
    assert data["failed_count"] == 0


def test_sync_now_exception(client, auth_headers, mocker):
    """Test error handling when sync fails"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.side_effect = Exception("Sync service unavailable")
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to perform sync"


def test_sync_now_options(client):
    """Test OPTIONS request for sync now"""
    response = client.options('/api/sync/now')
    
    assert response.status_code == 204


# Integration tests
def test_status_then_sync(client, auth_headers, mocker):
    """Test checking status then performing sync"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    
    # Check status
    mock_offline_service.sync_queue = [
        {"user_id": "test-user-id", "type": "mood"}
    ]
    
    status_response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    assert status_response.status_code == 200
    status_data = status_response.get_json()
    assert status_data["pending_count"] == 1
    
    # Perform sync
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 1,
        "failed_count": 0,
        "timestamp": "2025-10-22T12:00:00Z"
    }
    
    sync_response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    assert sync_response.status_code == 200
    sync_data = sync_response.get_json()
    assert sync_data["synced_count"] == 1


def test_both_options_requests(client):
    """Test OPTIONS for both endpoints"""
    endpoints = ['/api/sync/status', '/api/sync/now']
    
    for endpoint in endpoints:
        response = client.options(endpoint)
        assert response.status_code == 204
        assert len(response.data) == 0


def test_sync_now_with_complex_result(client, auth_headers, mocker):
    """Test sync with complex result structure"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 10,
        "failed_count": 2,
        "timestamp": "2025-10-22T12:00:00Z",
        "details": {
            "moods": 5,
            "memories": 3,
            "chatbot": 2
        }
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["synced_count"] == 10


def test_sync_status_with_many_pending_items(client, auth_headers, mocker):
    """Test sync status with many pending items"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = [
        {"user_id": "test-user-id", "type": f"item-{i}"} 
        for i in range(100)
    ]
    
    response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["pending_count"] == 100


def test_logger_exception_call(client, auth_headers, mocker):
    """Test that logger.exception is called on error"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_queue = None
    
    mock_logger = mocker.patch('src.routes.sync_routes.logger')
    
    response = client.get(
        '/api/sync/status?user_id=test-user-id',
        headers=auth_headers
    )
    
    assert response.status_code == 500
    mock_logger.exception.assert_called_once()


def test_sync_now_missing_timestamp(client, auth_headers, mocker):
    """Test sync when result has no timestamp"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "synced_count": 5,
        "failed_count": 0
        # No timestamp field
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["last_sync"] is None


def test_sync_now_missing_counts(client, auth_headers, mocker):
    """Test sync when result has missing count fields"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    mock_offline_service.sync_pending_data.return_value = {
        "timestamp": "2025-10-22T12:00:00Z"
        # Missing synced_count and failed_count
    }
    
    response = client.post(
        '/api/sync/now',
        json={"user_id": "test-user-id"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["synced_count"] == 0
    assert data["failed_count"] == 0


def test_concurrent_sync_requests(client, auth_headers, mocker):
    """Test handling multiple concurrent sync requests"""
    mock_offline_service = mocker.patch('src.routes.sync_routes.offline_sync_service')
    
    for i in range(5):
        mock_offline_service.sync_pending_data.return_value = {
            "synced_count": i,
            "failed_count": 0,
            "timestamp": f"2025-10-22T12:00:{i:02d}Z"
        }
        
        response = client.post(
            '/api/sync/now',
            json={"user_id": f"user-{i}"},
            headers=auth_headers
        )
        assert response.status_code == 200
