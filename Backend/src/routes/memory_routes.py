import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
import jwt
import os
from werkzeug.utils import secure_filename
from firebase_admin import storage, firestore
import mimetypes
from Backend.src.config import JWT_SECRET_KEY
from Backend.src.firebase_config import get_firebase_services

memory_bp = Blueprint("memory", __name__)
logger = logging.getLogger(__name__)

def verify_jwt_token(token: str) -> dict:
    """Verifierar JWT-token och returnerar payload."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        logger.warning("⛔ JWT-token har gått ut.")
        raise ValueError("Token har gått ut.")
    except jwt.InvalidTokenError:
        logger.warning("⛔ Ogiltigt JWT-token.")
        raise ValueError("Ogiltigt token.")

@memory_bp.route("/upload", methods=["POST"])
def upload_memory():
    try:
        db = get_firebase_services()["db"]

        if not db:
            logger.critical("❌ Firestore-db är inte initialiserat!")
            raise RuntimeError("Firestore är inte tillgängligt.")

        auth_header = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not auth_header:
            logger.warning("⚠️ Ingen autentiseringstoken tillhandahölls.")
            return jsonify({"error": "Ingen autentiseringstoken tillhandahölls!"}), 401
        payload = verify_jwt_token(auth_header)
        user_id = payload["sub"]
        logger.debug(f"✅ Autentiserad användare: {user_id}")

        if "audio" not in request.files or "user_id" not in request.form:
            logger.warning("⚠️ Ljudfil och användar-ID krävs!")
            return jsonify({"error": "Ljudfil och användar-ID krävs!"}), 400

        file = request.files["audio"]
        form_user_id = request.form["user_id"].strip()

        if form_user_id != user_id:
            logger.warning(f"⛔ Obehörig åtkomst: Form user_id ({form_user_id}) matchar inte token ({user_id}).")
            return jsonify({"error": "Obehörig åtkomst! Användar-ID matchar inte token."}), 403

        if not file.filename:
            logger.warning("⚠️ Ingen fil vald för uppladdning.")
            return jsonify({"error": "Ingen fil vald!"}), 400

        original_extension = os.path.splitext(file.filename)[1].lower() or ".bin"
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        filename = f"memories/{user_id}/{timestamp}{original_extension}"
        secure_name = secure_filename(filename)

        content_type, _ = mimetypes.guess_type(file.filename)
        if not content_type:
            content_type = "application/octet-stream"

        bucket = storage.bucket("lugn-trygg-53d75.firebasestorage.app")
        blob = bucket.blob(secure_name)
        blob.upload_from_file(file, content_type=content_type)

        # Generera signerad URL och spara den i Firestore
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))
        memory_ref = db.collection("memories").document(f"{user_id}_{timestamp}")
        memory_ref.set({
            "user_id": user_id,
            "file_path": filename,
            "timestamp": timestamp,
            "content_type": content_type,
            "audioUrl": signed_url  # Spara signerad URL i Firestore också
        })
        logger.info(f"✅ Metadata sparad i Firestore för {filename}, Signed URL: {signed_url}")

        return jsonify({"message": "Minne har laddats upp!", "file_url": signed_url}), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 401
    except Exception as e:
        logger.exception(f"🔥 Fel vid uppladdning av minne: {str(e)}")
        return jsonify({"error": "Ett fel uppstod vid uppladdning av minne!"}), 500

@memory_bp.route("/list", methods=["GET"])
def list_memories():
    try:
        db = get_firebase_services()["db"]

        if not db:
            logger.critical("❌ Firestore-db är inte initialiserat!")
            raise RuntimeError("Firestore är inte tillgängligt.")

        auth_header = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not auth_header:
            logger.warning("⚠️ Ingen autentiseringstoken tillhandahölls.")
            return jsonify({"error": "Ingen autentiseringstoken tillhandahölls!"}), 401

        payload = verify_jwt_token(auth_header)
        user_id = payload["sub"]
        logger.debug(f"✅ Autentiserad användare: {user_id}")

        # Hämta minnen från Firestore baserat på user_id
        memories_ref = db.collection("memories")
        query = memories_ref.where("user_id", "==", user_id).order_by("timestamp", direction=firestore.Query.DESCENDING).limit(50)

        memory_list = []
        for mem in query.stream():
            mem_data = mem.to_dict()
            file_path = mem_data.get("file_path")
            if not file_path:
                continue

            # Använd signerad URL från Firestore för att ge åtkomst till filen
            audio_url = mem_data.get("audioUrl")
            if not audio_url:
                continue

            memory_list.append({
                "id": mem.id,
                "file_path": file_path,
                "timestamp": mem_data.get("timestamp"),
                "audioUrl": audio_url  # Använd signerad URL för att spela upp filen
            })

        logger.info(f"✅ Hämtade {len(memory_list)} minnen för användare {user_id}")
        return jsonify({"memories": memory_list}), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 401
    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minnen: {str(e)}")
        return jsonify({"error": "Ett fel uppstod vid hämtning av minnen!"}), 500

@memory_bp.route("/get", methods=["GET"])
def get_memory():
    try:
        db = get_firebase_services()["db"]
        if not db:
            logger.critical("❌ Firestore-db är inte initialiserat!")
            raise RuntimeError("Firestore är inte tillgängligt.")

        auth_header = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not auth_header:
            logger.warning("⚠️ Ingen autentiseringstoken tillhandahölls.")
            return jsonify({"error": "Ingen autentiseringstoken tillhandahölls!"}), 401
        payload = verify_jwt_token(auth_header)
        user_id = payload["sub"]
        logger.debug(f"✅ Autentiserad användare: {user_id}")

        query_user_id = request.args.get("user_id", "").strip()
        file_path = request.args.get("file_path", "").strip()

        if query_user_id != user_id:
            logger.warning(f"⛔ Obehörig åtkomst: Query user_id ({query_user_id}) matchar inte token ({user_id}).")
            return jsonify({"error": "Obehörig åtkomst! Användar-ID matchar inte token."}), 403

        if not file_path:
            logger.warning("⚠️ Filväg saknas.")
            return jsonify({"error": "Filväg krävs!"}), 400

        memory_ref = db.collection("memories")
        query = memory_ref.where("user_id", "==", user_id).where("file_path", "==", file_path).limit(1)
        memory_docs = list(query.stream())
        if not memory_docs:
            logger.warning(f"⛔ Inget minne hittades för user_id: {user_id}, file_path: {file_path}")
            return jsonify({"error": "Inget minne hittades!"}), 404

        storage_path = secure_filename(file_path)
        bucket = storage.bucket("lugn-trygg-53d75.firebasestorage.app")
        blob = bucket.blob(storage_path)
        if not blob.exists():
            logger.warning(f"⚠️ Filen hittades inte: {storage_path}")
            return jsonify({"error": "Filen hittades inte!"}), 404

        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))
        logger.info(f"Signerad URL för {user_id}: {signed_url}")

        return jsonify({"url": signed_url}), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 401
    except Exception as e:
        logger.exception(f"🔥 Fel vid hämtning av minne: {str(e)}")
        return jsonify({"error": "Ett fel uppstod vid hämtning av minne!"}), 500

