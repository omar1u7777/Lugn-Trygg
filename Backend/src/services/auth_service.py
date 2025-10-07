from typing import Tuple, Optional
from datetime import datetime, timezone
import logging
import jwt
import requests
from functools import wraps
from flask import request, jsonify
from src.utils import convert_email_to_punycode  # Flyttad till utils.py
from firebase_admin import auth, exceptions
from src.firebase_config import db
from src.models.user import User
from src.config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES,
    FIREBASE_WEB_API_KEY
)

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    def register_user(email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """Registrerar en ny användare i Firebase Authentication"""
        try:
            # Skapa användare i Firebase Authentication
            firebase_user = auth.create_user(email=email, password=password)
            
            # Konvertera e-post till Punycode
            punycode_email = convert_email_to_punycode(email)

            # Spara användardata i Firestore
            user_data = {
                "email": email,
                "email_punycode": punycode_email,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": None
            }

            db.collection("users").document(firebase_user.uid).set(user_data)

            user = User(uid=firebase_user.uid, email=email)
            logger.info(f"✅ Användare registrerad med UID: {firebase_user.uid}")
            return user, None

        except auth.EmailAlreadyExistsError:
            logger.warning(f"🚨 Registrering misslyckades: E-postadressen används redan!")
            return None, "E-postadressen används redan!"
        except Exception as e:
            logger.exception(f"🔥 Fel vid registrering: {str(e)}")
            return None, f"Ett internt fel uppstod vid registrering: {str(e)}"

    @staticmethod
    def login_user(email: str, password: str) -> Tuple[Optional[User], Optional[str], Optional[str], Optional[str]]:
        """Verifierar lösenordet och genererar tokens"""
        try:
            # Skicka POST-request till Firebase för att verifiera lösenordet
            verify_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
            response = requests.post(verify_url, json={"email": email, "password": password, "returnSecureToken": True})

            if response.status_code != 200:
                logger.warning(f"🚨 Felaktiga inloggningsuppgifter för e-post")
                return None, "Felaktiga inloggningsuppgifter!", None, None

            response_data = response.json()
            firebase_id_token = response_data.get("idToken")
            refresh_token = response_data.get("refreshToken")

            # Hämta användardata från Firebase Authentication
            user_record = auth.get_user_by_email(email)

            # Uppdatera senaste inloggningstid i Firestore
            db.collection("users").document(user_record.uid).set({
                "last_login": datetime.now(timezone.utc).isoformat()
            }, merge=True)

            # Generera JWT access-token
            access_token = AuthService.generate_access_token(user_record.uid)

            # Spara Firebase refresh-token i Firestore
            db.collection("refresh_tokens").document(user_record.uid).set({
                "firebase_refresh_token": refresh_token,
                "created_at": datetime.now(timezone.utc).isoformat()
            }, merge=True)

            user = User(uid=user_record.uid, email=user_record.email)
            logger.info(f"✅ Inloggning lyckades för användare med UID: {user_record.uid}")
            return user, None, access_token, refresh_token

        except auth.UserNotFoundError:
            logger.warning(f"🚨 Användare ej funnen")
            return None, "Felaktiga inloggningsuppgifter!", None, None
        except exceptions.FirebaseError as e:
            logger.exception(f"🔥 Firebase-fel vid inloggning: {str(e)}")
            return None, "Problem med autentiseringstjänsten. Försök igen senare.", None, None
        except Exception as e:
            logger.exception(f"🔥 Okänt fel vid inloggning: {str(e)}")
            return None, f"Ett internt fel uppstod vid inloggning: {str(e)}", None, None

    @staticmethod
    def refresh_token(user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Förnyar access-token med hjälp av refresh-token"""
        try:
            # Hämta refresh-token från Firestore
            refresh_doc = db.collection("refresh_tokens").document(user_id).get()
            if not refresh_doc.exists:
                logger.warning(f"⛔ Ingen refresh-token hittades för UID: {user_id}")
                return None, "Ogiltigt refresh-token!"

            refresh_data = refresh_doc.to_dict()
            firebase_refresh_token = refresh_data.get("firebase_refresh_token")

            # Försök att förnya access-token via Firebase REST API
            refresh_url = f"https://securetoken.googleapis.com/v1/token?key={FIREBASE_WEB_API_KEY}"
            refresh_response = requests.post(refresh_url, json={"grant_type": "refresh_token", "refresh_token": firebase_refresh_token})

            if refresh_response.status_code != 200:
                logger.warning(f"⛔ Refresh-token ogiltig för UID: {user_id}")
                return None, "Ogiltigt refresh-token!"

            refresh_data = refresh_response.json()
            new_id_token = refresh_data.get("id_token")

            # Generera ett nytt JWT access-token
            new_access_token = AuthService.generate_access_token(user_id)

            return new_access_token, None

        except Exception as e:
            logger.exception(f"🔥 Fel vid förnyelse av token: {str(e)}")
            return None, "Ett internt fel uppstod vid token-förnyelse."

    @staticmethod
    def generate_access_token(user_id: str) -> str:
        """Genererar JWT access-token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRES
        }, JWT_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def generate_refresh_token(user_id: str) -> str:
        """Genererar JWT refresh-token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRES
        }, JWT_REFRESH_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def logout(user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Tar bort refresh-token vid utloggning"""
        try:
            db.collection("refresh_tokens").document(user_id).delete()
            logger.info(f"✅ Användare med UID: {user_id} har loggats ut framgångsrikt.")
            return "Utloggning lyckades!", None
        except Exception as e:
            logger.exception(f"🔥 Fel vid utloggning: {str(e)}")
            return None, f"Ett internt fel uppstod vid utloggning: {str(e)}"

    @staticmethod
    def verify_token(token: str) -> Tuple[Optional[str], Optional[str]]:
        """Verifierar JWT-token och returnerar user_id om giltig"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                return None, "Ogiltigt token-innehåll!"
            return user_id, None
        except jwt.ExpiredSignatureError:
            return None, "Token har gått ut!"
        except jwt.InvalidTokenError:
            return None, "Ogiltigt token!"
        except Exception as e:
            logger.exception(f"🔥 Fel vid token-verifiering: {str(e)}")
            return None, "Ett internt fel uppstod vid token-verifiering."

    @staticmethod
    def jwt_required(f):
        """Dekorator för att kräva giltig JWT-token"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"error": "Authorization header saknas eller är ogiltig!"}), 401

            token = auth_header.split(" ")[1]
            user_id, error = AuthService.verify_token(token)
            if error:
                return jsonify({"error": error}), 401

            # Lägg till user_id i request context
            request.user_id = user_id
            return f(*args, **kwargs)
        return decorated_function