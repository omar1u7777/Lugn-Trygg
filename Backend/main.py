import os
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_babel import Babel
from flask_jwt_extended import JWTManager
from redis import Redis

from src.routes.memory_routes import memory_bp
from src.routes.auth import auth_bp, limiter
from src.routes.mood_routes import mood_bp
from src.routes.chatbot_routes import chatbot_bp
from src.routes.ai_routes import ai_bp
from src.routes.ai_stories_routes import ai_stories_bp
from src.routes.subscription_routes import subscription_bp
from src.routes.integration_routes import integration_bp
from src.routes.ai_helpers_routes import ai_helpers_bp
from src.routes.referral_routes import referral_bp
from src.routes.feedback_routes import feedback_bp
from src.routes.admin_routes import admin_bp
from src.routes.notifications_routes import notifications_bp
from src.routes.users_routes import users_bp
from src.routes.sync_routes import sync_bp
from src.firebase_config import initialize_firebase

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(pathname)s:%(lineno)d",
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 🔹 Initiera Google Cloud Speech-to-Text
try:
    from src.utils.speech_utils import initialize_google_speech
    if initialize_google_speech():
        logger.info("✅ Google Cloud Speech-to-Text initierad")
    else:
        logger.warning("⚠️ Google Cloud Speech-to-Text kunde inte initieras - vissa funktioner kommer inte fungera")
except Exception as e:
    logger.error(f"❌ Fel vid initiering av Google Speech: {str(e)}")

