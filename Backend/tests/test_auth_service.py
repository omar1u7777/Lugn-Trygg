import os
import random
import sys
import pytest
from unittest.mock import Mock, MagicMock, patch
from firebase_admin import auth, firestore
from src.utils import convert_email_to_punycode  # Ändrat från src.routes.auth
from main import create_app

# Lägg till projektets rot till sys.path för korrekta importer
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 🔹 Skapa en Flask-testklient via create_app
@pytest.fixture(scope="module")
def client():
    """Skapar en testklient för Flask-applikationen med mockade beroenden."""
    with patch('src.firebase_config.initialize_firebase', return_value=True):
        try:
            app = create_app(testing=True)
        except Exception as e:
            pytest.fail(f"Misslyckades med att skapa appen: {str(e)}")
        return app.test_client()

# 🔹 Mocka Firebase Authentication & REST API
@pytest.fixture(scope="function")
def mock_firebase_auth(mocker):
    """Mockar Firebase Authentication och REST API-anrop."""
    mock_auth = Mock()
    mock_requests = mocker.patch('requests.post')

    test_email = "teståäö@example.com"
    test_punycode_email = convert_email_to_punycode(test_email)
    test_uid = "test-uid-123"

    existing_users = {
        test_punycode_email: {
            "uid": test_uid,
            "email": test_email,
            "email_punycode": test_punycode_email,
            "password": "Test123!",
            "email_verified": True
        }
    }

    def get_user_by_email(email):
        punycode_email = convert_email_to_punycode(email)
        if punycode_email in existing_users:
            return MagicMock(uid=existing_users[punycode_email]["uid"], email=email, email_verified=True)
        raise auth.UserNotFoundError("No user record found")

    def create_user(email, password, **kwargs):
        punycode_email = convert_email_to_punycode(email)
        if punycode_email in existing_users:
            raise auth.EmailAlreadyExistsError("E-postadressen används redan!", cause=None, http_response=None)
        new_uid = f"test-uid-{random.randint(1000, 9999)}"
        existing_users[punycode_email] = {
            "uid": new_uid,
            "email": email,
            "email_punycode": punycode_email,
            "password": password,
            "email_verified": True
        }
        return MagicMock(uid=new_uid, email=email)

    # Mocka REST API för login
    def mock_post(url, json=None, **kwargs):
        if "signInWithPassword" in url:
            punycode_email = convert_email_to_punycode(json["email"])
            if punycode_email in existing_users and json["password"] == existing_users[punycode_email]["password"]:
                return MagicMock(status_code=200, json=lambda: {
                    "idToken": "fake-id-token",
                    "refreshToken": "fake-refresh-token"
                })
            return MagicMock(status_code=400, json=lambda: {"error": "INVALID_PASSWORD"})
        elif "token" in url:
            return MagicMock(status_code=200, json=lambda: {"id_token": "new-id-token"})
        return MagicMock(status_code=500)

    mock_auth.get_user_by_email = get_user_by_email
    mock_auth.create_user = create_user
    mock_requests.side_effect = mock_post

    mocker.patch('src.services.auth_service.auth.get_user_by_email', side_effect=get_user_by_email)
    mocker.patch('src.services.auth_service.auth.create_user', side_effect=create_user)
    mocker.patch('src.services.auth_service.requests.post', side_effect=mock_post)

    return {"auth": mock_auth, "test_email": test_email}

# 🔹 Mocka Firestore
@pytest.fixture(scope="function")
def mock_firestore(mocker, mock_firebase_auth):
    """Mockar Firestore med stöd för set, update och delete."""
    mock_db = Mock()
    mock_users = mock_db.collection("users")
    mock_tokens = mock_db.collection("refresh_tokens")

    test_email = mock_firebase_auth["test_email"]
    test_punycode = convert_email_to_punycode(test_email)

    # Mocka användardata
    mock_users.document.return_value.get.return_value.exists = True
    mock_users.document.return_value.get.return_value.to_dict.return_value = {
        "email": test_email,
        "email_punycode": test_punycode,
        "created_at": "2025-02-24T10:00:00",
        "last_login": None,
        "email_verified": True
    }
    mock_users.document.return_value.set = Mock()
    mock_users.document.return_value.update = Mock()

    # Mocka where query for login
    class MockQuery:
        def __init__(self):
            self.stream_result = [Mock(id="test-uid-123", to_dict=lambda: {
                "email": test_email,
                "email_punycode": test_punycode,
                "created_at": "2025-02-24T10:00:00",
                "last_login": None,
                "email_verified": True
            })]

        def limit(self, n):
            return self

        def stream(self):
            return self.stream_result

    mock_query = MockQuery()
    mock_users.where = lambda **kwargs: mock_query

    # Mocka refresh-tokens
    mock_tokens.document.return_value.set = Mock()
    mock_tokens.document.return_value.delete = Mock()
    mock_tokens.document.return_value.get.return_value.exists = True
    mock_tokens.document.return_value.get.return_value.to_dict.return_value = {
        "firebase_refresh_token": "fake-refresh-token",
        "created_at": "2025-02-24T10:00:00"
    }
    def mock_tokens_where(filter):
        class MockTokensQuery:
            def __init__(self):
                self.stream_result = [Mock(id="test-uid-123", to_dict=lambda: {
                    "backend_refresh_token": "fake-refresh-token",
                    "created_at": "2025-02-24T10:00:00"
                })]

            def limit(self, n):
                return self

            def stream(self):
                return self.stream_result

        return MockTokensQuery()
    mock_tokens.where = mock_tokens_where

    mocker.patch('src.firebase_config.db', mock_db)
    mocker.patch('src.routes.auth.db', mock_db)
    return mock_db

