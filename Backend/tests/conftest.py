import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Add project root to path for imports (main.py is at root level)
project_root = os.path.join(os.path.dirname(__file__), '..', '..')
backend_dir = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

# Ensure test environment settings before any config imports
# Force these OVER any .env file values
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = 'True'
os.environ['TESTING'] = 'True'

# Set Firebase env vars for CI/test environments if not already set
os.environ.setdefault('FIREBASE_WEB_API_KEY', 'test-firebase-web-api-key')
os.environ.setdefault('FIREBASE_API_KEY', 'test-firebase-api-key')
os.environ.setdefault('FIREBASE_PROJECT_ID', 'test-project')
os.environ.setdefault('FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com')
os.environ.setdefault('FIREBASE_CREDENTIALS', '{"type":"service_account","project_id":"test","private_key_id":"k","private_key":"-----BEGIN RSA PRIVATE KEY-----\\nMIIBogIBAAJBALRiMLAH\\n-----END RSA PRIVATE KEY-----\\n","client_email":"t@t.iam.gserviceaccount.com","client_id":"1","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}')
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test-refresh-secret-key')

from src.utils.hf_cache import configure_hf_cache

configure_hf_cache()

# Mock firebase_admin.messaging BEFORE any imports
mock_messaging = MagicMock()
mock_messaging.send = MagicMock(return_value="projects/test/messages/12345")
mock_messaging.send_multicast = MagicMock(return_value=MagicMock(success_count=1, failure_count=0))
mock_messaging.Message = MagicMock
mock_messaging.Notification = MagicMock
mock_messaging.AndroidConfig = MagicMock
mock_messaging.APNSConfig = MagicMock
mock_messaging.WebpushConfig = MagicMock

# Create a mock ApiCallError class
class MockApiCallError(Exception):
    """Mock Firebase messaging ApiCallError"""
    def __init__(self, code, message, cause=None):
        self.code = code
        self.message = message
        self.cause = cause
        super().__init__(message)

mock_messaging.ApiCallError = MockApiCallError
sys.modules['firebase_admin.messaging'] = mock_messaging

# Mock Firebase BEFORE any route imports happen
mock_db = MagicMock()

def create_mock_collection():
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "test-doc-id"
    mock_doc_ref.set = MagicMock()
    mock_doc_ref.update = MagicMock()
    mock_doc_ref.delete = MagicMock()
    mock_doc_ref.get = MagicMock(return_value=MagicMock(exists=False, to_dict=lambda: {}))

    # Nested collection mock (e.g., users/{id}/usage)
    usage_collection = MagicMock()
    usage_doc_ref = MagicMock()
    usage_doc_ref.get = MagicMock(return_value=MagicMock(exists=False, to_dict=lambda: {}))
    usage_doc_ref.set = MagicMock()
    usage_doc_ref.update = MagicMock()
    usage_collection.document = MagicMock(return_value=usage_doc_ref)
    mock_doc_ref.collection = MagicMock(return_value=usage_collection)

    mock_collection.document = MagicMock(return_value=mock_doc_ref)
    mock_collection.add = MagicMock(return_value=(None, mock_doc_ref))
    mock_collection.where = MagicMock(return_value=mock_collection)
    mock_collection.order_by = MagicMock(return_value=mock_collection)
    mock_collection.limit = MagicMock(return_value=mock_collection)
    mock_collection.stream = MagicMock(return_value=[])
    mock_collection.get = MagicMock(return_value=[])

    return mock_collection

def create_mock_transaction(*args, **kwargs):
    """Mock transaction function"""
    def transaction_func(func):
        # Just call the function directly for testing
        return func()
    return transaction_func

mock_db.collection = MagicMock(side_effect=lambda name: create_mock_collection())
mock_db.transaction = MagicMock(side_effect=create_mock_transaction)

# Patch firebase_config BEFORE importing main
mock_firebase_config = MagicMock()
mock_firebase_config.db = mock_db
mock_firebase_config.auth = MagicMock()
mock_firebase_config.auth.create_user = MagicMock()
mock_firebase_config.auth.get_user_by_email = MagicMock()
mock_firebase_config.auth.sign_in_with_email_and_password = MagicMock()
mock_firebase_config.auth.verify_id_token = MagicMock()
mock_firebase_config.initialize_firebase = MagicMock(return_value=True)
sys.modules['src.firebase_config'] = mock_firebase_config

# Patch the jwt_required decorator BEFORE importing routes
def mock_jwt_required(f):
    def wrapper(*args, **kwargs):
        from flask import g
        g.user_id = 'test-user-id'
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# Import auth_service first to make sure it's in sys.modules before patching
try:
    from src.services import auth_service as auth_service_module
    # Start the patch after the module is loaded
    jwt_required_patcher = patch.object(auth_service_module.AuthService, 'jwt_required', new=staticmethod(mock_jwt_required))
    jwt_required_patcher.start()
except Exception as e:
    print(f"Warning: Could not patch jwt_required: {e}")
    # Continue anyway, tests might still work

# Import app from Backend's main.py (one level up from tests/)
import importlib.util
from datetime import UTC

spec = importlib.util.spec_from_file_location("main", os.path.join(os.path.dirname(__file__), '..', 'main.py'))
main_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main_module)
flask_app = main_module.app


