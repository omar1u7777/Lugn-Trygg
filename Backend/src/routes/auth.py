from flask import Blueprint, request, jsonify, make_response
from firebase_admin import auth
import jwt
import re
from datetime import datetime, timezone
import logging
from src.services.auth_service import AuthService
from src.fierbase_config import db  # Importera Firestore för refresh-token lagring
from src.config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES
)

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-ZåäöÅÄÖ0-9._%+-]+@[a-zA-ZåäöÅÄÖ0-9.-]+\.[a-zA-Z]{2,}$")
INVALID_CREDENTIALS_MSG = "Felaktiga inloggningsuppgifter!"


@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        
        if not data or "email" not in data or "password" not in data:
            return jsonify({"error": "E-post och lösenord krävs!"}), 400

        email = data["email"].strip()
        password = data["password"].strip()

        # Validera e-post och lösenord
        if not EMAIL_REGEX.match(email):
            return jsonify({"error": "Ogiltig e-postadress!"}), 400
        if len(password) < 8:
            return jsonify({"error": "Lösenordet måste vara minst 8 tecken långt!"}), 400

        auth_service = AuthService()
        user, error = auth_service.register_user(email, password)
        if error:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Registrering lyckades!"}), 201
    except Exception as e:
        logger.error(f"❌ Registreringsfel: {str(e)}")
        return jsonify({"error": "Registrering misslyckades."}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        
        if not data or "email" not in data or "password" not in data:
            return jsonify({"error": "E-post och lösenord krävs!"}), 400

        email = data["email"].strip()
        password = data["password"].strip()

        # Validera e-post och lösenord
        if not EMAIL_REGEX.match(email):
            return jsonify({"error": "Ogiltig e-postadress!"}), 400
        if len(password) < 8:
            return jsonify({"error": "Lösenordet måste vara minst 8 tecken långt!"}), 400

        auth_service = AuthService()
        user, error, access_token, refresh_token = auth_service.login_user(email, password)
        if error:
            logger.warning(f"Login failed for {email}: {error}")
            return jsonify({"error": INVALID_CREDENTIALS_MSG}), 401

        response = make_response(jsonify({
            "message": "Inloggning lyckades!",
            "user_id": user.uid,
            "email": user.email,
            "access_token": access_token,
            "refresh_token": refresh_token
        }))

        response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="Lax", max_age=int(ACCESS_TOKEN_EXPIRES.total_seconds()))
        response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="Lax", max_age=int(REFRESH_TOKEN_EXPIRES.total_seconds()))

        return response, 200
    except Exception as e:
        logger.error(f"❌ Inloggningsfel: {str(e)}")
        return jsonify({"error": "Ett internt fel uppstod vid inloggning. Försök igen senare."}), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        if not user_id:
            return jsonify({"error": "Användar-ID krävs!"}), 400

        db.collection("refresh_tokens").document(user_id).delete()

        response = make_response(jsonify({"message": "Utloggning lyckades!"}))
        response.set_cookie("access_token", "", expires=0)
        response.set_cookie("refresh_token", "", expires=0)

        return response, 200
    except Exception as e:
        logger.error(f"❌ Utloggningsfel: {str(e)}")
        return jsonify({"error": "Ett internt fel uppstod vid utloggning"}), 500


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    try:
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            return jsonify({"error": "Refresh-token saknas!"}), 400

        user_doc = db.collection("refresh_tokens").where("refresh_token", "==", refresh_token).limit(1).get()
        if not user_doc:
            return jsonify({"error": "Ogiltigt refresh-token!"}), 401

        user_id = user_doc[0].id
        auth_service = AuthService()
        new_access_token = auth_service.generate_access_token(user_id)

        response = make_response(jsonify({"message": "Token uppdaterad", "access_token": new_access_token}))
        response.set_cookie("access_token", new_access_token, httponly=True, secure=True, samesite="Lax", max_age=int(ACCESS_TOKEN_EXPIRES.total_seconds()))

        return response, 200
    except Exception as e:
        logger.error(f"❌ Refresh-tokenfel: {str(e)}")
        return jsonify({"error": "Ett internt fel uppstod vid token-uppdatering"}), 500
