import os
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
try:
    from firebase_admin import firestore
except ModuleNotFoundError:  # pragma: no cover
    from unittest.mock import MagicMock
    firestore = MagicMock()

mood_bp = Blueprint("mood", __name__)
logger = logging.getLogger(__name__)

@mood_bp.route("/log", methods=["POST"])
def log_mood():
    if "audio" not in request.files:
        logger.error("❌ No audio file found in the request")
        return jsonify({"error": "No audio file found"}), 400

    file = request.files["audio"]
    filename = secure_filename(file.filename)
    file_path = os.path.join("temp_audio.wav")

    try:
        file.save(file_path)
        logger.info(f"📂 Audio file saved as: {file_path}")

        transcriber = current_app.config.get("TRANSCRIBE_MODEL")
        if transcriber is None:
            return jsonify({"error": "Speech recognition model is not available"}), 500

        result = transcriber.transcribe(file_path, language="sv")
        text = result["text"].strip()
        os.remove(file_path)
        logger.info(f"📝 Transcribed text: {text}")

        if not text:
            return jsonify({"error": "No text could be extracted from the audio file."}), 400

        mood = "neutral"
        mood_mapping = {
            "glad": ["jag är glad", "känner mig glad", "jag mår bra"],
            "ledsen": ["jag är ledsen", "ledsen", "känner mig ledsen"],
            "arg": ["jag är arg", "jag är frustrerad", "jag känner mig irriterad"]
        }
        for mood_type, expressions in mood_mapping.items():
            if any(sentence in text.lower() for sentence in expressions):
                mood = mood_type
                break

        user_email = request.form.get("user_email")
        if not user_email:
            logger.error("❌ User email is missing in the request")
            return jsonify({"error": "User email is missing"}), 400

        timestamp = datetime.utcnow().isoformat()
        db_conn = current_app.config.get("FIRESTORE_DB")
        user_ref = db_conn.collection("users").document(user_email)
        user_ref.collection("moods").document(timestamp).set({
            "mood": mood,
            "transcript": text,
            "timestamp": timestamp,
        })

        logger.info(f"📦 Saved mood log for {user_email}: {mood} ({timestamp})")
        return jsonify({"message": "Mood logged", "mood": mood, "transcript": text})
    except Exception as e:  # pragma: no cover
        logger.error(f"🔥 Error while logging mood: {str(e)}")
        return jsonify({"error": str(e)}), 500

@mood_bp.route("/get", methods=["GET"])
def get_moods():
    try:
        user_email = request.args.get("user_email")
        if not user_email:
            return jsonify({"error": "User email is required"}), 400

        user_email = user_email.strip().lower()
        db_conn = current_app.config.get("FIRESTORE_DB")
        user_ref = db_conn.collection("users").document(user_email)
        moods_ref = user_ref.collection("moods").order_by("timestamp", direction=firestore.Query.DESCENDING)
        mood_logs = [{"mood": doc.to_dict().get("mood"), "timestamp": doc.to_dict().get("timestamp")}
                     for doc in moods_ref.stream()]

        if not mood_logs:
            return jsonify({"message": "No mood logs found."}), 200

        return jsonify({"moods": mood_logs}), 200
    except Exception as e:  # pragma: no cover
        logger.error(f"🔥 Error while fetching mood logs: {str(e)}")
        return jsonify({"error": str(e)}), 500
