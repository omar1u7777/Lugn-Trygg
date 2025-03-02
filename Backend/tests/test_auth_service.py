import random
import pytest
from unittest.mock import Mock, MagicMock
import sys
import os
from firebase_admin import auth, firestore

# Lägg till projektroten i sys.path för att importera moduler
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from main import create_app  # Importera create_app från rätt väg

@pytest.fixture(scope="session")
def app():
    """Skapar en Flask-applikation för testning"""
    app = create_app(testing=True)
    return app

@pytest.fixture(scope="session")
def client(app):
    """Returnerar en testklient för Flask-applikationen."""
    return app.test_client()

# Mockar Firebase Authentication
@pytest.fixture(scope="function")
def mock_firebase_auth(mocker):
    """Mockar Firebase Authentication för tester."""
    mock_auth = Mock()

    # Mocka `get_user_by_email`
    def get_user_by_email(email):
        if email == "test@exempel.se":
            return MagicMock(uid="test-uid-123", email=email)
        raise auth.UserNotFoundError("No user record found")

    # Mocka `create_user`
    def create_user(email, password, **kwargs):
        if email in ["test@exempel.se", "existing@example.com"]:
            raise auth.EmailAlreadyExistsError("E-postadressen används redan!", cause=None, http_response=None)
        return MagicMock(uid="test-uid-123", email=email)
    
    # Mocka `verify_id_token`
    def verify_id_token(id_token):
        if id_token == "valid-token":
            return {"uid": "test-uid-123"}
        raise auth.InvalidIdTokenError("Invalid token")

    mock_auth.get_user_by_email = get_user_by_email
    mock_auth.create_user = create_user
    mock_auth.verify_id_token = verify_id_token

    # Patch Firebase Admin SDK:s auth-modul
    mocker.patch.object(auth, "get_user_by_email", side_effect=get_user_by_email)
    mocker.patch.object(auth, "create_user", side_effect=create_user)
    mocker.patch.object(auth, "verify_id_token", side_effect=verify_id_token)

    return mock_auth

# Mockar Firestore
@pytest.fixture(scope="function")
def mock_firestore(mocker):
    """Mockar Firestore för att undvika riktiga databasoperationer i tester."""
    mock_db = Mock()

    # Simulera användarskapande i Firestore
    mock_users = mock_db.collection("users")
    mock_refresh_tokens = mock_db.collection("refresh_tokens")

    # Mocka Firestore-samlingar
    mock_users.document.return_value.get.return_value.exists = False
    mock_users.document.return_value.set.return_value = None  # Simulerar skapande av användare
    mock_users.document.return_value.update.return_value = None  # Simulerar uppdatering

    mock_refresh_tokens.document.return_value.get.return_value.exists = False
    mock_refresh_tokens.document.return_value.set.return_value = None  # Simulerar refresh-token lagring
    mock_refresh_tokens.document.return_value.delete.return_value = None  # Simulerar refresh-token borttagning

    # Simulera att användardokumentet finns vid inloggning
    mock_users.document.return_value.get.return_value.exists = True
    mock_users.document.return_value.to_dict.return_value = {
        "email": "test@exempel.se",
        "password": "hashed_password",
        "created_at": "2025-02-24T10:00:00",
        "last_login": None,
        "email_verified": False
    }

    mocker.patch.object(firestore, "client", return_value=mock_db)

    return mock_db

# Mockad testanvändare
@pytest.fixture(scope="function")
def test_user():
    """Returnerar en testanvändare med giltiga inloggningsuppgifter."""
    return {
        "email": "test@exempel.se",  # Svensk e-postadress
        "password": "Test123!",
        "uid": "test-uid-123"
    }

# Testa användarregistrering
def test_register_user(client, mock_firebase_auth, mock_firestore):
    """Testar användarregistrering"""
    random_email = "user" + str(random.randint(1000, 9999)) + "@example.com"
    response = client.post("/api/auth/register", json={
        "email": random_email,
        "password": "Lösenord123!"
    })

    # Kontrollera att registreringen var framgångsrik
    assert response.status_code == 201
    assert "Registrering lyckades!" in response.get_json()["message"]

# Testa användarinloggning
def test_login_user(client, mock_firebase_auth, mock_firestore):
    """Testar användarinloggning för den nyregistrerade användaren."""
    random_email = "user" + str(random.randint(1000, 9999)) + "@example.com"
    
    # Först registrera användaren
    register_response = client.post("/api/auth/register", json={
        "email": random_email,
        "password": "Lösenord123!"
    })
    
    assert register_response.status_code == 201
    assert "Registrering lyckades!" in register_response.get_json()["message"]

    # Sedan logga in användaren
    login_response = client.post("/api/auth/login", json={
        "email": random_email,
        "password": "Lösenord123!"
    })

    # Kontrollera att inloggning lyckas
    assert login_response.status_code == 200
    assert "Inloggning lyckades!" in login_response.get_json()["message"]
    assert "access_token" in login_response.get_json()
