import pytest
import sys
from unittest.mock import patch, MagicMock

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
    
    mock_collection.document = MagicMock(return_value=mock_doc_ref)
    mock_collection.add = MagicMock(return_value=(None, mock_doc_ref))
    mock_collection.where = MagicMock(return_value=mock_collection)
    mock_collection.order_by = MagicMock(return_value=mock_collection)
    mock_collection.limit = MagicMock(return_value=mock_collection)
    mock_collection.stream = MagicMock(return_value=[])
    mock_collection.get = MagicMock(return_value=[])
    
    return mock_collection

mock_db.collection = MagicMock(side_effect=lambda name: create_mock_collection())

# Patch firebase_config BEFORE importing main
sys.modules['src.firebase_config'] = MagicMock()
sys.modules['src.firebase_config'].db = mock_db

from main import app as flask_app  # Import app directly


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
    return {"Authorization": "Bearer test-token"}

@pytest.fixture(scope='function')
def mock_auth_service(mocker):
    """Mockar AuthService för alla tester som behöver autentisering."""
    # Mock JWT verification for AuthService
    mocker.patch('src.services.auth_service.AuthService.verify_token', return_value=("test-user-id", None))
    
    # Mock jwt_required decorator to set g.user_id
    def jwt_required_decorator(f):
        def wrapper(*args, **kwargs):
            from flask import g
            g.user_id = 'test-user-id'
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    
    mocker.patch('src.services.auth_service.AuthService.jwt_required', side_effect=lambda f: jwt_required_decorator(f))
    
    return {"user_id": "test-user-id", "email": "test@example.com"}


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