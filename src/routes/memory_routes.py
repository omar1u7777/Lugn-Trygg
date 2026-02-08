import os
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request as flask_request, jsonify
from types import SimpleNamespace
from werkzeug.utils import secure_filename
from firebase_admin import storage
import src.firebase_config as firebase_config
from ..utils.input_sanitization import input_sanitizer
from ..utils.response_utils import APIResponse, success_response, error_response, created_response

_DB_SENTINEL = object()
db = _DB_SENTINEL  # legacy override point for tests


def _get_db():
    """Return Firestore client, allowing tests to inject a mock via module attribute."""
    override = globals().get("db", _DB_SENTINEL)
    return override if override is not _DB_SENTINEL else firebase_config.db
from src.services.auth_service import AuthService

memory_bp = Blueprint("memory", __name__)

logger = logging.getLogger(__name__)

# Expose a patchable symbol for tests as a plain object (does not require request context)
request = SimpleNamespace()


# 🔹 Tillåtna filformat
ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
 

def allowed_file(filename):
    """🔹 Kontrollera om filen har ett tillåtet format"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# 🔹 Ladda upp ljudminne till Firebase Storage
@memory_bp.route("/upload", methods=["POST", "OPTIONS"])
def upload_memory():
    if flask_request.method == 'OPTIONS':
        return '', 204
    try:
        if "audio" not in flask_request.files or "user_id" not in flask_request.form:
            return APIResponse.bad_request("Ljudfil och användar-ID krävs!")

        file = flask_request.files["audio"]
        user_id = flask_request.form["user_id"].strip()

        # Sanitize user_id
        user_id = input_sanitizer.sanitize(user_id, 'text', 100)

        if not user_id:
            return APIResponse.bad_request("Ogiltigt användar-ID!")

        if not allowed_file(file.filename):
            return APIResponse.bad_request("Endast MP3, WAV och M4A-filer är tillåtna!")

        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)
        if file_length > MAX_FILE_SIZE:
            return APIResponse.bad_request("Filen är för stor. Max 10MB tillåtet!")

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
        memory_ref = _get_db().collection("memories").document(f"{user_id}_{timestamp}")
        memory_ref.set({
            "user_id": user_id,
            "file_path": secure_name,
            "timestamp": timestamp
        })

        # 🔹 Generera säker temporär länk (1 timmes giltighet)
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        return APIResponse.success({"file_url": signed_url}, "Minne har laddats upp!")

    except Exception as e:
        logger.exception(f"🔥 Fel vid uppladdning av minne: {e}")
        logger.error(f"🔥 Feltyp: {type(e).__name__}")
        logger.error(f"🔥 Felmeddelande: {str(e)}")
        return APIResponse.error(f"Ett fel uppstod vid uppladdning av minne: {str(e)}", "INTERNAL_ERROR", 500, str(e))

# 🔹 Hämta en lista över användarens minnen
@memory_bp.route("/list", methods=["GET"])
@AuthService.jwt_required
def list_memories():
    logger.info("📸 MEMORY - LIST memories endpoint called")
    try:
        # Derive user_id from Flask request or Authorization header
        current_user_id = getattr(flask_request, "user_id", None)
        logger.info(f"👤 MEMORY - Current user ID: {current_user_id}")
        if not current_user_id:
            auth_header = flask_request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                uid, err = AuthService.verify_token(token)
                if not err:
                    current_user_id = uid

        # Get user_id from query parameter
        query_user_id = flask_request.args.get("user_id", "").strip()
        # Sanitize user_id
        query_user_id = input_sanitizer.sanitize(query_user_id, 'text', 100)
        if not query_user_id:
            return APIResponse.success({"memories": []}, "No memories found")

        if query_user_id != current_user_id:
            # Check if user is authorized to access this user's memories (admin check could go here)
            return APIResponse.forbidden("Obehörig åtkomst till andra användares minnen!")

        target_user_id = query_user_id

        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning and fix index requirement
        # Handle both production (FieldFilter) and test (positional) environments
        try:
            from google.cloud.firestore import FieldFilter
            memories_ref = list(
                _get_db().collection("memories")
                .where(filter=FieldFilter("user_id", "==", target_user_id))
                .limit(100)  # CRITICAL FIX: Add limit to prevent large queries
                .stream()
            )
        except TypeError:
            # Fallback for test environments that don't support FieldFilter
            memories_ref = list(
                _get_db().collection("memories")
                .where("user_id", "==", target_user_id)
                .limit(100)
                .stream()
            )
        # Sort in memory to avoid composite index requirement
        memory_list = [{"id": mem.id, "file_path": mem.to_dict().get("file_path"), "timestamp": mem.to_dict().get("timestamp")} for mem in memories_ref]
        memory_list.sort(key=lambda x: x["timestamp"], reverse=True)
        logger.info(f"✅ MEMORY - Retrieved {len(memory_list)} memories for user {target_user_id}")

        return APIResponse.success({"memories": memory_list}, f"Retrieved {len(memory_list)} memories")

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minnen: {e}")
        return APIResponse.error("Ett fel uppstod vid hämtning av minnen!", "INTERNAL_ERROR", 500, str(e))

# 🔹 Hämta en signerad URL för uppspelning
@memory_bp.route("/get", methods=["GET"])
@AuthService.jwt_required
def get_memory():
    try:
        current_user_id = getattr(flask_request, "user_id", None)
        if not current_user_id:
            auth_header = flask_request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                uid, err = AuthService.verify_token(token)
                if not err:
                    current_user_id = uid
        file_path = flask_request.args.get("file_path", "").strip()

        # Sanitize file_path
        file_path = input_sanitizer.sanitize(file_path, 'filename', 255)

        if not file_path:
            return APIResponse.bad_request("Filväg krävs!")

        # Get user_id from query parameter if provided, otherwise use JWT user_id
        query_user_id = flask_request.args.get("user_id", "").strip()
        if query_user_id and query_user_id != current_user_id:
            # Check if user is authorized to access this user's memories (admin check could go here)
            return APIResponse.forbidden("Obehörig åtkomst till andra användares minnen!")

        target_user_id = query_user_id or current_user_id

        # 🔹 Kontrollera att minnet tillhör användaren
        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        # Handle both production (FieldFilter) and test (positional) environments
        try:
            from google.cloud.firestore import FieldFilter
            memory_ref = list(
                _get_db().collection("memories")
                .where(filter=FieldFilter("user_id", "==", target_user_id))
                .where(filter=FieldFilter("file_path", "==", file_path))
                .limit(1)
                .stream()
            )
        except TypeError:
            # Fallback for test environments that don't support FieldFilter
            memory_ref = list(
                _get_db().collection("memories")
                .where("user_id", "==", target_user_id)
                .where("file_path", "==", file_path)
                .limit(1)
                .stream()
            )

        if not memory_ref:
            return APIResponse.forbidden("Obehörig åtkomst till minne!")

        # 🔹 Kontrollera att filen existerar i Firebase Storage
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
        bucket = storage.bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            return APIResponse.not_found("Filen hittades inte!")

        # 🔹 Skapa en signerad URL som är giltig i 1 timme
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        return APIResponse.success({"url": signed_url}, "Memory URL generated")

    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minne: {e}")
        return APIResponse.error("Ett fel uppstod vid hämtning av minne!", "INTERNAL_ERROR", 500, str(e))
