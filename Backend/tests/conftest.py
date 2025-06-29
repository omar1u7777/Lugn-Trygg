import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# 🛡️ Sätt nödvändiga miljövariabler direkt vid import
os.environ.setdefault("JWT_SECRET_KEY", "test_jwt")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test_refresh")
os.environ.setdefault("FIREBASE_WEB_API_KEY", "fake")
os.environ.setdefault("FIREBASE_API_KEY", "fake")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test_project")
os.environ.setdefault("FIREBASE_STORAGE_BUCKET", "test-bucket")
os.environ.setdefault("FIREBASE_CREDENTIALS", "mock.json")
os.environ.setdefault("PORT", "5001")
os.environ.setdefault("FLASK_DEBUG", "False")

# 🧪 Skapa en dummy Firebase-fil om den inte finns
mock_credentials_path = os.environ.get("FIREBASE_CREDENTIALS", "mock.json")
if not os.path.exists(mock_credentials_path):
    with open(mock_credentials_path, "w") as f:
        f.write("{}")

# Lägg till project root för imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from Backend.main import create_app

@pytest.fixture(scope='module')
def app():
    """
    Skapar och returnerar Flask-applikationen för testning.
    Mockar externa beroenden som Whisper och Firebase.
    """
    with patch("Backend.main.whisper.load_model") as mock_whisper, \
         patch("Backend.src.firebase_config.initialize_firebase", return_value=True), \
         patch("firebase_admin.initialize_app", MagicMock()):

        mock_whisper.return_value = MagicMock()

        try:
            app = create_app(testing=True)
        except Exception as e:
            pytest.fail(f"❌ Misslyckades med att skapa appen för testning: {str(e)}")

        yield app
        app.logger.info("✅ Testmiljö rensad efter körning.")

@pytest.fixture(scope='module')
def client(app):
    """Testklient för att skicka HTTP-förfrågningar."""
    return app.test_client()

@pytest.fixture(scope='module')
def runner(app):
    """CLI-runner för att testa kommandon."""
    return app.test_cli_runner()