def create_app(testing=False):
    """🔹 Skapar och konfigurerar Flask-applikationen."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["JSON_AS_ASCII"] = False
    app.config["TESTING"] = testing
    # Set debug mode based on FLASK_DEBUG environment variable
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ["1", "true", "yes"]
    app.config["DEBUG"] = debug_mode

    # Initialize Babel for i18n
    app.config['BABEL_DEFAULT_LOCALE'] = 'sv'
    babel = Babel(app)

    # Register locale selector function
    def get_locale():
        """Determine locale from query param or JSON payload safely.

        Uses request.args first, then falls back to JSON body if present.
        This avoids accessing attributes on None and registers the selector
        using the Flask-Babel pattern.
        """
        user_id = request.args.get('user_id')

        if not user_id and request.is_json:
            # Use get_json with silent=True to avoid raising on invalid json
            payload = request.get_json(silent=True) or {}
            user_id = payload.get('user_id')

        if user_id:
            try:
                from src.firebase_config import db
                user_doc = db.collection('users').document(user_id).get()
                user = user_doc.to_dict() if user_doc.exists else None
                return user.get('language', 'sv') if user else 'sv'
            except Exception:
                # If Firebase lookup fails, fall back to default locale
                logger.warning("Could not fetch user locale from Firebase, falling back to default")
                return 'sv'

        return 'sv'
    
    # Set the locale selector
    babel.init_app(app, locale_selector=get_locale)

    # --- DEV: Increase rate limit and allow all local origins ---
    # For local development, set a generous rate limit and allow all local frontend origins
    dev_rate_limit = "1000 per minute" if app.config["DEBUG"] else "100 per hour"
    redis_url = os.getenv("REDIS_URL", None)
    
    # Initialize limiter with Redis if configured, otherwise use in-memory storage
    try:
        if redis_url:
            logger.info(f"🔍 Attempting Redis connection to: {redis_url}")
            try:
                redis_client = Redis.from_url(
                    redis_url, 
                    socket_connect_timeout=1,
                    socket_timeout=1,
                    socket_keepalive=False,
                    retry_on_timeout=False
                )
                redis_client.ping()
                limiter = Limiter(
                    key_func=get_remote_address,
                    storage_uri=redis_url,
                    default_limits=[dev_rate_limit]
                )
                limiter.init_app(app)
                logger.info(f"✅ Rate limiter initialized with Redis storage, limit: {dev_rate_limit}")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {str(e)}, falling back to in-memory storage")
                limiter = Limiter(
                    key_func=get_remote_address,
                    default_limits=[dev_rate_limit]
                )
                limiter.init_app(app)
                logger.info(f"✅ Rate limiter initialized with in-memory storage, limit: {dev_rate_limit}")
        else:
            # No Redis configured - use in-memory storage (common for development)
            limiter = Limiter(
                key_func=get_remote_address,
                default_limits=[dev_rate_limit]
            )
            limiter.init_app(app)
            logger.info(f"✅ Rate limiter initialized with in-memory storage, limit: {dev_rate_limit}")
    except Exception as e:
        logger.error(f"❌ Failed to initialize rate limiter: {e}")
        # Create a minimal limiter as fallback
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=[dev_rate_limit]
        )
        limiter.init_app(app)
        logger.warning("⚠️ Rate limiter initialized with basic fallback configuration")

    # Hämta JWT secret key från miljövariabler
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    if not app.config["JWT_SECRET_KEY"]:
        logger.critical("❌ JWT_SECRET_KEY saknas i miljövariabler!")
        raise ValueError("JWT_SECRET_KEY saknas i miljövariabler!")

    # 🔹 JWT-konfiguration
    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
    app.config["JWT_COOKIE_SECURE"] = not app.config["DEBUG"]  # Secure in production
    app.config["JWT_COOKIE_HTTPONLY"] = True
    app.config["JWT_COOKIE_SAMESITE"] = "Strict"

    # Initiera JWT Manager
    jwt = JWTManager(app)

    # Kontrollera FIREBASE_CREDENTIALS_PATH
    if not testing and not os.getenv("FIREBASE_CREDENTIALS_PATH"):
        logger.critical("❌ FIREBASE_CREDENTIALS_PATH saknas i miljövariabler!")
        raise ValueError("FIREBASE_CREDENTIALS_PATH saknas i miljövariabler!")

    # 🔹 Hantering av CORS-domäner
    # --- DEV: Always allow all local dev origins ---
    dev_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:4173",  # Vite preview port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:4173",
        "http://frontend:3000",
        "http://frontend:3001",
        "http://localhost:5000",
        "http://192.168.10.154:3000",
        "http://192.168.10.154:3001",
        "http://192.168.10.154:4173",  # Network IP for Vite preview
        "http://172.21.112.1:3001",
        "http://172.22.80.1:3000",
        "http://172.22.80.1:4173"  # Network IP for Vite preview
    ]
    
    # In DEBUG mode: combine dev_origins with .env origins
    # In production: only use .env origins
    env_origins = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
    
    if app.config["DEBUG"]:
        # Development: combine both lists and remove duplicates
        allowed_origins = list(set(dev_origins + env_origins)) if env_origins else dev_origins
    else:
        # Production: only use .env origins
        allowed_origins = env_origins if env_origins else ["https://www.lugntrygg.se"]

    if not allowed_origins or not all(isinstance(i, str) for i in allowed_origins):
        if app.config["ENV"] == "production":
            logger.critical("❌ CORS_ALLOWED_ORIGINS är felaktig i produktionsläge!")
            raise ValueError("CORS_ALLOWED_ORIGINS är felaktig i produktionsläge!")
        else:
            logger.warning("⚠️ CORS_ALLOWED_ORIGINS har ett felaktigt format, standardvärden används!")

    # Tillåtna domäner via CORS
    CORS(app, supports_credentials=True, origins=allowed_origins,
            allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
            expose_headers=["Authorization"],
            methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            resources={r"/api/*": {"origins": allowed_origins}})

    # Add security headers
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains' if not app.config["DEBUG"] else ''
        return response

    logger.info(f"🌍 Tillåtna CORS-domäner: {allowed_origins}")

    # 🔹 Initiera Firebase (ej under tester)
    if not testing:
        try:
            initialize_firebase()
            logger.info("✅ Firebase initialized successfully.")
        except Exception as e:
            logger.warning(f"⚠️ Firebase initialization failed: {e}. Fortsätter i degraded läge - vissa funktioner kan vara begränsade.")

    # 🔹 Registrera blueprints (kontrollera att de inte registreras två gånger)
    if "auth" not in app.blueprints:
        app.register_blueprint(auth_bp, url_prefix="/api/auth")
        logger.info("✅ Blueprint auth_bp registrerad under /api/auth")

    if "mood" not in app.blueprints:
        app.register_blueprint(mood_bp, url_prefix="/api/mood")
        logger.info("✅ Blueprint mood_bp registrerad under /api/mood")

    if "memory" not in app.blueprints:
        app.register_blueprint(memory_bp, url_prefix="/api/memory")
        logger.info("✅ Blueprint memory_bp registrerad under /api/memory")

    if "chatbot" not in app.blueprints:
        app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")
        logger.info("✅ Blueprint chatbot_bp registrerad under /api/chatbot")

    if "ai_helpers" not in app.blueprints:
        app.register_blueprint(ai_helpers_bp, url_prefix="/api/mood")
        logger.info("✅ Blueprint ai_helpers_bp registrerad under /api/mood")

    if "subscription" not in app.blueprints:
        app.register_blueprint(subscription_bp, url_prefix="/api/subscription")
        logger.info("✅ Blueprint subscription_bp registrerad under /api/subscription")

    if "ai" not in app.blueprints:
        app.register_blueprint(ai_bp, url_prefix="/api/ai")
        logger.info("✅ Blueprint ai_bp registrerad under /api/ai")

    if "ai_stories" not in app.blueprints:
        app.register_blueprint(ai_stories_bp, url_prefix="/api/ai")
        logger.info("✅ Blueprint ai_stories_bp registrerad under /api/ai")

    if "integration" not in app.blueprints:
        app.register_blueprint(integration_bp, url_prefix="/api/integration")
        logger.info("✅ Blueprint integration_bp registrerad under /api/integration")

    if "referral" not in app.blueprints:
        app.register_blueprint(referral_bp, url_prefix="/api/referral")
        logger.info("✅ Blueprint referral_bp registrerad under /api/referral")

    if "feedback" not in app.blueprints:
        app.register_blueprint(feedback_bp, url_prefix="/api/feedback")
        logger.info("✅ Blueprint feedback_bp registrerad under /api/feedback")

    if "admin" not in app.blueprints:
        app.register_blueprint(admin_bp, url_prefix="/api/admin")
        logger.info("✅ Blueprint admin_bp registrerad under /api/admin")

    if "notifications" not in app.blueprints:
        app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
        logger.info("✅ Blueprint notifications_bp registrerad under /api/notifications")

    if "users" not in app.blueprints:
        app.register_blueprint(users_bp, url_prefix="/api/users")
        logger.info("✅ Blueprint users_bp registrerad under /api/users")

    if "sync" not in app.blueprints:
        app.register_blueprint(sync_bp, url_prefix="/api/sync")
        logger.info("✅ Blueprint sync_bp registrerad under /api/sync")

    # Definiera en enkel endpoint för hälsokontroll
    @app.route("/")
    def index():
        return jsonify({
            "message": "Welcome to Lugn & Trygg API",
            "version": "1.0",
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "endpoints": {
                "auth": {
                    "register": "/api/auth/register",
                    "login": "/api/auth/login",
                    "google_login": "/api/auth/google-login",
                    "reset_password": "/api/auth/reset-password",
                    "logout": "/api/auth/logout",
                    "consent": "/api/auth/consent",
                    "get_consent": "/api/auth/consent/<user_id>",
                    "delete_account": "/api/auth/delete-account/<user_id>"
                },
                "mood": {
                    "log": "/api/mood/log",
                    "get": "/api/mood/get",
                    "weekly-analysis": "/api/mood/weekly-analysis",
                    "recommendations": "/api/mood/recommendations",
                    "analyze-voice": "/api/mood/analyze-voice"
                },
                "memory": {
                    "upload": "/api/memory/upload",
                    "list": "/api/memory/list",
                    "get": "/api/memory/get"
                },
                "chatbot": {
                    "chat": "/api/chatbot/chat",
                    "history": "/api/chatbot/history",
                    "analyze-patterns": "/api/chatbot/analyze-patterns",
                    "exercise": "/api/chatbot/exercise",
                    "complete_exercise": "/api/chatbot/exercise/<user_id>/<exercise_id>/complete"
                },
                "ai": {
                    "generate_story": "/api/ai/story",
                    "predictive_forecast": "/api/ai/forecast",
                    "story_history": "/api/ai/stories",
                    "forecast_history": "/api/ai/forecasts"
                },
                "subscription": {
                    "create_session": "/api/subscription/create-session",
                    "status": "/api/subscription/status/<user_id>",
                    "webhook": "/api/subscription/webhook",
                    "cancel": "/api/subscription/cancel/<user_id>"
                },
                "integration": {
                    "wearable": {
                        "google_fit_sync": "/api/integration/wearable/google-fit/sync",
                        "apple_health_sync": "/api/integration/wearable/apple-health/sync",
                        "get_data": "/api/integration/wearable/data"
                    },
                    "crisis": {
                        "referral": "/api/integration/crisis/referral"
                    },
                    "fhir": {
                        "patient": "/api/integration/fhir/patient",
                        "observation": "/api/integration/fhir/observation"
                    }
                }
            }
        }), 200

    # Global error handler for 404
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Endpoint not found", "status_code": 404}), 404

    # Global error handler for 500
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({"error": "Internal server error", "status_code": 500}), 500

    return app

if __name__ == "__main__":
    # Starta Flask-servern
    app = create_app()
    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "False").lower() in ["1", "true", "yes"]

    # Logga serverinställningar
    logger.info(f"🚀 Startar server på http://localhost:{port} (Debug mode: {debug})")
    logger.info("📌 API Endpoints:")
    logger.info("   - Authentication: /api/auth/")
    logger.info("   - Mood Logging: /api/mood/")
    logger.info("   - Memory Management: /api/memory/")

    try:
        host = os.getenv("HOST", "0.0.0.0")
        app.run(host=host, port=port, debug=debug)
    except Exception as e:
        logger.critical(f"🔥 Kritiskt fel vid serverstart: {e}")
