"""Configuration module for Lugn & Trygg Backend."""

import atexit
import json
import logging
import os
import tempfile
from datetime import timedelta
from pathlib import Path
from typing import Any, cast

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Avoid leaking runtime configuration details in production logs.
LOG_ENV_VALUES = os.getenv("LOG_ENV_VALUES", "false").strip().lower() in {"1", "true", "yes"}


def _register_temp_file_cleanup(file_path: str) -> None:
    """Ensure temporary credentials file is deleted on graceful shutdown."""

    def _cleanup() -> None:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            logger.warning("Kunde inte ta bort temporär credentials-fil vid avslut")

    atexit.register(_cleanup)


def get_env_variable(
    var_name: str,
    default: Any = None,
    required: bool = False,
    hide_value: bool = False,
    cast_type: type[Any] = str,
) -> Any:
    value = os.getenv(var_name, default)

    if required and (value is None or str(value).strip() == ""):
        logger.critical(
            f"❌ Miljövariabel '{var_name}' saknas och är obligatorisk! Kontrollera din .env-fil."
        )
        raise ValueError(f"Miljövariabel '{var_name}' saknas och är obligatorisk!")

    try:
        if cast_type is bool:
            value = str(value).strip().lower() in ["1", "true", "yes"]
        elif cast_type is int:
            value = int(str(value).strip())
        elif cast_type is float:
            value = float(str(value).strip())
        elif cast_type is str:
            value = str(value).strip()
    except ValueError as err:
        logger.critical(
            f"❌ Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}."
        )
        raise ValueError(
            f"Miljövariabel '{var_name}' har fel format och kunde inte omvandlas till {cast_type.__name__}."
        ) from err

    if LOG_ENV_VALUES:
        log_value = "***" if hide_value else value
        logger.info(f"🔹 Laddad miljövariabel: {var_name} = {log_value}")
    else:
        logger.debug("Miljövariabel laddad: %s", var_name)

    return value


PORT = cast(int, get_env_variable("PORT", 5001, cast_type=int))
DEBUG = cast(bool, get_env_variable("FLASK_DEBUG", "False", cast_type=bool))
# Cookies: secure=True only in production (HTTPS); localhost uses HTTP
COOKIE_SECURE = not DEBUG
# Cross-site frontend/backend setup (Vercel -> Render) requires SameSite=None in HTTPS production.
COOKIE_SAMESITE = "None" if COOKIE_SECURE else "Lax"

_JWT_WEAK_PATTERNS = (
    "your-jwt-secret-key-here",
    "your-jwt-refresh-secret-key-here",
    "your-secret-key",
    "change-me",
    "changeme",
    "secret-key-here",
    "placeholder",
    "insert-your",
    "example-key",
)


