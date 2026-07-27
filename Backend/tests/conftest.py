import os
import sys
import types
from functools import wraps
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
os.environ['REDIS_URL'] = 'memory://'

# Stub Redis early so that importing routes/services that eagerly connect to
# Redis does not hang waiting for a real server during test collection.
import redis as _redis_module  # noqa: E402
_redis_module.Redis = MagicMock  # type: ignore[misc]
_redis_module.from_url = MagicMock(return_value=MagicMock(ping=MagicMock()))  # type: ignore[attr-defined]

# Set Firebase env vars for CI/test environments if not already set
os.environ.setdefault('FIREBASE_WEB_API_KEY', 'test-firebase-web-api-key')
os.environ.setdefault('FIREBASE_API_KEY', 'test-firebase-api-key')
os.environ.setdefault('FIREBASE_PROJECT_ID', 'test-project')
os.environ.setdefault('FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com')
os.environ.setdefault('FIREBASE_CREDENTIALS', '{"type":"service_account","project_id":"test","private_key_id":"k","private_key":"-----BEGIN RSA PRIVATE KEY-----\\nMIIBogIBAAJBALRiMLAH\\n-----END RSA PRIVATE KEY-----\\n","client_email":"t@t.iam.gserviceaccount.com","client_id":"1","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}')  # gitleaks:allow
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key-that-is-at-least-32-chars-long')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test-refresh-secret-key-at-least-32-chars-long')

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

class _FakeFirestoreTransaction:
    """A fake that satisfies the real google.cloud.firestore transactional
    decorator contract (_read_only/_max_attempts/_clean_up/_begin/_id/
    _commit/_rollback) so production code using @firestore.transactional +
    db.transaction() can be exercised in tests without a live backend.

    Reads/writes go through the mocked doc refs exactly as in production; the
    transaction object itself is a no-op coordinator.
    """
    _read_only = False
    _max_attempts = 1

    def __init__(self):
        self._id = None
        self.writes = []

    def _clean_up(self):
        self._id = None

    def _begin(self, retry_id=None):
        self._id = b"fake-txn-id"

    def _commit(self):
        return []

    def _rollback(self):
        self._id = None

    def set(self, reference, document_data, **kwargs):
        # Record only (matches the previous MagicMock no-op semantics); does
        # not eagerly write so tests keep control of the mocked ref state.
        self.writes.append((reference, document_data))

    def update(self, reference, field_updates, **kwargs):
        self.writes.append((reference, field_updates))

    def delete(self, reference, **kwargs):
        self.writes.append((reference, None))


def create_mock_transaction(*args, **kwargs):
    """Mock transaction object returned by db.transaction()."""
    return _FakeFirestoreTransaction()

mock_db.collection = MagicMock(side_effect=lambda name: create_mock_collection())
mock_db.transaction = MagicMock(side_effect=create_mock_transaction)
# NOTE: deliberately no `mock_db.run_in_transaction` — that method does not
# exist on the real google.cloud.firestore.Client (it silently raised
# AttributeError in production for the lifetime of the bug it caused; see
# subscription_service.py's comment on _run_quota_transaction). Keeping a
# working fake for a non-existent API would let a reintroduced call to it
# pass tests silently instead of failing the way the real client does.
_shared_mock_db = mock_db


def _ensure_shared_mock_db() -> MagicMock:
    """Return a resettable shared Firestore mock, even if tests patched db to a non-mock object."""
    firebase_module = sys.modules.get('src.firebase_config')
    if firebase_module is None:
        firebase_module = MagicMock()
        sys.modules['src.firebase_config'] = firebase_module

    db_obj = getattr(firebase_module, 'db', None)
    if not hasattr(db_obj, 'reset_mock'):
        db_obj = _shared_mock_db

    # Keep default behavior stable between tests
    db_obj.collection = MagicMock(side_effect=lambda name: create_mock_collection())
    db_obj.transaction = MagicMock(side_effect=create_mock_transaction)
    # No run_in_transaction here either — see the note by _shared_mock_db above.

    firebase_module.db = db_obj

    backend_firebase_module = sys.modules.get('Backend.src.firebase_config')
    if backend_firebase_module is not None:
        backend_firebase_module.db = db_obj

    # Keep already-imported route/service modules wired to the same shared db object.
    for module_name, module in list(sys.modules.items()):
        if module is None:
            continue
        if not module_name.startswith(('src.routes.', 'src.services.', 'src.repositories.')):
            continue
        if hasattr(module, 'db'):
            module.db = db_obj

    return db_obj

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
# Also mock under Backend.src path so tests using that prefix don't trigger real init
sys.modules['Backend.src.firebase_config'] = mock_firebase_config

