import os
import logging
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS

# Importera auth_bp Blueprint
from src.routes.auth import auth_bp  # Kontrollera att du importerar rätt path
from src.fierbase_config import db, auth, initialize_firebase  # Kontrollera om filen är korrekt, se till att använda rätt namn

# Ladda miljövariabler från .env-filen
load_dotenv()

# Konfigurera logging för att ge tydliga och detaljerade meddelanden
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def create_app(testing=False):
    """Skapar och konfigurerar Flask-applikationen."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["JSON_AS_ASCII"] = False  # Hantera svenska tecken korrekt
    app.config["TESTING"] = testing
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

    # Säkerställ att JWT_SECRET_KEY är definierad
    if not app.config["JWT_SECRET_KEY"]:
        logger.critical("❌ JWT_SECRET_KEY saknas i miljövariabler. Applikationen kan inte starta.")
        raise ValueError("JWT_SECRET_KEY saknas i miljövariabler. Applikationen kan inte starta.")

    # Aktivera CORS för frontend
    allowed_origins = [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",  # Stöd för Vite
        os.getenv("FRONTEND_URL", "https://www.lugntrygg.se")  # Dynamiskt frontend-URL stöd
    ]

    CORS(app, supports_credentials=True, origins=allowed_origins,
         allow_headers=["Content-Type", "Authorization"],
         expose_headers=["Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    # Initiera Firebase om inte i testläge
    if not testing:
        try:
            if not initialize_firebase():
                logger.warning("⚠️ Firebase-konfiguration saknas eller är felaktig. Backend körs utan Firebase.")
        except Exception as e:
            logger.critical(f"❌ Firebase kunde inte initieras: {e}")
            raise

    # Registrera Blueprint för autentisering
    if "auth" not in app.blueprints:
        app.register_blueprint(auth_bp, url_prefix="/api/auth")  # Registrera med rätt prefix
        logger.info("auth_bp har registrerats under /api/auth")

    # Root-route definieras här, inuti create_app
    @app.route("/")
    def index():
        response = {
            "message": "Välkommen till Lugn & Trygg API",
            "version": "1.0",
            "endpoints": {
                "auth": {
                    "register": "/api/auth/register",
                    "login": "/api/auth/login",
                    "logout": "/api/auth/logout"
                }
            }
        }
        return jsonify(response), 200  # Använd jsonify istället för json.dumps

    # Health check route
    @app.route("/health")
    def health_check():
        return jsonify({"status": "hälsosam"}), 200

    # Hantera OPTIONS-förfrågningar korrekt
    @app.before_request
    def handle_options():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            return response

    # Lägg till CSP-header för säkerhet
    @app.after_request
    def add_csp_headers(response):
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://www.lugntrygg.se; "
            "connect-src 'self' https://*.firebaseio.com https://www.lugntrygg.se "
            "http://127.0.0.1:5001 http://localhost:5001 "
            "ws://127.0.0.1:5001 ws://localhost:5001 wss://127.0.0.1:5001 wss://localhost:5001; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "upgrade-insecure-requests;"
        )
        return response

    return app

# Starta servern om filen körs direkt
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "False").lower() in ["1", "true", "yes"]
    logger.info(f"🚀 Startar servern på http://localhost:{port} (Debug-läge: {debug})")

    try:
        app.run(host="0.0.0.0", port=port, debug=debug)
    except Exception as e:
        logger.critical(f"🔥 Kritiskt fel vid start av servern: {e}")
