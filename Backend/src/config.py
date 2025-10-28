"""
Configuration module for Lugn & Trygg Backend
Centralized configuration management with environment variable loading
"""

import os
import logging
from datetime import timedelta
from dotenv import load_dotenv
import json
import tempfile

# 🔹 Ladda miljövariabler från .env-filen
load_dotenv()

# 🔹 Konfigurera logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def get_env_variable(var_name: str, default=None, required=False, hide_value=False, cast_type=str):
    """
    Hämtar en miljövariabel och kastar fel om den saknas (om `required=True`).

    Args:
        var_name (str): Namnet på miljövariabeln.
        default: Standardvärde om variabeln saknas.
        required (bool): Om True kastas ett fel om variabeln saknas.
        hide_value (bool): Om True loggas inte värdet av variabeln.
        cast_type (type): Datatyp som variabeln ska omvandlas till.

    Returns:
        cast_type: Värdet av miljövariabeln i angiven datatyp.
    """
    value = os.getenv(var_name, default)

    if required and (value is None or str(value).strip() == ""):
        logger.critical(f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk! Kontrollera din .env-fil.")
        raise ValueError(f"Miljövariabel '{var_name}' saknas och är obligatorisk!")

    try:
        if cast_type == bool:
            value = str(value).strip().lower() in ["1", "true", "yes"]
        elif cast_type == int:
            value = int(str(value).strip())
        elif cast_type == float:
            value = float(str(value).strip())
        elif cast_type == str:
            value = str(value).strip()
    except ValueError:
        logger.critical(f"❌ Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}.")
        raise ValueError(f"Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}.")

    # Logga inte känsliga värden
    log_value = "***" if hide_value else value
    logger.info(f"🔹 Laddad miljövariabel: {var_name} = {log_value}")

    return value

# 🔹 Serverkonfiguration
PORT = get_env_variable("PORT", 5001, cast_type=int)
DEBUG = get_env_variable("FLASK_DEBUG", "False", cast_type=bool)

# 🔹 JWT-konfiguration
JWT_SECRET_KEY = get_env_variable("JWT_SECRET_KEY", required=True, hide_value=True)
JWT_REFRESH_SECRET_KEY = get_env_variable("JWT_REFRESH_SECRET_KEY", required=True, hide_value=True)
ACCESS_TOKEN_EXPIRES = timedelta(minutes=get_env_variable("JWT_EXPIRATION_MINUTES", 15, cast_type=int))
REFRESH_TOKEN_EXPIRES = timedelta(days=get_env_variable("JWT_REFRESH_EXPIRATION_DAYS", 360, cast_type=int))

# 🔹 Firebase-konfiguration
FIREBASE_WEB_API_KEY = get_env_variable("FIREBASE_WEB_API_KEY", required=True, hide_value=True)
FIREBASE_API_KEY = get_env_variable("FIREBASE_API_KEY", required=True, hide_value=True)
FIREBASE_PROJECT_ID = get_env_variable("FIREBASE_PROJECT_ID", required=True)
FIREBASE_STORAGE_BUCKET = get_env_variable("FIREBASE_STORAGE_BUCKET", required=True)

# 🔹 Firebase Credentials - kan vara filepath ELLER JSON string från env
FIREBASE_CREDENTIALS_RAW = get_env_variable("FIREBASE_CREDENTIALS", "serviceAccountKey.json", required=True)
FIREBASE_CREDENTIALS_RAW = str(FIREBASE_CREDENTIALS_RAW).strip()  # Konvertera till string

# Om det är en JSON string (från Render env), spara som tempfil; annars använd filepath
if FIREBASE_CREDENTIALS_RAW.startswith("{"):
    # Det är JSON - skriv till temp-fil
    try:
        creds_json = json.loads(FIREBASE_CREDENTIALS_RAW)
        # Skriv till tempfil som Firebase kan läsa
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tf:
            json.dump(creds_json, tf)
            FIREBASE_CREDENTIALS = tf.name
        logger.info(f"🔹 Firebase credentials från JSON env-variabel - sparad till {FIREBASE_CREDENTIALS}")
    except json.JSONDecodeError as e:
        logger.error(f"❌ Kunde inte parse Firebase credentials JSON: {e}")
        FIREBASE_CREDENTIALS = FIREBASE_CREDENTIALS_RAW
else:
    # Det är en filepath
    FIREBASE_CREDENTIALS = FIREBASE_CREDENTIALS_RAW
    if not os.path.exists(FIREBASE_CREDENTIALS):
        logger.warning(f"⚠️ Firebase credentials-filen saknas: {FIREBASE_CREDENTIALS}. Backend kommer köra i begränsad dev-läge.")
    else:
        try:
            with open(FIREBASE_CREDENTIALS, "r") as f:
                f.read()  # Testa att filen är läsbar
        except Exception as e:
            logger.warning(f"⚠️ Firebase credentials-filen kunde inte läsas: {e}. Backend kommer köra i begränsad dev-läge.")

# 🔹 Stripe-konfiguration
STRIPE_SECRET_KEY = get_env_variable("STRIPE_SECRET_KEY", required=False, hide_value=True)
STRIPE_PUBLISHABLE_KEY = get_env_variable("STRIPE_PUBLISHABLE_KEY", required=False, hide_value=True)
STRIPE_PRICE_PREMIUM = get_env_variable("STRIPE_PRICE_PREMIUM", "price_premium", required=False)
STRIPE_PRICE_ENTERPRISE = get_env_variable("STRIPE_PRICE_ENTERPRISE", "price_enterprise", required=False)
STRIPE_PRICE_CBT_MODULE = get_env_variable("STRIPE_PRICE_CBT_MODULE", "price_cbt_module", required=False)
STRIPE_WEBHOOK_SECRET = get_env_variable("STRIPE_WEBHOOK_SECRET", "", hide_value=True)  # Optional for development

# 🔹 Krypteringskonfiguration
ENCRYPTION_KEY = get_env_variable("ENCRYPTION_KEY", required=False, hide_value=True)

# 🔹 Google OAuth-konfiguration
GOOGLE_CLIENT_ID = get_env_variable("GOOGLE_CLIENT_ID", required=False, hide_value=True)

# 🔹 CORS-konfiguration
cors_origins_str = str(get_env_variable("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5000,https://www.lugntrygg.se")).strip()
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# 🔹 Content Security Policy (CSP)
CSP_DIRECTIVES = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://www.gstatic.com", "https://www.googleapis.com", "https://apis.google.com", "https://securetoken.googleapis.com", "https://firebase.googleapis.com", "https://*.firebaseapp.com", "https://*.googleapis.com", "https://www.googletagmanager.com", "https://googletagmanager.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "https:", "http:", "blob:"],
    "connect-src": ["'self'", "ws://localhost:3000", "ws://localhost:3001", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:5001", "http://localhost:5001", "https://www.lugntrygg.se", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://securetoken.googleapis.com", "https://firebase.googleapis.com", "https://identitytoolkit.googleapis.com", "wss://*.firebaseio.com", "https://*.firebaseio.com", "https://region1.google-analytics.com", "https://www.googletagmanager.com", "https://googletagmanager.com", "https://*.sentry.io", "https://o4510267243298816.ingest.de.sentry.io", "https://api.amplitude.com", "https://*.amplitude.com"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
}

# 🔹 Create a config object for easy importing
class Config:
    """Configuration object for easy access to all settings"""

    def __init__(self):
        self.PORT = PORT
        self.DEBUG = DEBUG
        self.JWT_SECRET_KEY = JWT_SECRET_KEY
        self.JWT_REFRESH_SECRET_KEY = JWT_REFRESH_SECRET_KEY
        self.ACCESS_TOKEN_EXPIRES = ACCESS_TOKEN_EXPIRES
        self.REFRESH_TOKEN_EXPIRES = REFRESH_TOKEN_EXPIRES
        self.FIREBASE_WEB_API_KEY = FIREBASE_WEB_API_KEY
        self.FIREBASE_API_KEY = FIREBASE_API_KEY
        self.FIREBASE_PROJECT_ID = FIREBASE_PROJECT_ID
        self.FIREBASE_STORAGE_BUCKET = FIREBASE_STORAGE_BUCKET
        self.FIREBASE_CREDENTIALS = FIREBASE_CREDENTIALS
        self.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY
        self.STRIPE_PUBLISHABLE_KEY = STRIPE_PUBLISHABLE_KEY
        self.STRIPE_PRICE_PREMIUM = STRIPE_PRICE_PREMIUM
        self.STRIPE_PRICE_ENTERPRISE = STRIPE_PRICE_ENTERPRISE
        self.STRIPE_PRICE_CBT_MODULE = STRIPE_PRICE_CBT_MODULE
        self.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET
        self.ENCRYPTION_KEY = ENCRYPTION_KEY
        self.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID
        self.CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS
        self.CSP_DIRECTIVES = CSP_DIRECTIVES

# Create global config instance
config = Config()

# 🔹 Logga konfigurationsdetaljer (men döljer hemligheter)
logger.info(f"✅ Backend körs på port: {PORT}, Debug-läge: {DEBUG}")
logger.info(f"✅ Firebase-konfiguration laddad från: {FIREBASE_CREDENTIALS}")
logger.info(f"✅ JWT-token expiration: {ACCESS_TOKEN_EXPIRES}, Refresh expiration: {REFRESH_TOKEN_EXPIRES}")
logger.info(f"✅ Tillåtna CORS-origins: {CORS_ALLOWED_ORIGINS}")
logger.info("✅ Backend är korrekt konfigurerad men inga hemligheter visas i loggen.")

# Export the config object
__all__ = ['config', 'get_env_variable']