# Stub heavy NLP model loader to avoid native crashes during test bootstrap.
# The real module loads sentence-transformers and can crash CI/dev Python runtimes.
fake_crisis_nlp = types.ModuleType('src.services.crisis_nlp')


class _FakeSemanticCrisisAssessment:
    def __init__(self, risk_level='none', semantic_score=0.0, confidence=0.5, detected_concepts=None):
        self.risk_level = risk_level
        self.semantic_score = semantic_score
        self.confidence = confidence
        self.detected_concepts = detected_concepts or []


class _FakeSemanticDetector:
    def detect(self, text, conversation_context=None):
        return _FakeSemanticCrisisAssessment()


def _get_semantic_crisis_detector():
    return _FakeSemanticDetector()


fake_crisis_nlp.SemanticCrisisAssessment = _FakeSemanticCrisisAssessment
fake_crisis_nlp.get_semantic_crisis_detector = _get_semantic_crisis_detector
sys.modules['src.services.crisis_nlp'] = fake_crisis_nlp

# Patch the jwt_required decorator BEFORE importing routes
def mock_jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        from flask import g
        g.user_id = 'testuser1234567890ab'
        return f(*args, **kwargs)
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
from datetime import UTC, datetime

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

    # Create a proper JWT token with correct signature and required claims
    payload = {
        "sub": "testuser1234567890ab",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "type": "access",
        "iss": "lugn-trygg",
        "aud": "lugn-trygg-web",
    }

    # Use the same secret key as the app (from config)
    from src.config import JWT_SECRET_KEY
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope='function')
def csrf_headers(client):
    """Fetch a CSRF token and return headers for state-changing requests."""
    response = client.get('/api/dashboard/csrf-token')
    assert response.status_code == 200
    body = response.get_json() or {}
    token = ((body.get('data') or {}).get('csrfToken'))
    assert token
    return {"X-CSRF-Token": token}


@pytest.fixture(scope='function')
def auth_csrf_headers(auth_headers, csrf_headers):
    """Combined auth+CSRF headers for protected state-changing endpoints."""
    return {**auth_headers, **csrf_headers}


_LEGACY_CSRF_MODULES = {
    'test_ai_helpers_routes.py',
    'test_ai_routes.py',
    'test_ai_support_full_coverage.py',
    'test_challenges_routes.py',
    'test_chatbot_routes.py',
    'test_crisis_routes.py',
    'test_edge_cases_security.py',
    'test_feedback_routes.py',
    'test_integration_flows.py',
    'test_integration_routes.py',
    'test_journal_routes.py',
    'test_main_app.py',
    'test_memory_routes.py',
    'test_middleware_validation.py',
    'test_mood_routes.py',
    'test_peer_chat_routes.py',
    'test_privacy_routes.py',
    'test_referral_routes.py',
    'test_rewards_routes.py',
    'test_subscription_routes.py',
    'test_sync_history_routes.py',
    'test_voice_routes.py',
    'test_webhook_security.py',
    'test_qa_integration.py',
    'test_qa_security_edge.py',
}


@pytest.fixture(autouse=True)
def _auto_attach_csrf_for_legacy_modules(request):
    """Attach CSRF header automatically for selected legacy modules during migration."""
    file_name = os.path.basename(str(request.node.fspath))
    if file_name not in _LEGACY_CSRF_MODULES:
        yield
        return

    client = request.getfixturevalue('client')
    csrf = request.getfixturevalue('csrf_headers')

    previous_header = client.environ_base.get('HTTP_X_CSRF_TOKEN')
    client.environ_base['HTTP_X_CSRF_TOKEN'] = csrf['X-CSRF-Token']
    try:
        yield
    finally:
        if previous_header is None:
            client.environ_base.pop('HTTP_X_CSRF_TOKEN', None)
        else:
            client.environ_base['HTTP_X_CSRF_TOKEN'] = previous_header

