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
    with patch('whisper.load_model', return_value=None), \
         patch('src.firebase_config.initialize_firebase', return_value=True):
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

    random_email = f"user{random.randint(1000, 9999)}åäö@example.com"
    test_punycode_email = convert_email_to_punycode(random_email)
    test_uid = "test-uid-123"

    existing_users = {
        test_punycode_email: {
            "uid": test_uid,
            "email": random_email,
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
            raise auth.EmailAlreadyExistsError("E-postadressen används redan!")
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

    mocker.patch.object(auth, "get_user_by_email", side_effect=get_user_by_email)
    mocker.patch.object(auth, "create_user", side_effect=create_user)

    return mock_auth

# 🔹 Mocka Firestore
@pytest.fixture(scope="function")
def mock_firestore(mocker):
    """Mockar Firestore med stöd för set, update och delete."""
    mock_db = Mock()
    mock_users = mock_db.collection("users")
    mock_tokens = mock_db.collection("refresh_tokens")

    # Mocka användardata
    mock_users.document.return_value.get.return_value.exists = True
    mock_users.document.return_value.get.return_value.to_dict.return_value = {
        "email": "teståäö@exempel.se",
        "email_punycode": convert_email_to_punycode("teståäö@exempel.se"),
        "created_at": "2025-02-24T10:00:00",
        "last_login": None,
        "email_verified": True
    }
    mock_users.document.return_value.set = Mock()
    mock_users.document.return_value.update = Mock()

    # Mocka refresh-tokens
    mock_tokens.document.return_value.set = Mock()
    mock_tokens.document.return_value.delete = Mock()
    mock_tokens.document.return_value.get.return_value.exists = True
    mock_tokens.document.return_value.get.return_value.to_dict.return_value = {
        "firebase_refresh_token": "fake-refresh-token",
        "created_at": "2025-02-24T10:00:00"
    }

    mocker.patch('src.firebase_config.db', mock_db)
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
def test_user():
    """Skapar en testanvändare med slumpmässig e-post."""
    random_email = f"user{random.randint(1000, 9999)}åäö@example.com"
    return {"email": random_email, "password": "Test123!", "uid": "test-uid-123"}

# 🔹 Testa registrering med svenska tecken
def test_register_user(client, mock_firebase_auth, mock_firestore):
    """Testar registrering av en ny användare med svenska tecken i e-postadressen."""
    random_email = f"user{random.randint(1000, 9999)}åäö@example.com"
    response = client.post("/api/auth/register", json={"email": random_email, "password": "Lösenord123!"})
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
def test_store_mood(client, mock_firebase_auth, mock_firestore, login_data):
    """Testar lagring av humör med ett giltigt access-token."""
    access_token = login_data["access_token"]
    response = client.post("/api/mood/log", json={
        "user_email": "teståäö@exempel.se",
        "mood": "happy",
        "transcript": "Jag är verkligen glad idag!"
    }, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"

# 🔹 Testa utloggning
def test_logout(client, mock_firebase_auth, mock_firestore, login_data):
    """Testar utloggning med ett giltigt refresh-token."""
    refresh_token = login_data["refresh_token"]
    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 200, f"Fel statuskod: {response.status_code}"
    assert "Utloggning lyckades!" in response.get_json()["message"]