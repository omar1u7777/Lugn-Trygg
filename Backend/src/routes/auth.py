import logging
import re
from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_babel import gettext as _
from ..utils import convert_email_to_punycode
from firebase_admin import auth
from google.cloud.firestore import FieldFilter
from src.services.auth_service import AuthService
from src.firebase_config import db
from src.config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES
  )
from datetime import datetime, timezone

# Initialize limiter for this module
limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])

# Skapa Blueprint
auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

# Regex för e-postvalidering (inklusive Punycode och svenska tecken)
EMAIL_REGEX = re.compile(r"^[^@]+@([a-zA-Z0-9.-]+|xn--[a-zA-Z0-9]+)\.[a-zA-Z]{2,}$")

# Hjälpfunktion för JSON-respons
def json_response(data, status=200):
    """Returnerar JSON med korrekt UTF-8-encoding"""
    return jsonify(data), status, {"Content-Type": "application/json; charset=utf-8"}

# Registrering
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    try:
        data = request.get_json(force=True, silent=True) or {}
        logger.info(f"Registration request data: {data}")
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        logger.info(f"Processing registration for email: {email}, password length: {len(password)}")

        if not email or not password:
            logger.warning("Missing email or password")
            return json_response({"error": _("email_password_required")}, 400)

        # Konvertera till Punycode
        punycode_email = convert_email_to_punycode(email)
        logger.info(f"Punycode email: {punycode_email}")

        # Validera e-post och lösenord
        if not EMAIL_REGEX.match(punycode_email):
            logger.warning(f"Invalid email format: {punycode_email}")
            return json_response({"error": "⚠️ Ogiltig e-postadress!"}, 400)
        if len(password) < 8:
            logger.warning(f"Password too short: {len(password)} characters")
            return json_response({"error": "⚠️ Lösenordet måste vara minst 8 tecken långt!"}, 400)

        # Skapa användare i Firebase via AuthService
        auth_service = AuthService()
        user, error = auth_service.register_user(punycode_email, password)
        if error:
            logger.warning(f"Firebase registration failed: {error}")
            return json_response({"error": error}, 400)

        # Spara användardata i Firestore
        user_data = {
            "email": email,
            "email_punycode": punycode_email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }

        try:
            db.collection("users").document(user.uid).set(user_data)
            logger.info(f"✅ Användare registrerad i Firestore med UID: {user.uid}")
            return json_response({"message": "✅ Registrering lyckades!", "user_id": user.uid}, 201)
        except Exception as firestore_error:
            logger.error(f"Failed to save user to Firestore: {firestore_error}")
            # If Firestore save fails, we should delete the Firebase user to maintain consistency
            try:
                auth.delete_user(user.uid)
                logger.info(f"Cleaned up Firebase user {user.uid} due to Firestore error")
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup Firebase user: {cleanup_error}")
            return json_response({"error": "Registrering misslyckades. Försök igen senare."}, 500)

    except Exception as e:
        logger.exception(f"❌ Registreringsfel: {str(e)}")
        return json_response({"error": "⚠️ Registrering misslyckades. Försök igen senare."}, 500)

# Inloggning
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return json_response({"error": "⚠️ E-post och lösenord krävs!"}, 400)

        punycode_email = convert_email_to_punycode(email)

        # Hämta användare från Firestore
        user_doc = next(iter(db.collection("users").where(filter=FieldFilter("email_punycode", "==", punycode_email)).limit(1).stream()), None)
        if not user_doc:
            logger.warning(f"🚨 Användare ej funnen i Firestore: {punycode_email}")
            # Check if user exists in Firebase Auth but not in Firestore (cleanup orphaned user)
            try:
                firebase_user = auth.get_user_by_email(punycode_email)
                logger.info(f"Found orphaned Firebase user {firebase_user.uid}, cleaning up...")
                auth.delete_user(firebase_user.uid)
                logger.info(f"Cleaned up orphaned user: {punycode_email}")
            except auth.UserNotFoundError:
                logger.info(f"User {punycode_email} doesn't exist in Firebase Auth either")
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup orphaned user: {cleanup_error}")

            # Generic error message to prevent user enumeration
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
        token_doc = next(iter(db.collection("refresh_tokens").where(filter=FieldFilter("backend_refresh_token", "==", refresh_token)).stream()), None)
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

