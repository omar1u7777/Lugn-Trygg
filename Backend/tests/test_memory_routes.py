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
    mock_memories.where.return_value.order_by.return_value.stream.return_value = [
        Mock(id="mem1", to_dict=lambda: {"user_id": "test_user", "file_path": "memories/test_user/123.mp3", "timestamp": "2025-01-01"}),
        Mock(id="mem2", to_dict=lambda: {"user_id": "test_user", "file_path": "memories/test_user/456.mp3", "timestamp": "2025-01-02"})
    ]
    mock_memories.document.return_value.set = Mock()

    mocker.patch('src.firebase_config.db', mock_db)
    mocker.patch('src.routes.memory_routes.db', mock_db)
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

def test_list_memories(client, mock_firestore):
    """Testar listning av minnen."""
    response = client.get("/api/memory/list?user_id=test_user")
    assert response.status_code == 200
    data = response.get_json()
    assert "memories" in data
    assert len(data["memories"]) == 2
    assert data["memories"][0]["file_path"] == "memories/test_user/123.mp3"

def test_list_memories_empty(client, mock_firestore):
    """Testar listning när inga minnen finns."""
    mock_firestore.collection.return_value.where.return_value.order_by.return_value.stream.return_value = []
    response = client.get("/api/memory/list?user_id=test_user")
    assert response.status_code == 200
    data = response.get_json()
    assert data["memories"] == []

def test_list_memories_missing_user_id(client, mock_firestore):
    """Testar listning utan user_id."""
    response = client.get("/api/memory/list")
    assert response.status_code == 400
    assert "Användar-ID krävs!" in response.get_json()["error"]

def test_get_memory(client, mock_firestore, mock_storage):
    """Testar hämtning av minne-URL."""
    mock_firestore.collection.return_value.where.return_value.where.return_value.limit.return_value.stream.return_value = [
        Mock(id="mem1", to_dict=lambda: {"user_id": "test_user", "file_path": "memories/test_user/123.mp3"})
    ]
    response = client.get("/api/memory/get?user_id=test_user&file_path=memories/test_user/123.mp3")
    assert response.status_code == 200
    data = response.get_json()
    assert "url" in data
    assert data["url"] == "https://signed-url.com"

def test_get_memory_not_found(client, mock_firestore, mock_storage):
    """Testar hämtning av icke-existerande minne."""
    mock_firestore.collection.return_value.where.return_value.where.return_value.limit.return_value.stream.return_value = []
    response = client.get("/api/memory/get?user_id=test_user&file_path=nonexistent.mp3")
    assert response.status_code == 403
    assert "Obehörig åtkomst till minne!" in response.get_json()["error"]

def test_get_memory_missing_params(client, mock_firestore):
    """Testar hämtning utan parametrar."""
    response = client.get("/api/memory/get")
    assert response.status_code == 400
    assert "Användar-ID och filväg krävs!" in response.get_json()["error"]