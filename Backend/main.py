import os
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_babel import Babel
from redis import Redis

from src.routes.memory_routes import memory_bp
from src.routes.auth import auth_bp, limiter
from src.routes.mood_routes import mood_bp
from src.routes.chatbot_routes import chatbot_bp
from src.routes.ai_routes import ai_bp
from src.routes.subscription_routes import subscription_bp
from src.routes.integration_routes import integration_bp
from src.firebase_config import initialize_firebase

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
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

    def get_locale():
        user_id = request.args.get('user_id') or request.json.get('user_id') if request.is_json else None
        if user_id:
            from src.firebase_config import db
            user = db.collection('users').document(user_id).get().to_dict()
            return user.get('language', 'sv') if user else 'sv'
        return 'sv'

    babel.locale_selector_func = get_locale

    # Initialize rate limiter with Redis storage (fallback to in-memory)
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    logger.info(f"🔍 Attempting Redis connection to: {redis_url}")
    try:
        redis_client = Redis.from_url(redis_url, socket_connect_timeout=5, socket_timeout=5)
        redis_client.ping()  # Test connection
        logger.info("✅ Redis connection successful - ping received")
        limiter = Limiter(
            key_func=get_remote_address,
            storage_uri=redis_url,
            default_limits=["100 per hour"]
        )
        limiter.init_app(app)
        logger.info("✅ Rate limiter initialized with Redis storage")
    except Exception as e:
        logger.warning(f"⚠️ Redis not available at {redis_url} ({str(e)}), falling back to in-memory storage")
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["100 per hour"]
        )
        limiter.init_app(app)

    # Hämta JWT secret key från miljövariabler
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    if not app.config["JWT_SECRET_KEY"]:
        logger.critical("❌ JWT_SECRET_KEY saknas i miljövariabler!")
        raise ValueError("JWT_SECRET_KEY saknas i miljövariabler!")

    # Kontrollera FIREBASE_CREDENTIALS_PATH
    if not testing and not os.getenv("FIREBASE_CREDENTIALS_PATH"):
        logger.critical("❌ FIREBASE_CREDENTIALS_PATH saknas i miljövariabler!")
        raise ValueError("FIREBASE_CREDENTIALS_PATH saknas i miljövariabler!")

    # 🔹 Hantering av CORS-domäner
    allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5000,https://www.lugntrygg.se").split(",")
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]

    if not allowed_origins or not all(isinstance(i, str) for i in allowed_origins):
        if app.config["ENV"] == "production":
            logger.critical("❌ CORS_ALLOWED_ORIGINS är felaktig i produktionsläge!")
            raise ValueError("CORS_ALLOWED_ORIGINS är felaktig i produktionsläge!")
        else:
            logger.warning("⚠️ CORS_ALLOWED_ORIGINS har ett felaktigt format, standardvärden används!")

    # Tillåtna domäner via CORS
    CORS(app, supports_credentials=True, origins=allowed_origins,
          allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
          expose_headers=["Authorization"],
          methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

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
            if not initialize_firebase():
                logger.critical("❌ Firebase kunde inte initialiseras!")
                raise RuntimeError("Firebase initialisering misslyckades!")
        except Exception as e:
            logger.critical(f"🔥 Firebase-initialiseringsfel: {e}")
            raise

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

    if "subscription" not in app.blueprints:
        app.register_blueprint(subscription_bp, url_prefix="/api/subscription")
        logger.info("✅ Blueprint subscription_bp registrerad under /api/subscription")

    if "ai" not in app.blueprints:
        app.register_blueprint(ai_bp, url_prefix="/api/ai")
        logger.info("✅ Blueprint ai_bp registrerad under /api/ai")

    if "integration" not in app.blueprints:
        app.register_blueprint(integration_bp, url_prefix="/api/integration")
        logger.info("✅ Blueprint integration_bp registrerad under /api/integration")

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
        app.run(host="0.0.0.0", port=port, debug=debug)
    except Exception as e:
        logger.critical(f"🔥 Kritiskt fel vid serverstart: {e}")
