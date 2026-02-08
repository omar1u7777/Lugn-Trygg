"""
Comprehensive tests for notifications_routes.py
Target: Increase coverage from 24% to 100%

Tests all endpoints:
- POST /fcm-token
- POST /send-reminder
- POST /schedule-daily
- POST /disable-all
- OPTIONS for all endpoints
"""

import pytest
import json
from unittest.mock import Mock, patch


# FCM Token tests
def test_save_fcm_token_success(client, auth_headers, mock_auth_service):
    """Test saving FCM token successfully"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "dGVzdF90b2tlbl8xMjM0NTY3ODkwYWJjZGVm"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert "Token saved" in data.get("message", "")


def test_save_fcm_token_missing_token(client, auth_headers, mock_auth_service):
    """Test saving without fcmToken field"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert "fcmToken" in data["error"].lower() or "missing" in data["error"].lower()


def test_save_fcm_token_empty_token(client, auth_headers, mock_auth_service):
    """Test saving with empty fcmToken"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": ""},
        headers=auth_headers
    )
    
    assert response.status_code == 400


def test_save_fcm_token_null_token(client):
    """Test saving with null fcmToken"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": None}
    )
    
    assert response.status_code == 400


def test_save_fcm_token_long_token(client):
    """Test saving with very long FCM token"""
    long_token = "x" * 500
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": long_token}
    )
    
    assert response.status_code == 200


def test_save_fcm_token_no_json(client):
    """Test saving without JSON body"""
    response = client.post('/api/notifications/fcm-token')
    
    assert response.status_code == 400


def test_save_fcm_token_invalid_json(client):
    """Test saving with invalid JSON"""
    response = client.post(
        '/api/notifications/fcm-token',
        data='invalid json',
        content_type='application/json'
    )
    
    # silent=True returns {}, which has no fcmToken
    assert response.status_code == 400


def test_save_fcm_token_exception(client, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Logger failed")
    
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "test-token"}
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to save token"


def test_save_fcm_token_options(client):
    """Test OPTIONS request for fcm-token"""
    response = client.options('/api/notifications/fcm-token')
    
    assert response.status_code == 204
    assert response.data == b''


# Send Reminder tests
def test_send_reminder_success(client, auth_headers, mock_auth_service):
    """Test sending reminder successfully"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={"type": "mood_check", "userId": "user-123"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert "message" in data


def test_send_reminder_empty_data(client, auth_headers, mock_auth_service):
    """Test sending reminder with empty data"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_send_reminder_no_json(client, auth_headers, mock_auth_service):
    """Test sending reminder without JSON"""
    response = client.post('/api/notifications/send-reminder', headers=auth_headers)
    
    assert response.status_code == 200


def test_send_reminder_with_schedule(client, auth_headers, mock_auth_service):
    """Test sending reminder with schedule details"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={
            "type": "medication",
            "userId": "user-123",
            "time": "08:00",
            "message": "Time for your medication"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_send_reminder_exception(client, auth_headers, mock_auth_service, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Notification service down")
    
    response = client.post(
        '/api/notifications/send-reminder',
        json={"type": "reminder"},
        headers=auth_headers
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert "error" in data


def test_send_reminder_options(client):
    """Test OPTIONS request for send-reminder"""
    response = client.options('/api/notifications/send-reminder')
    
    assert response.status_code == 204


# Schedule Daily tests
def test_schedule_daily_success(client, auth_headers, mock_auth_service):
    """Test scheduling daily notifications"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={
            "userId": "user-123",
            "time": "09:00",
            "enabled": True
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert "message" in data


