import os
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from firebase_admin import storage
from google.cloud.firestore import FieldFilter
from src.firebase_config import db
from src.services.auth_service import AuthService

memory_bp = Blueprint("memory", __name__)

logger = logging.getLogger(__name__)

# 🔹 Tillåtna filformat
ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
 

def allowed_file(filename):
    """🔹 Kontrollera om filen har ett tillåtet format"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# 🔹 Ladda upp ljudminne till Firebase Storage
@memory_bp.route("/upload", methods=["POST"])
def upload_memory():
    try:
        if "audio" not in request.files or "user_id" not in request.form:
            return jsonify({"error": "Ljudfil och användar-ID krävs!"}), 400

        file = request.files["audio"]
        user_id = request.form["user_id"].strip()

        if not user_id:
            return jsonify({"error": "Ogiltigt användar-ID!"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "Endast MP3, WAV och M4A-filer är tillåtna!"}), 400

        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)
        if file_length > MAX_FILE_SIZE:
            return jsonify({"error": "Filen är för stor. Max 10MB tillåtet!"}), 400

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        filename = f"memories/{user_id}/{timestamp}.mp3"
        secure_name = secure_filename(filename)

        # 🔹 Ladda upp till Firebase Storage
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
        bucket = storage.bucket(bucket_name)

        # Try to create bucket if it doesn't exist
        try:
            if not bucket.exists():
                logger.info(f"📦 Creating storage bucket: {bucket_name}")
                bucket.create()
        except Exception as bucket_error:
            logger.warning(f"⚠️ Could not create bucket (might already exist): {bucket_error}")

        blob = bucket.blob(secure_name)
        blob.upload_from_file(file, content_type="audio/mpeg")

        # 🔹 Spara metadata i Firestore
        memory_ref = db.collection("memories").document(f"{user_id}_{timestamp}")
        memory_ref.set({
            "user_id": user_id,
            "file_path": secure_name,
            "timestamp": timestamp
        })

        # 🔹 Generera säker temporär länk (1 timmes giltighet)
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        return jsonify({"message": "Minne har laddats upp!", "file_url": signed_url}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid uppladdning av minne: {e}")
        logger.error(f"🔥 Feltyp: {type(e).__name__}")
        logger.error(f"🔥 Felmeddelande: {str(e)}")
        return jsonify({"error": f"Ett fel uppstod vid uppladdning av minne: {str(e)}"}), 500

# 🔹 Hämta en lista över användarens minnen
@memory_bp.route("/list", methods=["GET"])
@AuthService.jwt_required
def list_memories():
    try:
        user_id = request.user_id

        # Get user_id from query parameter if provided, otherwise use JWT user_id
        query_user_id = request.args.get("user_id", "").strip()
        if query_user_id and query_user_id != user_id:
            # Check if user is authorized to access this user's memories (admin check could go here)
            return jsonify({"error": "Obehörig åtkomst till andra användares minnen!"}), 403

        target_user_id = query_user_id or user_id

        memories_ref = list(db.collection("memories").where(filter=FieldFilter("user_id", "==", target_user_id)).order_by("timestamp", direction="DESCENDING").stream())
        memory_list = [{"id": mem.id, "file_path": mem.to_dict().get("file_path"), "timestamp": mem.to_dict().get("timestamp")} for mem in memories_ref]

        return jsonify({"memories": memory_list}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minnen: {e}")
        return jsonify({"error": "Ett fel uppstod vid hämtning av minnen!"}), 500

# 🔹 Hämta en signerad URL för uppspelning
@memory_bp.route("/get", methods=["GET"])
@AuthService.jwt_required
def get_memory():
    try:
        user_id = request.user_id
        file_path = request.args.get("file_path", "").strip()

        if not file_path:
            return jsonify({"error": "Filväg krävs!"}), 400

        # Get user_id from query parameter if provided, otherwise use JWT user_id
        query_user_id = request.args.get("user_id", "").strip()
        if query_user_id and query_user_id != user_id:
            # Check if user is authorized to access this user's memories (admin check could go here)
            return jsonify({"error": "Obehörig åtkomst till andra användares minnen!"}), 403

        target_user_id = query_user_id or user_id

        # 🔹 Kontrollera att minnet tillhör användaren
        memory_ref = list(db.collection("memories").where(filter=FieldFilter("user_id", "==", target_user_id)).where(filter=FieldFilter("file_path", "==", file_path)).limit(1).stream())

        if not memory_ref:
            return jsonify({"error": "Obehörig åtkomst till minne!"}), 403

        # 🔹 Kontrollera att filen existerar i Firebase Storage
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
        bucket = storage.bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            return jsonify({"error": "Filen hittades inte!"}), 404

        # 🔹 Skapa en signerad URL som är giltig i 1 timme
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        return jsonify({"url": signed_url}), 200

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minne: {e}")
        return jsonify({"error": "Ett fel uppstod vid hämtning av minne!"}), 500