@pytest.fixture(scope='module')
def app():
    """
    Skapar och returnerar Flask-applikationen för testning.

    Använder 'testing=True' för att aktivera testläge, vilket gör att Flask
    inte kör servern och hanterar alla fel genom att generera en HTTP-status.
    Mockar externa beroenden som Whisper och Firebase för att isolera testerna.
    """
    # Mocka Google Speech och Firebase för att undvika externa beroenden
    with patch('src.utils.speech_utils.initialize_google_speech') as mock_speech, \
          patch('src.firebase_config.initialize_firebase') as mock_firebase:
        mock_speech.return_value = True  # Mockar Google Speech initiering
        mock_firebase.return_value = True  # Mockar Firebase-initialisering

        try:
            # Use the imported Flask app directly
            flask_app.config['TESTING'] = True
            test_app = flask_app
        except Exception as e:
            pytest.fail(f"Misslyckades med att skapa appen för testning: {str(e)}")

        # Kör Flask-applikationen och tillhandahåll den till tester
        yield test_app

        # Rensning efter testerna (valfritt beroende på behov)
        # Här kan du t.ex. stänga ner resurser om det behövs
        logger = test_app.logger
        logger.info("✅ Testmiljö rensad efter körning.")

@pytest.fixture(scope='module')
def client(app):
    """
    Skapar en testklient som kan användas för att skicka HTTP-förfrågningar till Flask-applikationen.

    Använd denna klient för att testa endpoints i din applikation.
    """
    return app.test_client()

@pytest.fixture(scope='module')
def runner(app):
    """
    Skapar en runner som kan användas för att köra Flask CLI-kommandon i testläge.
    """
    return app.test_cli_runner()

@pytest.fixture(scope='function')
def auth_headers():
    """Returnerar authentication headers för tester."""
    from datetime import datetime, timedelta

    import jwt

    # Create a proper JWT token with correct signature
    payload = {
        "sub": "test-user-id",
        "exp": datetime.now(UTC) + timedelta(hours=1)
    }

    # Use the same secret key as the app (from config)
    from src.config import JWT_SECRET_KEY
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope='function')
def mock_auth_service(mocker):
    """Mockar AuthService för alla tester som behöver autentisering."""
    # Mock JWT verification for AuthService
    mocker.patch('src.services.auth_service.AuthService.verify_token', return_value=("test-user-id", None))

    # Mock jwt_required decorator to set g.user_id - patch at the module level
    def jwt_required_decorator(f):
        def wrapper(*args, **kwargs):
            from flask import g
            g.user_id = 'test-user-id'
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper

    # Patch the jwt_required method directly on the AuthService class
    from src.services import auth_service
    original_jwt_required = auth_service.AuthService.jwt_required
    auth_service.AuthService.jwt_required = staticmethod(lambda f: jwt_required_decorator(f))

    yield {"user_id": "test-user-id", "email": "test@example.com"}

    # Restore original method after test
    auth_service.AuthService.jwt_required = original_jwt_required


@pytest.fixture(scope='function')
def mock_jwt(mocker):
    """Mock JWT decorators for flask_jwt_extended"""
    # Mock jwt_required to be a no-op decorator
    mocker.patch('flask_jwt_extended.jwt_required', lambda **kwargs: lambda f: f)
    # Mock get_jwt_identity to return a test user ID
    mocker.patch('flask_jwt_extended.get_jwt_identity', return_value='user123')
    return 'user123'


@pytest.fixture(scope='function')
def mock_db():
    """Returnerar den globala mockade Firestore db för modifiering i tester."""
    db = sys.modules['src.firebase_config'].db

    # Reset mock between tests
    db.reset_mock()

    # Create a dictionary to store collection mocks
    collections_dict = {}

    def get_or_create_collection(name):
        """Get existing collection mock or create new one"""
        if name not in collections_dict:
            mock_collection = MagicMock()
            mock_doc_ref = MagicMock()
            mock_doc_ref.id = "test-doc-id"
            mock_doc_ref.set = MagicMock()
            mock_doc_ref.update = MagicMock()
            mock_doc_ref.delete = MagicMock()
            mock_doc_ref.get = MagicMock(return_value=MagicMock(exists=False, to_dict=lambda: {}))

            usage_collection = MagicMock()
            usage_doc_ref = MagicMock()
            usage_doc_ref.get = MagicMock(return_value=MagicMock(exists=False, to_dict=lambda: {}))
            usage_doc_ref.set = MagicMock()
            usage_doc_ref.update = MagicMock()
            usage_collection.document = MagicMock(return_value=usage_doc_ref)
            mock_doc_ref.collection = MagicMock(return_value=usage_collection)

            mock_collection.document = MagicMock(return_value=mock_doc_ref)
            mock_collection.add = MagicMock(return_value=(None, mock_doc_ref))
            mock_collection.where = MagicMock(return_value=mock_collection)
            mock_collection.order_by = MagicMock(return_value=mock_collection)
            mock_collection.limit = MagicMock(return_value=mock_collection)
            mock_collection.stream = MagicMock(return_value=[])
            mock_collection.get = MagicMock(return_value=[])

            collections_dict[name] = mock_collection

        return collections_dict[name]

    db.collection = MagicMock(side_effect=get_or_create_collection)

    return db
