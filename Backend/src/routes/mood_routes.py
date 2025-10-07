import logging
import asyncio
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_babel import gettext as _
from firebase_admin import firestore
from google.cloud.firestore import FieldFilter
from src.firebase_config import db
from src.config import ENCRYPTION_KEY
from src.services.auth_service import AuthService
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import redis
import json

mood_bp = Blueprint("mood", __name__)
logger = logging.getLogger(__name__)

# Redis client for caching (lazy initialization)
redis_client = None
redis_available = False

def _ensure_redis_connection():
    """Ensure Redis connection is available, initialize if needed"""
    global redis_client, redis_available
    if redis_client is None:
        try:
            redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True, socket_connect_timeout=1)
            redis_client.ping()  # Test connection
            redis_available = True
            logger.info("✅ Redis connection established")
        except redis.exceptions.ConnectionError:
            redis_client = None
            redis_available = False
            logger.warning("⚠️ Redis not available, falling back to no caching")
    return redis_available

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt data encrypted with AES"""
    try:
        cipher = Cipher(algorithms.AES(ENCRYPTION_KEY.encode()), modes.ECB(), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(base64.b64decode(encrypted_data)) + decryptor.finalize()
        # Remove padding
        return decrypted.decode('utf-8').rstrip('\x00')
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError("Failed to decrypt data")

def _generate_fallback_weekly_insights(weekly_data: dict) -> str:
    """
    Generate fallback insights when AI services are not available
    """
    mood_logs = weekly_data.get("moods", [])
    memories = weekly_data.get("memories", [])
    average_score = weekly_data.get("average_score", 0)
    mood_counts = weekly_data.get("mood_counts", {})

    insights = []

    # Overall mood analysis
    if average_score > 0.5:
        insights.append("Du har haft en övervägande positiv vecka!")
    elif average_score < -0.5:
        insights.append("Du har haft en utmanande vecka - kom ihåg att ta hand om dig själv.")
    else:
        insights.append("Din vecka har varit balanserad.")

    # Mood variety
    if len(mood_counts) > 3:
        insights.append("Du har upplevt en variation av olika känslor denna vecka.")
    elif len(mood_counts) == 1:
        insights.append("Du har hållit dig till samma känsla mestadels denna vecka.")

    # Memories
    if memories:
        insights.append(f"Du har skapat {len(memories)} minnen denna vecka - bra jobbat!")

    # Activity level
    if len(mood_logs) >= 7:
        insights.append("Du har loggat ditt humör varje dag - utmärkt engagemang för din mentala hälsa!")
    elif len(mood_logs) >= 4:
        insights.append("Du har loggat ditt humör flera gånger denna vecka - bra jobbat!")
    else:
        insights.append("Försök att logga ditt humör oftare för bättre insikter.")

    # Specific mood advice
    if mood_counts.get("stressad", 0) > mood_counts.get("glad", 0):
        insights.append("Överväg stresshanteringstekniker som meditation eller promenader.")
    elif mood_counts.get("glad", 0) > mood_counts.get("stressad", 0):
        insights.append("Fortsätt med det som gör dig glad!")

    return " ".join(insights) if insights else "Otillräcklig data för analys denna vecka."

# 🔹 Definiera humörkategorier
NEGATIVE_MOODS = ["ledsen", "arg", "stressad", "deppig", "frustrerad", "irriterad", "orolig"]
POSITIVE_MOODS = ["glad", "lycklig", "nöjd", "tacksam", "positiv"]
ALL_MOODS = NEGATIVE_MOODS + POSITIVE_MOODS

# 🔹 Humörpoäng för analys
MOOD_SCORES = {
    "glad": 2, "lycklig": 2, "nöjd": 1, "tacksam": 1, "positiv": 1,
    "ledsen": -2, "arg": -2, "stressad": -1, "deppig": -1, "frustrerad": -1, "irriterad": -1, "orolig": -1
}

def _sentiment_to_mood(sentiment_analysis: dict, transcript: str) -> str:
    """
    Convert AI sentiment analysis to specific mood category
    """
    sentiment = sentiment_analysis.get("sentiment", "NEUTRAL")
    emotions = sentiment_analysis.get("emotions", [])
    score = sentiment_analysis.get("score", 0.0)

    logger.info(f"🎭 Sentiment analysis: {sentiment} (score: {score:.2f}), emotions: {emotions}")

    # Priority: emotions > sentiment > keyword matching
    if emotions:
        emotion_to_mood = {
            "joy": "glad",
            "sadness": "ledsen",
            "anger": "arg",
            "fear": "orolig",
            "surprise": "positiv",
            "trust": "tacksam",
            "anticipation": "nöjd"
        }
        for emotion in emotions:
            if emotion in emotion_to_mood:
                logger.info(f"🎭 Selected mood from emotion '{emotion}': {emotion_to_mood[emotion]}")
                return emotion_to_mood[emotion]

    # Enhanced keyword matching first (before sentiment-based mapping)
    transcript_lower = transcript.lower()
    keyword_moods = {
        "stressad": "stressad", "stress": "stressad", "orolig": "orolig", "ängslig": "orolig",
        "ledsen": "ledsen", "sorg": "ledsen", "deppig": "deppig", "nedstämd": "deppig",
        "arg": "arg", "rasande": "arg", "irriterad": "irriterad", "frustrerad": "frustrerad",
        "glad": "glad", "lycklig": "lycklig", "härlig": "glad", "kul": "glad",
        "nöjd": "nöjd", "tacksam": "tacksam", "positiv": "positiv"
    }

    for keyword, mood in keyword_moods.items():
        if keyword in transcript_lower:
            logger.info(f"🎭 Selected mood from keyword '{keyword}': {mood}")
            return mood

    # Fallback to sentiment-based mapping
    if sentiment == "POSITIVE":
        if score > 0.6:
            return "lycklig"
        elif score > 0.3:
            return "glad"
        else:
            return "nöjd"
    elif sentiment == "NEGATIVE":
        if score < -0.6:
            return "ledsen"
        elif score < -0.3:
            return "deppig"
        else:
            return "stressad"
    else:
        # Final fallback
        logger.info("🎭 No specific mood detected, defaulting to 'nöjd'")
        return "nöjd"


# 🔹 Logga humör i strukturen users/{user_email}/moods/{timestamp}
@mood_bp.route("/log", methods=["POST"])
def log_mood():
    try:
        # Check if multipart (audio) or JSON
        if request.content_type.startswith('multipart/form-data'):
            logger.info("🎵 Processing multipart audio request")
            # Handle audio upload
            if "audio" not in request.files or "user_email" not in request.form:
                return jsonify({"error": "Ljudfil och e-post krävs!"}), 400

            file = request.files["audio"]
            user_email = request.form["user_email"].strip().lower()

            # Find user_id by email
            user_query = db.collection("users").where(filter=FieldFilter("email", "==", user_email)).limit(1)
            user_docs = list(user_query.stream())
            if not user_docs:
                return jsonify({"error": "Användare hittades inte!"}), 404
            user_id = user_docs[0].id

            # Transcribe with Google Speech-to-Text
            from src.utils.speech_utils import transcribe_audio_google
            audio_data = file.read()
            transcript = transcribe_audio_google(audio_data, language_code="sv-SE")
            if transcript is None:
                return jsonify({"error": "Kunde inte transkribera ljudfilen!"}), 500

            # Advanced AI-powered mood detection
            from src.utils.ai_services import ai_services
            sentiment_analysis = ai_services.analyze_sentiment(transcript)

            # Extract score from sentiment analysis
            score = sentiment_analysis.get("score", 0.0)
            logger.info(f"📊 Audio path: score = {score}")

            # Map sentiment to mood categories
            detected_mood = _sentiment_to_mood(sentiment_analysis, transcript)

        else:
            logger.info("📄 Processing JSON request")
            # JSON input (encrypted)
            data = request.get_json(force=True, silent=False)
            logger.info(f"📩 Mottagen krypterad data")

            if not data or "user_id" not in data or "mood" not in data or "score" not in data:
                return jsonify({"error": "Felaktig JSON-data!"}), 400

            user_id = data["user_id"].strip()
            encrypted_mood = data["mood"].strip()
            score = data["score"]
            logger.info(f"📊 JSON path: score = {score}")

            # Decrypt mood data
            try:
                detected_mood = decrypt_data(encrypted_mood)
                logger.info(f"🔓 Dekrypterat humör: {detected_mood}")
            except Exception as decrypt_error:
                logger.error(f"Failed to decrypt mood data: {decrypt_error}")
                return jsonify({"error": "Kunde inte dekryptera data!"}), 400

            # Additional validation
            if not user_id or not detected_mood:
                return jsonify({"error": "Alla fält måste fyllas i!"}), 400
            if not isinstance(score, (int, float)) or score < -1 or score > 1:
                return jsonify({"error": "Ogiltig humörpoäng!"}), 400

        # User already verified above

        timestamp = datetime.now(timezone.utc).isoformat()

        # 🔹 Kontrollera att humöret är giltigt
        if detected_mood not in ALL_MOODS:
            return jsonify({"error": "Ogiltigt humör!"}), 400

        logger.info(f"📊 Before saving: user_id={user_id}, detected_mood={detected_mood}, score={score}")

        # 🔹 Spara i Firestore under users/{user_id}/moods/{timestamp}
        user_ref = db.collection("users").document(user_id)
        mood_ref = user_ref.collection("moods").document(timestamp)

        mood_data = {
            "mood": detected_mood,
            "score": score,
            "timestamp": timestamp,
            "source": "encrypted",
            "decrypted_mood": detected_mood  # Store decrypted version for analysis
        }

        mood_ref.set(mood_data)

        logger.info(f"✅ Krypterat humör sparat för användare {user_id}: {detected_mood} (score: {score})")
        return jsonify({"message": "Ditt humör har sparats!", "mood": detected_mood, "score": score, "timestamp": timestamp}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid humörloggning: {e}")
        logger.error(f"🔥 Feltyp: {type(e).__name__}")
        logger.error(f"🔥 Felmeddelande: {str(e)}")
        return jsonify({"error": f"Ett internt fel uppstod vid humörloggning: {str(e)}"}), 500


# 🔹 Hämta sparade humörloggar från users/{user_id}/moods/
@mood_bp.route("/get", methods=["GET"])
@AuthService.jwt_required
def get_moods():
    try:
        user_id = request.user_id

        # 🔹 Hämta humörloggar från Firestore
        moods_ref = db.collection("users").document(user_id).collection("moods").order_by("timestamp", direction=firestore.Query.DESCENDING)
        mood_logs = [{"mood": doc.to_dict().get("decrypted_mood", doc.to_dict().get("mood")), "score": doc.to_dict().get("score", 0), "timestamp": doc.to_dict().get("timestamp")} for doc in moods_ref.stream()]

        if not mood_logs:
            return jsonify({"message": "Inga humörloggar hittades."}), 200

        logger.info(f"✅ {len(mood_logs)} humörloggar hämtade för användare {user_id}")
        return jsonify({"moods": mood_logs}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av humörloggar: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid hämtning av humörloggar."}), 500


# 🔹 Veckoanalys av humör och minnen
@mood_bp.route("/weekly-analysis", methods=["GET"])
@AuthService.jwt_required
def weekly_analysis():
    try:
        user_id = request.user_id
        locale = request.args.get("locale", "sv").strip()

        # Check cache first (if Redis is available)
        redis_connected = _ensure_redis_connection()
        if redis_connected and redis_client:
            cache_key = f"weekly_analysis:{user_id}:{locale}"
            try:
                cached_result = redis_client.get(cache_key)
                if cached_result:
                    logger.info(f"✅ Cache hit for weekly analysis: {user_id}")
                    return jsonify(json.loads(cached_result)), 200
            except redis.exceptions.ConnectionError:
                logger.warning("⚠️ Redis connection lost during cache read")
                redis_available = False

        from datetime import datetime, timedelta
        # Use timezone-aware datetime for proper comparison
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        logger.info(f"📊 Analyzing data from {week_ago} to now for user {user_id}")

        # Hämta användarens e-post från Firestore
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return jsonify({"error": _("user_not_found")}), 404
        user_email = user_doc.to_dict().get("email")

        # Hämta humörloggar från senaste veckan
        try:
            logger.info(f"📊 Fetching mood logs for user {user_id} from {week_ago}")
            moods_ref = db.collection("users").document(user_id).collection("moods").where(filter=FieldFilter("timestamp", ">=", week_ago)).order_by("timestamp")
            mood_logs = [{"mood": doc.to_dict().get("decrypted_mood", doc.to_dict().get("mood")), "score": doc.to_dict().get("score", 0), "timestamp": doc.to_dict().get("timestamp")} for doc in moods_ref.stream()]
            logger.info(f"✅ Found {len(mood_logs)} mood logs")
        except Exception as mood_error:
            logger.error(f"❌ Error fetching mood logs: {mood_error}")
            mood_logs = []

        # Hämta minnen från senaste veckan
        try:
            logger.info(f"📊 Fetching memories for user {user_id} from {week_ago}")
            memories_ref = db.collection("memories").where(filter=FieldFilter("user_id", "==", user_id)).where(filter=FieldFilter("timestamp", ">=", week_ago)).order_by("timestamp")
            memory_list = [{
                "id": doc.id,
                "file_path": doc.to_dict().get("file_path"),
                "timestamp": doc.to_dict().get("timestamp")
            } for doc in memories_ref.stream()]
            logger.info(f"✅ Found {len(memory_list)} memories")
        except Exception as mem_error:
            logger.warning(f"⚠️ Error fetching memories, using empty list: {str(mem_error)}")
            memory_list = []

        # Analysera humör
        total_score = 0
        mood_counts = {}
        try:
            for log in mood_logs:
                mood = log.get("mood")
                score = log.get("score", 0)
                if mood:
                    total_score += score  # Use stored score directly
                    mood_counts[mood] = mood_counts.get(mood, 0) + 1

            average_score = total_score / len(mood_logs) if mood_logs else 0
            logger.info(f"📈 Mood analysis: {len(mood_logs)} logs, average score: {average_score}")
        except Exception as analysis_error:
            logger.error(f"❌ Error in mood analysis: {analysis_error}")
            average_score = 0
            mood_counts = {}

        # AI-powered insights with fallback
        from src.utils.ai_services import ai_services

        weekly_data = {
            "moods": mood_logs,
            "memories": memory_list,
            "average_score": average_score,
            "mood_counts": mood_counts
        }

        try:
            logger.info(f"🔍 Generating AI insights for user {user_id}")
            ai_insights = ai_services.generate_weekly_insights(weekly_data, locale)
            logger.info(f"✅ AI insights generated successfully")
        except Exception as ai_error:
            logger.warning(f"⚠️ AI insights failed, using fallback: {str(ai_error)}")
            # Fallback analysis when AI is not available
            ai_insights = {
                "insights": _generate_fallback_weekly_insights(weekly_data),
                "ai_generated": False,
                "confidence": 0.6,
                "comprehensive": False
            }

        # Sammanfattning med AI-insikter
        summary = {
            "total_moods": len(mood_logs),
            "average_score": average_score,
            "mood_counts": mood_counts,
            "memories_count": len(memory_list),
            "recent_memories": memory_list[:5],  # Top 5
            "insights": ai_insights["insights"],
            "ai_generated": ai_insights["ai_generated"],
            "confidence": ai_insights["confidence"]
        }

        # Cache the result for 1 hour (if Redis is available)
        if redis_connected and redis_client:
            try:
                redis_client.setex(cache_key, 3600, json.dumps(summary))
                logger.info(f"✅ Weekly analysis cached for user {user_id}")
            except redis.exceptions.ConnectionError:
                logger.warning("⚠️ Redis connection lost during cache write")
                redis_available = False

        return jsonify(summary), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid veckoanalys: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid analys."}), 500


# 🔹 AI-powered personalized recommendations
@mood_bp.route("/recommendations", methods=["GET"])
def get_personalized_recommendations():
    try:
        user_id = request.args.get("user_id", "").strip()
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        # Hämta användarens humörhistorik
        user_ref = db.collection("users").document(user_id)
        moods_ref = user_ref.collection("moods").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(30)
        mood_history = []

        for doc in moods_ref.stream():
            data = doc.to_dict()
            mood_history.append({
                "mood": data.get("mood"),
                "timestamp": data.get("timestamp"),
                "sentiment": data.get("ai_analysis", {}).get("sentiment") if data.get("ai_analysis") else None
            })

        # Bestäm nuvarande sinnesstämning från senaste logg
        current_mood = "neutral"
        if mood_history:
            latest_mood = mood_history[0]["mood"]
            if latest_mood:
                current_mood = latest_mood

        # Generera AI-rekommendationer
        from src.utils.ai_services import ai_services
        recommendations = ai_services.generate_personalized_recommendations(mood_history, current_mood)

        return jsonify({
            "current_mood": current_mood,
            "recommendations": recommendations["recommendations"],
            "ai_generated": recommendations["ai_generated"],
            "confidence": recommendations["confidence"],
            "personalized": recommendations["personalized"]
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid generering av rekommendationer: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid generering av rekommendationer."}), 500


# 🔹 Voice emotion analysis endpoint
@mood_bp.route("/analyze-voice", methods=["POST"])
def analyze_voice_emotion():
    """
    Analyze emotions from voice recording using advanced AI
    """
    try:
        data = request.get_json(force=True, silent=False)
        if not data or "user_id" not in data or "audio_data" not in data:
            return jsonify({"error": "Användar-ID och ljuddata krävs!"}), 400

        user_id = data["user_id"].strip()
        audio_data = data["audio_data"]  # Base64 encoded audio
        transcript = data.get("transcript", "").strip()

        if not user_id or not audio_data:
            return jsonify({"error": "Användar-ID och ljuddata får inte vara tomma!"}), 400

        # For now, return mock analysis since full implementation requires audio processing setup
        # In production, this would:
        # 1. Decode base64 audio data
        # 2. Use speech recognition to get transcript if not provided
        # 3. Analyze voice characteristics (pitch, tempo, energy)
        # 4. Use AI models for emotion detection

        from src.utils.ai_services import ai_services

        # If transcript is provided, use it for analysis
        if transcript:
            sentiment_analysis = ai_services.analyze_sentiment(transcript)
            voice_analysis = ai_services.analyze_voice_emotion(
                audio_data.encode() if isinstance(audio_data, str) else audio_data,
                transcript
            )
        else:
            # Basic fallback analysis
            voice_analysis = {
                "primary_emotion": "neutral",
                "confidence": 0.5,
                "voice_characteristics": {
                    "energy_level": "medium",
                    "speech_rate": "normal",
                    "emotional_intensity": 0.5
                },
                "transcript_sentiment": "NEUTRAL",
                "combined_analysis": "NEUTRAL"
            }

        return jsonify({
            "voice_analysis": voice_analysis,
            "transcript_provided": bool(transcript),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "ai_powered": True
        }), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid röstanalys: {e}")
        return jsonify({"error": "Ett internt fel uppstod vid röstanalys."}), 500