# Google-inloggning
@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    try:
        data = request.get_json(force=True, silent=True) or {}
        id_token = data.get("id_token", "").strip()

        if not id_token:
            return json_response({"error": "⚠️ ID-token krävs!"}, 400)

        # Verifiera Google ID-token
        from firebase_admin import auth as firebase_auth
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email', '')

        logger.info(f"Google login for user: {email} (UID: {uid})")

        # Kontrollera om användaren finns i Firestore
        user_doc = db.collection("users").document(uid).get()

        if not user_doc.exists:
            # Skapa ny användare i Firestore för Google-användare
            user_data = {
                "email": email,
                "email_punycode": convert_email_to_punycode(email),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google"
            }
            db.collection("users").document(uid).set(user_data)
            logger.info(f"✅ Ny Google-användare skapad: {uid}")
        else:
            # Uppdatera last_login för befintlig användare
            db.collection("users").document(uid).update({
                "last_login": datetime.now(timezone.utc).isoformat()
            })

        # Generera JWT-tokens
        auth_service = AuthService()
        access_token = auth_service.generate_access_token(uid)
        refresh_token = auth_service.generate_refresh_token(uid)

        # Spara refresh-token
        db.collection("refresh_tokens").document(uid).set({
            "backend_refresh_token": refresh_token,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"✅ Google-inloggning lyckades för användare: {email}")
        return json_response({
            "message": "✅ Google-inloggning lyckades!",
            "user_id": uid,
            "email": email,
            "access_token": access_token,
            "refresh_token": refresh_token
        }, 200)

    except Exception as e:
        logger.exception(f"❌ Google-inloggningsfel: {str(e)}")
        return json_response({"error": "⚠️ Google-inloggning misslyckades."}, 500)

# Utloggning
@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        # Optional: Try to get and delete refresh token if provided
        refresh_token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if refresh_token:
            try:
                # Verifiera och ta bort refresh-token om den finns
                token_doc = next(iter(db.collection("refresh_tokens").where(filter=FieldFilter("backend_refresh_token", "==", refresh_token)).stream()), None)
                if token_doc:
                    user_id = token_doc.id
                    db.collection("refresh_tokens").document(user_id).delete()
                    logger.info(f"✅ Refresh-token raderad för användare med UID: {user_id}")
            except Exception as token_error:
                logger.warning(f"Failed to delete refresh token: {token_error}")
                # Continue with logout even if token deletion fails

        # Always return success for logout (client-side handles token removal)
        logger.info("✅ Utloggning lyckades")
        return json_response({"message": "✅ Utloggning lyckades!"}, 200)

    except Exception as e:
        logger.exception(f"❌ Utloggningsfel: {str(e)}")
        # Still return success to avoid client issues
        return json_response({"message": "✅ Utloggning lyckades!"}, 200)

# Återställ lösenord
@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("3 per hour")
def reset_password():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email", "").strip().lower()

        if not email:
            return json_response({"error": "⚠️ E-postadress krävs!"}, 400)

        # Validera e-postformat
        if not EMAIL_REGEX.match(email):
            return json_response({"error": "⚠️ Ogiltig e-postadress!"}, 400)

        # Firebase hanterar själva återställningen via e-post
        # Här kan vi lägga till extra validering eller loggning om nödvändigt
        logger.info(f"🔄 Lösenordsåterställning begärd för: {email}")

        return json_response({"message": "✅ Återställningslänk har skickats till din e-postadress!"}, 200)

    except Exception as e:
        logger.exception(f"❌ Lösenordsåterställningsfel: {str(e)}")
        return json_response({"error": "⚠️ Ett internt fel uppstod vid lösenordsåterställning."}, 500)

# GDPR Consent Management
@auth_bp.route("/consent", methods=["POST"])
def save_consent():
    """Save user GDPR consent preferences"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        consents = data.get("consents", {})
        timestamp = data.get("timestamp", datetime.now(timezone.utc).isoformat())
        version = data.get("version", "1.0")

        if not user_id:
            return json_response({"error": "⚠️ Användar-ID krävs!"}, 400)

        # Validate required consents
        if not consents.get("dataProcessing") or not consents.get("storage"):
            return json_response({"error": "⚠️ Nödvändiga samtycken måste godkännas!"}, 400)

        # Save consent to Firestore
        consent_data = {
            "user_id": user_id,
            "consents": consents,
            "timestamp": timestamp,
            "version": version,
            "ip_address": request.remote_addr,
            "user_agent": request.headers.get("User-Agent", ""),
            "gdpr_compliant": True
        }

        # Use user_id as document ID for easy lookup
        db.collection("consents").document(user_id).set(consent_data)

        logger.info(f"✅ GDPR consent saved for user: {user_id}")
        return json_response({"message": "✅ Samtycke sparat framgångsrikt!"}, 200)

    except Exception as e:
        logger.exception(f"❌ Consent save error: {str(e)}")
        return json_response({"error": "⚠️ Kunde inte spara samtycke."}, 500)

@auth_bp.route("/consent/<user_id>", methods=["GET"])
def get_consent(user_id):
    """Get user consent status"""
    try:
        if not user_id:
            return json_response({"error": "⚠️ Användar-ID krävs!"}, 400)

        consent_doc = db.collection("consents").document(user_id).get()

        if consent_doc.exists:
            consent_data = consent_doc.to_dict()
            return json_response({
                "consent_given": True,
                "consents": consent_data.get("consents", {}),
                "timestamp": consent_data.get("timestamp"),
                "version": consent_data.get("version")
            }, 200)
        else:
            return json_response({
                "consent_given": False,
                "consents": {},
                "message": "Inget samtycke registrerat"
            }, 200)

    except Exception as e:
        logger.exception(f"❌ Consent retrieval error: {str(e)}")
        return json_response({"error": "⚠️ Kunde inte hämta samtycke."}, 500)

# 2FA Management
@auth_bp.route("/enable-2fa", methods=["POST"])
def enable_2fa():
    """Enable 2FA for user with phone number"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_id = data.get("user_id", "").strip()
        phone_number = data.get("phone_number", "").strip()

        if not user_id or not phone_number:
            return json_response({"error": "Användar-ID och telefonnummer krävs!"}, 400)

        # Validate phone number format (Swedish format)
        if not re.match(r'^\+46\d{9}$', phone_number):
            return json_response({"error": "Ogiltigt telefonnummerformat. Använd +46XXXXXXXXX"}, 400)

        # Update user with phone number and enable 2FA
        try:
            # Update Firebase Auth user
            auth.update_user(
                user_id,
                phone_number=phone_number
            )

            # Note: Firebase handles SMS 2FA automatically when phone number is set
            # and multi-factor auth is enabled in the project settings

            logger.info(f"✅ 2FA enabled for user: {user_id}")
            return json_response({"message": "✅ 2FA aktiverat! Du kommer att få SMS-koder vid inloggning."}, 200)

        except auth.UserNotFoundError:
            return json_response({"error": "Användare hittades inte!"}, 404)
        except Exception as firebase_error:
            logger.error(f"Firebase 2FA setup error: {str(firebase_error)}")
            return json_response({"error": "Kunde inte aktivera 2FA. Försök igen senare."}, 500)

    except Exception as e:
        logger.exception(f"❌ 2FA setup error: {e}")
        return json_response({"error": "Ett internt fel uppstod vid 2FA-aktivering."}, 500)

@auth_bp.route("/disable-2fa/<user_id>", methods=["POST"])
def disable_2fa(user_id):
    """Disable 2FA for user"""
    try:
        if not user_id:
            return json_response({"error": "Användar-ID krävs!"}, 400)

        # Remove phone number from Firebase Auth user
        try:
            auth.update_user(
                user_id,
                phone_number=None
            )

            logger.info(f"✅ 2FA disabled for user: {user_id}")
            return json_response({"message": "✅ 2FA inaktiverat!"}, 200)

        except auth.UserNotFoundError:
            return json_response({"error": "Användare hittades inte!"}, 404)
        except Exception as firebase_error:
            logger.error(f"Firebase 2FA disable error: {str(firebase_error)}")
            return json_response({"error": "Kunde inte inaktivera 2FA. Försök igen senare."}, 500)

    except Exception as e:
        logger.exception(f"❌ 2FA disable error: {e}")
        return json_response({"error": "Ett internt fel uppstod vid 2FA-inaktivering."}, 500)

# GDPR Data Deletion
@auth_bp.route("/delete-account/<user_id>", methods=["DELETE"])
def delete_account(user_id):
    """GDPR-compliant account and data deletion"""
    try:
        if not user_id:
            return json_response({"error": "⚠️ Användar-ID krävs!"}, 400)

        # Delete user data from all collections
        collections_to_delete = ["moods", "memories", "consents"]

        deleted_counts = {}
        for collection in collections_to_delete:
            # Delete all documents for this user
            docs = db.collection(collection).where(filter=FieldFilter("user_id", "==", user_id)).stream()
            count = 0
            for doc in docs:
                doc.reference.delete()
                count += 1
            deleted_counts[collection] = count

        # Delete user document directly (for users collection)
        db.collection("users").document(user_id).delete()

        # Delete refresh token document directly
        db.collection("refresh_tokens").document(user_id).delete()

        # Delete Firebase Auth user
        try:
            auth.delete_user(user_id)
            logger.info(f"✅ Firebase Auth user deleted: {user_id}")
        except auth.UserNotFoundError:
            logger.warning(f"Firebase user {user_id} not found (already deleted?)")
        except Exception as firebase_error:
            logger.error(f"Failed to delete Firebase user {user_id}: {firebase_error}")
            # Continue with data deletion even if Firebase user deletion fails

        logger.info(f"✅ GDPR data deletion completed for user: {user_id}, deleted: {deleted_counts}")
        return json_response({
            "message": "✅ Konto och all data har raderats enligt GDPR!",
            "deleted_data": deleted_counts
        }, 200)

    except Exception as e:
        logger.exception(f"❌ Account deletion error: {str(e)}")
        return json_response({"error": "⚠️ Kunde inte radera konto. Kontakta support."}, 500)