def _validate_jwt_key(var_name: str, value: str) -> str:
    """Reject JWT keys that are too short or contain known placeholder patterns."""
    if len(value) < 32:
        raise ValueError(
            f"{var_name} must be at least 32 characters long. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    lower = value.lower()
    for pattern in _JWT_WEAK_PATTERNS:
        if pattern in lower:
            raise ValueError(
                f"{var_name} contains a known placeholder value ('{pattern}'). "
                "Generate a strong secret: "
                "python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
    return value


JWT_SECRET_KEY = _validate_jwt_key(
    "JWT_SECRET_KEY",
    get_env_variable("JWT_SECRET_KEY", required=True, hide_value=True),
)
JWT_REFRESH_SECRET_KEY = _validate_jwt_key(
    "JWT_REFRESH_SECRET_KEY",
    get_env_variable("JWT_REFRESH_SECRET_KEY", required=True, hide_value=True),
)
ACCESS_TOKEN_EXPIRES = timedelta(
    minutes=cast(int, get_env_variable("JWT_EXPIRATION_MINUTES", 15, cast_type=int))
)
REFRESH_TOKEN_EXPIRES = timedelta(
    days=cast(int, get_env_variable("JWT_REFRESH_EXPIRATION_DAYS", 30, cast_type=int))
)

FIREBASE_WEB_API_KEY = get_env_variable("FIREBASE_WEB_API_KEY", required=True, hide_value=True)
FIREBASE_API_KEY = get_env_variable("FIREBASE_API_KEY", required=True, hide_value=True)
FIREBASE_PROJECT_ID = get_env_variable("FIREBASE_PROJECT_ID", required=True)
FIREBASE_STORAGE_BUCKET = get_env_variable("FIREBASE_STORAGE_BUCKET", required=True)

FIREBASE_CREDENTIALS_RAW = str(
    get_env_variable("FIREBASE_CREDENTIALS", "", required=False)
).strip()

FIREBASE_CREDENTIALS_PATH_OVERRIDE = os.getenv("FIREBASE_CREDENTIALS_PATH")
if FIREBASE_CREDENTIALS_PATH_OVERRIDE:
    FIREBASE_CREDENTIALS_RAW = FIREBASE_CREDENTIALS_PATH_OVERRIDE.strip()

if not FIREBASE_CREDENTIALS_RAW:
    raise ValueError(
        "FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS must be set. "
        "Refusing to start without explicit Firebase credentials source."
    )

BACKEND_ROOT = Path(__file__).resolve().parents[2]

if FIREBASE_CREDENTIALS_RAW.startswith("{"):
    try:
        creds_json = json.loads(FIREBASE_CREDENTIALS_RAW)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as tf:
            json.dump(creds_json, tf)
            FIREBASE_CREDENTIALS = tf.name
        _register_temp_file_cleanup(FIREBASE_CREDENTIALS)
        logger.info(
            "🔹 Firebase credentials laddade från JSON i miljövariabel (temporär fil skapad)"
        )
    except json.JSONDecodeError as exc:
        raise ValueError(
            "FIREBASE_CREDENTIALS innehåller ogiltig JSON. Kontrollera att värdet är en giltig service account payload."
        ) from exc
else:
    credentials_path = Path(FIREBASE_CREDENTIALS_RAW)
    if not credentials_path.is_absolute():
        credentials_path = (BACKEND_ROOT / credentials_path).resolve()

    if not credentials_path.exists():
        raise FileNotFoundError(
            "Firebase credentials-filen saknas. Se till att FIREBASE_CREDENTIALS eller FIREBASE_CREDENTIALS_PATH pekar på en giltig service-account JSON."
        )

    try:
        credentials_path.read_text(encoding="utf-8")
    except Exception as exc:
        raise RuntimeError(
            "Firebase credentials-filen kunde inte läsas. Kontrollera filens behörigheter och format."
        ) from exc

    FIREBASE_CREDENTIALS = str(credentials_path)


STRIPE_SECRET_KEY = get_env_variable("STRIPE_SECRET_KEY", required=False, hide_value=True)
STRIPE_PUBLISHABLE_KEY = get_env_variable("STRIPE_PUBLISHABLE_KEY", required=False, hide_value=True)
STRIPE_PRICE_PREMIUM = get_env_variable("STRIPE_PRICE_PREMIUM", "price_premium", required=False)
STRIPE_PRICE_PREMIUM_YEARLY = get_env_variable("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_yearly", required=False)
STRIPE_PRICE_ENTERPRISE = get_env_variable("STRIPE_PRICE_ENTERPRISE", "price_enterprise", required=False)
STRIPE_PRICE_CBT_MODULE = get_env_variable("STRIPE_PRICE_CBT_MODULE", "price_cbt_module", required=False)
STRIPE_WEBHOOK_SECRET = get_env_variable("STRIPE_WEBHOOK_SECRET", "", hide_value=True)

ENCRYPTION_KEY = get_env_variable("ENCRYPTION_KEY", required=False, hide_value=True)

# [C4] Enforce ENCRYPTION_KEY in production — must be present and not a placeholder
_is_production = os.getenv("FLASK_ENV", "production") == "production" and not DEBUG
if _is_production:
    if not ENCRYPTION_KEY:
        logger.critical(
            "[C4] ENCRYPTION_KEY is not set in production. "
            "Encrypted journal and memory data cannot be read or stored safely. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\" "
            "and set the same value as VITE_ENCRYPTION_KEY in the frontend."
        )
        raise ValueError(
            "[C4] ENCRYPTION_KEY must be set in production. "
            "Set it in Backend/.env and set VITE_ENCRYPTION_KEY to the same value in the frontend .env."
        )
    _ENC_WEAK = (
        "your-encryption-key",
        "change-me",
        "changeme",
        "placeholder",
        "example-key",
        "insert-your",
    )
    for _p in _ENC_WEAK:
        if _p in ENCRYPTION_KEY.lower():
            raise ValueError(
                f"[C4] ENCRYPTION_KEY contains a known placeholder ('{_p}'). "
                "Generate: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
    if len(ENCRYPTION_KEY) < 32:
        raise ValueError("[C4] ENCRYPTION_KEY must be at least 32 characters in production.")

_is_prod_for_frontend = os.getenv("FLASK_ENV", "production") == "production" and not DEBUG
_raw_frontend_url = get_env_variable(
    "FRONTEND_URL",
    default=None if _is_prod_for_frontend else "http://localhost:3000",
    required=False,
)

# [C5] Validate FRONTEND_URL centrally — route files import this instead of re-checking
if _is_prod_for_frontend:
    _furl = (_raw_frontend_url or "").strip()
    if not _furl or "localhost" in _furl or "127.0.0.1" in _furl or not _furl.startswith("https://"):
        logger.critical(
            "[C5] FRONTEND_URL is missing or not a valid production HTTPS URL. "
            "Backend cannot start safely. Set FRONTEND_URL in Backend/.env "
            "(e.g. FRONTEND_URL=https://lugn-trygg.vercel.app)."
        )
        raise ValueError(
            "[C5] FRONTEND_URL must be set to a production HTTPS URL (not localhost or empty). "
            "Example: FRONTEND_URL=https://lugn-trygg.vercel.app"
        )

FRONTEND_URL: str = (_raw_frontend_url or "http://localhost:3000").rstrip("/")

REDIS_HOST = get_env_variable("REDIS_HOST", "localhost")
REDIS_PORT = cast(int, get_env_variable("REDIS_PORT", 6379, cast_type=int))
REDIS_PASSWORD = get_env_variable("REDIS_PASSWORD", required=False, hide_value=True)
REDIS_DB = cast(int, get_env_variable("REDIS_DB", 0, cast_type=int))
REDIS_SSL = cast(bool, get_env_variable("REDIS_SSL", "False", cast_type=bool))
REDIS_MAX_CONNECTIONS = cast(int, get_env_variable("REDIS_MAX_CONNECTIONS", 20, cast_type=int))

CACHE_DEFAULT_TIMEOUT = cast(int, get_env_variable("CACHE_DEFAULT_TIMEOUT", 300, cast_type=int))
CACHE_API_RESPONSE_TIMEOUT = cast(int, get_env_variable("CACHE_API_RESPONSE_TIMEOUT", 600, cast_type=int))
CACHE_USER_DATA_TIMEOUT = cast(int, get_env_variable("CACHE_USER_DATA_TIMEOUT", 1800, cast_type=int))

GOOGLE_CLIENT_ID = get_env_variable("GOOGLE_CLIENT_ID", required=False, hide_value=True)

cors_origins_str = str(
    get_env_variable(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5000,https://www.lugntrygg.se",
    )
).strip()
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

is_production = os.getenv("FLASK_ENV", "development") == "production"
webauthn_rp_id = os.getenv("WEBAUTHN_RP_ID")
if is_production and not webauthn_rp_id:
    render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if render_hostname:
        webauthn_rp_id = render_hostname
        logger.warning(
            "WEBAUTHN_RP_ID saknas i produktion; använder RENDER_EXTERNAL_HOSTNAME=%s som fallback.",
            render_hostname,
        )
    else:
        logger.critical("❌ WEBAUTHN_RP_ID environment variable is required in production!")
        raise ValueError(
            "WEBAUTHN_RP_ID environment variable is required for production WebAuthn configuration. "
            "Set WEBAUTHN_RP_ID or ensure RENDER_EXTERNAL_HOSTNAME is available."
        )
WEBAUTHN_RP_ID = webauthn_rp_id or "localhost"

WEBAUTHN_RP_NAME = get_env_variable("WEBAUTHN_RP_NAME", "Lugn & Trygg", required=False)
WEBAUTHN_ORIGIN = get_env_variable("WEBAUTHN_ORIGIN", "http://localhost:3000", required=False)
if is_production and WEBAUTHN_ORIGIN == "http://localhost:3000" and WEBAUTHN_RP_ID != "localhost":
    WEBAUTHN_ORIGIN = f"https://{WEBAUTHN_RP_ID}"

MAX_FAILED_LOGIN_ATTEMPTS = cast(int, get_env_variable("MAX_FAILED_LOGIN_ATTEMPTS", 5, cast_type=int))
LOCKOUT_DURATION_MINUTES_FIRST = cast(int, get_env_variable("LOCKOUT_DURATION_MINUTES_FIRST", 5, cast_type=int))
LOCKOUT_DURATION_MINUTES_SECOND = cast(int, get_env_variable("LOCKOUT_DURATION_MINUTES_SECOND", 15, cast_type=int))
LOCKOUT_DURATION_MINUTES_THIRD = cast(int, get_env_variable("LOCKOUT_DURATION_MINUTES_THIRD", 60, cast_type=int))

CSP_DIRECTIVES = {
    "default-src": ["'self'"],
    "script-src": [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://www.gstatic.com",
        "https://www.googleapis.com",
        "https://apis.google.com",
        "https://securetoken.googleapis.com",
        "https://firebase.googleapis.com",
        "https://*.firebaseapp.com",
        "https://*.googleapis.com",
        "https://www.googletagmanager.com",
        "https://googletagmanager.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "https:", "http:", "blob:"],
    "connect-src": [
        "'self'",
        # [S5] Exclude localhost dev URLs from production CSP
        *([] if is_production else [
            "ws://localhost:3000",
            "ws://localhost:3001",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:5001",
            "http://localhost:5001",
        ]),
        "https://www.lugntrygg.se",
        "https://*.googleapis.com",
        "https://*.firebaseapp.com",
        "https://securetoken.googleapis.com",
        "https://firebase.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "wss://*.firebaseio.com",
        "https://*.firebaseio.com",
        "https://region1.google-analytics.com",
        "https://www.googletagmanager.com",
        "https://googletagmanager.com",
        "https://*.sentry.io",
        "https://o4510267243298816.ingest.de.sentry.io",
        "https://api.amplitude.com",
        "https://*.amplitude.com",
    ],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
}


class Config:
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
        self.STRIPE_PRICE_PREMIUM_YEARLY = STRIPE_PRICE_PREMIUM_YEARLY
        self.STRIPE_PRICE_ENTERPRISE = STRIPE_PRICE_ENTERPRISE
        self.STRIPE_PRICE_CBT_MODULE = STRIPE_PRICE_CBT_MODULE
        self.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET
        self.ENCRYPTION_KEY = ENCRYPTION_KEY
        self.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID
        self.CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS
        self.CSP_DIRECTIVES = CSP_DIRECTIVES
        self.WEBAUTHN_RP_ID = webauthn_rp_id or "localhost"
        self.WEBAUTHN_RP_NAME = WEBAUTHN_RP_NAME
        self.WEBAUTHN_ORIGIN = WEBAUTHN_ORIGIN
        self.MAX_FAILED_LOGIN_ATTEMPTS = MAX_FAILED_LOGIN_ATTEMPTS
        self.LOCKOUT_DURATION_MINUTES_FIRST = LOCKOUT_DURATION_MINUTES_FIRST
        self.LOCKOUT_DURATION_MINUTES_SECOND = LOCKOUT_DURATION_MINUTES_SECOND
        self.LOCKOUT_DURATION_MINUTES_THIRD = LOCKOUT_DURATION_MINUTES_THIRD
        self.REDIS_HOST = REDIS_HOST
        self.REDIS_PORT = REDIS_PORT
        self.REDIS_PASSWORD = REDIS_PASSWORD
        self.REDIS_DB = REDIS_DB
        self.REDIS_SSL = REDIS_SSL
        self.REDIS_MAX_CONNECTIONS = REDIS_MAX_CONNECTIONS
        self.CACHE_DEFAULT_TIMEOUT = CACHE_DEFAULT_TIMEOUT
        self.CACHE_API_RESPONSE_TIMEOUT = CACHE_API_RESPONSE_TIMEOUT
        self.CACHE_USER_DATA_TIMEOUT = CACHE_USER_DATA_TIMEOUT


config = Config()

logger.info(f"✅ Backend körs på port: {PORT}, Debug-läge: {DEBUG}")
logger.info("✅ Firebase-konfiguration laddad")
logger.info(
    f"✅ JWT-token expiration: {ACCESS_TOKEN_EXPIRES}, Refresh expiration: {REFRESH_TOKEN_EXPIRES}"
)
logger.info(f"✅ Tillåtna CORS-origins: {CORS_ALLOWED_ORIGINS}")
logger.info("✅ Backend är korrekt konfigurerad men inga hemligheter visas i loggen.")

# 2026-Compliant: Export both old and new config for backward compatibility
try:
    from typing import TYPE_CHECKING

    from .settings import Settings, get_settings
    from .settings import settings as new_settings
    settings = new_settings

    __all__ = ["config", "get_env_variable", "Config", "Settings", "get_settings", "settings", "new_settings"]
    if TYPE_CHECKING:
        from .settings import Settings as SettingsType
except ImportError:
    __all__ = ["config", "get_env_variable", "Config"]
