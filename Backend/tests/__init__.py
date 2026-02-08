"""
Test package for Lugn & Trygg backend.

This package contains all tests for the backend application.
Tests are organized by functionality and marked with appropriate pytest markers.
"""

import pytest
from typing import Dict, Any, Optional
from unittest.mock import MagicMock

# Test constants
TEST_USER_ID = "test-user-123"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "TestPassword123!"

# Common test data
def create_test_user(user_id: str = TEST_USER_ID, email: str = TEST_EMAIL) -> Dict[str, Any]:
    """Create a test user dictionary"""
    return {
        "uid": user_id,
        "email": email,
        "email_verified": True,
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": "2024-01-01T00:00:00Z",
        "is_active": True
    }

def create_test_mood(user_id: str = TEST_USER_ID, mood_value: int = 7) -> Dict[str, Any]:
    """Create a test mood entry"""
    return {
        "user_id": user_id,
        "mood_value": mood_value,
        "note": "Test mood entry",
        "timestamp": "2024-01-01T12:00:00Z",
        "created_at": "2024-01-01T12:00:00Z"
    }

def create_auth_headers(token: str = "test-jwt-token") -> Dict[str, str]:
    """Create authentication headers for tests"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

# Mock factories
def create_mock_firestore_document(data: Optional[Dict[str, Any]] = None, exists: bool = True) -> MagicMock:
    """Create a mock Firestore document"""
    mock_doc = MagicMock()
    mock_doc.exists = exists
    mock_doc.id = "test-doc-id"
    mock_doc.to_dict.return_value = data or {}
    return mock_doc

def create_mock_firestore_collection(documents: list = None) -> MagicMock:
    """Create a mock Firestore collection"""
    mock_collection = MagicMock()
    mock_collection.stream.return_value = documents or []
    mock_collection.get.return_value = documents or []
    return mock_collection

# Test utilities
class TestClient:
    """Enhanced test client with common operations"""

    def __init__(self, client):
        self.client = client

    def auth_request(self, method: str, url: str, user_id: str = TEST_USER_ID, **kwargs):
        """Make an authenticated request"""
        headers = create_auth_headers()
        # Set user_id in Flask g for the request
        with self.client.application.app_context():
            from flask import g
            g.user_id = user_id

        return getattr(self.client, method.lower())(url, headers=headers, **kwargs)

    def get_auth(self, url: str, user_id: str = TEST_USER_ID, **kwargs):
        return self.auth_request('get', url, user_id, **kwargs)

    def post_auth(self, url: str, user_id: str = TEST_USER_ID, **kwargs):
        return self.auth_request('post', url, user_id, **kwargs)

    def put_auth(self, url: str, user_id: str = TEST_USER_ID, **kwargs):
        return self.auth_request('put', url, user_id, **kwargs)

    def delete_auth(self, url: str, user_id: str = TEST_USER_ID, **kwargs):
        return self.auth_request('delete', url, user_id, **kwargs)

# Pytest fixtures
@pytest.fixture
def test_client(client):
    """Enhanced test client fixture"""
    return TestClient(client)

@pytest.fixture
def test_user():
    """Test user fixture"""
    return create_test_user()

@pytest.fixture
def test_mood():
    """Test mood fixture"""
    return create_test_mood()

@pytest.fixture
def auth_headers():
    """Authentication headers fixture"""
    return create_auth_headers()