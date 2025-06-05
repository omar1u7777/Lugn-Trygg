import os
import logging
from datetime import datetime
try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    # Define a no-op fallback if python-dotenv is not installed
    def load_dotenv(*args, **kwargs):
        return None
from flask import Flask, jsonify, request
from flask_cors import CORS
import whisper
from werkzeug.utils import secure_filename
from firebase_admin import firestore
import firebase_admin
from Backend.src.routes.memory_routes import memory_bp

# Import authentication and Firebase setup
from Backend.src.routes.auth import auth_bp
from Backend.src.firebase_config import db, initialize_firebase

# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def create_app(testing=False):
    """Creates and configures the Flask application."""
    app = Flask(__name__)
    model = None
    if not testing:
        try:
            model = whisper.load_model("medium")
        except Exception as e:
            logger.warning(f"Whisper model could not be loaded: {e}")
    app.config["JSON_SORT_KEYS"] = False
    app.config["JSON_AS_ASCII"] = False
    app.config["TESTING"] = testing
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(memory_bp, url_prefix="/api/memory")
    logger.info("✅ Blueprint auth_bp registered under /api/auth")
    logger.info("✅ Blueprint memory_bp registered under /api/memory")

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

    # Initialize Firebase
    if not testing:
        try:
            if not initialize_firebase():
                logger.warning("⚠️ Firebase configuration is missing.")
        except Exception as e:
            logger.critical(f"❌ Firebase initialization failed: {e}")
            raise

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

    # Endpoint for logging mood
    @app.route("/api/mood/log", methods=["POST"])
    def log_mood():
        """Receives audio file, transcribes with Whisper, and logs the mood in Firestore."""
        if "audio" not in request.files:
            logger.error("❌ No audio file found in the request")
            return jsonify({"error": "No audio file found"}), 400

        file = request.files["audio"]
        filename = secure_filename(file.filename)
        file_path = os.path.join("temp_audio.wav")

        try:
            file.save(file_path)
            logger.info(f"📂 Audio file saved as: {file_path}")

            if model is None:
                return jsonify({"error": "Speech recognition model is not available"}), 500

            # 📝 Transcribe audio to text in Swedish
            result = model.transcribe(file_path, language="sv")
            text = result["text"].strip()
            os.remove(file_path)  
            logger.info(f"📝 Transcribed text: {text}")

            if not text:
                return jsonify({"error": "No text could be extracted from the audio file."}), 400

            # 🔍 Enhanced Mood Mapping with Sentences
            mood = "neutral"
            mood_mapping = {
                "glad": [
                    "jag är glad", "känner mig glad", "jag mår bra", "det här är en fantastisk dag", 
                    "jag känner mig positiv", "jag är lycklig", "allt är underbart",
                    "jag är nöjd", "jag är tacksam", "jag känner mig glad",
                    "jag är så glad idag", "det här gör mig lycklig", "jag är överlycklig"
                ],
                "ledsen": [
                    "jag är ledsen","ledsen", "känner mig ledsen", "jag mår dåligt", "det här är en jobbig dag",
                    "jag känner mig trött", "jag är nere", "inget känns bra",
                    "jag är deppig", "jag känner mig ledsen", "jag har haft en dålig dag",
                    "det här gör mig ledsen", "jag känner mig tom","jag mår inte bra"
                ],
                "arg": [
                    "jag är stressad", "känner mig stressad","stressad","jag är arg", "jag är frustrerad", 
                    "jag känner mig irriterad", "det här gör mig förbannad", 
                    "jag är upprörd", "jag känner mig irriterad idag",
                    "det här gör mig rasande", "jag orkar inte längre","jag känner mig arg"
                ]
            }

            for mood_type, expressions in mood_mapping.items():
                if any(sentence in text.lower() for sentence in expressions):
                    mood = mood_type
                    break

            user_email = request.form.get("user_email")
            if not user_email:
                logger.error("❌ User email is missing in the request")
                return jsonify({"error": "User email is missing"}), 400

            # 🆕 Set timestamp to the current time
            timestamp = datetime.utcnow().isoformat()  # Add timestamp here

            # 🆕 Store mood logs in the `moods` collection for the user
            user_ref = db.collection("users").document(user_email)
            mood_ref = user_ref.collection("moods").document(timestamp)

            mood_ref.set({
                "mood": mood,
                "transcript": text,
                "timestamp": timestamp
            })

            logger.info(f"📦 Saved mood log for {user_email}: {mood} ({timestamp})")

            return jsonify({"message": "Mood logged", "mood": mood, "transcript": text})

        except Exception as e:
            logger.error(f"🔥 Error while logging mood: {str(e)}")
            return jsonify({"error": str(e)}), 500


    # Endpoint för att hämta humörloggar
    @app.route("/api/mood/get", methods=["GET"])
    def get_moods():
        """Hämtar humörloggar för användaren från Firestore"""
        try:
            user_email = request.args.get("user_email")
            if not user_email:
                return jsonify({"error": "User email is required"}), 400

            user_email = user_email.strip().lower()  # Hämta e-postadress från URL-parametrar

            # Hämta humörloggar från Firestore
            user_ref = db.collection("users").document(user_email)
            moods_ref = user_ref.collection("moods").order_by("timestamp", direction=firestore.Query.DESCENDING)
            mood_logs = [{"mood": doc.to_dict().get("mood"), "timestamp": doc.to_dict().get("timestamp")} for doc in moods_ref.stream()]

            if not mood_logs:
                return jsonify({"message": "No mood logs found."}), 200

            return jsonify({"moods": mood_logs}), 200

        except Exception as e:
            logger.error(f"🔥 Error while fetching mood logs: {str(e)}")
            return jsonify({"error": str(e)}), 500

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

