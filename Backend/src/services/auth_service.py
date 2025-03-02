from typing import Tuple, Optional
from datetime import datetime, timezone
import logging
import jwt
from firebase_admin import auth
from src.fierbase_config import db
from src.models.user import User
from src.utils.password_utils import hash_password, verify_password
from src.config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES
)

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    def register_user(email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        try:
            # Skapa användare i Firebase Authentication
            firebase_user = auth.create_user(email=email, password=password, email_verified=False)

            # Hasha lösenordet och lagra användardata i Firestore
            hashed_password = hash_password(password)

            # Lagra användardata i Firestore
            db.collection("users").document(firebase_user.uid).set({
                "email": email,
                "password": hashed_password,
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
                "email_verified": False
            })

            # Skapa och returnera användarobjekt
            user = User(uid=firebase_user.uid, email=email, created_at=datetime.now(timezone.utc))
            return user, None

        except auth.EmailAlreadyExistsError:
            logger.warning(f"Registrering misslyckades: {email} används redan!")
            return None, "E-postadressen används redan!"
        except Exception as e:
            logger.error(f"Fel vid registrering: {str(e)}")
            return None, f"Ett internt fel uppstod vid registrering: {str(e)}"

    @staticmethod
    def login_user(email: str, password: str) -> Tuple[Optional[User], Optional[str], Optional[str], Optional[str]]:
        try:
            # Hämta användare från Firebase
            firebase_user = auth.get_user_by_email(email)
            user_ref = db.collection("users").document(firebase_user.uid).get()

            # Kontrollera om användaren finns i Firestore
            if not user_ref.exists:
                return None, "Felaktiga inloggningsuppgifter!", None, None

            # Hämta användardata och verifiera lösenord
            user_data = user_ref.to_dict()
            stored_hash = user_data.get("password")

            if not stored_hash or not verify_password(password, stored_hash):
                return None, "Felaktiga inloggningsuppgifter!", None, None

            # Uppdatera senaste inloggning i Firestore
            db.collection("users").document(firebase_user.uid).update({
                "last_login": datetime.now(timezone.utc)
            })

            # Generera access- och refresh-token
            access_token = AuthService.generate_access_token(firebase_user.uid)
            refresh_token = AuthService.generate_refresh_token(firebase_user.uid)

            # Spara refresh_token i Firestore
            db.collection("refresh_tokens").document(firebase_user.uid).set({
                "refresh_token": refresh_token,
                "created_at": datetime.now(timezone.utc)
            }, merge=True)

            # Skapa användarobjekt och returnera det tillsammans med tokens
            user = User(
                uid=firebase_user.uid,
                email=firebase_user.email,
                created_at=user_data["created_at"],
                last_login=datetime.now(timezone.utc),
                email_verified=firebase_user.email_verified or False
            )

            return user, None, access_token, refresh_token

        except auth.UserNotFoundError:
            logger.warning(f"Användare inte funnen för e-post: {email}")
            return None, "Felaktiga inloggningsuppgifter!", None, None
        except Exception as e:
            logger.error(f"Fel vid inloggning: {str(e)}")
            return None, f"Ett internt fel uppstod vid inloggning: {str(e)}", None, None

    @staticmethod
    def generate_access_token(user_id: str) -> str:
        """Generera JWT-access-token för användaren."""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRES
        }, JWT_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def generate_refresh_token(user_id: str) -> str:
        """Generera JWT-refresh-token för användaren."""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRES
        }, JWT_REFRESH_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def logout(user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Logga ut användare och ta bort deras refresh-token."""
        try:
            # Ta bort refresh-token från databasen
            db.collection("refresh_tokens").document(user_id).delete()
            logger.info(f"Användare {user_id} har loggats ut framgångsrikt.")
            return "Utloggning lyckades!", None
        except Exception as e:
            logger.error(f"Fel vid utloggning: {str(e)}")
            return None, f"Ett internt fel uppstod vid utloggning: {str(e)}"