# 🔹 Fixtur för att logga in och hämta tokens
@pytest.fixture(scope="function")
def login_data(client, mock_firebase_auth, mock_firestore, test_user):
    """Loggar in en testanvändare och returnerar tokens."""
    response = client.post("/api/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert response.status_code == 200, "Inloggning misslyckades i fixturen"
    data = response.get_json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "user_id": data["user_id"]
    }

# 🔹 Testanvändare
@pytest.fixture(scope="function")
def test_user(mock_firebase_auth):
    """Skapar en testanvändare med e-post från mock."""
    return {"email": mock_firebase_auth["test_email"], "password": "Test123!", "uid": "test-uid-123"}

# 🔹 Testa registrering med svenska tecken
def test_register_user(client, mock_firebase_auth, mock_firestore):
    """Testar registrering av en ny användare med svenska tecken i e-postadressen."""
    new_email = f"user{random.randint(1000, 9999)}åäö@example.com"
    response = client.post("/api/auth/register", json={"email": new_email, "password": "Lösenord123!"})
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.get_json()}")
    assert response.status_code == 201, f"Fel statuskod: {response.status_code}"
    assert "Registrering lyckades!" in response.get_json()["message"]

# 🔹 Testa inloggning med svenska tecken
def test_login_user(client, mock_firebase_auth, mock_firestore, test_user):
    """Testar inloggning med en befintlig användare."""
    response = client.post("/api/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"
    assert "Inloggning lyckades!" in response.get_json()["message"]
    assert "access_token" in response.get_json()
    assert "refresh_token" in response.get_json()

# 🔹 Testa token-uppdatering
def test_refresh_token(client, mock_firebase_auth, mock_firestore, login_data):
    """Testar token-uppdatering med ett giltigt refresh-token."""
    refresh_token = login_data["refresh_token"]
    response = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"
    assert "Token uppdaterad" in response.get_json()["message"]
    assert "access_token" in response.get_json()

# 🔹 Testa lagring av humör med autentisering
def test_store_mood(client, mock_firebase_auth, mock_firestore, login_data, mocker):
    """Testar lagring av humör med ett giltigt access-token."""
    # Mock the decrypt_data function to return the mood directly for testing
    mocker.patch('src.routes.mood_routes.decrypt_data', return_value="glad")

    access_token = login_data["access_token"]
    response = client.post("/api/mood/log", json={
        "user_id": login_data["user_id"],
        "mood": "encrypted_glad",  # Mock encrypted data
        "score": 0.8
    }, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"

# 🔹 Testa utloggning
def test_logout(client, mock_firebase_auth, mock_firestore, login_data):
    """Testar utloggning med ett giltigt refresh-token."""
    refresh_token = login_data["refresh_token"]
    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"
    assert "Utloggning lyckades!" in response.get_json()["message"]

# 🔹 Testa Google-inloggning
def test_google_login(client, mock_firestore, mocker):
    """Testar Google-inloggning med ID-token."""
    # Mocka Firebase auth verify_id_token
    mock_decoded_token = {
        'uid': 'google-user-123',
        'email': 'google@example.com'
    }
    mocker.patch('firebase_admin.auth.verify_id_token', return_value=mock_decoded_token)

    # Mocka JWT-generering
    mocker.patch('src.services.auth_service.AuthService.generate_access_token', return_value='mock-access-token')
    mocker.patch('src.services.auth_service.AuthService.generate_refresh_token', return_value='mock-refresh-token')

    response = client.post("/api/auth/google-login", json={"id_token": "mock-google-token"})
    assert response.status_code == 200
    data = response.get_json()
    assert "Google-inloggning lyckades!" in data["message"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user_id"] == "google-user-123"
    assert data["email"] == "google@example.com"

# 🔹 Testa lösenordsåterställning
def test_reset_password(client):
    """Testar lösenordsåterställning."""
    response = client.post("/api/auth/reset-password", json={"email": "test@example.com"})
    assert response.status_code == 200
    assert "Återställningslänk har skickats" in response.get_json()["message"]

def test_reset_password_invalid_email(client):
    """Testar lösenordsåterställning med ogiltig e-post."""
    response = client.post("/api/auth/reset-password", json={"email": "invalid-email"})
    assert response.status_code == 400
    assert "Ogiltig e-postadress" in response.get_json()["error"]

def test_reset_password_missing_email(client):
    """Testar lösenordsåterställning utan e-post."""
    response = client.post("/api/auth/reset-password", json={})
    assert response.status_code == 400
    assert "E-postadress krävs" in response.get_json()["error"]