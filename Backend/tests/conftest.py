import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# Ensure project root for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from Backend.main import create_app

@pytest.fixture(autouse=True, scope="session")
def _set_env():
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
    yield

@pytest.fixture()
def app():
    with patch("firebase_admin.initialize_app", MagicMock()), \
         patch("Backend.src.firebase_config.initialize_firebase", return_value=True), \
         patch("Backend.src.firebase_config.db", MagicMock(), create=True), \
         patch("Backend.src.firebase_config.auth", MagicMock(), create=True):
        app = create_app(testing=True)
        yield app

@pytest.fixture()
def client(app):
    return app.test_client()
