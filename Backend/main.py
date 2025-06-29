import os
import sys
import logging
from datetime import datetime
try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    # Define a no-op fallback if python-dotenv is not installed
    def load_dotenv(*args, **kwargs):
        return None
from flask import Flask, jsonify, request
try:
    from flask_cors import CORS
except ModuleNotFoundError:  # pragma: no cover - fallback for tests without dependency
    class CORS:  # minimal stub
        def __init__(self, *_, **__):
            pass
try:
    from flasgger import Swagger
except ModuleNotFoundError:  # pragma: no cover - fallback for tests without dependency
    class Swagger:
        def __init__(self, *_, **__):
            pass
try:
    import whisper
except ModuleNotFoundError:  # pragma: no cover - fallback for tests without dependency
    whisper = None
from werkzeug.utils import secure_filename
try:
    from firebase_admin import firestore
    import firebase_admin
except ModuleNotFoundError:  # pragma: no cover - fallback for tests without dependency
    from unittest.mock import MagicMock
    class DummyQuery:
        DESCENDING = "DESCENDING"

    class DummyFirestore:
        Query = DummyQuery
        def client(self):
            return MagicMock()

    firestore = DummyFirestore()
    firebase_admin = MagicMock()

# Support running this file directly by ensuring the project root is on sys.path
if __package__ in (None, ""):
    current_dir = os.path.dirname(__file__)
    parent_dir = os.path.abspath(os.path.join(current_dir, os.pardir))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)


# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def create_app(testing=False):
    """Creates and configures the Flask application."""
    app = Flask(__name__)
    Swagger(app)
    # Import blueprints lazily to avoid side effects during test collection
    from Backend.src.routes.auth import auth_bp
    from Backend.src.routes.memory_routes import memory_bp
    from Backend.src.routes.mood import mood_bp
    from unittest.mock import MagicMock
    model = MagicMock() if testing else None
    if not testing and whisper is not None:
        try:
            model = whisper.load_model("medium")
        except Exception as e:  # pragma: no cover - optional in tests
            logger.warning(f"Whisper model could not be loaded: {e}")
    app.config["JSON_SORT_KEYS"] = False
    app.config["JSON_AS_ASCII"] = False
    app.config["TESTING"] = testing
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["TRANSCRIBE_MODEL"] = model
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(memory_bp, url_prefix="/api/memory")
    app.register_blueprint(mood_bp, url_prefix="/api/mood")
    logger.info("✅ Blueprint auth_bp registered under /api/auth")
    logger.info("✅ Blueprint memory_bp registered under /api/memory")
    logger.info("✅ Blueprint mood_bp registered under /api/mood")

    if not app.config["JWT_SECRET_KEY"]:
        logger.critical("❌ JWT_SECRET_KEY is missing in environment variables.")
        raise ValueError("JWT_SECRET_KEY is missing in environment variables.")

    # Enable CORS
    allowed_origins = [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", "https://www.lugntrygg.se")
    ]
    CORS(app, supports_credentials=True, origins=allowed_origins,
         allow_headers=["Content-Type", "Authorization"],
         expose_headers=["Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    # Initialize Firebase only when not testing
    from unittest.mock import MagicMock
    db = MagicMock() if testing else None
    if not testing:
        try:
            from Backend.src.firebase_config import db as _db, initialize_firebase
            if not initialize_firebase():
                logger.warning("⚠️ Firebase configuration is missing.")
            db = _db
        except Exception as e:
            logger.critical(f"❌ Firebase initialization failed: {e}")
            raise
    app.config["FIRESTORE_DB"] = db

    # Health check route
    @app.route("/")
    def index():
        return jsonify({
            "message": "Welcome to Lugn & Trygg API",
            "version": "1.0",
            "endpoints": {
                "auth": { "register": "/api/auth/register", "login": "/api/auth/login", "logout": "/api/auth/logout" },
                "mood": { "log": "/api/mood/log", "get": "/api/mood/get" }
            }
        }), 200


    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "False").lower() in ["1", "true", "yes"]
    logger.info(f"🚀 Starting server at http://localhost:{port} (Debug mode: {debug})")

    try:
        app.run(host="0.0.0.0", port=port, debug=debug)
    except Exception as e:
        logger.critical(f"🔥 Critical error while starting the server: {e}")