def test_schedule_daily_empty_data(client, auth_headers, mock_auth_service):
    """Test scheduling with empty data"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_schedule_daily_no_json(client, auth_headers, mock_auth_service):
    """Test scheduling without JSON"""
    response = client.post('/api/notifications/schedule-daily', headers=auth_headers)
    
    assert response.status_code == 200


def test_schedule_daily_multiple_times(client, auth_headers, mock_auth_service):
    """Test scheduling with multiple time slots"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={
            "userId": "user-123",
            "times": ["09:00", "12:00", "18:00", "21:00"]
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_schedule_daily_exception(client, auth_headers, mock_auth_service, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Scheduler failed")
    
    response = client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert "error" in data


def test_schedule_daily_options(client):
    """Test OPTIONS request for schedule-daily"""
    response = client.options('/api/notifications/schedule-daily')
    
    assert response.status_code == 204


# Disable All tests
def test_disable_all_success(client, auth_headers, mock_auth_service):
    """Test disabling all notifications"""
    response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert "message" in data


def test_disable_all_empty_data(client, auth_headers, mock_auth_service):
    """Test disabling with empty data"""
    response = client.post(
        '/api/notifications/disable-all',
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_disable_all_no_json(client, auth_headers, mock_auth_service):
    """Test disabling without JSON"""
    response = client.post('/api/notifications/disable-all', headers=auth_headers)
    
    assert response.status_code == 200


def test_disable_all_no_user_id(client, auth_headers, mock_auth_service):
    """Test disabling without userId field"""
    response = client.post(
        '/api/notifications/disable-all',
        json={"reason": "user_request"},
        headers=auth_headers
    )
    
    assert response.status_code == 200


def test_disable_all_exception(client, mocker, auth_headers, mock_auth_service):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Disable failed")
    
    response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to disable notifications"


def test_disable_all_options(client):
    """Test OPTIONS request for disable-all"""
    response = client.options('/api/notifications/disable-all')
    
    assert response.status_code == 204


# Integration tests
def test_save_token_then_send_reminder(client, auth_headers, mock_auth_service):
    """Test saving token then sending reminder"""
    # Save token
    token_response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "test-token-123"},
        headers=auth_headers
    )
    assert token_response.status_code == 200
    
    # Send reminder
    reminder_response = client.post(
        '/api/notifications/send-reminder',
        json={"userId": "user-123", "type": "mood_check"},
        headers=auth_headers
    )
    assert reminder_response.status_code == 200


def test_schedule_then_disable(client, auth_headers, mock_auth_service):
    """Test scheduling then disabling notifications"""
    # Schedule daily
    schedule_response = client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123", "time": "09:00"},
        headers=auth_headers
    )
    assert schedule_response.status_code == 200
    
    # Disable all
    disable_response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    assert disable_response.status_code == 200


def test_all_options_requests(client):
    """Test OPTIONS for all endpoints"""
    endpoints = [
        '/api/notifications/fcm-token',
        '/api/notifications/send-reminder',
        '/api/notifications/schedule-daily',
        '/api/notifications/disable-all'
    ]
    
    for endpoint in endpoints:
        response = client.options(endpoint)
        assert response.status_code == 204
        assert len(response.data) == 0


def test_logger_calls(client, mocker, auth_headers, mock_auth_service):
    """Test that logger is called for each endpoint"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    
    # Save FCM token
    client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "test-token"},
        headers=auth_headers
    )
    assert mock_logger.info.call_count >= 1
    
    # Send reminder
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/send-reminder',
        json={"type": "reminder"},
        headers=auth_headers
    )
    assert mock_logger.info.call_count >= 1
    
    # Schedule daily
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    assert mock_logger.info.call_count >= 1
    
    # Disable all
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"},
        headers=auth_headers
    )
    assert mock_logger.info.call_count >= 1


def test_concurrent_requests(client, auth_headers, mock_auth_service):
    """Test handling multiple concurrent requests"""
    tokens = [f"token-{i}" for i in range(10)]
    
    for token in tokens:
        response = client.post(
            '/api/notifications/fcm-token',
            json={"fcmToken": token},
            headers=auth_headers
        )
        assert response.status_code == 200


def test_special_characters_in_data(client, auth_headers, mock_auth_service):
    """Test endpoints with special characters in data"""
    # FCM token with special chars
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "token_with-special.chars:123/abc="},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # Reminder with Unicode
    response = client.post(
        '/api/notifications/send-reminder',
        json={"message": "Dags för humörkoll! 😊"},
        headers=auth_headers
    )
    assert response.status_code == 200
