import logging
import re
from flask import Blueprint, request, jsonify
from Backend.src.utils import convert_email_to_punycode
try:
    from firebase_admin import auth
except ModuleNotFoundError:  # pragma: no cover - fallback when firebase not installed
    from unittest.mock import MagicMock
    auth = MagicMock()
from Backend.src.services.auth_service import AuthService
try:
    from Backend.src.firebase_config import db
except Exception:  # pragma: no cover - during testing firebase config not available
    from unittest.mock import MagicMock
    db = MagicMock()
from Backend.src.config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES
)
from datetime import datetime, timezone

# Skapa Blueprint
auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

# Regex för e-postvalidering (inklusive Punycode)
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+|xn--[a-zA-Z0-9]+)\.[a-zA-Z]{2,}$")

# Hjälpfunktion för JSON-respons
def json_response(data, status=200):
    """Returnerar JSON med korrekt UTF-8-encoding"""
    return jsonify(data), status, {"Content-Type": "application/json; charset=utf-8"}

# Registrering
@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user
    ---
    tags:
      - Auth
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
            password:
              type: string
          required:
            - email
            - password
    responses:
      201:
        description: User created
      400:
        description: Validation error
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return json_response({"error": "⚠️ E-post och lösenord krävs!"}, 400)

        # Konvertera till Punycode
        punycode_email = convert_email_to_punycode(email)

        # Validera e-post och lösenord
        if not EMAIL_REGEX.match(punycode_email):
            return json_response({"error": "⚠️ Ogiltig e-postadress!"}, 400)
        if len(password) < 8:
            return json_response({"error": "⚠️ Lösenordet måste vara minst 8 tecken långt!"}, 400)

        # Skapa användare i Firebase via AuthService
        auth_service = AuthService()
        user, error = auth_service.register_user(punycode_email, password)
        if error:
            return json_response({"error": error}, 400)

        # Spara användardata i Firestore
        user_data = {
            "email": email,
            "email_punycode": punycode_email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }
        db.collection("users").document(user.uid).set(user_data)

        logger.info(f"✅ Användare registrerad i Firestore med UID: {user.uid}")
        return json_response({"message": "✅ Registrering lyckades!", "user_id": user.uid}, 201)

    except Exception as e:
        logger.exception(f"❌ Registreringsfel: {str(e)}")
        return json_response({"error": "⚠️ Registrering misslyckades. Försök igen senare."}, 500)

# Inloggning
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Log in a user
    ---
    tags:
      - Auth
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
            password:
              type: string
          required:
            - email
            - password
    responses:
      200:
        description: Login successful
      401:
        description: Invalid credentials
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return json_response({"error": "⚠️ E-post och lösenord krävs!"}, 400)

        punycode_email = convert_email_to_punycode(email)

        # Hämta användare från Firestore
        user_doc = next(iter(db.collection("users").where("email_punycode", "==", punycode_email).limit(1).stream()), None)
        if not user_doc:
            logger.warning(f"🚨 Användare ej funnen: {email}")
            return json_response({"error": "⚠️ Felaktiga inloggningsuppgifter!"}, 401)

        user_id = user_doc.id

        # Autentisera användare
        auth_service = AuthService()
        user, error, access_token, refresh_token = auth_service.login_user(punycode_email, password)
        if error:
            logger.warning(f"⛔ Inloggning misslyckades för UID: {user_id}: {error}")
            return json_response({"error": "⚠️ Felaktiga inloggningsuppgifter!"}, 401)

        # Uppdatera last_login och spara refresh-token
        db.collection("users").document(user_id).update({
            "last_login": datetime.now(timezone.utc).isoformat()
        })
        db.collection("refresh_tokens").document(user_id).set({
            "backend_refresh_token": refresh_token,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"✅ Inloggning lyckades för användare med UID: {user.uid}")
        return json_response({
            "message": "✅ Inloggning lyckades!",
            "user_id": user.uid,
            "email": email,
            "access_token": access_token,
            "refresh_token": refresh_token
        }, 200)

    except Exception as e:
        logger.exception(f"❌ Inloggningsfel: {str(e)}")
        return json_response({"error": "⚠️ Ett internt fel uppstod vid inloggning."}, 500)

# Token-uppdatering
@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    try:
        # Hämta refresh_token enbart från Authorization-headern
        refresh_token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not refresh_token:
            return json_response({"error": "⚠️ Ingen refresh-token hittades!"}, 400)

        # Verifiera refresh-token
        token_doc = next(iter(db.collection("refresh_tokens").where("backend_refresh_token", "==", refresh_token).stream()), None)
        if not token_doc:
            return json_response({"error": "⚠️ Ogiltigt refresh-token!"}, 401)

        user_id = token_doc.id
        auth_service = AuthService()
        new_access_token = auth_service.generate_access_token(user_id)

        logger.info(f"✅ Token uppdaterad för användare med UID: {user_id}")
        return json_response({"message": "✅ Token uppdaterad", "access_token": new_access_token}, 200)

    except Exception as e:
        logger.exception(f"❌ Refresh-tokenfel: {str(e)}")
        return json_response({"error": "⚠️ Ett internt fel uppstod vid token-uppdatering."}, 500)

# Utloggning
@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        refresh_token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not refresh_token:
            return json_response({"error": "⚠️ Ingen refresh-token hittades!"}, 400)

        # Verifiera och ta bort refresh-token
        token_doc = next(iter(db.collection("refresh_tokens").where("backend_refresh_token", "==", refresh_token).stream()), None)
        if not token_doc:
            return json_response({"error": "⚠️ Ogiltigt refresh-token!"}, 401)

        user_id = token_doc.id
        db.collection("refresh_tokens").document(user_id).delete()

        logger.info(f"✅ Utloggning lyckades för användare med UID: {user_id}")
        return json_response({"message": "✅ Utloggning lyckades!"}, 200)

    except Exception as e:
        logger.exception(f"❌ Utloggningsfel: {str(e)}")
        return json_response({"error": "⚠️ Ett internt fel uppstod vid utloggning."}, 500)
