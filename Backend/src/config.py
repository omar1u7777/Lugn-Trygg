import os
import logging
from datetime import timedelta
from dotenv import load_dotenv

#  Ladda miljövariabler från .env-filen
load_dotenv()

#  Konfigurera logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def get_env_variable(var_name: str, default=None, required=False):
    """
    Hämtar en miljövariabel och kastar fel om den saknas (om `required=True`).
    
    Args:
        var_name (str): Namnet på miljövariabeln.
        default: Standardvärde om variabeln saknas.
        required (bool): Om True kastas ett fel om variabeln saknas.

    Returns:
        str: Värdet av miljövariabeln.
    """
    value = os.getenv(var_name, default)
    if required and not value:
        logger.error(f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk!")
        raise ValueError(f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk!")
    return value

#  Serverkonfiguration
PORT = int(get_env_variable("PORT", 5001))
DEBUG = get_env_variable("FLASK_DEBUG", "True").lower() == "true"

#  JWT-konfiguration
JWT_SECRET_KEY = get_env_variable("JWT_SECRET_KEY", required=True)
JWT_REFRESH_SECRET_KEY = get_env_variable("JWT_REFRESH_SECRET_KEY", required=True)
ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(get_env_variable("JWT_EXPIRATION_MINUTES", 15)))
REFRESH_TOKEN_EXPIRES = timedelta(days=int(get_env_variable("JWT_REFRESH_EXPIRATION_DAYS", 360)))

#  Firebase-konfiguration
FIREBASE_CREDENTIALS = get_env_variable("FIREBASE_CREDENTIALS", "serviceAccountKey.json", required=True)
FIREBASE_API_KEY = get_env_variable("FIREBASE_API_KEY", required=True)
FIREBASE_PROJECT_ID = get_env_variable("FIREBASE_PROJECT_ID", required=True)
FIREBASE_STORAGE_BUCKET = get_env_variable("FIREBASE_STORAGE_BUCKET", required=True)

#  CORS-konfiguration
FRONTEND_URL = get_env_variable("FRONTEND_URL", "http://localhost:5000")
CORS_ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "https://www.lugntrygg.se",  # Lägg till produktions-frontend
]

#  Content Security Policy (CSP)
CSP_DIRECTIVES = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "https://apis.google.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "https://www.lugntrygg.se"],
    "connect-src": ["'self'", "http://localhost:5001", "https://www.lugntrygg.se"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
}

# Säkerställ att alla kritiska variabler är korrekt definierade
logger.info(f"✅ Backend körs på port: {PORT}, Debug-läge: {DEBUG}")
logger.info(f"✅ Firebase-konfiguration laddad från: {FIREBASE_CREDENTIALS}")
logger.info(f"✅ JWT-konfiguration (expiration: {ACCESS_TOKEN_EXPIRES}, refresh expiration: {REFRESH_TOKEN_EXPIRES})")
logger.info(f"✅ Tillåtna CORS-origins: {CORS_ALLOWED_ORIGINS}")

# Säkerställ att hemligheter inte loggas
logger.info("✅ Backend är korrekt konfigurerad men inga hemligheter visas i loggen.")
