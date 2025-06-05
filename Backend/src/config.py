import os
import logging
from datetime import timedelta
try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*args, **kwargs):
        return None

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
FIREBASE_CREDENTIALS = get_env_variable("FIREBASE_CREDENTIALS", "serviceAccountKey.json", required=True)
FIREBASE_API_KEY = get_env_variable("FIREBASE_API_KEY", required=True, hide_value=True)
FIREBASE_PROJECT_ID = get_env_variable("FIREBASE_PROJECT_ID", required=True)
FIREBASE_STORAGE_BUCKET = get_env_variable("FIREBASE_STORAGE_BUCKET", required=True)

# 🔹 Kontrollera att Firebase Credentials-filen finns och kan läsas
if not os.path.exists(FIREBASE_CREDENTIALS):
    logger.critical(f"❌ Firebase credentials-filen saknas: {FIREBASE_CREDENTIALS}")
    raise FileNotFoundError(f"Firebase credentials-filen saknas: {FIREBASE_CREDENTIALS}")

try:
    with open(FIREBASE_CREDENTIALS, "r") as f:
        f.read()  # Testa att filen är läsbar
except Exception as e:
    logger.critical(f"❌ Firebase credentials-filen kunde inte läsas: {e}")
    raise FileNotFoundError(f"Firebase credentials-filen kunde inte läsas: {e}")

# 🔹 CORS-konfiguration
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in get_env_variable("CORS_ALLOWED_ORIGINS", "http://localhost:5000,https://www.lugntrygg.se").split(",") if origin.strip()]

# 🔹 Content Security Policy (CSP)
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

# 🔹 Logga konfigurationsdetaljer (men döljer hemligheter)
logger.info(f"✅ Backend körs på port: {PORT}, Debug-läge: {DEBUG}")
logger.info(f"✅ Firebase-konfiguration laddad från: {FIREBASE_CREDENTIALS}")
logger.info(f"✅ JWT-token expiration: {ACCESS_TOKEN_EXPIRES}, Refresh expiration: {REFRESH_TOKEN_EXPIRES}")
logger.info(f"✅ Tillåtna CORS-origins: {CORS_ALLOWED_ORIGINS}")
logger.info("✅ Backend är korrekt konfigurerad men inga hemligheter visas i loggen.")