@pytest.fixture(scope='function')
def mock_auth_service(mocker):
    """Mockar AuthService för alla tester som behöver autentisering."""
    # Mock JWT verification for AuthService
    mocker.patch('src.services.auth_service.AuthService.verify_token', return_value=("testuser1234567890ab", None))

    # Mock jwt_required decorator to set g.user_id - patch at the module level
    def jwt_required_decorator(f):
        def wrapper(*args, **kwargs):
            from flask import g
            g.user_id = 'testuser1234567890ab'
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper

    # Patch the jwt_required method directly on the AuthService class
    from src.services import auth_service
    original_jwt_required = auth_service.AuthService.jwt_required
    auth_service.AuthService.jwt_required = staticmethod(lambda f: jwt_required_decorator(f))

    yield {"user_id": "testuser1234567890ab", "email": "test@example.com"}

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


@pytest.fixture(autouse=True)
def _reset_shared_mock_db():
    """Auto-reset the shared mock_db before every test to prevent cross-test pollution.

    Without this, tests that set mock_db.collection.side_effect = Exception(...)
    would poison the shared object for all subsequent tests since route modules
    hold a direct reference to it via 'from src.firebase_config import db'.
    """
    db = _ensure_shared_mock_db()
    db.reset_mock()
    # Restore the default side_effect so db.collection('x') returns a proper mock chain
    db.collection = MagicMock(side_effect=lambda name: create_mock_collection())
    yield
    # Post-test cleanup: reset again to be safe
    db.reset_mock()
    db.collection = MagicMock(side_effect=lambda name: create_mock_collection())


@pytest.fixture(autouse=True)
def _reset_rate_limiter_state():
    """Reset in-memory rate limiter counters to prevent test cross-contamination."""
    try:
        from src.services.rate_limiting import rate_limiter
        if hasattr(rate_limiter, '_memory_store'):
            rate_limiter._memory_store.clear()
    except Exception:
        pass

    yield

    try:
        from src.services.rate_limiting import rate_limiter
        if hasattr(rate_limiter, '_memory_store'):
            rate_limiter._memory_store.clear()
    except Exception:
        pass


@pytest.fixture(scope='function')
def mock_db():
    """Returnerar den globala mockade Firestore db för modifiering i tester."""
    db = _ensure_shared_mock_db()

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


# ===========================================================================
# QA Test Suite Fixtures (Humör, AI Stöd, Klinisk bedömning, Dagliga insikter)
# ===========================================================================

@pytest.fixture
def mock_redis_client():
    """In-memory Redis mock supporting get/set/setex/delete/scan/ping/ttl."""
    import fnmatch
    store: dict[str, str] = {}
    ttls: dict[str, float] = {}

    client = MagicMock()
    client.ping = MagicMock(return_value=True)
    client._store = store

    def _get(key):
        return store.get(key)

    def _set(key, value, ex=None, **kwargs):
        store[key] = str(value)
        if ex:
            ttls[key] = datetime.now(UTC).timestamp() + ex
        return True

    def _setex(key, ttl, value):
        store[key] = str(value)
        ttls[key] = datetime.now(UTC).timestamp() + ttl
        return True

    def _delete(*keys):
        deleted = 0
        for key in keys:
            if key in store:
                del store[key]
                ttls.pop(key, None)
                deleted += 1
        return deleted

    def _exists(key):
        return 1 if key in store else 0

    def _scan(cursor=0, match=None, count=100):
        matched = []
        for key in store:
            if match and '*' in match:
                if fnmatch.fnmatch(key, match):
                    matched.append(key)
            elif match and key == match:
                matched.append(key)
            elif not match:
                matched.append(key)
        return (0, matched)

    def _expire(key, ttl):
        ttls[key] = datetime.now(UTC).timestamp() + ttl
        return True

    def _ttl(key):
        if key not in ttls:
            return -1
        remaining = ttls[key] - datetime.now(UTC).timestamp()
        return int(remaining) if remaining > 0 else -2

    client.get = MagicMock(side_effect=_get)
    client.set = MagicMock(side_effect=_set)
    client.setex = MagicMock(side_effect=_setex)
    client.delete = MagicMock(side_effect=_delete)
    client.exists = MagicMock(side_effect=_exists)
    client.scan = MagicMock(side_effect=_scan)
    client.expire = MagicMock(side_effect=_expire)
    client.ttl = MagicMock(side_effect=_ttl)

    return client


