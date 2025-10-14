import os
import sys
import pytest
from unittest.mock import Mock, patch
from main import create_app

# Lägg till projektets rot till sys.path för korrekta importer
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(scope="module")
def client():
    """Skapar en testklient för Flask-applikationen med mockade beroenden."""
    with patch('src.firebase_config.initialize_firebase', return_value=True):
        try:
            app = create_app(testing=True)
        except Exception as e:
            pytest.fail(f"Misslyckades med att skapa appen: {str(e)}")
        return app.test_client()

@pytest.fixture(scope="function")
def mock_firestore(mocker):
    """Mockar Firestore för memory routes."""
    mock_db = Mock()
    mock_memories = Mock()
    mock_db.collection.return_value = mock_memories
    def mock_where(field, operator, value):
        print(f"Mock where called with field={field}, operator={operator}, value={value}")
        mock_query = Mock()
        if field == "user_id" and operator == "==" and value == "test-user-id":
            print("Returning mock data for test-user-id")
            mock_query.order_by.return_value.stream.return_value = [
                Mock(id="mem1", to_dict=lambda: {"user_id": "test-user-id", "file_path": "memories/test_user/123.mp3", "timestamp": "2025-01-01"}),
                Mock(id="mem2", to_dict=lambda: {"user_id": "test-user-id", "file_path": "memories/test_user/456.mp3", "timestamp": "2025-01-02"})
            ]
        else:
            print(f"No match for field={field}, value={value}")
            mock_query.order_by.return_value.stream.return_value = []
        return mock_query
    mock_memories.where = mock_where
    mock_memories.document.return_value.set = Mock()

    mocker.patch('src.firebase_config.db', mock_db)
    return mock_db

@pytest.fixture(scope="function")
def mock_storage(mocker):
    """Mockar Firebase Storage."""
    mock_bucket = Mock()
    mock_blob = Mock()
    mock_bucket.blob.return_value = mock_blob
    mock_blob.upload_from_file = Mock()
    mock_blob.generate_signed_url.return_value = "https://signed-url.com"

    mocker.patch('src.routes.memory_routes.storage.bucket', return_value=mock_bucket)
    return mock_bucket

@pytest.fixture(scope="function")
def auth_headers():
    """Returnerar authentication headers för tester."""
    return {"Authorization": "Bearer test-token"}

@pytest.fixture(scope="function")
def mock_auth_service(mocker):
    """Mock auth service for testing."""
    # Mock the AuthService.jwt_required decorator globally for all tests
    mocker.patch('src.routes.memory_routes.AuthService.jwt_required', lambda f: f)
    # Mock AuthService.verify_token to return the test user_id
    mocker.patch('src.routes.memory_routes.AuthService.verify_token', return_value=("test-user-id", None))
    return {"email": "test@example.com", "user_id": "test-user-id"}

def test_list_memories(client, mock_firestore, mocker, auth_headers, mock_auth_service):
    """Testar listning av minnen."""
    # Fix the mock to return data for the correct user_id
    def mock_where(field, operator, value):
        mock_query = Mock()
        if field == "user_id" and operator == "==" and value == "test-user-id":
            mock_query.order_by.return_value.stream.return_value = [
                Mock(id="mem1", to_dict=lambda: {"user_id": "test-user-id", "file_path": "memories/test_user/123.mp3", "timestamp": "2025-01-01"}),
                Mock(id="mem2", to_dict=lambda: {"user_id": "test-user-id", "file_path": "memories/test_user/456.mp3", "timestamp": "2025-01-02"})
            ]
        else:
            mock_query.order_by.return_value.stream.return_value = []
        return mock_query
    mock_firestore.collection.return_value.where = mock_where

    # Also patch the db in the routes module
    mocker.patch('src.routes.memory_routes.db', mock_firestore)

    response = client.get("/api/memory/list?user_id=test-user-id", headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "memories" in data
    assert len(data["memories"]) == 2
    assert data["memories"][0]["file_path"] == "memories/test_user/123.mp3"

def test_list_memories_empty(client, mock_firestore, mocker, auth_headers, mock_auth_service):
    """Testar listning när inga minnen finns."""
    def mock_where_empty(field, operator, value):
        mock_query = Mock()
        mock_query.order_by.return_value.stream.return_value = []
        return mock_query
    mock_firestore.collection.return_value.where = mock_where_empty

    response = client.get("/api/memory/list?user_id=test-user-id", headers=auth_headers)  # Use same user_id as auth
    assert response.status_code == 200
    data = response.get_json()
    assert data["memories"] == []

def test_list_memories_missing_user_id(client, mock_firestore, mocker, auth_headers, mock_auth_service):
    """Testar listning utan user_id."""
    response = client.get("/api/memory/list", headers=auth_headers)
    assert response.status_code == 200  # Should return 200 with empty list when no user_id provided
    data = response.get_json()
    assert data["memories"] == []

def test_get_memory(client, mock_firestore, mock_storage, mocker, auth_headers, mock_auth_service):
    """Testar hämtning av minne-URL."""
    def mock_where_first(field, operator, value):
        mock_query = Mock()
        def mock_where_second(field2, operator2, value2):
            mock_query2 = Mock()
            if field == "user_id" and field2 == "file_path" and value == "test-user-id" and value2 == "memories/test_user/123.mp3":
                mock_query2.limit.return_value.stream.return_value = [
                    Mock(id="mem1", to_dict=lambda: {"user_id": "test-user-id", "file_path": "memories/test_user/123.mp3"})
                ]
            else:
                mock_query2.limit.return_value.stream.return_value = []
            return mock_query2
        mock_query.where = mock_where_second
        return mock_query

    mock_firestore.collection.return_value.where = mock_where_first

    # Mock storage blob exists
    mock_storage.bucket.return_value.blob.return_value.exists.return_value = True
    mock_storage.bucket.return_value.blob.return_value.generate_signed_url.return_value = "https://signed-url.com"

    response = client.get("/api/memory/get?user_id=test-user-id&file_path=memories/test_user/123.mp3", headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "url" in data
    assert data["url"] == "https://signed-url.com"

def test_get_memory_not_found(client, mock_firestore, mock_storage, mocker, auth_headers, mock_auth_service):
    """Testar hämtning av icke-existerande minne."""
    def mock_where_first(field, operator, value):
        mock_query = Mock()
        def mock_where_second(field2, operator2, value2):
            mock_query2 = Mock()
            mock_query2.limit.return_value.stream.return_value = []
            return mock_query2
        mock_query.where = mock_where_second
        return mock_query

    mock_firestore.collection.return_value.where = mock_where_first

    response = client.get("/api/memory/get?user_id=test-user-id&file_path=nonexistent.mp3", headers=auth_headers)
    assert response.status_code == 403
    assert "Obehörig åtkomst till minne!" in response.get_json()["error"]

def test_get_memory_missing_params(client, mock_firestore, mocker, auth_headers, mock_auth_service):
    """Testar hämtning utan parametrar."""
    response = client.get("/api/memory/get", headers=auth_headers)
    assert response.status_code == 400
    assert "Filväg krävs!" in response.get_json()["error"]  # Updated to match actual error message