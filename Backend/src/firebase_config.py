import os
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore, storage, exceptions as firebase_admin_exceptions
from firebase_admin import auth as firebase_admin_auth_module

# 🔹 Ladda miljövariabler från .env
load_dotenv()

# 🔹 Konfigurera loggning
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_env_variable(var_name: str, default=None, required: bool = False, hide_value: bool = False, cast_type=str):
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
db: Optional[Any] = None
auth: Optional[Any] = None
firebase_admin_auth: Optional[Any] = None
firebase_storage: Optional[Any] = None
firebase_exceptions = firebase_admin_exceptions


def _firebase_initialized() -> bool:
    return bool(getattr(firebase_admin, "_apps", None))


def _bind_services() -> None:
    global db, auth, firebase_admin_auth, firebase_storage, firebase_exceptions

    db = firestore.client()
    firebase_admin_auth = firebase_admin_auth_module
    auth = firebase_admin_auth
    firebase_storage = storage
    firebase_exceptions = firebase_admin_exceptions


def initialize_firebase(force_reinitialize: bool = False) -> bool:
    global db, auth, firebase_admin_auth, firebase_storage, firebase_exceptions

    if _firebase_initialized():
        if not force_reinitialize:
            _bind_services()
            return True
        firebase_admin.delete_app(firebase_admin.get_app())

    cred_path_raw = str(get_env_variable("FIREBASE_CREDENTIALS", required=True)).strip()

    path_override = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if path_override:
        cred_path_raw = path_override.strip()

    if cred_path_raw.startswith("{"):
        import json
        import tempfile

        try:
            creds_json = json.loads(cred_path_raw)
            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
                json.dump(creds_json, tf)
                cred_path = tf.name
            logger.info("🔹 Firebase credentials från JSON env-variabel - sparad till %s", cred_path)
        except json.JSONDecodeError as exc:  # pragma: no cover - configuration error path
            raise RuntimeError(f"Invalid Firebase credentials JSON: {exc}") from exc
    else:
        cred_path = cred_path_raw
        if not os.path.isabs(cred_path):
            backend_dir = Path(__file__).resolve().parents[1]
            cred_path = str((backend_dir / cred_path).resolve())
            logger.info("🔹 Konverterade relativ sökväg till absolut: %s", cred_path)

    if not os.path.exists(cred_path):
        raise FileNotFoundError(f"Firebase credentials-filen saknas: {cred_path}")

    with open(cred_path, "r", encoding="utf-8") as fp:
        fp.read()

    cred = credentials.Certificate(cred_path)

    options: Dict[str, Any] = {}
    database_url = os.getenv("FIREBASE_DATABASE_URL")
    if database_url:
        options["databaseURL"] = database_url
    storage_bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
    if storage_bucket_name:
        options["storageBucket"] = storage_bucket_name

    firebase_admin.initialize_app(cred, options or None)
    if options:
        logger.info("🔹 Firebase initierad med extra konfiguration: %s", ", ".join(options.keys()))

    _bind_services()
    logger.info("✅ Firebase-initialisering lyckades!")
    return True


def get_firebase_services() -> Dict[str, Any]:
    if not _firebase_initialized():
        raise RuntimeError("❌ Firebase är inte initierat. Kör initialize_firebase() först.")

    return {
        "auth": auth,
        "db": db,
        "storage": firebase_storage,
    }


initialize_firebase()
services = get_firebase_services()
db = services.get("db")
auth = services.get("auth")
firebase_admin_auth = auth
firebase_storage = services.get("storage")
firebase_exceptions = firebase_admin_exceptions
logger.info("✅ Firebase-tjänster laddades framgångsrikt (live)")