@pytest.fixture
def mock_redis_down():
    """Simulate Redis being unavailable (connection refused)."""
    import redis
    client = MagicMock()
    client.ping = MagicMock(side_effect=redis.ConnectionError("Connection refused"))
    client.get = MagicMock(side_effect=redis.ConnectionError("Connection refused"))
    client.set = MagicMock(side_effect=redis.ConnectionError("Connection refused"))
    client.setex = MagicMock(side_effect=redis.ConnectionError("Connection refused"))
    return client


@pytest.fixture
def no_auth_headers():
    """Empty headers (no Authorization) for testing 401 responses."""
    return {}


@pytest.fixture
def invalid_auth_headers():
    """Invalid Authorization header for testing 401 responses."""
    return {"Authorization": "Bearer invalid-token-abc123"}


@pytest.fixture
def strict_auth_client():
    """Flask test client with REAL JWT auth (not mocked).

    Stops the global mock_jwt_required patcher, creates a minimal Flask app
    with endpoints protected by the real AuthService.jwt_required decorator,
    and yields a test client. Restores the mock after the test.
    """
    from flask import Flask
    from src.services.auth_service import AuthService

    # Stop the global mock so AuthService.jwt_required is the real implementation
    try:
        jwt_required_patcher.stop()
    except Exception:
        pass

    test_app = Flask(__name__)
    test_app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'test-secret-key-that-is-at-least-32-chars-long')

    # Register minimal endpoints with REAL auth decorator
    @test_app.route('/api/v1/mood/log', methods=['POST'])
    @AuthService.jwt_required
    def _log_mood():
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/mood', methods=['GET'])
    @AuthService.jwt_required
    def _get_mood():
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/chatbot/chat', methods=['POST'])
    @AuthService.jwt_required
    def _chat():
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/advanced-mood/assess/phq9', methods=['POST'])
    @AuthService.jwt_required
    def _phq9():
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/advanced-mood/assess/gad7', methods=['POST'])
    @AuthService.jwt_required
    def _gad7():
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/insights/pending/<user_id>', methods=['GET'])
    @AuthService.jwt_required
    def _pending_insights(user_id):
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/insights/generate/<user_id>', methods=['POST'])
    @AuthService.jwt_required
    def _generate_insights(user_id):
        return {'status': 'ok'}, 200

    @test_app.route('/api/v1/cbt/modules', methods=['GET'])
    @AuthService.jwt_required
    def _cbt_modules():
        return {'status': 'ok'}, 200

    with test_app.test_client() as test_client:
        yield test_client

    # Restore the global mock
    try:
        jwt_required_patcher.start()
    except Exception:
        pass


@pytest.fixture
def make_mood_data():
    """Factory for creating valid mood log payloads."""
    def _make(score=5, mood_text="Neutral", note="", tags=None, valence=5, arousal=5):
        return {
            'score': score,
            'mood_text': mood_text,
            'note': note,
            'tags': tags or [],
            'valence': valence,
            'arousal': arousal,
            'timestamp': datetime.now(UTC).isoformat(),
        }
    return _make


@pytest.fixture
def make_phq9_data():
    """Factory for creating PHQ-9 assessment payloads with correct question keys."""
    phq9_keys = [
        'little_interest', 'feeling_down', 'sleep_problems', 'feeling_tired',
        'appetite', 'feeling_bad', 'concentration', 'moving_slowly', 'self_harm'
    ]
    def _make(answers=None):
        if answers is None:
            answers = [0] * 9
        return {'responses': {k: a for k, a in zip(phq9_keys, answers)}}
    return _make


@pytest.fixture
def make_gad7_data():
    """Factory for creating GAD-7 assessment payloads with correct question keys."""
    gad7_keys = [
        'feeling_nervous', 'cant_control_worry', 'worrying_too_much',
        'trouble_relaxing', 'restless', 'easily_annoyed', 'afraid'
    ]
    def _make(answers=None):
        if answers is None:
            answers = [0] * 7
        return {'responses': {k: a for k, a in zip(gad7_keys, answers)}}
    return _make
