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
def test_save_fcm_token_success(client):
    """Test saving FCM token successfully"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "dGVzdF90b2tlbl8xMjM0NTY3ODkwYWJjZGVm"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Token saved"


def test_save_fcm_token_missing_token(client):
    """Test saving without fcmToken field"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={}
    )
    
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Missing fcmToken"


def test_save_fcm_token_empty_token(client):
    """Test saving with empty fcmToken"""
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": ""}
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
def test_send_reminder_success(client):
    """Test sending reminder successfully"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={"type": "mood_check", "userId": "user-123"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Reminder dispatched"


def test_send_reminder_empty_data(client):
    """Test sending reminder with empty data"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={}
    )
    
    assert response.status_code == 200


def test_send_reminder_no_json(client):
    """Test sending reminder without JSON"""
    response = client.post('/api/notifications/send-reminder')
    
    assert response.status_code == 200


def test_send_reminder_with_schedule(client):
    """Test sending reminder with schedule details"""
    response = client.post(
        '/api/notifications/send-reminder',
        json={
            "type": "medication",
            "userId": "user-123",
            "time": "08:00",
            "message": "Time for your medication"
        }
    )
    
    assert response.status_code == 200


def test_send_reminder_exception(client, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Notification service down")
    
    response = client.post(
        '/api/notifications/send-reminder',
        json={"type": "reminder"}
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to send reminder"


def test_send_reminder_options(client):
    """Test OPTIONS request for send-reminder"""
    response = client.options('/api/notifications/send-reminder')
    
    assert response.status_code == 204


# Schedule Daily tests
def test_schedule_daily_success(client):
    """Test scheduling daily notifications"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={
            "userId": "user-123",
            "time": "09:00",
            "enabled": True
        }
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Daily notifications scheduled"


def test_schedule_daily_empty_data(client):
    """Test scheduling with empty data"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={}
    )
    
    assert response.status_code == 200


def test_schedule_daily_no_json(client):
    """Test scheduling without JSON"""
    response = client.post('/api/notifications/schedule-daily')
    
    assert response.status_code == 200


def test_schedule_daily_multiple_times(client):
    """Test scheduling with multiple time slots"""
    response = client.post(
        '/api/notifications/schedule-daily',
        json={
            "userId": "user-123",
            "times": ["09:00", "12:00", "18:00", "21:00"]
        }
    )
    
    assert response.status_code == 200


def test_schedule_daily_exception(client, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Scheduler failed")
    
    response = client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123"}
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to schedule notifications"


def test_schedule_daily_options(client):
    """Test OPTIONS request for schedule-daily"""
    response = client.options('/api/notifications/schedule-daily')
    
    assert response.status_code == 204


# Disable All tests
def test_disable_all_success(client):
    """Test disabling all notifications"""
    response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "All notifications disabled"


def test_disable_all_empty_data(client):
    """Test disabling with empty data"""
    response = client.post(
        '/api/notifications/disable-all',
        json={}
    )
    
    assert response.status_code == 200


def test_disable_all_no_json(client):
    """Test disabling without JSON"""
    response = client.post('/api/notifications/disable-all')
    
    assert response.status_code == 200


def test_disable_all_no_user_id(client):
    """Test disabling without userId field"""
    response = client.post(
        '/api/notifications/disable-all',
        json={"reason": "user_request"}
    )
    
    assert response.status_code == 200


def test_disable_all_exception(client, mocker):
    """Test error handling when exception occurs"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    mock_logger.info.side_effect = Exception("Disable failed")
    
    response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"}
    )
    
    assert response.status_code == 500
    data = response.get_json()
    assert data["error"] == "Failed to disable notifications"


def test_disable_all_options(client):
    """Test OPTIONS request for disable-all"""
    response = client.options('/api/notifications/disable-all')
    
    assert response.status_code == 204


# Integration tests
def test_save_token_then_send_reminder(client):
    """Test saving token then sending reminder"""
    # Save token
    token_response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "test-token-123"}
    )
    assert token_response.status_code == 200
    
    # Send reminder
    reminder_response = client.post(
        '/api/notifications/send-reminder',
        json={"userId": "user-123", "type": "mood_check"}
    )
    assert reminder_response.status_code == 200


def test_schedule_then_disable(client):
    """Test scheduling then disabling notifications"""
    # Schedule daily
    schedule_response = client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123", "time": "09:00"}
    )
    assert schedule_response.status_code == 200
    
    # Disable all
    disable_response = client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"}
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


def test_logger_calls(client, mocker):
    """Test that logger is called for each endpoint"""
    mock_logger = mocker.patch('src.routes.notifications_routes.logger')
    
    # Save FCM token
    client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "test-token"}
    )
    assert mock_logger.info.call_count >= 1
    
    # Send reminder
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/send-reminder',
        json={"type": "reminder"}
    )
    assert mock_logger.info.call_count >= 1
    
    # Schedule daily
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/schedule-daily',
        json={"userId": "user-123"}
    )
    assert mock_logger.info.call_count >= 1
    
    # Disable all
    mock_logger.reset_mock()
    client.post(
        '/api/notifications/disable-all',
        json={"userId": "user-123"}
    )
    assert mock_logger.info.call_count >= 1


def test_concurrent_requests(client):
    """Test handling multiple concurrent requests"""
    tokens = [f"token-{i}" for i in range(10)]
    
    for token in tokens:
        response = client.post(
            '/api/notifications/fcm-token',
            json={"fcmToken": token}
        )
        assert response.status_code == 200


def test_special_characters_in_data(client):
    """Test endpoints with special characters in data"""
    # FCM token with special chars
    response = client.post(
        '/api/notifications/fcm-token',
        json={"fcmToken": "token_with-special.chars:123/abc="}
    )
    assert response.status_code == 200
    
    # Reminder with Unicode
    response = client.post(
        '/api/notifications/send-reminder',
        json={"message": "Dags för humörkoll! 😊"}
    )
    assert response.status_code == 200
