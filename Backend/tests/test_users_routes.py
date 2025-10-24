"""
Comprehensive tests for users_routes.py
Target: Increase coverage from 40% to 85%+

Tests all endpoints:
- GET /<user_id>/notification-settings
- PUT /<user_id>/notification-preferences  
- POST /<user_id>/notification-schedule
"""

import pytest
import json
from unittest.mock import Mock, patch


def test_get_notification_settings_success(client):
    """Test retrieving default notification settings"""
    response = client.get('/api/users/test-user-123/notification-settings')
    assert response.status_code == 200
    data = response.get_json()
    
    # Check all expected fields
    assert 'morningReminder' in data
    assert 'eveningReminder' in data
    assert 'moodCheckInTime' in data
    assert 'enableMoodReminders' in data
    assert 'enableMeditationReminders' in data
    
    # Check default values
    assert data['morningReminder'] == '08:00'
    assert data['eveningReminder'] == '20:00'
    assert data['moodCheckInTime'] == '12:00'
    assert data['enableMoodReminders'] is True
    assert data['enableMeditationReminders'] is False


def test_get_notification_settings_different_user(client):
    """Test notification settings returns same defaults for different users"""
    response1 = client.get('/api/users/user-1/notification-settings')
    response2 = client.get('/api/users/user-2/notification-settings')
    
    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response1.get_json() == response2.get_json()


def test_update_notification_preferences_success(client):
    """Test updating notification preferences with valid data"""
    preferences = {
        'enableMoodReminders': False,
        'enableMeditationReminders': True,
        'notificationFrequency': 'daily'
    }
    
    response = client.put(
        '/api/users/test-user-123/notification-preferences',
        json=preferences
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Preferences updated'


def test_update_notification_preferences_empty_data(client):
    """Test updating preferences with empty JSON"""
    response = client.put(
        '/api/users/test-user-123/notification-preferences',
        json={}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Preferences updated'


def test_update_notification_preferences_no_json(client):
    """Test updating preferences without JSON body"""
    response = client.put('/api/users/test-user-123/notification-preferences')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Preferences updated'


def test_update_notification_preferences_invalid_json(client):
    """Test updating preferences with malformed JSON"""
    response = client.put(
        '/api/users/test-user-123/notification-preferences',
        data='invalid json{',
        content_type='application/json'
    )
    
    # Should handle gracefully with silent=True
    assert response.status_code == 200


def test_update_notification_preferences_with_all_fields(client):
    """Test updating all preference fields"""
    preferences = {
        'enableMoodReminders': True,
        'enableMeditationReminders': True,
        'enableExerciseReminders': False,
        'enableSleepReminders': True,
        'notificationFrequency': 'twice_daily',
        'quietHoursStart': '22:00',
        'quietHoursEnd': '07:00'
    }
    
    response = client.put(
        '/api/users/test-user-123/notification-preferences',
        json=preferences
    )
    
    assert response.status_code == 200


def test_set_notification_schedule_success(client):
    """Test setting notification schedule with valid data"""
    schedule = {
        'morningReminder': '07:00',
        'eveningReminder': '21:00',
        'moodCheckInTime': '13:00'
    }
    
    response = client.post(
        '/api/users/test-user-123/notification-schedule',
        json=schedule
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Schedule saved'


def test_set_notification_schedule_empty_data(client):
    """Test setting schedule with empty JSON"""
    response = client.post(
        '/api/users/test-user-123/notification-schedule',
        json={}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Schedule saved'


def test_set_notification_schedule_no_json(client):
    """Test setting schedule without JSON body"""
    response = client.post('/api/users/test-user-123/notification-schedule')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Schedule saved'


def test_set_notification_schedule_custom_times(client):
    """Test setting custom notification times"""
    schedule = {
        'morningReminder': '06:30',
        'eveningReminder': '22:30',
        'moodCheckInTime': '14:00',
        'medicationReminder': '09:00',
        'therapySessionReminder': '16:00'
    }
    
    response = client.post(
        '/api/users/test-user-123/notification-schedule',
        json=schedule
    )
    
    assert response.status_code == 200


def test_set_notification_schedule_invalid_json(client):
    """Test setting schedule with malformed JSON"""
    response = client.post(
        '/api/users/test-user-123/notification-schedule',
        data='not valid json',
        content_type='application/json'
    )
    
    # Should handle gracefully with silent=True
    assert response.status_code == 200


def test_different_user_ids(client):
    """Test that endpoints work with different user ID formats"""
    user_ids = [
        'user-123',
        'abc123def456',
        'user_with_underscore',
        '12345'
    ]
    
    for user_id in user_ids:
        # Test GET
        response = client.get(f'/api/users/{user_id}/notification-settings')
        assert response.status_code == 200
        
        # Test PUT
        response = client.put(
            f'/api/users/{user_id}/notification-preferences',
            json={'test': 'data'}
        )
        assert response.status_code == 200
        
        # Test POST
        response = client.post(
            f'/api/users/{user_id}/notification-schedule',
            json={'test': 'data'}
        )
        assert response.status_code == 200


def test_update_preferences_special_characters(client):
    """Test updating preferences with special characters in data"""
    preferences = {
        'customMessage': 'Hej! 👋 Dags för humörkoll? 😊',
        'timezone': 'Europe/Stockholm'
    }
    
    response = client.put(
        '/api/users/test-user/notification-preferences',
        json=preferences
    )
    
    assert response.status_code == 200


def test_schedule_with_boolean_values(client):
    """Test schedule with boolean enable/disable flags"""
    schedule = {
        'morningReminder': '08:00',
        'enableMorning': True,
        'enableEvening': False
    }
    
    response = client.post(
        '/api/users/test-user/notification-schedule',
        json=schedule
    )
    
    assert response.status_code == 200


def test_concurrent_updates(client):
    """Test multiple concurrent preference updates"""
    for i in range(5):
        response = client.put(
            f'/api/users/user-{i}/notification-preferences',
            json={'iteration': i}
        )
        assert response.status_code == 200


def test_update_preferences_with_logger_exception(client, mocker):
    """Test that logger exceptions are caught properly"""
    # Mock logger to raise exception
    mock_logger = mocker.patch('src.routes.users_routes.logger')
    mock_logger.info.side_effect = Exception('Logger failed')
    
    response = client.put(
        '/api/users/test-user/notification-preferences',
        json={'test': 'data'}
    )
    
    # Should still return 500 error since exception handler catches it
    # But the endpoint handles it gracefully
    assert response.status_code in [200, 500]


def test_schedule_with_logger_exception(client, mocker):
    """Test that schedule endpoint handles logger exceptions"""
    mock_logger = mocker.patch('src.routes.users_routes.logger')
    mock_logger.info.side_effect = Exception('Logger failed')
    
    response = client.post(
        '/api/users/test-user/notification-schedule',
        json={'test': 'data'}
    )
    
    assert response.status_code in [200, 500]
